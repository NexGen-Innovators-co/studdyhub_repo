// useWebRTC.ts - Fixed version for live audio streaming
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

interface WebRTCConfig {
  podcastId: string;
  isHost: boolean;
  isCohost?: boolean;
  enableVideo?: boolean;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  onParticipantJoined?: (userId: string, stream: MediaStream) => void;
  onParticipantLeft?: (userId: string) => void;
  onPermissionRequest?: (userId: string, requestType: 'speak' | 'cohost') => void;
  onPermissionGranted?: (userId: string, requestType: 'speak' | 'cohost') => void;
  onPermissionRevoked?: (userId: string) => void;
}

interface PeerConnection {
  userId: string;
  connection: RTCPeerConnection;
  stream?: MediaStream;
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

const DEBUG = true;
const log = (...args: any[]) => {
  if (DEBUG) {
    // console.log('[WebRTC]', ...args);
  }
};

export const useWebRTC = ({
  podcastId,
  isHost,
  isCohost = false,
  enableVideo = false,
  onConnectionStateChange,
  onRemoteStream,
  onParticipantJoined,
  onParticipantLeft,
  onPermissionRequest,
  onPermissionGranted,
  onPermissionRevoked
}: WebRTCConfig) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor' | 'disconnected'>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [participants, setParticipants] = useState<Map<string, { stream: MediaStream; isSpeaking: boolean; isMuted: boolean }>>(new Map());
  const [permissionRequests, setPermissionRequests] = useState<Array<{userId: string, requestType: 'speak' | 'cohost', timestamp: number}>>([]);
  const [isCohostMode, setIsCohostMode] = useState(isCohost);

  const peerConnectionsRef = useRef<Map<string, PeerConnection>>(new Map());
  const signalingChannelRef = useRef<RealtimeChannel | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingMimeRef = useRef<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingIceCandidatesRef = useRef<Map<string, RTCIceCandidate[]>>(new Map());
  const pendingListenersRef = useRef<Set<string>>(new Set());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef<Map<string, AnalyserNode>>(new Map());

  // Initialize WebRTC
  useEffect(() => {
    initializeWebRTC();

    return () => {
      cleanup();
    };
  }, [podcastId, isHost, isCohost]);

  // Handle pending listeners when host stream becomes available
  useEffect(() => {
    if ((isHost || isCohostMode) && localStream && pendingListenersRef.current.size > 0) {
      log('Processing pending listeners:', pendingListenersRef.current.size);
      pendingListenersRef.current.forEach(listenerId => {
        createOfferForListener(listenerId);
      });
      pendingListenersRef.current.clear();
    }
  }, [localStream, isHost, isCohostMode]);

  const initializeWebRTC = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      currentUserIdRef.current = user.id;
      log('Initializing WebRTC for user:', user.id, 'isHost:', isHost, 'isCohost:', isCohost);

      // Check if user is co-host
      if (isCohost) {
        const { data: cohostData } = await supabase
          .from('podcast_cohosts')
          .select('*')
          .eq('podcast_id', podcastId)
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single();
        
        if (cohostData) {
          setIsCohostMode(true);
          log('User is a co-host');
        }
      }

      // Set up signaling channel
      setupSignalingChannel();

      // Wait briefly for the signaling channel to become subscribed to avoid
      // starting broadcasting before the channel is ready (prevents race with captions/start)
      const waitForSubscribed = async (timeout = 3000) => {
        const start = Date.now();
        while (Date.now() - start < timeout) {
          const ch: any = signalingChannelRef.current;
          if (ch && ch.state === 'SUBSCRIBED') return true;
          await new Promise(r => setTimeout(r, 100));
        }
        return false;
      };
      try { await waitForSubscribed(3000); } catch (e) { /* best-effort */ }

