export const ACCOMPANIMENT_START_PHASES = Object.freeze({
  IDLE: 'idle',
  COUNTDOWN: 'countdown',
  WAITING_FOR_VOICE: 'waiting_for_voice',
  PLAYING: 'playing',
});

const DEFAULT_STATE = Object.freeze({
  phase: ACCOMPANIMENT_START_PHASES.IDLE,
  secondsRemaining: null,
  source: null,
  exerciseId: null,
});

export class AccompanimentStartCoordinator {
  constructor({
    startPlayback,
    playReadyCue,
    onStateChange = () => {},
    onTimeout = () => {},
    countdownSeconds = 3,
    tickIntervalMs = 1000,
    voiceWaitTimeoutMs = 15000,
    postCueDelayMs = 250,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
  }) {
    this.startPlayback = startPlayback;
    this.playReadyCue = playReadyCue;
    this.onStateChange = onStateChange;
    this.onTimeout = onTimeout;
    this.countdownSeconds = countdownSeconds;
    this.tickIntervalMs = tickIntervalMs;
    this.voiceWaitTimeoutMs = voiceWaitTimeoutMs;
    this.postCueDelayMs = postCueDelayMs;
    this.setTimer = setTimer;
    this.clearTimerFn = clearTimer;
    this.state = { ...DEFAULT_STATE };
    this.requestToken = 0;
    this.countdownTimer = null;
    this.voiceWaitTimer = null;
    this.postCueTimer = null;
    this.countdownComplete = false;
    this.voiceReady = false;
    this.voiceConfirmationStarted = false;
  }

  getSnapshot() {
    return { ...this.state };
  }

  isPending() {
    return (
      this.state.phase === ACCOMPANIMENT_START_PHASES.COUNTDOWN
      || this.state.phase === ACCOMPANIMENT_START_PHASES.WAITING_FOR_VOICE
    );
  }

  requestStart({ source, exerciseId }) {
    if (this.state.phase !== ACCOMPANIMENT_START_PHASES.IDLE) {
      return {
        accepted: false,
        phase: this.state.phase,
      };
    }

    const token = ++this.requestToken;
    this.countdownComplete = false;
    this.voiceReady = source === 'manual';
    this.voiceConfirmationStarted = false;
    this.setState({
      phase: ACCOMPANIMENT_START_PHASES.COUNTDOWN,
      secondsRemaining: this.countdownSeconds,
      source,
      exerciseId,
    });

    if (this.countdownSeconds <= 0) {
      this.completeCountdown(token);
    } else {
      this.scheduleCountdownTick(token, this.countdownSeconds - 1);
    }

    return {
      accepted: true,
      phase: ACCOMPANIMENT_START_PHASES.COUNTDOWN,
    };
  }

  scheduleCountdownTick(token, nextSeconds) {
    this.countdownTimer = this.setTimer(() => {
      if (token !== this.requestToken) return;

      if (nextSeconds > 0) {
        this.setState({ ...this.state, secondsRemaining: nextSeconds });
        this.scheduleCountdownTick(token, nextSeconds - 1);
        return;
      }

      this.completeCountdown(token);
    }, this.tickIntervalMs);
  }

  completeCountdown(token) {
    if (token !== this.requestToken) return;
    this.countdownTimer = null;
    this.countdownComplete = true;

    if (this.voiceReady) {
      this.beginPlayback(token);
      return;
    }

    this.setState({
      ...this.state,
      phase: ACCOMPANIMENT_START_PHASES.WAITING_FOR_VOICE,
      secondsRemaining: null,
    });
    this.voiceWaitTimer = this.setTimer(() => {
      if (token !== this.requestToken) return;
      this.cancel();
      this.onTimeout();
    }, this.voiceWaitTimeoutMs);
  }

  notifyVoiceReady() {
    if (!this.isPending() || this.state.source !== 'voice') return false;
    if (!this.voiceConfirmationStarted) return false;
    this.voiceReady = true;
    if (!this.countdownComplete) return true;

    this.clearTimer('voiceWaitTimer');
    this.beginPlaybackAfterCue(this.requestToken);
    return true;
  }

  notifyVoiceStarted() {
    if (!this.isPending() || this.state.source !== 'voice') return false;
    this.voiceConfirmationStarted = true;
    return true;
  }

  beginPlaybackAfterCue(token) {
    Promise.resolve()
      .then(() => this.playReadyCue())
      .catch(() => undefined)
      .then(() => {
        if (token !== this.requestToken) return;
        this.postCueTimer = this.setTimer(() => {
          if (token === this.requestToken) this.beginPlayback(token);
        }, this.postCueDelayMs);
      });
  }

  beginPlayback(token) {
    if (token !== this.requestToken) return;
    const { exerciseId, source } = this.state;
    this.clearTimers();

    try {
      this.startPlayback(exerciseId);
      this.setState({
        phase: ACCOMPANIMENT_START_PHASES.PLAYING,
        secondsRemaining: null,
        source,
        exerciseId,
      });
    } catch (error) {
      this.setState({ ...DEFAULT_STATE });
      throw error;
    }
  }

  markPlaybackStopped() {
    if (this.state.phase === ACCOMPANIMENT_START_PHASES.PLAYING) {
      this.requestToken += 1;
      this.clearTimers();
      this.setState({ ...DEFAULT_STATE });
    }
  }

  cancel() {
    const wasActive = this.state.phase !== ACCOMPANIMENT_START_PHASES.IDLE;
    this.requestToken += 1;
    this.clearTimers();
    this.countdownComplete = false;
    this.voiceReady = false;
    this.voiceConfirmationStarted = false;
    this.setState({ ...DEFAULT_STATE });
    return wasActive;
  }

  clearTimer(propertyName) {
    if (this[propertyName]) {
      this.clearTimerFn(this[propertyName]);
      this[propertyName] = null;
    }
  }

  clearTimers() {
    this.clearTimer('countdownTimer');
    this.clearTimer('voiceWaitTimer');
    this.clearTimer('postCueTimer');
  }

  setState(nextState) {
    this.state = nextState;
    this.onStateChange(this.getSnapshot());
  }
}
