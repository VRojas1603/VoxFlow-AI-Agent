import { useState, useRef, useCallback, useEffect } from 'react';
import { StreamingPCMPlayer } from '../audio/pcmPlayer';
import { scaleEngine } from '../audio/scaleEngine';

const WS_URL = import.meta.env.VITE_WS_PROXY_URL || 'ws://localhost:8000/ws/agent';

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
  const [playbackSettings, setPlaybackSettings] = useState({ pitchShift: 0, speed: 1.0 });
  const [activeExercise, setActiveExercise] = useState('warmup_breathing');
  const [isPlayingAccompaniment, setIsPlayingAccompaniment] = useState(false);
  const [currentNote, setCurrentNote] = useState(null);
  const [accompanimentVolume, setAccompanimentVolumeState] = useState(0.4);
  const [errorMessage, setErrorMessage] = useState(null);
  const [voiceProfile, setVoiceProfile] = useState({ language: 'en', voice: 'eve' });
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [summaryStats, setSummaryStats] = useState(null);
  const [sessionSeconds, setSessionSeconds] = useState(0);

  const wsRef = useRef(null);
  const audioCtxRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const workletNodeRef = useRef(null);
  const pcmPlayerRef = useRef(null);
  const micAnalyserRef = useRef(null);
  const sessionTimerRef = useRef(null);
  const sessionSecondsRef = useRef(0);
  const exercisesPracticedRef = useRef(new Set(['Diaphragmatic Breathing']));
  const tipsCoveredRef = useRef([]);
  const languageSwitchesCountRef = useRef(0);
  const keyShiftsCountRef = useRef(0);

  // Initialize PCM streaming audio player (AssemblyAI native 24 kHz) and Scale Engine callback
  useEffect(() => {
    pcmPlayerRef.current = new StreamingPCMPlayer(24000);
    scaleEngine.onNoteChange((noteInfo) => {
      setCurrentNote(noteInfo);
    });

    return () => {
      pcmPlayerRef.current?.close();
      scaleEngine.stop();
    };
  }, []);

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
  const stopMicrophone = () => {
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
  };

  // Switch voice dynamically
  const switchVoiceManual = useCallback((lang, voiceName) => {
    const targetVoice = voiceName || (lang === 'es' ? 'lola' : 'eve');
    setVoiceProfile({ language: lang, voice: targetVoice });
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'change_voice',
        voice: targetVoice,
        language: lang,
      }));
    }
  }, []);

  // Process Tool Calls (AssemblyAI Voice Agent Function Calling)
  const handleToolCall = useCallback((toolData) => {
    const name = toolData.name || toolData.function?.name;
    let parameters = toolData.parameters || toolData.arguments || toolData.args || {};
    if (typeof parameters === 'string') {
      try {
        parameters = JSON.parse(parameters);
      } catch (e) {
        console.warn('Could not parse tool parameters:', parameters);
      }
    }

    console.log(`[Tool Call Received]: ${name}`, parameters);

    if (name === 'switch_language_voice') {
      const lang = parameters.language || 'en';
      const voice = parameters.voice || (lang === 'es' ? 'lola' : 'eve');
      setVoiceProfile({ language: lang, voice });
      languageSwitchesCountRef.current += 1;
    } else if (name === 'show_vocal_tip') {
      const tipObj = {
        tipType: parameters.tip_type || 'posture',
        title: parameters.title || 'Vocal Technique Tip',
        explanation: parameters.explanation || '',
        timestamp: new Date().toLocaleTimeString(),
      };
      setActiveTip(tipObj);
      tipsCoveredRef.current.push(tipObj);
    } else if (name === 'adjust_music_playback') {
      keyShiftsCountRef.current += 1;
      setPlaybackSettings((prev) => {
        const nextPitch = parameters.pitch_shift !== undefined ? parameters.pitch_shift : prev.pitchShift;
        const nextSpeed = parameters.playback_speed !== undefined ? parameters.playback_speed : prev.speed;
        scaleEngine.setPitchShift(nextPitch);
        scaleEngine.setSpeed(nextSpeed);
        return { pitchShift: nextPitch, speed: nextSpeed };
      });
    } else if (name === 'select_exercise') {
      if (parameters.exercise_id) {
        const exNames = {
          warmup_breathing: 'Diaphragmatic Breathing',
          warmup_lip_trill: 'Lip Trill Scale',
          warmup_sirens: 'Vocal Sirens',
          song_practice: 'Free Song Practice',
        };
        setActiveExercise(parameters.exercise_id);
        scaleEngine.setExercise(parameters.exercise_id);
        exercisesPracticedRef.current.add(exNames[parameters.exercise_id] || parameters.exercise_id);
      }
    }
  }, []);

  // Connect to the Voice Agent
  const connect = useCallback(async () => {
    try {
      setStatus('connecting');
      setErrorMessage(null);
      setIsSummaryOpen(false);

      // Reset and start session metrics timer
      sessionSecondsRef.current = 0;
      setSessionSeconds(0);
      exercisesPracticedRef.current = new Set(['Diaphragmatic Breathing']);
      tipsCoveredRef.current = [];
      languageSwitchesCountRef.current = 0;
      keyShiftsCountRef.current = 0;

      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
      sessionTimerRef.current = setInterval(() => {
        sessionSecondsRef.current += 1;
        setSessionSeconds(sessionSecondsRef.current);
      }, 1000);

      await pcmPlayerRef.current?.init();

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = async () => {
        console.log('Connected to Voice Agent proxy');
        setStatus('connected');
        await startMicrophone(ws);
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

          // 1. Error
          if (eventType === 'error') {
            console.error('[AssemblyAI Error]:', message);
            setErrorMessage(message.message || 'Voice service error');
            setStatus('error');
            return;
          }

          // 2. Incoming TTS audio chunk from agent (Base64)
          if (eventType === 'reply.audio') {
            setIsSpeaking(true);
            const audioData = message.data || message.audio;
            if (audioData) {
              await pcmPlayerRef.current?.playBase64Chunk(audioData);
            }
            return;
          }

          // 3. Agent reply started
          if (eventType === 'reply.started') {
            setIsSpeaking(true);
            return;
          }

          // 4. Agent reply done (or barge-in interrupted)
          if (eventType === 'reply.done') {
            if (message.status === 'interrupted' || message.interrupted) {
              console.log('[Barge-in]: Agent interrupted by user');
              pcmPlayerRef.current?.stopAll();
            }
            setIsSpeaking(false);
            return;
          }

          // 5. Interruption event
          if (eventType === 'interruption' || message.interrupted) {
            console.log('[Barge-in]: Interruption detected');
            pcmPlayerRef.current?.stopAll();
            setIsSpeaking(false);
            return;
          }

          // 6. Agent transcript
          if (eventType === 'transcript.agent' || (eventType === 'transcript' && message.role === 'agent')) {
            const text = message.text || '';
            if (text) {
              setAgentTranscript(text);
              setConversation((prev) => [
                ...prev,
                { role: 'agent', text, time: new Date().toLocaleTimeString() }
              ]);
            }
            return;
          }

          // 7. User transcript
          if (eventType === 'transcript.user' || (eventType === 'transcript' && message.role === 'user')) {
            const text = message.text || '';
            if (text) {
              setUserTranscript(text);
              setConversation((prev) => [
                ...prev,
                { role: 'user', text, time: new Date().toLocaleTimeString() }
              ]);
            }
            return;
          }

          // 8. Partial user delta transcript
          if (eventType === 'transcript.user.delta') {
            setUserTranscript(message.text || message.delta || '');
            return;
          }

          // 9. Tool Calling
          if (eventType === 'tool.call' || eventType === 'tool_call') {
            handleToolCall(message.tool || message);
            return;
          }

          if (eventType === 'session.ready') {
            console.log('Voice Agent session ready for audio streaming');
          }
        } catch (e) {
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
        setStatus('disconnected');
        stopMicrophone();
        pcmPlayerRef.current?.stopAll();
        setIsSpeaking(false);
      };
    } catch (err) {
      console.error('Initialization error:', err);
      setStatus('error');
      setErrorMessage(err.message);
    }
  }, [handleToolCall]);

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
    setAccompanimentVolumeState(vol);
    scaleEngine.setVolume(vol);
  }, []);

  // Manually transpose pitch (+/- semitones)
  const adjustPitchManually = useCallback((delta) => {
    setPlaybackSettings((prev) => {
      const newShift = Math.max(-6, Math.min(6, prev.pitchShift + delta));
      scaleEngine.setPitchShift(newShift);
      return { ...prev, pitchShift: newShift };
    });
  }, []);

  // Manually adjust tempo speed factor
  const adjustSpeedManually = useCallback((newSpeed) => {
    setPlaybackSettings((prev) => {
      scaleEngine.setSpeed(newSpeed);
      return { ...prev, speed: newSpeed };
    });
  }, []);

  // Disconnect session and generate workout report
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    stopMicrophone();
    pcmPlayerRef.current?.stopAll();
    scaleEngine.stop();
    setIsPlayingAccompaniment(false);
    setStatus('disconnected');
    setIsSpeaking(false);

    if (sessionTimerRef.current) {
      clearInterval(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }

    const mins = Math.floor(sessionSecondsRef.current / 60);
    const secs = sessionSecondsRef.current % 60;
    const durationFormatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    setSummaryStats({
      durationFormatted: sessionSecondsRef.current > 0 ? durationFormatted : '00:45',
      exercisesPracticed: Array.from(exercisesPracticedRef.current),
      tipsCovered: [...tipsCoveredRef.current],
      languageSwitches: languageSwitchesCountRef.current,
      keyShiftsUsed: keyShiftsCountRef.current,
      messageCount: conversation.length,
    });
    setIsSummaryOpen(true);
  }, [conversation.length]);

  const closeSummary = useCallback(() => {
    setIsSummaryOpen(false);
  }, []);

  const openSummary = useCallback(() => {
    setIsSummaryOpen(true);
  }, []);

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
    setPlaybackSettings,
    activeExercise,
    setActiveExercise,
    isPlayingAccompaniment,
    toggleAccompaniment,
    currentNote,
    accompanimentVolume,
    setAccompanimentVolume,
    adjustPitchManually,
    adjustSpeedManually,
    getMicAnalyser: () => micAnalyserRef.current,
    getPlayerAnalyser: () => pcmPlayerRef.current?.getAnalyser() || null,
    isSummaryOpen,
    summaryStats,
    openSummary,
    closeSummary,
    sessionSeconds,
    errorMessage,
    voiceProfile,
    switchVoiceManual,
    connect,
    disconnect,
  };
}
