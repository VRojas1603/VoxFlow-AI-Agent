import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_PITCH_TRACKING_CONFIG,
  createPitchAnalyzer,
} from '../audio/pitchDetector';

const SAMPLE_INTERVAL_MS = 40;
const DISPLAY_INTERVAL_MS = 80;
const DECAY_AFTER_MS = 360;
const NOISE_FLOOR_MULTIPLIER = 2.5;
const INITIAL_NOISE_FLOOR = 0.004;

export function usePitchTracking({ analyserRef, enabled, onAnalysis }) {
  const [pitchData, setPitchData] = useState(null);
  const [signalQuality, setSignalQuality] = useState('unavailable');
  const analyzerRef = useRef(null);
  const bufferRef = useRef(null);
  const latestSampleRef = useRef(null);
  const latestAnalysisRef = useRef(null);
  const noiseFloorRef = useRef(INITIAL_NOISE_FLOOR);
  const lastValidAtRef = useRef(0);
  const lastDisplayAtRef = useRef(0);
  const onAnalysisRef = useRef(onAnalysis);

  useEffect(() => {
    onAnalysisRef.current = onAnalysis;
  }, [onAnalysis]);

  useEffect(() => {
    if (!enabled) {
      latestSampleRef.current = null;
      latestAnalysisRef.current = null;
      return undefined;
    }

    analyzerRef.current = createPitchAnalyzer();
    bufferRef.current = new Float32Array(DEFAULT_PITCH_TRACKING_CONFIG.inputLength);
    noiseFloorRef.current = INITIAL_NOISE_FLOOR;
    lastValidAtRef.current = 0;
    lastDisplayAtRef.current = 0;

    const intervalId = window.setInterval(() => {
      const analyser = analyserRef.current;
      if (!analyser) return;

      if (analyser.fftSize !== DEFAULT_PITCH_TRACKING_CONFIG.inputLength) {
        analyser.fftSize = DEFAULT_PITCH_TRACKING_CONFIG.inputLength;
      }
      if (bufferRef.current.length !== analyser.fftSize) {
        bufferRef.current = new Float32Array(analyser.fftSize);
        analyzerRef.current = createPitchAnalyzer({ inputLength: analyser.fftSize });
      }

      analyser.getFloatTimeDomainData(bufferRef.current);
      const sampleRate = analyser.context?.sampleRate || 24000;
      const audioTime = analyser.context?.currentTime ?? null;
      const capturedAtMs = performance.now();
      const minimumRms = Math.max(
        DEFAULT_PITCH_TRACKING_CONFIG.minimumRms,
        noiseFloorRef.current * NOISE_FLOOR_MULTIPLIER,
      );
      const analysis = analyzerRef.current.analyze(bufferRef.current, sampleRate, {
        audioTime,
        capturedAtMs,
        minimumRms,
      });
      const now = capturedAtMs;

      latestAnalysisRef.current = analysis;
      onAnalysisRef.current?.(analysis);

      if (analysis.sample) {
        latestSampleRef.current = analysis.sample;
        lastValidAtRef.current = now;
      } else if (analysis.signalQuality === 'quiet') {
        noiseFloorRef.current = (
          noiseFloorRef.current * 0.92
          + Math.min(analysis.rms, DEFAULT_PITCH_TRACKING_CONFIG.minimumRms) * 0.08
        );
      }

      if (now - lastDisplayAtRef.current < DISPLAY_INTERVAL_MS) return;
      lastDisplayAtRef.current = now;
      setSignalQuality(analysis.signalQuality);

      if (analysis.sample) {
        setPitchData(analysis.sample);
      } else if (latestSampleRef.current && now - lastValidAtRef.current < DECAY_AFTER_MS) {
        setPitchData({
          ...latestSampleRef.current,
          isDecaying: true,
          signalQuality: analysis.signalQuality,
        });
      } else {
        latestSampleRef.current = null;
        setPitchData(null);
      }
    }, SAMPLE_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
      latestSampleRef.current = null;
      latestAnalysisRef.current = null;
    };
  }, [analyserRef, enabled]);

  return {
    pitchData: enabled ? pitchData : null,
    signalQuality: enabled ? signalQuality : 'unavailable',
    latestPitchSampleRef: latestSampleRef,
    latestPitchAnalysisRef: latestAnalysisRef,
  };
}
