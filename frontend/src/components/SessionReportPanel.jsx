import React from 'react';
import {
  Activity,
  Clock3,
  Download,
  Gauge,
  RotateCcw,
  Sparkles,
  Target,
  Wind,
} from 'lucide-react';
import { serializeSessionReport } from '../reports/sessionReport';

function downloadSessionReport(report) {
  const blob = new Blob([serializeSessionReport(report)], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `VoxFlow-Session-${report.completedAt.slice(0, 10)}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-950/45 px-3 py-2.5">
      <span className="block text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
      <strong className="mt-0.5 block text-sm text-white">{value}</strong>
    </div>
  );
}

function AttemptCard({ title, attempt, type }) {
  if (!attempt) {
    return (
      <div className="rounded-2xl border border-slate-800/70 bg-slate-950/35 p-4">
        <h3 className="text-sm font-semibold text-white m-0">{title}</h3>
        <p className="mt-2 mb-0 text-xs text-slate-500">No completed attempts were available.</p>
      </div>
    );
  }

  const metrics = type === 'lip_trill'
    ? [
        ['Detected notes', `${attempt.metrics.detectedNotes}/${attempt.metrics.expectedNotes}`],
        ['Within tolerance', `${attempt.metrics.withinTolerancePercent}%`],
        ['Median deviation', `${attempt.metrics.medianDeviationCents}¢`],
      ]
    : [
        ['Range', `${attempt.metrics.rangeSemitones} semitones`],
        ['Continuity', `${attempt.metrics.continuityPercent}%`],
        ['Direction match', `${attempt.metrics.directionMatchPercent}%`],
      ];

  return (
    <div className="rounded-2xl border border-slate-800/70 bg-slate-950/45 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-white m-0">{title}</h3>
        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
          attempt.signalQuality === 'valid'
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
            : attempt.signalQuality === 'partial'
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
              : 'border-slate-700 bg-slate-800/60 text-slate-400'
        }`}>
          {attempt.signalQuality.replace('_', ' ')}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {metrics.map(([label, value]) => <Metric key={label} label={label} value={value} />)}
      </div>
      <p className="m-0 text-xs leading-relaxed text-slate-400">{attempt.focusAreas[0]}</p>
    </div>
  );
}

export function SessionReportPanel({ report, onStartNewSession, actionsDisabled = false }) {
  const latestLipTrill = report.lipTrillAttempts.at(-1);
  const latestSiren = report.sirenAttempts.at(-1);

  return (
    <div className="relative z-10 px-1 py-2 sm:px-3" aria-labelledby="session-report-title">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-purple-300">
              Session complete
            </span>
            <h2 id="session-report-title" className="mt-1 mb-0 text-2xl font-bold text-white">
              Vocal Practice Report
            </h2>
            <p className="mt-1 mb-0 text-sm text-slate-400">
              Review the activities and measured feedback from this session.
            </p>
          </div>
          <span className="self-start rounded-full border border-slate-700/70 bg-slate-900/70 px-3 py-1.5 text-xs text-slate-300">
            {new Date(report.completedAt).toLocaleString()}
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <Metric label="Duration" value={report.durationFormatted} />
          <Metric label="Activities" value={report.exercisesPracticed.length} />
          <Metric label="Breathing cycles" value={report.breathingCycles} />
          <Metric label="Evaluated attempts" value={report.evaluatedAttempts} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <AttemptCard title="Latest Lip Trill" attempt={latestLipTrill} type="lip_trill" />
          <AttemptCard title="Latest Vocal Siren" attempt={latestSiren} type="siren" />
        </div>

        <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-r from-purple-950/45 to-slate-900/60 p-4 flex items-start gap-3">
          <div className="mt-0.5 rounded-lg border border-purple-500/20 bg-purple-500/10 p-2">
            <Sparkles className="w-4 h-4 text-purple-300" />
          </div>
          <div>
            <span className="block text-xs font-semibold text-purple-200">Lyra's Feedback</span>
            <p className="mt-1.5 mb-2 text-sm leading-relaxed text-slate-200">
              {report.finalFeedback.text}
            </p>
            <span className="text-xs text-slate-400">
              <strong className="text-slate-300">Next action:</strong> {report.finalFeedback.nextAction}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-slate-800/70 bg-slate-950/35 px-4 py-3 text-xs text-slate-400">
          <span className="flex items-center gap-1.5"><Target className="w-3.5 h-3.5 text-cyan-400" /> Key shifts: {report.playbackAdjustments.keyShifts}</span>
          <span className="flex items-center gap-1.5"><Gauge className="w-3.5 h-3.5 text-amber-400" /> Speed changes: {report.playbackAdjustments.speedChanges}</span>
          <span className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-pink-400" /> Volume changes: {report.playbackAdjustments.volumeChanges}</span>
          <span className="flex items-center gap-1.5"><Wind className="w-3.5 h-3.5 text-emerald-400" /> Tips covered: {report.tipsCovered.length}</span>
          <span className="flex items-center gap-1.5"><Clock3 className="w-3.5 h-3.5 text-purple-400" /> Spoken turns: {report.messageCount}</span>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-1">
          <button
            type="button"
            disabled={actionsDisabled}
            onClick={() => downloadSessionReport(report)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-4 h-4" /> Download Report (.txt)
          </button>
          <button
            type="button"
            disabled={actionsDisabled}
            onClick={onStartNewSession}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-purple-600/25 transition-all hover:from-purple-500 hover:to-pink-500 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" /> Start New Session
          </button>
        </div>
      </div>
    </div>
  );
}
