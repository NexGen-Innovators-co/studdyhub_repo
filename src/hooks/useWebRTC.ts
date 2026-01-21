// useWebRTC.ts - Hook for managing WebRTC peer connections for live audio streaming
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

interface WebRTCConfig {
  podcastId: string;
  isHost: boolean;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onRemoteStream?: (stream: MediaStream) => void;
}

interface PeerConnection {
  userId: string;
  connection: RTCPeerConnection;
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];
export const useWebRTC = ({
  podcastId,
  isHost,
  onConnectionStateChange,
  onRemoteStream
}: WebRTCConfig) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor' | 'disconnected'>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);

  const peerConnectionsRef = useRef<Map<string, PeerConnection>>(new Map());
  const signalingChannelRef = useRef<RealtimeChannel | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingIceCandidatesRef = useRef<Map<string, RTCIceCandidate[]>>(new Map());
  const pendingListenersRef = useRef<Set<string>>(new Set());

  // Initialize WebRTC
  useEffect(() => {
    initializeWebRTC();

    return () => {
      cleanup();
    };
  }, [podcastId, isHost]);

  // Handle pending listeners when host stream becomes available
  useEffect(() => {
    if (isHost && localStream && pendingListenersRef.current.size > 0) {
      pendingListenersRef.current.forEach(listenerId => {
        createOfferForListener(listenerId);
      });
      pendingListenersRef.current.clear();
    }
  }, [localStream, isHost]);

  // Periodically re-announce presence if not connected (for listeners)
  useEffect(() => {
    if (isHost || isConnected) return;

    const interval = setInterval(() => {
      if (signalingChannelRef.current && currentUserIdRef.current) {
        signalingChannelRef.current.send({
          type: 'broadcast',
          event: 'listener-joined',
          payload: { userId: currentUserIdRef.current }
        });
      }
    }, 10000); // Increased to 10s to avoid interrupting handshake

    return () => clearInterval(interval);
  }, [isHost, isConnected]);

  const initializeWebRTC = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      currentUserIdRef.current = user.id;

      // Set up signaling channel
      setupSignalingChannel();

      // If host, start capturing audio
      if (isHost) {
        await startBroadcasting();
      }
    } catch (err: any) {
      //console.error('Error initializing WebRTC:', err);
      setError(err.message);
    }
  };

  const setupSignalingChannel = () => {
    const channel = supabase.channel(`podcast-webrtc-${podcastId}`, {
      config: {
        broadcast: { ack: true }
      }
    });

    signalingChannelRef.current = channel;

    channel
      .on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (payload.to === currentUserIdRef.current) {
          await handleOffer(payload);
        }
      })
      .on('broadcast', { event: 'answer' }, async ({ payload }) => {
        if (payload.to === currentUserIdRef.current) {
          await handleAnswer(payload);
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (payload.to === currentUserIdRef.current) {
          await handleIceCandidate(payload);
        }
      })
      .on('broadcast', { event: 'listener-joined' }, async ({ payload }) => {
        if (isHost && payload.userId !== currentUserIdRef.current) {
          if (localStreamRef.current) {
            await createOfferForListener(payload.userId);
          } else {
            pendingListenersRef.current.add(payload.userId);
          }
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Announce presence
          if (!isHost) {
            channel.send({
              type: 'broadcast',
              event: 'listener-joined',
              payload: { userId: currentUserIdRef.current }
            });
          }
        }
      });
  };

  const startBroadcasting = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      setLocalStream(stream);
      localStreamRef.current = stream;
      setIsConnected(true);
      setConnectionQuality('excellent');

      // Start recording the audio stream
      if (isHost) {
        startRecording(stream);
      }

      return stream;
    } catch (err: any) {
      //console.error('Error accessing microphone:', err);
      setError('Failed to access microphone. Please grant permission.');
      throw err;
    }
  };

  const startRecording = (stream: MediaStream) => {
    try {
      const options = { mimeType: 'audio/webm;codecs=opus' };
      const mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(1000); // Collect data every second
      mediaRecorderRef.current = mediaRecorder;
    } catch (err) {
      //console.error('Error starting recording:', err);
    }
  };

  const stopRecording = async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current) {
        resolve(null);
        return;
      }

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setRecordedChunks(audioChunksRef.current);
        resolve(audioBlob);
      };

      mediaRecorderRef.current.stop();
    });
  };

  const createPeerConnection = (userId: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Monitor connection state
    pc.onconnectionstatechange = () => {
      onConnectionStateChange?.(pc.connectionState);

      // Only update global isConnected state for listeners
      // For hosts, isConnected means "broadcasting" and is managed by start/stopBroadcasting
      if (!isHost) {
        switch (pc.connectionState) {
          case 'connected':
            setIsConnected(true);
            setConnectionQuality('excellent');
            break;
          case 'disconnected':
            setConnectionQuality('poor');
            setIsConnected(false);
            break;
          case 'failed':
            setConnectionQuality('disconnected');
            setIsConnected(false);
            break;
          case 'connecting':
            setConnectionQuality('poor');
            break;
        }
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && signalingChannelRef.current) {
        signalingChannelRef.current.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: {
            candidate: event.candidate.toJSON(),
            from: currentUserIdRef.current,
            to: userId
          }
        });
      }
    };

    // Handle remote stream (for listeners)
    pc.ontrack = (event) => {
      // Ensure the track is enabled
      event.track.enabled = true;

      if (event.streams && event.streams[0]) {
        onRemoteStream?.(event.streams[0]);
      } else {
        const newStream = new MediaStream([event.track]);
        onRemoteStream?.(newStream);
      }
    };

    // Monitor ICE connection state
    pc.oniceconnectionstatechange = () => {
      if (!isHost) {
        switch (pc.iceConnectionState) {
          case 'checking':
            setConnectionQuality('poor');
            break;
          case 'connected':
          case 'completed':
            setConnectionQuality('excellent');
            break;
          case 'disconnected':
            setConnectionQuality('poor');
            setIsConnected(false);
            break;
          case 'failed':
            setConnectionQuality('disconnected');
            setIsConnected(false);
            // Attempt to reconnect
            pc.restartIce();
            break;
        }
      }
    };

    return pc;
  };

  const createOfferForListener = async (listenerId: string) => {
    try {
      const stream = localStreamRef.current;
      if (!stream) {
        return;
      }

      // Close existing connection if any to avoid leaks and conflicts
      const existingPeer = peerConnectionsRef.current.get(listenerId);
      if (existingPeer) {
        const state = existingPeer.connection.connectionState;
        if (state === 'connected' || state === 'connecting') {
          return;
        }
        existingPeer.connection.close();
      }

      const pc = createPeerConnection(listenerId);

      // Add local tracks to peer connection
      stream.getTracks().forEach(track => {
        track.enabled = true; // Ensure track is enabled before adding
        pc.addTrack(track, stream);
      });

      peerConnectionsRef.current.set(listenerId, {
        userId: listenerId,
        connection: pc
      });

      // Create and send offer
      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false
      });
      await pc.setLocalDescription(offer);

      if (signalingChannelRef.current) {
        signalingChannelRef.current.send({
          type: 'broadcast',
          event: 'offer',
          payload: {
            offer,
            from: currentUserIdRef.current,
            to: listenerId
          }
        });
      }
    } catch (err) {
      //console.error('Error creating offer:', err);
    }
  };

  const handleOffer = async (payload: any) => {
    try {
      // Close existing connection if any
      const existingPeer = peerConnectionsRef.current.get(payload.from);
      if (existingPeer) {
        const state = existingPeer.connection.connectionState;
        if (state === 'connected' || state === 'connecting') {
          return;
        }
        existingPeer.connection.close();
      }

      const pc = createPeerConnection(payload.from);
      peerConnectionsRef.current.set(payload.from, {
        userId: payload.from,
        connection: pc
      });

      await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
      await applyPendingIceCandidates(payload.from, pc);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (signalingChannelRef.current) {
        signalingChannelRef.current.send({
          type: 'broadcast',
          event: 'answer',
          payload: {
            answer,
            from: currentUserIdRef.current,
            to: payload.from
          }
        });
      }
    } catch (err) {
      //console.error('Error handling offer:', err);
    }
  };

  const handleAnswer = async (payload: any) => {
    try {
      const peer = peerConnectionsRef.current.get(payload.from);
      if (peer) {
        await peer.connection.setRemoteDescription(new RTCSessionDescription(payload.answer));
        await applyPendingIceCandidates(payload.from, peer.connection);
      }
    } catch (err) {
      //console.error('Error handling answer:', err);
    }
  };

  const handleIceCandidate = async (payload: any) => {
    try {
      const peer = peerConnectionsRef.current.get(payload.from);
      if (peer && peer.connection.remoteDescription) {
        await peer.connection.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } else {
        // Buffer candidate if peer connection not ready or remote description not set
        const candidates = pendingIceCandidatesRef.current.get(payload.from) || [];
        candidates.push(new RTCIceCandidate(payload.candidate));
        pendingIceCandidatesRef.current.set(payload.from, candidates);
      }
    } catch (err) {
      //console.error('Error handling ICE candidate:', err);
    }
  };

  const applyPendingIceCandidates = async (userId: string, pc: RTCPeerConnection) => {
    const candidates = pendingIceCandidatesRef.current.get(userId);
    if (candidates && pc.remoteDescription) {
      for (const candidate of candidates) {
        try {
          await pc.addIceCandidate(candidate);
        } catch (e) {
          //console.error('Error adding buffered ICE candidate:', e);
        }
      }
      pendingIceCandidatesRef.current.delete(userId);
    }
  };

  const toggleMute = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, [localStream]);

  const stopBroadcasting = useCallback(async () => {
    let audioBlob: Blob | null = null;

    // Stop recording and get the recorded audio
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      audioBlob = await stopRecording();
    }

    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
      localStreamRef.current = null;
    }
    setIsConnected(false);

    return audioBlob;
  }, [localStream]);

  const cleanup = () => {
    // Close all peer connections
    peerConnectionsRef.current.forEach(({ connection }) => {
      connection.close();
    });
    peerConnectionsRef.current.clear();

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    // Unsubscribe from signaling channel
    if (signalingChannelRef.current) {
      signalingChannelRef.current.unsubscribe();
    }

    pendingIceCandidatesRef.current.clear();
    pendingListenersRef.current.clear();

    setIsConnected(false);
  };

  return {
    localStream,
    isConnected,
    isMuted,
    connectionQuality,
    error,
    recordedChunks,
    toggleMute,
    stopBroadcasting,
    startBroadcasting
  };
};
