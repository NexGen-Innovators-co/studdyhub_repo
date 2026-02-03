// AudioMixer.ts - Fixed version for mixing multiple audio streams
export class AudioMixer {
  private audioContext: AudioContext | null = null;
  private sources: Map<string, MediaStreamAudioSourceNode> = new Map();
  private gains: Map<string, GainNode> = new Map();
  private merger: ChannelMergerNode | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  private analysers: Map<string, AnalyserNode> = new Map();
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    try {
      // Create audio context with proper error handling
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create nodes
      this.merger = this.audioContext.createChannelMerger(2);
      this.destination = this.audioContext.createMediaStreamDestination();
      
      // Connect merger to destination
      this.merger.connect(this.destination);
      
      this.isInitialized = true;
      // console.log('[AudioMixer] Initialized successfully');
    } catch (error) {
      // console.error('[AudioMixer] Failed to initialize:', error);
      this.isInitialized = false;
    }
  }

  addStream(userId: string, stream: MediaStream): void {
    if (!this.isInitialized || !this.audioContext || !this.merger) {
      // console.error('[AudioMixer] Not initialized');
      return;
    }

    // Remove existing stream for this user if present
    this.removeStream(userId);

    try {
      // Create audio source from stream
      const source = this.audioContext.createMediaStreamSource(stream);
      const gain = this.audioContext.createGain();
      gain.gain.value = 1.0; // Default volume

      // Create analyser for volume detection
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.3;
      
      // Connect chain: source -> analyser -> gain -> merger
      source.connect(analyser);
      analyser.connect(gain);
      gain.connect(this.merger, 0, 0);
      gain.connect(this.merger, 0, 1);

      // Store references
      this.sources.set(userId, source);
      this.gains.set(userId, gain);
      this.analysers.set(userId, analyser);

      // console.log(`[AudioMixer] Added stream for user: ${userId}`);
    } catch (error) {
      // console.error(`[AudioMixer] Error adding stream for user ${userId}:`, error);
    }
  }

  removeStream(userId: string): void {
    const source = this.sources.get(userId);
    const gain = this.gains.get(userId);
    const analyser = this.analysers.get(userId);

    if (source) {
      try {
        source.disconnect();
      } catch (e) {}
      this.sources.delete(userId);
    }

    if (gain) {
      try {
        gain.disconnect();
      } catch (e) {}
      this.gains.delete(userId);
    }

    if (analyser) {
      try {
        analyser.disconnect();
      } catch (e) {}
      this.analysers.delete(userId);
    }

    // console.log(`[AudioMixer] Removed stream for user: ${userId}`);
  }

  setVolume(userId: string, volume: number): void {
    const gain = this.gains.get(userId);
    if (gain) {
      const normalizedVolume = Math.max(0, Math.min(1, volume));
      gain.gain.value = normalizedVolume;
      // console.log(`[AudioMixer] Set volume for ${userId} to: ${normalizedVolume}`);
    }
  }

  muteUser(userId: string, muted: boolean): void {
    const gain = this.gains.get(userId);
    if (gain) {
      gain.gain.value = muted ? 0 : 1;
      // console.log(`[AudioMixer] ${muted ? 'Muted' : 'Unmuted'} user: ${userId}`);
    }
  }

  getMixedStream(): MediaStream | null {
    if (!this.destination || !this.isInitialized) {
      // console.error('[AudioMixer] Not initialized, cannot get mixed stream');
      return null;
    }
    
    return this.destination.stream;
  }

  getAudioLevel(userId: string): number {
    const analyser = this.analysers.get(userId);
    if (!analyser || !this.isInitialized) return 0;

    try {
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      
      // Normalize to 0-1 range
      const normalized = Math.min(1, average / 128);
      return normalized;
    } catch (error) {
      // console.error(`[AudioMixer] Error getting audio level for ${userId}:`, error);
      return 0;
    }
  }

  getUserVolume(userId: string): number {
    const gain = this.gains.get(userId);
    return gain ? gain.gain.value : 1;
  }

  getActiveUsers(): string[] {
    return Array.from(this.sources.keys());
  }

  getIsSpeaking(userId: string, threshold: number = 0.1): boolean {
    const level = this.getAudioLevel(userId);
    return level > threshold;
  }

  suspend(): void {
    if (this.audioContext && this.audioContext.state === 'running') {
      this.audioContext.suspend();
      // console.log('[AudioMixer] Suspended');
    }
  }

  resume(): void {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
      // console.log('[AudioMixer] Resumed');
    }
  }

  getContextState(): string {
    return this.audioContext ? this.audioContext.state : 'closed';
  }

  close(): void {
    // console.log('[AudioMixer] Closing...');
    
    // Disconnect all sources and nodes
    this.sources.forEach(source => {
      try {
        source.disconnect();
      } catch (e) {}
    });
    
    this.gains.forEach(gain => {
      try {
        gain.disconnect();
      } catch (e) {}
    });
    
    this.analysers.forEach(analyser => {
      try {
        analyser.disconnect();
      } catch (e) {}
    });

    // Clear all maps
    this.sources.clear();
    this.gains.clear();
    this.analysers.clear();

    // Close audio context
    if (this.audioContext) {
      this.audioContext.close().catch(e => {
        // console.error('[AudioMixer] Error closing audio context:', e);
      });
      this.audioContext = null;
    }

    // Reset other properties
    this.merger = null;
    this.destination = null;
    this.isInitialized = false;
    
    // console.log('[AudioMixer] Closed successfully');
  }

  // Helper method to mix multiple streams into one
  static async createMixedStream(streams: MediaStream[]): Promise<MediaStream | null> {
    const mixer = new AudioMixer();
    
    // Add all streams to mixer
    streams.forEach((stream, index) => {
      mixer.addStream(`stream-${index}`, stream);
    });
    
    // Wait a bit for mixer to initialize
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const mixedStream = mixer.getMixedStream();
    
    // Keep mixer alive by returning it with the stream
    if (mixedStream) {
      (mixedStream as any)._mixer = mixer;
    }
    
    return mixedStream;
  }

  // Method to apply audio effects
  applyEffect(userId: string, effectType: 'echo' | 'reverb' | null = null): void {
    if (!this.audioContext || !this.gains.has(userId)) return;
    
    const gain = this.gains.get(userId);
    if (!gain) return;

    // Remove any existing effects
    gain.disconnect();
    
    if (effectType === 'echo') {
      const delay = this.audioContext.createDelay();
      delay.delayTime.value = 0.3;
      
      const feedback = this.audioContext.createGain();
      feedback.gain.value = 0.5;
      
      const wet = this.audioContext.createGain();
      wet.gain.value = 0.3;
      
      // Connect: gain -> delay -> feedback -> delay (loop) -> wet -> merger
      gain.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(wet);
      wet.connect(this.merger!, 0, 0);
      wet.connect(this.merger!, 0, 1);
    } else if (effectType === 'reverb') {
      const convolver = this.audioContext.createConvolver();
      const wet = this.audioContext.createGain();
      wet.gain.value = 0.3;
      
      // Simple impulse response for reverb
      const sampleRate = this.audioContext.sampleRate;
      const length = sampleRate * 2;
      const impulse = this.audioContext.createBuffer(2, length, sampleRate);
      
      for (let channel = 0; channel < 2; channel++) {
        const channelData = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) {
          channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
        }
      }
      
      convolver.buffer = impulse;
      gain.connect(convolver);
      convolver.connect(wet);
      wet.connect(this.merger!, 0, 0);
      wet.connect(this.merger!, 0, 1);
    } else {
      // No effect, connect directly to merger
      gain.connect(this.merger!, 0, 0);
      gain.connect(this.merger!, 0, 1);
    }
  }
}
