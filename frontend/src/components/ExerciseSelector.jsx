import React from 'react';
import { Wind, Activity, Flame, Music2, Check, Sliders } from 'lucide-react';

const EXERCISES = [
  {
    id: 'warmup_breathing',
    name: 'Diaphragmatic Breathing',
    category: 'Preparation',
    duration: '2 min',
    desc: 'Low 4-count inhale with controlled, steady "S" sound exhalation.',
    icon: Wind,
  },
  {
    id: 'warmup_lip_trill',
    name: 'Lip Trill (Lip Bubbles)',
    category: 'Vocal Cords',
    duration: '3 min',
    desc: 'Gentle lip vibration over 3-note and 5-note scales ("brrr").',
    icon: Flame,
  },
  {
    id: 'warmup_sirens',
    name: 'Vocal Sirens',
    category: 'Resonance',
    duration: '3 min',
    desc: 'Smooth glissando sliding from low register to high register.',
    icon: Activity,
  },
  {
    id: 'song_practice',
    name: 'Free Song Practice',
    category: 'Repertoire',
    duration: '5 min',
    desc: 'Sing any phrase freely and get immediate vocal coach guidance.',
    icon: Music2,
  },
];

export function ExerciseSelector({ activeExercise, onSelectExercise, playbackSettings }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-white m-0">Training Routine</h2>
          <p className="text-xs text-slate-400 m-0">You can ask Lyra to switch exercises by voice</p>
        </div>
        {playbackSettings && (
          <div className="flex items-center gap-2 text-xs bg-slate-800/80 px-2.5 py-1 rounded-lg text-purple-300 border border-purple-500/20">
            <Sliders className="w-3.5 h-3.5 text-purple-400" />
            <span>Key: {playbackSettings.pitchShift >= 0 ? `+${playbackSettings.pitchShift}` : playbackSettings.pitchShift} st</span>
            <span>•</span>
            <span>Speed: {playbackSettings.speed}x</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {EXERCISES.map((ex) => {
          const Icon = ex.icon;
          const isActive = activeExercise === ex.id;

          return (
            <button
              key={ex.id}
              onClick={() => onSelectExercise(ex.id)}
              className={`p-3.5 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
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
    </div>
  );
}
