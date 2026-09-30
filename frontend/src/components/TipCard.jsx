import React from 'react';
import { Sparkles, Lightbulb, X, CheckCircle2 } from 'lucide-react';

export function TipCard({ activeTip, onClose }) {
  if (!activeTip) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/30 p-6 text-center text-slate-500 flex flex-col items-center justify-center min-h-[140px]">
        <Lightbulb className="w-8 h-8 text-slate-600 mb-2" />
        <p className="text-sm">Vocal technique guidance cards will appear here automatically when Lyra explains them by voice.</p>
      </div>
    );
  }

  const getTipBadge = (type) => {
    switch (type) {
      case 'diaphragm_breath':
        return { label: 'Breath Control', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
      case 'lip_trill':
        return { label: 'Warm-up', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
      case 'head_voice':
        return { label: 'Resonance', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' };
      case 'vocal_siren':
        return { label: 'Range & Flexibility', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' };
      default:
        return { label: 'Vocal Technique', color: 'text-pink-400 bg-pink-500/10 border-pink-500/20' };
    }
  };

  const badge = getTipBadge(activeTip.tipType);

  return (
    <div className="relative rounded-2xl border border-purple-500/40 bg-gradient-to-br from-slate-900/90 to-purple-950/40 p-5 shadow-xl shadow-purple-950/30 transition-all animate-fade-slide-in">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.color}`}>
            {badge.label}
          </span>
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-purple-400" /> Triggered by Lyra
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Tip Content */}
      <h3 className="text-base font-bold text-white mb-1.5 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
        {activeTip.title}
      </h3>
      <p className="text-sm text-slate-300 leading-relaxed m-0">
        {activeTip.explanation}
      </p>

      {/* Footer hint */}
      <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
        <span>Active technique focus</span>
        <span>{activeTip.timestamp}</span>
      </div>
    </div>
  );
}
