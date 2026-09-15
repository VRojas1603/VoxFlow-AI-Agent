import { useState, useRef, useCallback, useEffect } from 'react';
import { StreamingPCMPlayer } from '../audio/pcmPlayer';

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
  const [errorMessage, setErrorMessage] = useState(null);
  const [voiceProfile, setVoiceProfile] = useState({ language: 'en', voice: 'eve' });

  const wsRef = useRef(null);
  const audioCtxRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const workletNodeRef = useRef(null);
  const pcmPlayerRef = useRef(null);

  // Initialize PCM streaming audio player (AssemblyAI native 24 kHz)
  useEffect(() => {
    pcmPlayerRef.current = new StreamingPCMPlayer(24000);
    return () => {
      pcmPlayerRef.current?.close();
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
    } else if (name === 'show_vocal_tip') {
      setActiveTip({
        tipType: parameters.tip_type || 'posture',
        title: parameters.title || 'Vocal Technique Tip',
        explanation: parameters.explanation || '',
        timestamp: new Date().toLocaleTimeString(),
      });
    } else if (name === 'adjust_music_playback') {
      setPlaybackSettings((prev) => ({
        pitchShift: parameters.pitch_shift !== undefined ? parameters.pitch_shift : prev.pitchShift,
        speed: parameters.playback_speed !== undefined ? parameters.playback_speed : prev.speed,
      }));
    } else if (name === 'select_exercise') {
      if (parameters.exercise_id) {
        setActiveExercise(parameters.exercise_id);
      }
    }
  }, []);

  // Connect to the Voice Agent
  const connect = useCallback(async () => {
    try {
      setStatus('connecting');
      setErrorMessage(null);
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

  // Disconnect session
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    stopMicrophone();
    pcmPlayerRef.current?.stopAll();
    setStatus('disconnected');
    setIsSpeaking(false);
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
    errorMessage,
    voiceProfile,
    switchVoiceManual,
    connect,
    disconnect,
  };
}
