/**
 * Streaming PCM Audio Player for the voice agent's spoken responses.
 * Supports continuous queuing, Base64 decoding, and immediate barge-in interruption.
 */
export class StreamingPCMPlayer {
  constructor(sampleRate = 24000) {
    this.sampleRate = sampleRate;
    this.audioCtx = null;
    this.nextStartTime = 0;
    this.activeSources = [];
    this.isPlaying = false;
  }

  async init() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass({ sampleRate: this.sampleRate });
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.8;
      this.analyser.connect(this.audioCtx.destination);
    }
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
    this.nextStartTime = this.audioCtx.currentTime;
  }

  getAnalyser() {
    return this.analyser;
  }

  /**
   * Decodes a Base64 PCM audio chunk received from AssemblyAI (reply.audio) and plays it.
   */
  async playBase64Chunk(base64String) {
    if (!base64String) return;
    try {
      const binaryString = atob(base64String);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      await this.playChunk(bytes.buffer);
    } catch (e) {
      console.error('Error decoding Base64 audio chunk:', e);
    }
  }

  /**
   * Queues a 16-bit linear PCM chunk (ArrayBuffer) for seamless continuous playback.
   */
  async playChunk(arrayBuffer) {
    if (!this.audioCtx) {
      await this.init();
    }

    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    // Convert Int16Array to Float32Array
    const int16Array = new Int16Array(arrayBuffer);
    if (int16Array.length === 0) return;

    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768;
    }

    const audioBuffer = this.audioCtx.createBuffer(1, float32Array.length, this.sampleRate);
    audioBuffer.copyToChannel(float32Array, 0);

    const source = this.audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.analyser || this.audioCtx.destination);

    const currentTime = this.audioCtx.currentTime;
    if (this.nextStartTime < currentTime) {
      this.nextStartTime = currentTime;
    }

    source.start(this.nextStartTime);
    this.nextStartTime += audioBuffer.duration;
    this.isPlaying = true;

    this.activeSources.push(source);
    source.onended = () => {
      const index = this.activeSources.indexOf(source);
      if (index !== -1) {
        this.activeSources.splice(index, 1);
      }
      if (this.activeSources.length === 0) {
        this.isPlaying = false;
      }
    };
  }

  /**
   * Immediately stops all currently playing chunks and clears the audio queue (Barge-in).
   */
  stopAll() {
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // Ignore if already stopped
      }
    }
    this.activeSources = [];
    this.isPlaying = false;
    if (this.audioCtx) {
      this.nextStartTime = this.audioCtx.currentTime;
    }
  }

  async close() {
    this.stopAll();
    if (this.audioCtx) {
      await this.audioCtx.close();
      this.audioCtx = null;
    }
  }
}
