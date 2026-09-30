import React from 'react';
import { AudioLines, ChartNoAxesCombined, FileCheck2 } from 'lucide-react';

const STEPS = [
  {
    id: 'analyzing',
    label: 'Analyzing completed exercises',
    icon: AudioLines,
  },
  {
    id: 'preparing',
    label: 'Preparing coaching feedback',
    icon: ChartNoAxesCombined,
  },
  {
    id: 'finalizing',
    label: 'Finalizing your session report',
    icon: FileCheck2,
  },
];

export function SessionReportLoading({ activeStep = 'analyzing' }) {
  const activeIndex = STEPS.findIndex((step) => step.id === activeStep);

  return (
    <div className="relative z-10 min-h-[390px] flex flex-col items-center justify-center px-4 py-10 text-center">
      <div className="relative w-24 h-24 mb-7" aria-hidden="true">
        <div className="absolute inset-0 rounded-full border border-purple-400/20 animate-ping" />
        <div className="absolute inset-2 rounded-full border-2 border-slate-700 border-t-purple-400 animate-spin" />
        <div className="absolute inset-5 rounded-full bg-gradient-to-br from-purple-600/40 to-pink-600/30 border border-purple-400/30 flex items-center justify-center shadow-xl shadow-purple-950/50">
          <ChartNoAxesCombined className="w-8 h-8 text-purple-200" />
        </div>
      </div>

      <h2 className="text-xl font-bold text-white m-0">Generating Your Session Report</h2>
      <p className="mt-2 mb-7 text-sm text-slate-400 max-w-md">
        VoxFlow is organizing your completed exercises and measured vocal performance.
      </p>

      <div className="w-full max-w-md space-y-2" role="status" aria-live="polite">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === activeIndex;
          const isComplete = index < activeIndex;
          return (
            <div
              key={step.id}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors duration-300 ${
                isActive
                  ? 'border-purple-500/40 bg-purple-500/10 text-purple-100'
                  : isComplete
                    ? 'border-emerald-500/20 bg-emerald-500/5 text-slate-300'
                    : 'border-slate-800/70 bg-slate-950/30 text-slate-500'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'animate-pulse text-purple-300' : ''}`} />
              <span className="text-sm font-medium">{step.label}</span>
              <span className="ml-auto text-xs" aria-hidden="true">
                {isComplete ? 'Done' : isActive ? 'In progress' : 'Waiting'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
