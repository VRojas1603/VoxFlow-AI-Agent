import { useState, useRef, useCallback, useEffect } from 'react';
import { StreamingPCMPlayer } from '../audio/pcmPlayer';
import { scaleEngine } from '../audio/scaleEngine';
import {
  DEFAULT_ACCOMPANIMENT_STATE,
  applyAccompanimentAdjustment,
  resetAccompanimentEngine,
} from '../audio/accompanimentControls';
import {
  EXERCISE_NAMES,
  applyExerciseSelection,
  upsertCoveredTip,
} from '../audio/exerciseControls';
import { DEFAULT_VOICE_ID, getVoiceLanguage } from '../data/voices';
import { usePitchTracking } from './usePitchTracking';
import {
  SessionPerformanceTracker,
  createEmptySessionPerformance,
} from '../audio/performanceEvaluator';
import { buildSessionReport } from '../reports/sessionReport';

const WS_URL = import.meta.env.VITE_WS_PROXY_URL || 'ws://localhost:8000/ws/agent';

function getAgentWebSocketUrl(voice) {
  const url = new URL(WS_URL, window.location.href);
  if (url.protocol === 'http:') url.protocol = 'ws:';
  if (url.protocol === 'https:') url.protocol = 'wss:';
  url.searchParams.set('voice', voice);
  return url.toString();
}

