export const DEFAULT_ACCOMPANIMENT_STATE = Object.freeze({
  pitchShift: 0,
  speed: 1.0,
  volume: 0.4,
});

const CONTROL_CONFIG = {
  pitch: {
    stateKey: 'pitchShift',
    min: -6,
    max: 6,
    defaultStep: 1,
    precision: 0,
  },
  speed: {
    stateKey: 'speed',
    min: 0.5,
    max: 2.0,
    defaultStep: 0.15,
    precision: 2,
  },
  volume: {
    stateKey: 'volume',
    min: 0,
    max: 100,
    defaultStep: 10,
    precision: 0,
    percentage: true,
  },
};

const OPERATIONS = new Set(['increase', 'decrease', 'set']);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, precision) {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function applyAccompanimentAdjustment(currentState, command) {
  const config = CONTROL_CONFIG[command?.control];
  if (!config) throw new Error(`Unsupported accompaniment control: ${command?.control || 'missing'}`);
  if (!OPERATIONS.has(command?.operation)) {
    throw new Error(`Unsupported accompaniment operation: ${command?.operation || 'missing'}`);
  }

  const rawValue = command.value;
  if (command.operation === 'set' && !Number.isFinite(rawValue)) {
    throw new Error(`The set operation for ${command.control} requires a numeric value.`);
  }

  const amount = rawValue === undefined ? config.defaultStep : rawValue;
  if (!Number.isFinite(amount) || (command.operation !== 'set' && amount < 0)) {
    throw new Error(`Invalid value for accompaniment ${command.control}.`);
  }
  if (command.control === 'pitch' && !Number.isInteger(amount)) {
    throw new Error('Pitch adjustments must use whole semitones.');
  }

  const storedValue = currentState[config.stateKey];
  const previousValue = config.percentage ? storedValue * 100 : storedValue;
  let requestedValue = amount;
  if (command.operation === 'increase') requestedValue = previousValue + amount;
  if (command.operation === 'decrease') requestedValue = previousValue - amount;

  const currentValue = round(
    clamp(requestedValue, config.min, config.max),
    config.precision,
  );
  const nextStoredValue = config.percentage ? currentValue / 100 : currentValue;
  const nextState = {
    ...currentState,
    [config.stateKey]: nextStoredValue,
  };

  return {
    state: nextState,
    changed: nextStoredValue !== storedValue,
    control: command.control,
    previousValue: round(previousValue, config.precision),
    currentValue,
  };
}

export function resetAccompanimentEngine(engine) {
  engine.stop();
  engine.setExercise('warmup_breathing');
  engine.setPitchShift(DEFAULT_ACCOMPANIMENT_STATE.pitchShift);
  engine.setSpeed(DEFAULT_ACCOMPANIMENT_STATE.speed);
  engine.setVolume(DEFAULT_ACCOMPANIMENT_STATE.volume);
  return { ...DEFAULT_ACCOMPANIMENT_STATE };
}
