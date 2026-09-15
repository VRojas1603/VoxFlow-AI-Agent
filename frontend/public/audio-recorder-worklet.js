// AudioWorkletProcessor to convert microphone input into 16-bit PCM chunks (24000 Hz)
class AudioRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 2048;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0];
    for (let i = 0; i < channelData.length; i++) {
      this.buffer[this.bufferIndex++] = channelData[i];
      if (this.bufferIndex >= this.bufferSize) {
        this.flush();
      }
    }
    return true;
  }

  flush() {
    // Convert Float32 (-1.0 to 1.0) to Int16 (16-bit linear PCM)
    const pcm16 = new Int16Array(this.bufferIndex);
    for (let i = 0; i < this.bufferIndex; i++) {
      const s = Math.max(-1, Math.min(1, this.buffer[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
    this.bufferIndex = 0;
  }
}

registerProcessor('audio-recorder-processor', AudioRecorderProcessor);
