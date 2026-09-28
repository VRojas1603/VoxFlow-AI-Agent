import React from 'react';
import {
  Trophy,
  Clock,
  Flame,
  Lightbulb,
  Globe2,
  Sliders,
  Download,
  X,
  Sparkles,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';

export function SessionSummaryModal({ isOpen, onClose, stats, onStartNewSession }) {
  if (!isOpen || !stats) return null;

  const {
    durationFormatted = '00:00',
    exercisesPracticed = [],
    tipsCovered = [],
    languageSwitches = 0,
    keyShiftsUsed = 0,
    speedChangesUsed = 0,
    messageCount = 0,
  } = stats;

  const handleDownloadReport = () => {
    const reportText = `
=== VoxFlow Vocal Coaching Session Report ===
Date: ${new Date().toLocaleString()}
Coach: Lyra (AssemblyAI Voice Agent)
Session Duration: ${durationFormatted}
Messages Exchanged: ${messageCount}
Bilingual Language Switches: ${languageSwitches}

-- Exercises Practiced --
${exercisesPracticed.length > 0 ? exercisesPracticed.map((ex) => `• ${ex}`).join('\n') : '• Free song practice'}

-- Vocal Techniques & Tips Covered --
${tipsCovered.length > 0 ? tipsCovered.map((tip) => `• ${tip.title}: ${tip.explanation}`).join('\n') : '• General vocal warm-up'}

Key Pitch Shifts Tested: ${keyShiftsUsed}
Playback Speed Changes: ${speedChangesUsed}

Lyra's Recommendation for Next Session:
"Keep focusing on low diaphragmatic breath support before high register notes, and maintain relaxed jaw posture during vocal sirens."
=============================================
    `.trim();

    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `VoxFlow-Session-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg rounded-3xl border border-purple-500/40 bg-gradient-to-b from-slate-900 via-slate-950 to-purple-950/40 p-6 shadow-2xl shadow-purple-950/50 text-slate-100 flex flex-col gap-5 overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-500 to-pink-500 p-0.5 shadow-lg shadow-purple-500/30">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Trophy className="w-5 h-5 text-purple-400" />
              </div>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white m-0">Vocal Workout Summary</h2>
              <p className="text-xs text-slate-400 m-0">Lyra Session Performance Report</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4 Stat Metric Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Duration */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3 flex flex-col items-center text-center">
            <Clock className="w-4 h-4 text-purple-400 mb-1" />
            <span className="text-[10px] text-slate-400">Duration</span>
            <span className="text-sm font-bold text-white">{durationFormatted}</span>
          </div>

          {/* Exercises */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3 flex flex-col items-center text-center">
            <Flame className="w-4 h-4 text-amber-400 mb-1" />
            <span className="text-[10px] text-slate-400">Exercises</span>
            <span className="text-sm font-bold text-white">{exercisesPracticed.length || 1}</span>
          </div>

          {/* Tips Covered */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3 flex flex-col items-center text-center">
            <Lightbulb className="w-4 h-4 text-cyan-400 mb-1" />
            <span className="text-[10px] text-slate-400">Tips Learnt</span>
            <span className="text-sm font-bold text-white">{tipsCovered.length}</span>
          </div>

          {/* Code-Switching / Voice */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3 flex flex-col items-center text-center">
            <Globe2 className="w-4 h-4 text-pink-400 mb-1" />
            <span className="text-[10px] text-slate-400">Languages</span>
            <span className="text-sm font-bold text-white">{languageSwitches > 0 ? 'EN & ES' : 'English'}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 rounded-xl border border-slate-800/80 bg-slate-900/40 px-3 py-2 text-[11px] text-slate-300">
          <span className="flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-purple-400" />
            Key shifts: <strong className="text-white">{keyShiftsUsed}</strong>
          </span>
          <span>
            Speed changes: <strong className="text-white">{speedChangesUsed}</strong>
          </span>
        </div>

        {/* Techniques & Exercises Practiced List */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Completed Routine
            </span>
            <span className="text-[11px] text-purple-400 font-medium">
              {messageCount} Spoken Turns
            </span>
          </div>

          <div className="space-y-1.5 text-xs text-slate-300">
            {exercisesPracticed.length > 0 ? (
              exercisesPracticed.map((ex, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  <span>{ex}</span>
                </div>
              ))
            ) : (
              <div className="flex items-center gap-2 text-slate-400">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                <span>Diaphragmatic Breathing & Vocal Warm-up</span>
              </div>
            )}
          </div>
        </div>

        {/* Lyra's Personal Recommendation */}
        <div className="bg-gradient-to-r from-purple-950/40 to-slate-900/60 border border-purple-500/30 rounded-2xl p-4 text-xs text-slate-300 flex items-start gap-3">
          <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-purple-200 block mb-1">Lyra's Takeaway</span>
            <p className="m-0 leading-relaxed text-slate-300">
              "Great work warming up your vocal cords today! Remember to keep your throat relaxed and focus on steady diaphragm breath support for higher pitch stability."
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            onClick={handleDownloadReport}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" /> Download Report (.txt)
          </button>

          <button
            onClick={onStartNewSession}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/30 transition-all cursor-pointer flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" /> Start New Session
          </button>
        </div>
      </div>
    </div>
  );
}
