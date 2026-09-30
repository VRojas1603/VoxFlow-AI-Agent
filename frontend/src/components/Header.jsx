import React from 'react';
import { Mic, Radio, Music, Sparkles, Languages } from 'lucide-react';
import { VoiceSelector } from './VoiceSelector';
import { getVoice } from '../data/voices';

export function Header({
  status,
  onConnect,
  onDisconnect,
  selectedVoice,
  onVoiceChange,
  voiceProfile,
  sessionSeconds = 0,
  isSessionReview = false,
  sessionView = 'voice',
}) {
  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';
  const isReportReady = sessionView === 'report_ready' || sessionView === 'starting_new_session';
  const activeVoice = getVoice(voiceProfile?.voice);

  const mins = Math.floor(sessionSeconds / 60);
  const secs = sessionSeconds % 60;
  const durationFormatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-pink-500 to-amber-400 p-0.5 shadow-lg shadow-purple-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Music className="w-5 h-5 text-purple-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white m-0">VoxFlow</h1>
              <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> AssemblyAI Hackathon
              </span>
            </div>
            <p className="text-xs text-slate-400 m-0">Interactive vocal training & warm-up powered by voice</p>
          </div>
        </div>

        {/* Status indicator & Voice profile & Connect Action */}
        <div className="flex flex-wrap items-center justify-end gap-3">
          {status === 'disconnected' && !isSessionReview && (
            <VoiceSelector value={selectedVoice} onChange={onVoiceChange} />
          )}

          {/* Live Training Timer */}
          {isConnected && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-950/40 border border-purple-500/30 text-xs text-purple-300 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-ping" />
              <span>{durationFormatted}</span>
            </div>
          )}

          {/* Active Voice Badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <Languages className="w-3.5 h-3.5 text-purple-400" />
            <span>Voice:</span>
            <span className="font-semibold text-white capitalize">
              {activeVoice.flag} {activeVoice.name} · {voiceProfile?.language?.toUpperCase()}
            </span>
          </div>

          {/* Connection Status */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <span
              className={`w-2 h-2 rounded-full ${
                isSessionReview
                  ? 'bg-purple-400'
                  : isConnected
                  ? 'bg-emerald-400 animate-pulse'
                  : isConnecting
                  ? 'bg-amber-400 animate-ping'
                  : 'bg-slate-600'
              }`}
            />
            <span>
              {isSessionReview
                ? isReportReady ? 'Session Complete' : 'Generating Report'
                : isConnected
                ? 'Live Connected'
                : isConnecting
                ? 'Connecting to Lyra...'
                : 'Disconnected'}
            </span>
          </div>

          {/* Connect / Disconnect button */}
          {isSessionReview ? null : isConnected ? (
            <button
              onClick={onDisconnect}
              className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Radio className="w-4 h-4 animate-pulse" />
              End Session
            </button>
          ) : (
            <button
              onClick={onConnect}
              disabled={isConnecting}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-sm font-semibold shadow-lg shadow-purple-600/30 transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              <Mic className="w-4 h-4" />
              {isConnecting ? 'Starting...' : 'Start with Lyra'}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
