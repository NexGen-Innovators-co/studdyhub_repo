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
//   Add TURN servers for production
  {
    urls: 'turn:your-turn-server.com:3478',
    username: 'username',
    credential: 'password'
  }
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

  // Initialize WebRTC
  useEffect(() => {
    initializeWebRTC();

    return () => {
      cleanup();
    };
  }, [podcastId, isHost]);

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
      console.error('Error initializing WebRTC:', err);
      setError(err.message);
    }
  };

  const setupSignalingChannel = () => {
    const channel = supabase.channel(`podcast-webrtc-${podcastId}`);

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
          await createOfferForListener(payload.userId);
        }
      })
      .subscribe();

    signalingChannelRef.current = channel;

    // Announce presence
    if (!isHost) {
      channel.send({
        type: 'broadcast',
        event: 'listener-joined',
        payload: { userId: currentUserIdRef.current }
      });
    }
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
      setIsConnected(true);
      setConnectionQuality('excellent');

      // Start recording the audio stream
      if (isHost) {
        startRecording(stream);
      }

      return stream;
    } catch (err: any) {
      console.error('Error accessing microphone:', err);
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
      
      console.log('Started recording audio');
    } catch (err) {
      console.error('Error starting recording:', err);
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
      console.log(`Connection state for ${userId}:`, pc.connectionState);
      onConnectionStateChange?.(pc.connectionState);

      switch (pc.connectionState) {
        case 'connected':
          setIsConnected(true);
          setConnectionQuality('excellent');
          break;
        case 'disconnected':
        case 'failed':
          setConnectionQuality('disconnected');
          break;
        case 'connecting':
          setConnectionQuality('poor');
          break;
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && signalingChannelRef.current) {
        signalingChannelRef.current.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: {
            candidate: event.candidate,
            from: currentUserIdRef.current,
            to: userId
          }
        });
      }
    };

    // Handle remote stream (for listeners)
    pc.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind);
      if (event.streams[0]) {
        onRemoteStream?.(event.streams[0]);
      }
    };

    // Monitor ICE connection state
    pc.oniceconnectionstatechange = () => {
      console.log(`ICE state for ${userId}:`, pc.iceConnectionState);
      
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
          break;
        case 'failed':
          setConnectionQuality('disconnected');
          // Attempt to reconnect
          pc.restartIce();
          break;
      }
    };

    return pc;
  };

  const createOfferForListener = async (listenerId: string) => {
    try {
      if (!localStream) return;

      const pc = createPeerConnection(listenerId);
      
      // Add local tracks to peer connection
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });

      peerConnectionsRef.current.set(listenerId, {
        userId: listenerId,
        connection: pc
      });

      // Create and send offer
      const offer = await pc.createOffer();
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
      console.error('Error creating offer:', err);
    }
  };

  const handleOffer = async (payload: any) => {
    try {
      const pc = createPeerConnection(payload.from);
      peerConnectionsRef.current.set(payload.from, {
        userId: payload.from,
        connection: pc
      });

      await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));

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
      console.error('Error handling offer:', err);
    }
  };

  const handleAnswer = async (payload: any) => {
    try {
      const peer = peerConnectionsRef.current.get(payload.from);
      if (peer) {
        await peer.connection.setRemoteDescription(new RTCSessionDescription(payload.answer));
      }
    } catch (err) {
      console.error('Error handling answer:', err);
    }
  };

  const handleIceCandidate = async (payload: any) => {
    try {
      const peer = peerConnectionsRef.current.get(payload.from);
      if (peer && payload.candidate) {
        await peer.connection.addIceCandidate(new RTCIceCandidate(payload.candidate));
      }
    } catch (err) {
      console.error('Error handling ICE candidate:', err);
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
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }

    // Unsubscribe from signaling channel
    if (signalingChannelRef.current) {
      signalingChannelRef.current.unsubscribe();
    }

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
