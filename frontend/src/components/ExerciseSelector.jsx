import React from 'react';
import {
  Wind,
  Activity,
  Flame,
  Music2,
  Check,
  Sliders,
  Play,
  Square,
  Volume2,
  VolumeX,
  Plus,
  Minus,
  Radio,
  Sparkles,
} from 'lucide-react';

const EXERCISES = [
  {
    id: 'warmup_breathing',
    name: 'Diaphragmatic Breathing',
    category: 'Preparation',
    duration: '2 min',
    desc: 'Low 4-count inhale with rhythmic metronome & steady "S" exhale.',
    icon: Wind,
  },
  {
    id: 'warmup_lip_trill',
    name: 'Lip Trill (Lip Bubbles)',
    category: 'Vocal Cords',
    duration: '3 min',
    desc: 'Classic 5-note piano scale ("brrr") ascending by half-steps.',
    icon: Flame,
  },
  {
    id: 'warmup_sirens',
    name: 'Vocal Sirens',
    category: 'Resonance',
    duration: '3 min',
    desc: 'Continuous acoustic glissando sweep between chest & head voice.',
    icon: Activity,
  },
  {
    id: 'song_practice',
    name: 'Free Song Practice',
    category: 'Repertoire',
    duration: '5 min',
    desc: 'Looping acoustic piano chord progression with real-time feedback.',
    icon: Music2,
  },
];

export function ExerciseSelector({
  activeExercise,
  onSelectExercise,
  playbackSettings,
  isPlayingAccompaniment,
  accompanimentStart,
  onToggleAccompaniment,
  currentNote,
  accompanimentVolume = 0.4,
  onVolumeChange,
  onPitchAdjust,
  onSpeedAdjust,
  disabled = false,
}) {
  const pitchShift = playbackSettings?.pitchShift || 0;
  const speed = playbackSettings?.speed || 1.0;
  const isStartPending = (
    accompanimentStart?.phase === 'countdown'
    || accompanimentStart?.phase === 'waiting_for_voice'
  );

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 backdrop-blur-sm flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white m-0 flex items-center gap-2">
            <span>Training Routine</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-medium">
              4 Routines
            </span>
          </h2>
          <p className="text-xs text-slate-400 m-0">You can ask Lyra to switch exercises by voice</p>
        </div>

        {/* Key & Speed summary badge */}
        <div className="flex items-center gap-2 text-xs bg-slate-800/80 px-2.5 py-1 rounded-lg text-purple-300 border border-purple-500/20">
          <Sliders className="w-3.5 h-3.5 text-purple-400" />
          <span>Key: {pitchShift >= 0 ? `+${pitchShift}` : pitchShift} st</span>
          <span>•</span>
          <span>Speed: {speed}x</span>
        </div>
      </div>

      {/* Exercise Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {EXERCISES.map((ex) => {
          const Icon = ex.icon;
          const isActive = activeExercise === ex.id;

          return (
            <button
              key={ex.id}
              disabled={disabled}
              onClick={() => onSelectExercise(ex.id)}
              className={`p-3.5 rounded-xl text-left border transition-all cursor-pointer disabled:cursor-not-allowed flex flex-col justify-between ${
                isActive
                  ? 'bg-purple-900/30 border-purple-500/50 shadow-lg shadow-purple-950/20'
                  : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`p-2 rounded-lg ${
                      isActive ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white m-0 leading-tight">{ex.name}</h4>
                    <span className="text-[11px] text-slate-400">{ex.category} • {ex.duration}</span>
                  </div>
                </div>
                {isActive && (
                  <span className="p-1 rounded-full bg-purple-500/20 text-purple-400">
                    <Check className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-400 leading-snug m-0">{ex.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Interactive Scale Accompaniment & Reference Player Bar */}
      <div className="rounded-xl border border-purple-500/30 bg-gradient-to-r from-purple-950/40 via-slate-900/60 to-slate-900/40 p-3.5 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Play/Stop Button & Live Note Status */}
          <div className="flex items-center gap-3">
            <button
              disabled={disabled}
              onClick={onToggleAccompaniment}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 shadow-md ${
                isPlayingAccompaniment || isStartPending
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500 shadow-purple-600/20'
              }`}
            >
              {isPlayingAccompaniment ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-current" /> Stop Scale
                </>
              ) : isStartPending ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-current" /> Cancel Start
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" /> Play Accompaniment
                </>
              )}
            </button>

            {/* Live Playing Note Pill */}
            <div className="flex items-center gap-2">
              {accompanimentStart?.phase === 'countdown' ? (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs font-medium animate-pulse">
                  <Radio className="w-3 h-3 text-amber-400" />
                  <span>Starting in {accompanimentStart.secondsRemaining}</span>
                </div>
              ) : accompanimentStart?.phase === 'waiting_for_voice' ? (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-200 text-xs font-medium animate-pulse">
                  <Radio className="w-3 h-3 text-sky-400" />
                  <span>Waiting for Lyra</span>
                </div>
              ) : isPlayingAccompaniment && currentNote ? (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-200 text-xs font-medium animate-pulse">
                  <Radio className="w-3 h-3 text-purple-400 animate-spin" />
                  <span className="font-semibold">{currentNote.noteName}</span>
                  {currentNote.freq && (
                    <span className="text-[10px] text-purple-400">({currentNote.freq} Hz)</span>
                  )}
                </div>
              ) : (
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-purple-400" /> Reference piano scale & metronome
                </span>
              )}
            </div>
          </div>

          {/* Quick Pitch & Speed Transposition Buttons */}
          <div className="flex items-center gap-2">
            {/* Pitch Shift Controls */}
            <div className="flex items-center gap-1 bg-slate-800/80 border border-slate-700/60 rounded-lg p-1 text-xs">
              <span className="text-[11px] text-slate-400 px-1">Key:</span>
              <button
                disabled={disabled}
                onClick={() => onPitchAdjust && onPitchAdjust(-1)}
                className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                title="Transpose down 1 semitone"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="font-semibold text-white px-1">
                {pitchShift >= 0 ? `+${pitchShift}` : pitchShift}
              </span>
              <button
                disabled={disabled}
                onClick={() => onPitchAdjust && onPitchAdjust(1)}
                className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                title="Transpose up 1 semitone"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            {/* Tempo Multipliers */}
            <div className="flex items-center gap-1 bg-slate-800/80 border border-slate-700/60 rounded-lg p-1 text-xs">
              <span className="text-[11px] text-slate-400 px-1">Speed:</span>
              {[0.85, 1.0, 1.15].map((spd) => (
                <button
                  key={spd}
                  disabled={disabled}
                  onClick={() => onSpeedAdjust && onSpeedAdjust(spd)}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                    speed === spd
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>

            {/* Volume Slider */}
            <div className="hidden md:flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/60 rounded-lg px-2 py-1 text-xs">
              {accompanimentVolume > 0 ? (
                <Volume2 className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-rose-400" />
              )}
              <input
                disabled={disabled}
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={accompanimentVolume}
                onChange={(e) => onVolumeChange && onVolumeChange(parseFloat(e.target.value))}
                className="w-16 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                title={`Accompaniment Volume: ${Math.round(accompanimentVolume * 100)}%`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
