import React, { useRef, useEffect } from 'react';

export function AudioVisualizer({
  getMicAnalyser,
  getPlayerAnalyser,
  isSpeaking,
  isListening,
  isConnected,
}) {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Buffer for FFT frequency data (64 bins)
    const micData = new Uint8Array(64);
    const playerData = new Uint8Array(64);

    const render = () => {
      phaseRef.current += 0.03;
      const phase = phaseRef.current;

      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = 54; // Matches the central 112px orb (radius 56)

      ctx.clearRect(0, 0, width, height);

      let activeAnalyser = null;
      let isUserAudio = false;

      if (isListening && getMicAnalyser) {
        activeAnalyser = getMicAnalyser();
        isUserAudio = true;
      } else if (isSpeaking && getPlayerAnalyser) {
        activeAnalyser = getPlayerAnalyser();
        isUserAudio = false;
      }

      if (activeAnalyser) {
        const binCount = activeAnalyser.frequencyBinCount;
        const dataArray = isUserAudio ? micData : playerData;
        activeAnalyser.getByteFrequencyData(dataArray);

        // Calculate average volume energy
        let sum = 0;
        const usableBins = Math.min(32, binCount);
        for (let i = 0; i < usableBins; i++) {
          sum += dataArray[i];
        }
        const avgVolume = sum / (usableBins * 255); // 0.0 to 1.0

        // 1. Draw glowing background aura reacting to overall loudness
        const auraRadius = baseRadius + avgVolume * 40;
        const auraGradient = ctx.createRadialGradient(
          centerX,
          centerY,
          baseRadius * 0.8,
          centerX,
          centerY,
          auraRadius + 20
        );

        if (isUserAudio) {
          auraGradient.addColorStop(0, 'rgba(6, 182, 212, 0.35)'); // Cyan
          auraGradient.addColorStop(0.6, 'rgba(16, 185, 129, 0.15)'); // Emerald
          auraGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        } else {
          auraGradient.addColorStop(0, 'rgba(168, 85, 247, 0.4)'); // Purple
          auraGradient.addColorStop(0.6, 'rgba(236, 72, 153, 0.2)'); // Pink
          auraGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        }

        ctx.beginPath();
        ctx.arc(centerX, centerY, auraRadius + 20, 0, Math.PI * 2);
        ctx.fillStyle = auraGradient;
        ctx.fill();

        // 2. Draw 36 Radial Frequency Bars radiating outward
        const numBars = 36;
        const angleStep = (Math.PI * 2) / numBars;

        for (let i = 0; i < numBars; i++) {
          const angle = i * angleStep - Math.PI / 2;
          // Mirror frequency index symmetrically
          const dataIndex = Math.floor(
            (i < numBars / 2 ? i : numBars - i) * (usableBins / (numBars / 2))
          );
          const rawVal = dataArray[dataIndex] || 0;
          const normalized = rawVal / 255; // 0 to 1

          const barHeight = Math.max(4, normalized * 38 + Math.sin(phase * 2 + i) * 3);
          const innerRadius = baseRadius + 4;
          const outerRadius = innerRadius + barHeight;

          const x1 = centerX + Math.cos(angle) * innerRadius;
          const y1 = centerY + Math.sin(angle) * innerRadius;
          const x2 = centerX + Math.cos(angle) * outerRadius;
          const y2 = centerY + Math.sin(angle) * outerRadius;

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.lineWidth = 3.5;
          ctx.lineCap = 'round';

          if (isUserAudio) {
            // Gradient cyan -> emerald for user singing/speech
            const grad = ctx.createLinearGradient(x1, y1, x2, y2);
            grad.addColorStop(0, '#06b6d4');
            grad.addColorStop(1, '#34d399');
            ctx.strokeStyle = grad;
          } else {
            // Gradient purple -> pink/amber for Lyra
            const grad = ctx.createLinearGradient(x1, y1, x2, y2);
            grad.addColorStop(0, '#c084fc');
            grad.addColorStop(1, '#f43f5e');
            ctx.strokeStyle = grad;
          }

          ctx.stroke();
        }
      } else if (isConnected) {
        // Idle gentle breathing wave animation when connected
        const numBars = 32;
        const angleStep = (Math.PI * 2) / numBars;

        for (let i = 0; i < numBars; i++) {
          const angle = i * angleStep;
          const wave = Math.sin(phase * 1.5 + i * 0.4) * 6 + 6;
          const innerRadius = baseRadius + 2;
          const outerRadius = innerRadius + wave;

          const x1 = centerX + Math.cos(angle) * innerRadius;
          const y1 = centerY + Math.sin(angle) * innerRadius;
          const x2 = centerX + Math.cos(angle) * outerRadius;
          const y2 = centerY + Math.sin(angle) * outerRadius;

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.strokeStyle = 'rgba(147, 51, 234, 0.35)';
          ctx.stroke();
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [getMicAnalyser, getPlayerAnalyser, isSpeaking, isListening, isConnected]);

  return (
    <canvas
      ref={canvasRef}
      width={240}
      height={240}
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0"
    />
  );
}
