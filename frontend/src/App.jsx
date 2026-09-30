import React from 'react';
import { useVoiceAgent } from './hooks/useVoiceAgent';
import { Header } from './components/Header';
import { VoiceOrb } from './components/VoiceOrb';
import { TipCard } from './components/TipCard';
import { ExerciseSelector } from './components/ExerciseSelector';
import { TranscriptView } from './components/TranscriptView';
import { PitchMonitor } from './components/PitchMonitor';
import { SessionReportLoading } from './components/SessionReportLoading';
import { SessionReportPanel } from './components/SessionReportPanel';
import { AlertTriangle, Sparkles, Info, Globe2, LockKeyhole } from 'lucide-react';

export function App() {
  const {
    status,
    isSpeaking,
    isListening,
    userTranscript,
    agentTranscript,
    conversation,
    activeTip,
    setActiveTip,
    playbackSettings,
    activeExercise,
    setActiveExercise,
    isPlayingAccompaniment,
    accompanimentStart,
    toggleAccompaniment,
    currentNote,
    pitchData,
    pitchSignalQuality,
    accompanimentVolume,
    setAccompanimentVolume,
    adjustPitchManually,
    adjustSpeedManually,
    getMicAnalyser,
    getPlayerAnalyser,
    sessionView,
    reportGenerationStep,
    sessionReport,
    setUpNewSession,
    sessionSeconds,
    errorMessage,
    selectedVoice,
    selectVoice,
    voiceProfile,
    connect,
    disconnect,
  } = useVoiceAgent();

  const handleSelectExercise = (exerciseId) => {
    setActiveExercise(exerciseId);
  };

  const handleCloseTip = () => {
    setActiveTip(null);
  };

  const isSessionReview = !['voice', 'voice_setup'].includes(sessionView);
  const isVoicePanel = (
    sessionView === 'voice'
    || sessionView === 'voice_setup'
    || sessionView === 'voice_exiting'
  );
  const isLoadingPanel = (
    sessionView === 'generating_report' || sessionView === 'loading_exiting'
  );
  const isReportPanel = (
    sessionView === 'report_ready' || sessionView === 'returning_to_setup'
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation Bar */}
      <Header
        status={status}
        onConnect={connect}
        onDisconnect={disconnect}
        selectedVoice={selectedVoice}
        onVoiceChange={selectVoice}
        voiceProfile={voiceProfile}
        sessionSeconds={sessionSeconds}
        isSessionReview={isSessionReview}
        sessionView={sessionView}
      />

      {/* Error notification banner if any */}
      {errorMessage && (
        <div className="bg-rose-500/10 border-b border-rose-500/20 px-4 py-2.5">
          <div className="max-w-6xl mx-auto flex items-center gap-2 text-rose-400 text-xs sm:text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 flex flex-col gap-6">
        {/* Central Voice Agent Section */}
        <section className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-slate-900/60 to-slate-950/80 p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden">
          {/* Ambient background gradients */}
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-600/10 rounded-full blur-3xl pointer-events-none" />

          {isVoicePanel && (
            <div className={sessionView === 'voice_exiting' ? 'animate-slide-out-right' : 'animate-slide-in-left'}>
              <VoiceOrb
                status={status}
                isSpeaking={isSpeaking}
                isListening={isListening}
                agentTranscript={sessionView === 'voice_setup' ? '' : agentTranscript}
                userTranscript={sessionView === 'voice_setup' ? '' : userTranscript}
                getMicAnalyser={getMicAnalyser}
                getPlayerAnalyser={getPlayerAnalyser}
              />
            </div>
          )}

          {isLoadingPanel && (
            <div className={sessionView === 'loading_exiting' ? 'animate-slide-out-right' : 'animate-slide-in-left'}>
              <SessionReportLoading activeStep={reportGenerationStep} />
            </div>
          )}

          {isReportPanel && sessionReport && (
            <div className={sessionView === 'returning_to_setup' ? 'animate-slide-out-right' : 'animate-slide-in-left'}>
              <SessionReportPanel
                report={sessionReport}
                onSetUpNewSession={setUpNewSession}
                actionsDisabled={sessionView === 'returning_to_setup'}
              />
            </div>
          )}

          {/* Prompt suggestions when connected */}
          {status === 'connected' && sessionView === 'voice' && (
            <div className="mt-4 pt-4 border-t border-slate-800/60 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-400">
              <span className="flex items-center gap-1 font-medium text-slate-300">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Try saying:
              </span>
              <span className="px-2.5 py-1 rounded-full bg-slate-800/60 border border-slate-700/50 text-slate-300">
                "How do I do a lip trill?"
              </span>
              <span className="px-2.5 py-1 rounded-full bg-slate-800/60 border border-slate-700/50 text-slate-300">
                "Lower the track key by one semitone"
              </span>
              <span className="px-2.5 py-1 rounded-full bg-slate-800/60 border border-purple-500/40 text-purple-300 flex items-center gap-1">
                <Globe2 className="w-3 h-3 text-purple-400" /> "Can we practice in Spanish?"
              </span>
            </div>
          )}
        </section>

        {/* Two-column Interactive Dashboard */}
        {isSessionReview && (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-purple-500/20 bg-purple-500/5 px-4 py-2.5 text-xs text-purple-200">
            <LockKeyhole className="w-3.5 h-3.5" />
            Session controls are locked while you review the completed session.
          </div>
        )}

        <div className={`grid grid-cols-1 lg:grid-cols-12 gap-6 transition-opacity duration-300 ${isSessionReview ? 'opacity-60' : ''}`}>
          {/* Left Column: Vocal Tips & Routine (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            {/* Vocal Technique Tip Card (Tool Call from AssemblyAI) */}
            <TipCard activeTip={activeTip} onClose={handleCloseTip} />

            {/* Exercise Selector with Accompaniment Controls */}
            <ExerciseSelector
              activeExercise={activeExercise}
              onSelectExercise={handleSelectExercise}
              playbackSettings={playbackSettings}
              isPlayingAccompaniment={isPlayingAccompaniment}
              accompanimentStart={accompanimentStart}
              onToggleAccompaniment={toggleAccompaniment}
              currentNote={currentNote}
              accompanimentVolume={accompanimentVolume}
              onVolumeChange={setAccompanimentVolume}
              onPitchAdjust={adjustPitchManually}
              onSpeedAdjust={adjustSpeedManually}
              disabled={isSessionReview}
            />
          </div>

          {/* Right Column: Live Pitch Monitor, Transcript & Session Insights (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            {/* Real-time Vocal Pitch & Tuning Gauge */}
            <PitchMonitor
              isListening={isListening}
              targetNote={currentNote}
              pitchData={pitchData}
              signalQuality={pitchSignalQuality}
            />

            <TranscriptView conversation={conversation} />

            {/* Technology & Code-Switching info card */}
            <div className="rounded-2xl border border-slate-800/60 bg-slate-900/30 p-4 text-xs text-slate-400 flex items-start gap-3">
              <Info className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-300 block mb-1">
                  AssemblyAI Bilingual & Code-Switching Voice Agent
                </span>
                <p className="m-0 leading-relaxed">
                  Choose the session voice before connecting; that voice remains fixed while Lyra follows your spoken language in English, Spanish, or mixed conversation. Full support for <strong>barge-in</strong> interruptions and voice-driven <strong>tool calling</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 py-4 text-center text-xs text-slate-500">
        <p className="m-0">VoxFlow • AI Vocal Coach powered by AssemblyAI Voice Agent (lablab.ai)</p>
      </footer>
    </div>
  );
}

export default App;
