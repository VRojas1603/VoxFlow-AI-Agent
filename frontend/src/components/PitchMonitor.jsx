import React from 'react';
import { Target, Music, Mic, CheckCircle2, AlertCircle } from 'lucide-react';

export function PitchMonitor({ isListening, targetNote, pitchData, signalQuality }) {
  const visiblePitchData = isListening ? pitchData : null;
  const cents = visiblePitchData?.cents ?? 0;
  // Map cents (-50 to +50) to percentage (0% to 100%)
  const meterPercent = Math.max(0, Math.min(100, ((cents + 50) / 100) * 100));

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 backdrop-blur-sm flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white m-0">Vocal Pitch & Tuning Monitor</h3>
            <span className="text-[11px] text-slate-400">Real-time fundamental frequency (f₀)</span>
          </div>
        </div>

        {/* Status Indicator */}
        {isListening ? (
          visiblePitchData && !visiblePitchData.isDecaying ? (
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 border ${
                visiblePitchData.isInTune
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : visiblePitchData.isFlat
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}
            >
              {visiblePitchData.isInTune ? (
                <>
                  <CheckCircle2 className="w-3 h-3" /> In Tune
                </>
              ) : visiblePitchData.isFlat ? (
                <>
                  <AlertCircle className="w-3 h-3" /> Flat ({visiblePitchData.cents}¢)
                </>
              ) : (
                <>
                  <AlertCircle className="w-3 h-3" /> Sharp (+{visiblePitchData.cents}¢)
                </>
              )}
            </span>
          ) : (
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Mic className="w-3 h-3 text-cyan-400 animate-pulse" />
              {signalQuality === 'unclear' ? 'Signal is unclear' : 'Sing to detect pitch'}
            </span>
          )
        ) : (
          <span className="text-[11px] text-slate-500">Connect to activate</span>
        )}
      </div>

      {/* Main Pitch Display */}
      <div className="flex items-center justify-between gap-4 bg-slate-950/60 rounded-xl p-3 border border-slate-800/80">
        {/* Detected Note */}
        <div className="flex items-center gap-3">
          <div
            className={`w-14 h-14 rounded-xl flex items-center justify-center font-bold text-xl border transition-all ${
              visiblePitchData && !visiblePitchData.isDecaying
                ? visiblePitchData.isInTune
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-lg shadow-emerald-950/40'
                  : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-lg shadow-cyan-950/40'
                : 'bg-slate-900 text-slate-600 border-slate-800'
            }`}
          >
            {visiblePitchData && !visiblePitchData.isDecaying ? visiblePitchData.noteName : '—'}
          </div>
          <div>
            <span className="text-xs text-slate-400 block">Sung Pitch</span>
            <span className="text-sm font-semibold text-white">
              {visiblePitchData && !visiblePitchData.isDecaying ? `${visiblePitchData.freq} Hz` : '0.0 Hz'}
            </span>
          </div>
        </div>

        {/* Target Reference Note (from accompaniment engine) */}
        {targetNote && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-950/30 border border-purple-500/30 text-xs">
            <Music className="w-3.5 h-3.5 text-purple-400" />
            <div>
              <span className="text-[10px] text-purple-300 block">Target Scale Note</span>
              <span className="font-bold text-white">{targetNote.noteName}</span>
            </div>
          </div>
        )}
      </div>

      {/* Tuning Meter Bar (-50 cents to +50 cents) */}
      <div className="flex flex-col gap-1.5 px-1">
        <div className="flex justify-between text-[10px] text-slate-400 font-mono">
          <span>-50¢ (Flat)</span>
          <span className="text-emerald-400 font-semibold">Perfect (0¢)</span>
          <span>+50¢ (Sharp)</span>
        </div>

        <div className="relative w-full h-3 bg-slate-950 rounded-full border border-slate-800 overflow-hidden">
          {/* Center in-tune zone indicator */}
          <div className="absolute left-[40%] h-full w-[20%] bg-emerald-500/15" />
          <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-0.5 bg-emerald-400/60 z-10" />

          {/* Needle / Indicator indicator */}
          {visiblePitchData && !visiblePitchData.isDecaying && (
            <div
              className={`absolute top-0 bottom-0 w-3 -ml-1.5 rounded-full transition-all duration-75 shadow-md ${
                visiblePitchData.isInTune
                  ? 'bg-emerald-400 shadow-emerald-400/50 scale-y-125'
                  : visiblePitchData.isFlat
                  ? 'bg-amber-400 shadow-amber-400/50'
                  : 'bg-rose-400 shadow-rose-400/50'
              }`}
              style={{ left: `${meterPercent}%` }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
