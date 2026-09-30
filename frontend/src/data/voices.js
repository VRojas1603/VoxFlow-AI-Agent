export const DEFAULT_VOICE_ID = 'eve';

export const VOICE_GROUPS = [
  {
    label: 'English (US)',
    flag: '🇺🇸',
    language: 'en',
    voices: [
      { id: 'alba', name: 'Alba' },
      { id: 'eve', name: 'Eve' },
      { id: 'george', name: 'George' },
      { id: 'jane', name: 'Jane' },
      { id: 'jean', name: 'Jean' },
      { id: 'mary', name: 'Mary' },
      { id: 'michael', name: 'Michael' },
    ],
  },
  {
    label: 'English (UK)',
    flag: '🇬🇧',
    language: 'en',
    voices: [
      { id: 'anna', name: 'Anna' },
      { id: 'charles', name: 'Charles' },
      { id: 'paul', name: 'Paul' },
      { id: 'vera', name: 'Vera' },
    ],
  },
  {
    label: 'Spanish (ES)',
    flag: '🇪🇸',
    language: 'es',
    voices: [
      { id: 'lola', name: 'Lola' },
    ],
  },
];

export const VOICES = VOICE_GROUPS.flatMap((group) =>
  group.voices.map((voice) => ({
    ...voice,
    flag: group.flag,
    language: group.language,
    group: group.label,
  })),
);

export function getVoice(voiceId) {
  return VOICES.find((voice) => voice.id === voiceId)
    || VOICES.find((voice) => voice.id === DEFAULT_VOICE_ID);
}

export function getVoiceLanguage(voiceId) {
  return getVoice(voiceId).language;
}