// Helper to convert ArrayBuffer (16-bit PCM) to Base64
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function useVoiceAgent() {
  const [status, setStatus] = useState('disconnected'); // 'disconnected' | 'connecting' | 'connected' | 'error'
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [userTranscript, setUserTranscript] = useState('');
  const [agentTranscript, setAgentTranscript] = useState('');
  const [conversation, setConversation] = useState([]);
  const [activeTip, setActiveTip] = useState(null);
  const [playbackSettings, setPlaybackSettings] = useState({
    pitchShift: DEFAULT_ACCOMPANIMENT_STATE.pitchShift,
    speed: DEFAULT_ACCOMPANIMENT_STATE.speed,
  });
  const [activeExercise, setActiveExercise] = useState('warmup_breathing');
  const [isPlayingAccompaniment, setIsPlayingAccompaniment] = useState(false);
  const [currentNote, setCurrentNote] = useState(null);
  const [accompanimentVolume, setAccompanimentVolumeState] = useState(
    DEFAULT_ACCOMPANIMENT_STATE.volume,
  );
  const [errorMessage, setErrorMessage] = useState(null);
  const [selectedVoice, setSelectedVoice] = useState(DEFAULT_VOICE_ID);
  const [voiceProfile, setVoiceProfile] = useState({
    language: getVoiceLanguage(DEFAULT_VOICE_ID),
    voice: DEFAULT_VOICE_ID,
  });
  const [sessionView, setSessionView] = useState('voice');
  const [reportGenerationStep, setReportGenerationStep] = useState('analyzing');
  const [sessionReport, setSessionReport] = useState(null);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [sessionPerformance, setSessionPerformance] = useState(
    createEmptySessionPerformance,
  );

  const wsRef = useRef(null);
  const audioCtxRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const workletNodeRef = useRef(null);
  const pcmPlayerRef = useRef(null);
  const micAnalyserRef = useRef(null);
  const sessionTimerRef = useRef(null);
  const sessionSecondsRef = useRef(0);
  const sessionActiveRef = useRef(false);
  const pendingVoiceEndRef = useRef(false);
  const conversationRef = useRef([]);
  const exercisesPracticedRef = useRef(new Set(['Diaphragmatic Breathing']));
  const tipsCoveredRef = useRef([]);
  const languageSwitchesCountRef = useRef(0);
  const keyShiftsCountRef = useRef(0);
  const speedChangesCountRef = useRef(0);
  const volumeChangesCountRef = useRef(0);
  const processedToolCallsRef = useRef(new Map());
  const performanceTrackerRef = useRef(new SessionPerformanceTracker());
  const reportTransitionTimersRef = useRef(new Set());

  const handlePitchAnalysis = useCallback((analysis) => {
    performanceTrackerRef.current.handleAnalysis(analysis);
  }, []);

  const clearReportTransitionTimers = useCallback(() => {
    for (const timerId of reportTransitionTimersRef.current) {
      clearTimeout(timerId);
    }
    reportTransitionTimersRef.current.clear();
  }, []);

  const scheduleReportTransition = useCallback((callback, delayMs) => {
    const timerId = setTimeout(() => {
      reportTransitionTimersRef.current.delete(timerId);
      callback();
    }, delayMs);
    reportTransitionTimersRef.current.add(timerId);
    return timerId;
  }, []);

  const {
    pitchData,
    signalQuality: pitchSignalQuality,
    latestPitchSampleRef,
    latestPitchAnalysisRef,
  } = usePitchTracking({
    analyserRef: micAnalyserRef,
    enabled: isListening && !isSpeaking,
    onAnalysis: handlePitchAnalysis,
  });

  // Initialize PCM streaming audio player (AssemblyAI native 24 kHz) and Scale Engine callback
  useEffect(() => {
    pcmPlayerRef.current = new StreamingPCMPlayer(24000);
    const unsubscribeTarget = scaleEngine.onTargetChange((noteInfo) => {
      performanceTrackerRef.current.handleTarget(noteInfo);
      setCurrentNote(noteInfo);
    });
    const unsubscribeExerciseEvent = scaleEngine.onExerciseEvent((exerciseEvent) => {
      const result = performanceTrackerRef.current.handleExerciseEvent(exerciseEvent);
      if (exerciseEvent.type === 'playback.started') setIsPlayingAccompaniment(true);
      if (exerciseEvent.type === 'playback.stopped') setIsPlayingAccompaniment(false);
      if (result) setSessionPerformance(performanceTrackerRef.current.getSnapshot());
    });

    return () => {
      unsubscribeTarget();
      unsubscribeExerciseEvent();
      pcmPlayerRef.current?.close();
      scaleEngine.stop();
    };
  }, []);

  useEffect(() => () => clearReportTransitionTimers(), [clearReportTransitionTimers]);

  // Start microphone stream and AudioWorklet at 24000 Hz
  const startMicrophone = async (ws) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 24000,
        },
      });
      mediaStreamRef.current = stream;

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContextClass({ sampleRate: 24000 });
      audioCtxRef.current = audioCtx;

      await audioCtx.audioWorklet.addModule('/audio-recorder-worklet.js');
      const source = audioCtx.createMediaStreamSource(stream);
      const workletNode = new AudioWorkletNode(audioCtx, 'audio-recorder-processor');
      workletNodeRef.current = workletNode;

      // Real-time Analyser for Microphone Frequency Spectrum Visualizer
      const micAnalyser = audioCtx.createAnalyser();
      micAnalyser.fftSize = 128;
      micAnalyser.smoothingTimeConstant = 0.75;
      source.connect(micAnalyser);
      micAnalyserRef.current = micAnalyser;

      workletNode.port.onmessage = (event) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          // Stream raw base64 PCM16 audio via input.audio
          const base64Audio = arrayBufferToBase64(event.data);
          ws.send(JSON.stringify({
            type: "input.audio",
            audio: base64Audio,
            data: base64Audio,
          }));
        }
      };

      source.connect(workletNode);
      workletNode.connect(audioCtx.destination);
      setIsListening(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setErrorMessage('Could not access microphone. Please check browser permissions.');
    }
  };

  // Stop microphone capture
  const stopMicrophone = useCallback(() => {
    if (micAnalyserRef.current) {
      micAnalyserRef.current.disconnect();
      micAnalyserRef.current = null;
    }
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    setIsListening(false);
  }, []);

  const selectVoice = useCallback((voiceId) => {
    setSelectedVoice(voiceId);
    setVoiceProfile({
      language: getVoiceLanguage(voiceId),
      voice: voiceId,
    });
  }, []);

  const finishSession = useCallback(({ closeSocket = true } = {}) => {
    const hadActiveSession = sessionActiveRef.current;
    sessionActiveRef.current = false;
    pendingVoiceEndRef.current = false;

    const socket = wsRef.current;
    if (closeSocket && socket) {
      wsRef.current = null;
      socket.close();
    }

    stopMicrophone();
    pcmPlayerRef.current?.stopAll();
    scaleEngine.stop();
    setIsPlayingAccompaniment(false);
    setStatus('disconnected');
    setIsSpeaking(false);
    setVoiceProfile({
      language: getVoiceLanguage(selectedVoice),
      voice: selectedVoice,
    });

    if (sessionTimerRef.current) {
      clearInterval(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }

    if (!hadActiveSession) return;

    const mins = Math.floor(sessionSecondsRef.current / 60);
    const secs = sessionSecondsRef.current % 60;
    const durationFormatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    const report = buildSessionReport({
      durationFormatted: sessionSecondsRef.current > 0 ? durationFormatted : '00:00',
      exercisesPracticed: Array.from(exercisesPracticedRef.current),
      tipsCovered: [...tipsCoveredRef.current],
      languageSwitches: languageSwitchesCountRef.current,
      keyShiftsUsed: keyShiftsCountRef.current,
      speedChangesUsed: speedChangesCountRef.current,
      volumeChangesUsed: volumeChangesCountRef.current,
      messageCount: conversationRef.current.length,
      performance: performanceTrackerRef.current.getSnapshot(),
    });
    clearReportTransitionTimers();
    setSessionReport(report);
    setReportGenerationStep('analyzing');
    setSessionView('voice_exiting');
    scheduleReportTransition(() => setSessionView('generating_report'), 320);
    scheduleReportTransition(() => setReportGenerationStep('preparing'), 720);
    scheduleReportTransition(() => setReportGenerationStep('finalizing'), 1120);
    scheduleReportTransition(() => setSessionView('loading_exiting'), 1520);
    scheduleReportTransition(() => setSessionView('report_ready'), 1840);
  }, [
    clearReportTransitionTimers,
    scheduleReportTransition,
    selectedVoice,
    stopMicrophone,
  ]);

  const applyPlaybackAdjustment = useCallback((command) => {
    const transition = applyAccompanimentAdjustment({
      pitchShift: scaleEngine.pitchShift,
      speed: scaleEngine.speed,
      volume: scaleEngine.volume,
    }, command);

    if (transition.control === 'pitch') {
      scaleEngine.setPitchShift(transition.state.pitchShift);
      setPlaybackSettings((current) => ({
        ...current,
        pitchShift: transition.state.pitchShift,
      }));
      if (transition.changed) keyShiftsCountRef.current += 1;
    } else if (transition.control === 'speed') {
      scaleEngine.setSpeed(transition.state.speed);
      setPlaybackSettings((current) => ({
        ...current,
        speed: transition.state.speed,
      }));
      if (transition.changed) speedChangesCountRef.current += 1;
    } else if (transition.control === 'volume') {
      scaleEngine.setVolume(transition.state.volume);
      setAccompanimentVolumeState(transition.state.volume);
      if (transition.changed) volumeChangesCountRef.current += 1;
    }

    return {
      status: 'success',
      applied: transition.changed,
      control: transition.control,
      previous_value: transition.previousValue,
      current_value: transition.currentValue,
    };
  }, []);

  const selectExercise = useCallback((exerciseId) => {
    const result = applyExerciseSelection(scaleEngine, exerciseId);
    setActiveExercise(exerciseId);
    setIsPlayingAccompaniment(false);
    setActiveTip(null);
    exercisesPracticedRef.current.add(EXERCISE_NAMES[exerciseId]);
    return result;
  }, []);

  // Process Tool Calls (AssemblyAI Voice Agent Function Calling)
  const handleToolCall = useCallback((toolData) => {
    const name = toolData.name || toolData.function?.name;
    let parameters = toolData.parameters || toolData.arguments || toolData.args || {};
    if (typeof parameters === 'string') {
      try {
        parameters = JSON.parse(parameters);
      } catch {
        throw new Error('Could not parse tool parameters.');
      }
    }

    console.log(`[Tool Call Received]: ${name}`, parameters);

    if (name === 'switch_language') {
      const lang = parameters.language || 'en';
      setVoiceProfile((current) => ({ ...current, language: lang }));
      languageSwitchesCountRef.current += 1;
      return { status: 'success', applied: true, language: lang };
    } else if (name === 'end_session') {
      pendingVoiceEndRef.current = true;
      return { status: 'success', applied: true };
    } else if (name === 'show_vocal_tip') {
      const tipObj = {
        tipType: parameters.tip_type || 'posture',
        title: parameters.title || 'Vocal Technique Tip',
        explanation: parameters.explanation || '',
        timestamp: new Date().toLocaleTimeString(),
      };
      setActiveTip(tipObj);
      tipsCoveredRef.current = upsertCoveredTip(tipsCoveredRef.current, tipObj);
      return { status: 'success', applied: true, tip_type: tipObj.tipType };
    } else if (name === 'control_accompaniment') {
      const action = parameters.action;
      if (action === 'play') {
        const wasPlaying = scaleEngine.isPlaying;
        if (!wasPlaying) scaleEngine.start();
        setIsPlayingAccompaniment(true);
        return {
          status: 'success',
          applied: !wasPlaying,
          playback: 'playing',
          exercise_id: scaleEngine.currentExercise,
        };
      }
      if (action === 'stop') {
        const wasPlaying = scaleEngine.isPlaying;
        scaleEngine.stop();
        setIsPlayingAccompaniment(false);
        return {
          status: 'success',
          applied: wasPlaying,
          playback: 'stopped',
        };
      }
      throw new Error(`Unsupported accompaniment action: ${action || 'missing'}`);
    } else if (name === 'adjust_accompaniment') {
      return applyPlaybackAdjustment(parameters);
    } else if (name === 'select_exercise') {
      return selectExercise(parameters.exercise_id);
    }

    throw new Error(`Unsupported tool: ${name || 'unknown'}`);
  }, [applyPlaybackAdjustment, selectExercise]);

  // Connect to the Voice Agent
  const connect = useCallback(async () => {
    try {
      setStatus('connecting');
      setErrorMessage(null);
      clearReportTransitionTimers();
      setSessionView('voice');
      setReportGenerationStep('analyzing');
      setSessionReport(null);
      setConversation([]);
      conversationRef.current = [];
      setUserTranscript('');
      setAgentTranscript('');
      setActiveTip(null);
      pendingVoiceEndRef.current = false;
      processedToolCallsRef.current.clear();
      setVoiceProfile({
        language: getVoiceLanguage(selectedVoice),
        voice: selectedVoice,
      });

      // Reset and start session metrics timer
      sessionSecondsRef.current = 0;
      setSessionSeconds(0);
      exercisesPracticedRef.current = new Set(['Diaphragmatic Breathing']);
      tipsCoveredRef.current = [];
      languageSwitchesCountRef.current = 0;
      keyShiftsCountRef.current = 0;
      speedChangesCountRef.current = 0;
      volumeChangesCountRef.current = 0;
      performanceTrackerRef.current.reset();
      setSessionPerformance(createEmptySessionPerformance());

      resetAccompanimentEngine(scaleEngine);
      setActiveExercise('warmup_breathing');
      setIsPlayingAccompaniment(false);
      setPlaybackSettings({
        pitchShift: DEFAULT_ACCOMPANIMENT_STATE.pitchShift,
        speed: DEFAULT_ACCOMPANIMENT_STATE.speed,
      });
      setAccompanimentVolumeState(DEFAULT_ACCOMPANIMENT_STATE.volume);

      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
      sessionTimerRef.current = setInterval(() => {
        sessionSecondsRef.current += 1;
        setSessionSeconds(sessionSecondsRef.current);
      }, 1000);

      await pcmPlayerRef.current?.init();

      const ws = new WebSocket(getAgentWebSocketUrl(selectedVoice));
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Connected to Voice Agent proxy');
        sessionActiveRef.current = true;
        setStatus('connected');
      };

      ws.onmessage = async (event) => {
        // In case direct binary audio is received
        if (event.data instanceof ArrayBuffer) {
          setIsSpeaking(true);
          await pcmPlayerRef.current?.playChunk(event.data);
          return;
        }

        try {
          const message = JSON.parse(event.data);
          const eventType = message.type || message.event;

          // 1. Session configuration/runtime error
          if (eventType === 'session.error') {
            console.error('[AssemblyAI Session Error]:', message);
            const code = message.code || message.error?.code;
            const detail = message.message || message.error?.message || 'Voice session error';
            setErrorMessage(`${code ? `${code}: ` : ''}${detail}`);
            setStatus('error');
            return;
          }

          // 2. General proxy/service error
          if (eventType === 'error') {
            console.error('[AssemblyAI Error]:', message);
            setErrorMessage(message.message || 'Voice service error');
            setStatus('error');
            return;
          }

          // 3. Incoming TTS audio chunk from agent (Base64)
          if (eventType === 'reply.audio') {
            setIsSpeaking(true);
            const audioData = message.data || message.audio;
            if (audioData) {
              await pcmPlayerRef.current?.playBase64Chunk(audioData);
            }
            return;
          }

          // 4. Agent reply started
          if (eventType === 'reply.started') {
            setIsSpeaking(true);
            return;
          }

          // 5. Agent reply done (or barge-in interrupted)
          if (eventType === 'reply.done') {
            const wasInterrupted = message.status === 'interrupted' || message.interrupted;
            if (wasInterrupted) {
              console.log('[Barge-in]: Agent interrupted by user');
              pcmPlayerRef.current?.stopAll();
            }
            setIsSpeaking(false);
            if (pendingVoiceEndRef.current && wasInterrupted) {
              pendingVoiceEndRef.current = false;
            }
            return;
          }

          // 6. Interruption event
          if (eventType === 'interruption' || message.interrupted) {
            console.log('[Barge-in]: Interruption detected');
            pcmPlayerRef.current?.stopAll();
            setIsSpeaking(false);
            return;
          }

          // 7. Agent transcript
          if (eventType === 'transcript.agent' || (eventType === 'transcript' && message.role === 'agent')) {
            const text = message.text || '';
            if (text) {
              setAgentTranscript(text);
              setConversation((prev) => {
                const next = [
                  ...prev,
                  { role: 'agent', text, time: new Date().toLocaleTimeString() }
                ];
                conversationRef.current = next;
                return next;
              });
            }
            return;
          }

          // 8. User transcript
          if (eventType === 'transcript.user' || (eventType === 'transcript' && message.role === 'user')) {
            const text = message.text || '';
            if (text) {
              const isNoisePattern = /^(dun|la|brr|hum|na|bum|\.|\s)+$/i.test(text.trim());
              setUserTranscript(text);
              if (!isNoisePattern) {
                setConversation((prev) => {
                  const next = [
                    ...prev,
                    { role: 'user', text, time: new Date().toLocaleTimeString() }
                  ];
                  conversationRef.current = next;
                  return next;
                });
              }
            }
            return;
          }

          // 9. Partial user delta transcript
          if (eventType === 'transcript.user.delta') {
            setUserTranscript(message.text || message.delta || '');
            return;
          }

          // 10. Tool Calling
          if (eventType === 'tool.call' || eventType === 'tool_call') {
            const toolData = message.tool || message;
            const callId = toolData.call_id || toolData.id || message.call_id || message.id;
            if (!callId) {
              console.warn('Tool call received without call_id:', toolData);
              return;
            }

            let outcome = processedToolCallsRef.current.get(callId);
            if (!outcome) {
              try {
                outcome = {
                  result: handleToolCall(toolData),
                  is_error: false,
                };
              } catch (toolError) {
                console.error(`[Tool Execution Error]: ${toolData.name || 'unknown'}`, toolError);
                outcome = {
                  result: {
                    status: 'error',
                    applied: false,
                    message: toolError instanceof Error ? toolError.message : 'Tool execution failed.',
                  },
                  is_error: true,
                };
              }
              processedToolCallsRef.current.set(callId, outcome);
            }

            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'client.tool_result',
                call_id: callId,
                result: outcome.result,
                is_error: outcome.is_error,
              }));
            }
            return;
          }

          // Wait until the farewell audio queue is empty before ending the upstream session.
          if (eventType === 'proxy.playback_drain_requested') {
            const drainResult = await pcmPlayerRef.current?.waitForIdle();
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'client.playback_drained',
                timed_out: Boolean(drainResult?.timedOut),
              }));
            }
            return;
          }

          if (eventType === 'session.ready') {
            console.log('Voice Agent session ready for audio streaming');
            await startMicrophone(ws);
            return;
          }

          if (eventType === 'session.ended') {
            finishSession();
          }
        } catch {
          console.warn('Non-JSON message received:', event.data);
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        setStatus('error');
        setErrorMessage('Connection error. Please check that the backend server is running.');
      };

      ws.onclose = () => {
        console.log('WebSocket closed');
        if (wsRef.current && wsRef.current !== ws) return;
        if (wsRef.current === ws) wsRef.current = null;
        finishSession({ closeSocket: false });
      };
    } catch (err) {
      console.error('Initialization error:', err);
      setStatus('error');
      setErrorMessage(err.message);
    }
  }, [clearReportTransitionTimers, finishSession, handleToolCall, selectedVoice]);

  // Toggle accompaniment playback
  const toggleAccompaniment = useCallback(() => {
    if (scaleEngine.isPlaying) {
      scaleEngine.stop();
      setIsPlayingAccompaniment(false);
    } else {
      scaleEngine.setPitchShift(playbackSettings.pitchShift);
      scaleEngine.setSpeed(playbackSettings.speed);
      scaleEngine.start(activeExercise);
      setIsPlayingAccompaniment(true);
    }
  }, [activeExercise, playbackSettings]);

  // Adjust volume for accompaniment track
  const setAccompanimentVolume = useCallback((vol) => {
    applyPlaybackAdjustment({
      control: 'volume',
      operation: 'set',
      value: vol * 100,
    });
  }, [applyPlaybackAdjustment]);

  // Manually transpose pitch (+/- semitones)
  const adjustPitchManually = useCallback((delta) => {
    applyPlaybackAdjustment({
      control: 'pitch',
      operation: delta >= 0 ? 'increase' : 'decrease',
      value: Math.abs(delta),
    });
  }, [applyPlaybackAdjustment]);

  // Manually adjust tempo speed factor
  const adjustSpeedManually = useCallback((newSpeed) => {
    applyPlaybackAdjustment({
      control: 'speed',
      operation: 'set',
      value: newSpeed,
    });
  }, [applyPlaybackAdjustment]);

  // Disconnect session and generate workout report
  const disconnect = useCallback(() => {
    finishSession();
  }, [finishSession]);

  const startNewSession = useCallback(() => {
    clearReportTransitionTimers();
    setSessionView('starting_new_session');
    scheduleReportTransition(() => {
      connect();
    }, 320);
  }, [clearReportTransitionTimers, connect, scheduleReportTransition]);

  return {
    status,
    isSpeaking,
    isListening,
    userTranscript,
    agentTranscript,
    conversation,
    activeTip,
    setActiveTip,
    playbackSettings,
    activeExercise,
    setActiveExercise: selectExercise,
    isPlayingAccompaniment,
    toggleAccompaniment,
    currentNote,
    currentTarget: currentNote,
    pitchData,
    pitchSignalQuality,
    latestPitchSampleRef,
    latestPitchAnalysisRef,
    sessionPerformance,
    lastExerciseFeedback: sessionPerformance.lastAttempt,
    accompanimentVolume,
    setAccompanimentVolume,
    adjustPitchManually,
    adjustSpeedManually,
    getMicAnalyser: () => micAnalyserRef.current,
    getPlayerAnalyser: () => pcmPlayerRef.current?.getAnalyser() || null,
    sessionView,
    reportGenerationStep,
    sessionReport,
    startNewSession,
    sessionSeconds,
    errorMessage,
    selectedVoice,
    selectVoice,
    voiceProfile,
    connect,
    disconnect,
  };
}