      // If host or cohost, start capturing audio. StartBroadcasting is best-effort —
      // prefer the signaling channel to be subscribed first to avoid races.
      if (isHost || isCohostMode) {
        try { await startBroadcasting(); } catch (e) { log('startBroadcasting failed in init', e); }
      }
    } catch (err: any) {
      log('Error initializing WebRTC:', err);
      setError(err.message);
    }
  };

  const setupSignalingChannel = () => {
    // If a channel exists and is subscribed, don't recreate
    if (signalingChannelRef.current && (signalingChannelRef.current as any).state === 'SUBSCRIBED') {
      log('Signaling channel already exists and subscribed');
      return;
    }

    // Clean up existing channel if present
    if (signalingChannelRef.current) {
      try { signalingChannelRef.current.unsubscribe(); } catch (e) {}
      signalingChannelRef.current = null;
    }

    const channel = supabase.channel(`podcast-webrtc-${podcastId}`, {
      config: {
        broadcast: { ack: true, self: true }
      }
    });

    signalingChannelRef.current = channel;
    log('Setting up new signaling channel');

    channel
      .on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (payload.to === currentUserIdRef.current) {
          log('Received offer from:', payload.from);
          await handleOffer(payload);
        }
      })
      .on('broadcast', { event: 'answer' }, async ({ payload }) => {
        if (payload.to === currentUserIdRef.current) {
          log('Received answer from:', payload.from);
          await handleAnswer(payload);
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (payload.to === currentUserIdRef.current) {
          log('Received ICE candidate from:', payload.from);
          await handleIceCandidate(payload);
        }
      })
      .on('broadcast', { event: 'listener-joined' }, async ({ payload }) => {
        log('Listener joined:', payload.userId);
        if ((isHost || isCohostMode) && payload.userId !== currentUserIdRef.current) {
          if (localStreamRef.current) {
            await createOfferForListener(payload.userId);
          } else {
            log('Buffering listener until stream is ready:', payload.userId);
            pendingListenersRef.current.add(payload.userId);
          }
        }
      })
      .on('broadcast', { event: 'permission-request' }, ({ payload }) => {
        if (isHost || isCohostMode) {
          log('Permission request from:', payload.userId, 'type:', payload.requestType);
          setPermissionRequests(prev => [...prev, {
            userId: payload.userId,
            requestType: payload.requestType,
            timestamp: payload.timestamp
          }]);
          onPermissionRequest?.(payload.userId, payload.requestType);
        }
      })
      .on('broadcast', { event: 'permission-granted' }, ({ payload }) => {
        log('Received permission-granted:', payload.userId, payload.requestType);
        if (payload.userId === currentUserIdRef.current) {
          log('Permission granted to me:', payload.requestType);
          setIsCohostMode(payload.requestType === 'cohost');
          onPermissionGranted?.(payload.userId, payload.requestType);

          if (payload.requestType === 'speak' || payload.requestType === 'cohost') {
            startBroadcasting();
          }
        }
      })
      .on('broadcast', { event: 'permission-revoked' }, ({ payload }) => {
        log('Received permission-revoked:', payload.userId);
        if (payload.userId === currentUserIdRef.current) {
          log('Permission revoked from me');
          setIsCohostMode(false);
          onPermissionRevoked?.(payload.userId);

          if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            setLocalStream(null);
            localStreamRef.current = null;
            setIsMuted(false);
          }
        }
      })
      .on('broadcast', { event: 'participant-muted' }, ({ payload }) => {
        setParticipants(prev => {
          const newMap = new Map(prev);
          const participant = newMap.get(payload.userId);
          if (participant) {
            newMap.set(payload.userId, {
              ...participant,
              isMuted: payload.muted
            });
          }
          return newMap;
        });
      })
      .on('broadcast', { event: 'participant-speaking' }, ({ payload }) => {
        setParticipants(prev => {
          const newMap = new Map(prev);
          const participant = newMap.get(payload.userId);
          if (participant) {
            newMap.set(payload.userId, {
              ...participant,
              isSpeaking: payload.isSpeaking
            });
          }
          return newMap;
        });
      })
      .on('system', { event: 'channel_error' }, (event) => {
        log('Channel error:', event);
        setTimeout(() => {
          if ((signalingChannelRef.current as any)?.state !== 'SUBSCRIBED') {
            log('Reconnecting channel after error...');
            setupSignalingChannel();
          }
        }, 1000);
      })
      .subscribe((status) => {
        log('Signaling channel status:', status);
        if (status === 'SUBSCRIBED') {
          // Announce presence
          if (!isHost && !isCohostMode) {
            log('Announcing listener presence');
            channel.send({
              type: 'broadcast',
              event: 'listener-joined',
              payload: { userId: currentUserIdRef.current, timestamp: Date.now() }
            }).catch((e) => log('Error announcing presence:', e));
          }
        }
      });
  };

  const startBroadcasting = async (): Promise<MediaStream> => {
    try {
      log('Starting broadcasting...');
      const constraints: any = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      };
      if (enableVideo) {
        constraints.video = { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } };
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      log('Got media stream, track count:', stream.getTracks().length);
      setLocalStream(stream);
      localStreamRef.current = stream;
      setIsConnected(true);
      setConnectionQuality('excellent');

      // Start recording the audio stream if host
      if (isHost) {
        startRecording(stream);
      }

      // Setup audio analysis for speaking detection
      if (isHost || isCohostMode) {
        setupAudioAnalysis(stream, currentUserIdRef.current!);
      }

      return stream;
    } catch (err: any) {
      log('Error accessing microphone:', err);
      setError('Failed to access microphone. Please grant permission.');
      throw err;
    }
  };

  const setupAudioAnalysis = (stream: MediaStream, userId: string) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      const source = audioContextRef.current.createMediaStreamSource(stream);
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.3;
      
      source.connect(analyser);
      analysersRef.current.set(userId, analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      let lastSpeakingState = false;
      let speakingTimeout: NodeJS.Timeout;

      const checkAudioLevel = () => {
        if (!analysersRef.current.has(userId)) return;

        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const isSpeaking = average > 20;

        if (isSpeaking !== lastSpeakingState) {
          lastSpeakingState = isSpeaking;
          
          // Broadcast speaking state change
          if (signalingChannelRef.current) {
            signalingChannelRef.current.send({
              type: 'broadcast',
              event: 'participant-speaking',
              payload: {
                userId,
                isSpeaking,
                timestamp: Date.now()
              }
            });
          }

          // Update local participants state
          if (userId === currentUserIdRef.current) {
            setParticipants(prev => {
              const newMap = new Map(prev);
              const participant = newMap.get(userId);
              if (participant) {
                newMap.set(userId, {
                  ...participant,
                  isSpeaking
                });
              }
              return newMap;
            });
          }
        }

        // Clear timeout if still speaking
        if (isSpeaking && speakingTimeout) {
          clearTimeout(speakingTimeout);
        }

        // Set timeout to mark as not speaking after silence
        if (!isSpeaking && !speakingTimeout) {
          speakingTimeout = setTimeout(() => {
            if (signalingChannelRef.current) {
              signalingChannelRef.current.send({
                type: 'broadcast',
                event: 'participant-speaking',
                payload: {
                  userId,
                  isSpeaking: false,
                  timestamp: Date.now()
                }
              });
            }
          }, 1000);
        }

        requestAnimationFrame(checkAudioLevel);
      };

      checkAudioLevel();
    } catch (err) {
      log('Error setting up audio analysis:', err);
    }
  };

  const startRecording = (stream: MediaStream) => {
    try {
      const hasVideo = stream.getVideoTracks && stream.getVideoTracks().length > 0;
      const options = hasVideo ? { mimeType: 'video/webm;codecs=vp9,opus' } : { mimeType: 'audio/webm;codecs=opus' };
      const mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(1000);
      mediaRecorderRef.current = mediaRecorder;
      recordingMimeRef.current = (options as any).mimeType || null;
      log('Started recording');
    } catch (err) {
      log('Error starting recording:', err);
    }
  };

  const addLocalVideo = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia not supported');
      }

      const videoConstraints: any = { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } };
      const vs = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
      const vtrack = vs.getVideoTracks()[0];
      if (!vtrack) throw new Error('No video track obtained');

      // If there is no existing local stream, create one containing the video track
      if (!localStreamRef.current) {
        const newStream = new MediaStream([vtrack]);
        localStreamRef.current = newStream;
        try { setLocalStream(newStream); } catch (e) {}
      } else {
        try { localStreamRef.current.addTrack(vtrack); } catch (e) {}
        try { setLocalStream(localStreamRef.current); } catch (e) {}
      }

      // Add the video track to all existing peer connections
      peerConnectionsRef.current.forEach(({ connection }) => {
        try {
          connection.addTrack(vtrack, localStreamRef.current as MediaStream);
        } catch (e) {
          // best-effort
        }
      });

      return true;
    } catch (err) {
      log('addLocalVideo failed', err);
      setError((err as any)?.message || 'Failed to enable video');
      return false;
    }
  }, []);

  const stopRecording = async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current) {
        resolve(null);
        return;
      }

      mediaRecorderRef.current.onstop = () => {
        const mime = recordingMimeRef.current || (mediaRecorderRef.current && (mediaRecorderRef.current as any).mimeType) || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mime });
        setRecordedChunks(audioChunksRef.current);
        // clear recorded chunks and mime
        audioChunksRef.current = [];
        recordingMimeRef.current = null;
        resolve(blob);
      };

      mediaRecorderRef.current.stop();
      log('Stopped recording');
    });
  };

  const createPeerConnection = (userId: string, isInitiator: boolean = false): RTCPeerConnection => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    log('Creating peer connection for:', userId, 'isInitiator:', isInitiator);

    // Monitor connection state
    pc.onconnectionstatechange = () => {
      log('Connection state for', userId, ':', pc.connectionState);
      onConnectionStateChange?.(pc.connectionState);

      if (!isHost && !isCohostMode) {
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
        log('Sending ICE candidate to:', userId);
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

    // Handle remote stream
    pc.ontrack = (event) => {
      log('Received track from:', userId, 'track:', event.track.kind);
      event.track.enabled = true;

      if (event.streams && event.streams[0]) {
        const remoteStream = event.streams[0];
        
        // Setup audio analysis for this participant
        if (userId !== currentUserIdRef.current) {
          setupAudioAnalysis(remoteStream, userId);
        }

        // For hosts/cohosts: track participants
        if (isHost || isCohostMode) {
          setParticipants(prev => {
            const newMap = new Map(prev);
            newMap.set(userId, {
              stream: remoteStream,
              isSpeaking: false,
              isMuted: false
            });
            return newMap;
          });
          
          onParticipantJoined?.(userId, remoteStream);
        }
        
        // For listeners: forward the stream to audio player
        if (!isHost && !isCohostMode) {
          onRemoteStream?.(remoteStream);
        }
      }
    };

    // Monitor ICE connection state
    // Monitor ICE connection state and handle peer leaving
    pc.oniceconnectionstatechange = () => {
      log('ICE connection state for', userId, ':', pc.iceConnectionState);

      // Connection quality handling for listeners
      if (!isHost && !isCohostMode) {
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
            try { pc.restartIce(); } catch (e) { log('restartIce failed', e); }
            break;
        }
      }

      // Treat disconnected/failed as peer leaving for hosts/cohosts
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        log('Participant left:', userId);
        setParticipants(prev => {
          const newMap = new Map(prev);
          newMap.delete(userId);
          return newMap;
        });
        onParticipantLeft?.(userId);
      }
    };

    return pc;
  };

  const createOfferForListener = async (listenerId: string) => {
    try {
      const stream = localStreamRef.current;
      if (!stream) {
        log('No local stream available for listener:', listenerId);
        return;
      }

      log('Creating offer for listener:', listenerId);

      // Close existing connection if any
      const existingPeer = peerConnectionsRef.current.get(listenerId);
      if (existingPeer) {
        const state = existingPeer.connection.connectionState;
        if (state === 'connected' || state === 'connecting') {
          log('Already connected to listener:', listenerId);
          return;
        }
        existingPeer.connection.close();
      }

      const pc = createPeerConnection(listenerId, true);

      // Add local tracks to peer connection
      stream.getTracks().forEach(track => {
        log('Adding track to peer connection:', track.kind);
        track.enabled = true;
        pc.addTrack(track, stream);
      });

      peerConnectionsRef.current.set(listenerId, {
        userId: listenerId,
        connection: pc,
        stream
      });

      // Create and send offer - listener should receive audio
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: !!enableVideo
      });
      
      log('Created offer, setting local description');
      await pc.setLocalDescription(offer);

      if (signalingChannelRef.current) {
        log('Sending offer to listener:', listenerId);
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
      log('Error creating offer:', err);
    }
  };

  const handleOffer = async (payload: any) => {
    try {
      log('Handling offer from:', payload.from);

      // Close existing connection if any
      const existingPeer = peerConnectionsRef.current.get(payload.from);
      if (existingPeer) {
        const state = existingPeer.connection.connectionState;
        if (state === 'connected' || state === 'connecting') {
          log('Already connected to:', payload.from);
          return;
        }
        existingPeer.connection.close();
      }

      const pc = createPeerConnection(payload.from);
      peerConnectionsRef.current.set(payload.from, {
        userId: payload.from,
        connection: pc
      });

      log('Setting remote description');
      await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
      
      log('Applying pending ICE candidates');
      await applyPendingIceCandidates(payload.from, pc);

      // Create answer - listeners don't send audio back unless they're hosts/cohosts
      const answer = await pc.createAnswer({
        offerToReceiveAudio: !isHost && !isCohostMode, // Listeners receive audio
        offerToReceiveVideo: !!enableVideo
      });
      
      log('Created answer, setting local description');
      await pc.setLocalDescription(answer);

      if (signalingChannelRef.current) {
        log('Sending answer to:', payload.from);
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
      log('Error handling offer:', err);
    }
  };

  const handleAnswer = async (payload: any) => {
    try {
      log('Handling answer from:', payload.from);
      const peer = peerConnectionsRef.current.get(payload.from);
      if (peer) {
        await peer.connection.setRemoteDescription(new RTCSessionDescription(payload.answer));
        await applyPendingIceCandidates(payload.from, peer.connection);
        log('Answer processed successfully');
      }
    } catch (err) {
      log('Error handling answer:', err);
    }
  };

  const handleIceCandidate = async (payload: any) => {
    try {
      const peer = peerConnectionsRef.current.get(payload.from);
      if (peer && peer.connection.remoteDescription) {
        log('Adding ICE candidate from:', payload.from);
        await peer.connection.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } else {
        // Buffer candidate if peer connection not ready
        log('Buffering ICE candidate from:', payload.from);
        const candidates = pendingIceCandidatesRef.current.get(payload.from) || [];
        candidates.push(new RTCIceCandidate(payload.candidate));
        pendingIceCandidatesRef.current.set(payload.from, candidates);
      }
    } catch (err) {
      log('Error handling ICE candidate:', err);
    }
  };

  const applyPendingIceCandidates = async (userId: string, pc: RTCPeerConnection) => {
    const candidates = pendingIceCandidatesRef.current.get(userId);
    if (candidates && pc.remoteDescription) {
      log('Applying', candidates.length, 'buffered ICE candidates for:', userId);
      for (const candidate of candidates) {
        try {
          await pc.addIceCandidate(candidate);
        } catch (e) {
          log('Error adding buffered ICE candidate:', e);
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
        log('Microphone', audioTrack.enabled ? 'unmuted' : 'muted');
        
        // Broadcast mute state
        if (signalingChannelRef.current && currentUserIdRef.current) {
          signalingChannelRef.current.send({
            type: 'broadcast',
            event: 'participant-muted',
            payload: { 
              userId: currentUserIdRef.current, 
              muted: !audioTrack.enabled,
              timestamp: Date.now()
            }
          });
        }
      }
    }
  }, [localStream]);

  const stopBroadcasting = useCallback(async () => {
    log('Stopping broadcasting...');
    let audioBlob: Blob | null = null;

    // Stop recording and get the recorded audio
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        audioBlob = await stopRecording();
      }
    } catch (e) {
      log('Error stopping media recorder:', e);
    }

    // Stop and remove all audio analysis
    try {
      analysersRef.current.forEach((analyser) => {
        try { analyser.disconnect(); } catch (e) { }
      });
      analysersRef.current.clear();
    } catch (e) { log('Error clearing analysers', e); }

    if (audioContextRef.current) {
      try { await audioContextRef.current.close(); } catch (e) { log('Error closing audioContext', e); }
      audioContextRef.current = null;
    }

    // Prefer the ref-stored stream (more reliable across closures)
    const streamToStop = localStreamRef.current;
    if (streamToStop) {
      try {
        streamToStop.getTracks().forEach(track => {
          try { track.stop(); } catch (e) { }
        });
      } catch (e) { log('Error stopping tracks', e); }
      // clear refs and state
      localStreamRef.current = null;
      try { setLocalStream(null); } catch (e) { }
    }

    // Close all peer connections (ensure no active P2P links keeping devices open)
    try {
      peerConnectionsRef.current.forEach(({ connection }) => {
        try { connection.close(); } catch (e) { log('Error closing peer connection', e); }
      });
      peerConnectionsRef.current.clear();
    } catch (e) { log('Error closing peer connections', e); }

    // Clear media recorder refs and collected chunks
    try {
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
      setRecordedChunks([]);
    } catch (e) { }

    setIsConnected(false);
    // Ensure signaling channel is unsubscribed when broadcasting fully stops
    try {
      if (signalingChannelRef.current) {
        try { signalingChannelRef.current.unsubscribe(); } catch (e) { log('Error unsubscribing channel in stopBroadcasting', e); }
        signalingChannelRef.current = null;
      }
    } catch (e) { }
    log('Broadcasting stopped');
    return audioBlob;
  }, []);

  const requestPermission = useCallback((requestType: 'speak' | 'cohost') => {
    if (!signalingChannelRef.current || !currentUserIdRef.current) return;

    log('Requesting permission:', requestType);
    signalingChannelRef.current.send({
      type: 'broadcast',
      event: 'permission-request',
      payload: {
        userId: currentUserIdRef.current,
        requestType,
        timestamp: Date.now()
      }
    });

    // Also save to database for persistence
    savePermissionRequest(requestType);
  }, []);

  const savePermissionRequest = async (requestType: 'speak' | 'cohost') => {
    try {
      await supabase.from('podcast_participation_requests').insert({
        podcast_id: podcastId,
        user_id: currentUserIdRef.current!,
        request_type: requestType,
        status: 'pending'
      });
    } catch (err) {
      log('Error saving permission request:', err);
    }
  };

  const grantPermission = useCallback(async (userId: string, requestType: 'speak' | 'cohost') => {
    if (!signalingChannelRef.current) return;

    log('Granting permission to:', userId, 'type:', requestType);
    
    // Update database
    try {
      const { error } = await supabase
        .from('podcast_participation_requests')
        .update({
          status: 'approved',
          responded_at: new Date().toISOString(),
          responder_id: currentUserIdRef.current
        })
        .eq('podcast_id', podcastId)
        .eq('user_id', userId)
        .eq('status', 'pending');

      if (error) throw error;

      // If cohost request, add to cohosts table
      if (requestType === 'cohost') {
        await supabase
          .from('podcast_cohosts')
          .upsert({
            podcast_id: podcastId,
            user_id: userId,
            permissions: ['speak', 'moderate'],
            is_active: true
          });
      }
    } catch (err) {
      log('Error updating permission in database:', err);
    }

    // Broadcast permission granted
    try {
      signalingChannelRef.current?.send({
        type: 'broadcast',
        event: 'permission-granted',
        payload: {
          userId,
          requestType,
          grantedBy: currentUserIdRef.current,
          timestamp: Date.now()
        }
      });
    } catch (e) {
      log('Error broadcasting permission-granted, will rely on DB subscription:', e);
    }

    // Remove from local requests
    setPermissionRequests(prev => prev.filter(req => req.userId !== userId));
  }, [podcastId]);

  const revokePermission = useCallback(async (userId: string) => {
    if (!signalingChannelRef.current) return;

    log('Revoking permission from:', userId);
    
    // Update database
    try {
      await supabase
        .from('podcast_participation_requests')
        .update({
          status: 'revoked',
          responded_at: new Date().toISOString(),
          responder_id: currentUserIdRef.current
        })
        .eq('podcast_id', podcastId)
        .eq('user_id', userId)
        .eq('status', 'approved');

      // Remove from cohosts if exists
      await supabase
        .from('podcast_cohosts')
        .update({ is_active: false })
        .eq('podcast_id', podcastId)
        .eq('user_id', userId);
    } catch (err) {
      log('Error revoking permission in database:', err);
    }

    try {
      signalingChannelRef.current?.send({
        type: 'broadcast',
        event: 'permission-revoked',
        payload: {
          userId,
          revokedBy: currentUserIdRef.current,
          timestamp: Date.now()
        }
      });
    } catch (e) {
      log('Error broadcasting permission-revoked, will rely on DB subscription:', e);
    }
  }, [podcastId]);

  const setParticipantsMuted = useCallback((userId: string, muted: boolean) => {
    const participant = participants.get(userId);
    if (participant) {
      participant.stream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });

      // Update local state
      setParticipants(prev => {
        const newMap = new Map(prev);
        const p = newMap.get(userId);
        if (p) {
          newMap.set(userId, { ...p, isMuted: muted });
        }
        return newMap;
      });

      // Broadcast mute state
      if (signalingChannelRef.current) {
        signalingChannelRef.current.send({
          type: 'broadcast',
          event: 'participant-muted',
          payload: { userId, muted, timestamp: Date.now() }
        });
      }
    }
  }, [participants]);

  const cleanup = () => {
    log('Cleaning up WebRTC...');
    
    // Close all peer connections
    peerConnectionsRef.current.forEach(({ connection }) => {
      try { connection.close(); } catch (e) { log('Error closing connection', e); }
    });
    peerConnectionsRef.current.clear();

    // Stop and remove all audio analysis
    analysersRef.current.forEach(analyser => {
      try { analyser.disconnect(); } catch (e) { }
    });
    analysersRef.current.clear();

    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (e) { }
      audioContextRef.current = null;
    }

    // Stop local stream
    if (localStreamRef.current) {
      try { localStreamRef.current.getTracks().forEach(track => track.stop()); } catch (e) { }
      localStreamRef.current = null;
    }

    // Only unsubscribe signaling channel for non-hosts/non-cohosts.
    // Hosts/cohosts may close the UI but should keep the channel open while broadcasting.
    if (signalingChannelRef.current) {
      if (!isHost && !isCohostMode) {
        try {
          signalingChannelRef.current.unsubscribe();
        } catch (e) { log('Error unsubscribing channel', e); }
        signalingChannelRef.current = null;
      } else {
        log('Keeping signaling channel open for host/cohost');
      }
    }

    pendingIceCandidatesRef.current.clear();
    pendingListenersRef.current.clear();
    setParticipants(new Map());
    setIsConnected(false);
    log('WebRTC cleanup complete');
  };

  // Connection monitor: periodically ensure signaling channel remains subscribed
  useEffect(() => {
    const id = setInterval(() => {
      try {
        const ch = signalingChannelRef.current as any;
        if (!ch || ch.state !== 'SUBSCRIBED') {
          log('Signaling channel not subscribed, attempting to re-setup');
          setupSignalingChannel();
        }
      } catch (e) {
        log('Connection monitor error', e);
      }
    }, 5000);

    return () => clearInterval(id);
  }, [podcastId, isHost, isCohostMode]);

  return {
    localStream,
    isConnected,
    isMuted,
    connectionQuality,
    error,
    recordedChunks,
    participants: Array.from(participants.entries()).map(([userId, data]) => ({
      userId,
      ...data
    })),
    permissionRequests,
    isCohostMode,
    toggleMute,
    stopBroadcasting,
    startBroadcasting,
    requestPermission,
    grantPermission,
    revokePermission,
    setParticipantsMuted
    ,
    addLocalVideo
  };
};
