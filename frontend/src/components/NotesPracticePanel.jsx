import React from 'react';
import { Check, Circle, Mic2, Minus, Plus, Square, Target } from 'lucide-react';

function NoteCard({ target, isActive }) {
  const meterPercent = target.deviationCents === null
    ? 50
    : Math.max(0, Math.min(100, ((target.deviationCents + 50) / 100) * 100));

  return (
    <div className={`rounded-xl border p-3 transition-all ${
      target.status === 'done'
        ? 'border-emerald-500/40 bg-emerald-500/10'
        : isActive
          ? 'border-cyan-500/50 bg-cyan-500/10 shadow-lg shadow-cyan-950/30'
          : 'border-slate-800 bg-slate-950/45'
    }`}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <strong className="block text-lg text-white">{target.noteName}</strong>
          <span className="text-[10px] text-slate-400">{target.frequencyHz} Hz</span>
        </div>
        {target.status === 'done' ? (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-300">
            <Check className="h-3.5 w-3.5" /> Done
          </span>
        ) : isActive ? (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-cyan-300">
            <Mic2 className="h-3.5 w-3.5 animate-pulse" /> Listening
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-500">
            <Circle className="h-3.5 w-3.5 text-slate-700" /> Waiting
          </span>
        )}
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full border border-slate-800 bg-slate-950">
        <div className="relative h-full">
          <div className="absolute inset-y-0 left-[35%] w-[30%] bg-emerald-500/15" />
          {isActive && target.deviationCents !== null && (
            <div
              className="absolute inset-y-0 w-1.5 -translate-x-1/2 rounded-full bg-cyan-300 transition-all duration-75"
              style={{ left: `${meterPercent}%` }}
            />
          )}
        </div>
      </div>

      <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full transition-all duration-75 ${target.status === 'done' ? 'bg-emerald-400' : 'bg-cyan-400'}`}
          style={{ width: `${target.holdProgress * 100}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[9px] text-slate-500">
        <span>{isActive && target.detectedFrequencyHz ? `${target.detectedFrequencyHz} Hz detected` : 'No pitch detected'}</span>
        <span>{isActive && target.deviationCents !== null ? `${target.deviationCents > 0 ? '+' : ''}${target.deviationCents}¢` : ''}</span>
      </div>
    </div>
  );
}

export function NotesPracticePanel({
  practice,
  startState,
  pitchShift,
  onToggle,
  onPitchAdjust,
  disabled = false,
}) {
  const isPending = startState?.phase === 'countdown' || startState?.phase === 'waiting_for_voice';
  const isActive = practice.status === 'active';
  const controlsLocked = disabled || isPending || isActive;

  return (
    <div className="rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/30 via-slate-900/70 to-slate-900/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="m-0 flex items-center gap-2 text-sm font-semibold text-white">
            <Target className="h-4 w-4 text-cyan-300" /> Notes Practice
          </h3>
          <p className="mt-1 mb-0 text-[11px] text-slate-400">
            Match each note in order and hold it in tune for half a second.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-slate-700/60 bg-slate-800/80 p-1 text-xs">
            <span className="px-1 text-[11px] text-slate-400">Key:</span>
            <button
              type="button"
              disabled={controlsLocked || pitchShift <= -6}
              onClick={() => onPitchAdjust(-1)}
              className="cursor-pointer rounded p-1 text-slate-300 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              title="Transpose targets down one semitone"
            >
              <Minus className="h-3 w-3" />
            </button>
            <strong className="px-1 text-white">{pitchShift >= 0 ? `+${pitchShift}` : pitchShift}</strong>
            <button
              type="button"
              disabled={controlsLocked || pitchShift >= 6}
              onClick={() => onPitchAdjust(1)}
              className="cursor-pointer rounded p-1 text-slate-300 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
              title="Transpose targets up one semitone"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
          <button
            type="button"
            disabled={disabled}
            onClick={onToggle}
            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
              isActive || isPending
                ? 'border-rose-500/40 bg-rose-500/20 text-rose-200'
                : 'border-cyan-500/40 bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/30'
            }`}
          >
            {isActive || isPending ? <Square className="h-3.5 w-3.5 fill-current" /> : <Mic2 className="h-3.5 w-3.5" />}
            {isActive ? 'Stop Practice' : isPending ? 'Cancel Start' : 'Start Practice'}
          </button>
        </div>
      </div>

      {startState?.phase === 'countdown' && (
        <p className="mt-3 mb-0 text-center text-xs font-semibold text-amber-200 animate-pulse">
          Starting in {startState.secondsRemaining}
        </p>
      )}
      {startState?.phase === 'waiting_for_voice' && (
        <p className="mt-3 mb-0 text-center text-xs font-semibold text-sky-200 animate-pulse">
          Waiting for Lyra
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {practice.targets.map((target, index) => (
          <NoteCard
            key={`${target.midiNote}-${index}`}
            target={target}
            isActive={isActive && practice.activeIndex === index}
          />
        ))}
      </div>
    </div>
  );
}
