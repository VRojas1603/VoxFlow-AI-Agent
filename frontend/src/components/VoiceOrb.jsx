import React from 'react';
import { Mic, Volume2, Sparkles, MessageSquare, Activity } from 'lucide-react';
import { AudioVisualizer } from './AudioVisualizer';

export function VoiceOrb({
  status,
  isSpeaking,
  isListening,
  agentTranscript,
  userTranscript,
  getMicAnalyser,
  getPlayerAnalyser,
}) {
  const isConnected = status === 'connected';

  return (
    <div className="flex flex-col items-center justify-center p-6 text-center">
      {/* Central Visual Orb with Real-time Canvas Spectrum Visualizer */}
      <div className="relative flex items-center justify-center my-8 w-64 h-64">
        {/* Real-time HTML5 Canvas Radial Audio Frequency Spectrum */}
        <AudioVisualizer
          getMicAnalyser={getMicAnalyser}
          getPlayerAnalyser={getPlayerAnalyser}
          isSpeaking={isSpeaking}
          isListening={isListening}
          isConnected={isConnected}
        />

        {/* Ambient Glow Aura */}
        <div
          className={`absolute w-48 h-48 rounded-full blur-3xl transition-all duration-700 pointer-events-none ${
            isSpeaking
              ? 'bg-purple-600/40 scale-125 animate-pulse'
              : isListening
              ? 'bg-cyan-500/30 scale-110'
              : isConnected
              ? 'bg-slate-700/20 scale-95'
              : 'bg-purple-900/10 scale-90'
          }`}
        />

        {/* Main Core Interactive Orb */}
        <div
          className={`relative z-10 w-28 h-28 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 border ${
            isSpeaking
              ? 'bg-gradient-to-br from-purple-500 via-pink-600 to-amber-500 border-purple-300/50 shadow-purple-500/50 scale-105'
              : isListening
              ? 'bg-gradient-to-br from-cyan-600 via-blue-600 to-indigo-700 border-cyan-300/50 shadow-cyan-500/40 scale-100'
              : isConnected
              ? 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 shadow-slate-900/50'
              : 'bg-slate-900 border-slate-800 text-slate-500'
          }`}
        >
          {isSpeaking ? (
            <Volume2 className="w-10 h-10 text-white animate-bounce" />
          ) : isListening ? (
            <Mic className="w-10 h-10 text-cyan-200 animate-pulse" />
          ) : isConnected ? (
            <Sparkles className="w-10 h-10 text-purple-400" />
          ) : (
            <Mic className="w-10 h-10 text-slate-600" />
          )}
        </div>
      </div>

      {/* State & Real-time Spectrum Mode Label */}
      <div className="mt-1 text-center flex items-center justify-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium tracking-wide uppercase ${
            isSpeaking
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
              : isListening
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
              : isConnected
              ? 'bg-slate-800 text-slate-400 border border-slate-700/50'
              : 'bg-slate-900 text-slate-500'
          }`}
        >
          {isListening && <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />}
          {isSpeaking
            ? 'Lyra is speaking (you can interrupt)'
            : isListening
            ? 'Live Audio Spectrum Active • Listening to you...'
            : isConnected
            ? 'Standing by'
            : 'Click Start to connect'}
        </span>
      </div>

      {/* Live speech preview bubbles */}
      <div className="w-full max-w-xl mt-6 min-h-[70px] flex flex-col items-center justify-center gap-2">
        {userTranscript && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-cyan-950/40 border border-cyan-800/40 text-cyan-200 text-sm animate-fade-in max-w-md">
            <Mic className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="italic">"{userTranscript}"</span>
          </div>
        )}

        {agentTranscript && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-purple-950/40 border border-purple-800/40 text-purple-200 text-sm animate-fade-in max-w-md">
            <MessageSquare className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span>{agentTranscript}</span>
          </div>
        )}
      </div>
    </div>
  );
}
