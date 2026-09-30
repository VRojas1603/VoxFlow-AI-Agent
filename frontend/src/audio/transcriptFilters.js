const CJK_CHARACTER_PATTERN = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/u;
const PRACTICE_VOCALIZATION_PATTERN = /^(?:(?:dun|do|la|brr+|hum|h+m+|m+h+|m+|h+|na|bum|uh+|ah+|oh+)[\s.,!?-]*)+$/i;

export function containsUnsupportedCjkCharacters(text) {
  return CJK_CHARACTER_PATTERN.test(typeof text === 'string' ? text : '');
}

export function shouldIgnoreUserTranscript(text) {
  if (typeof text !== 'string') return true;
  const normalized = text.trim();
  if (!normalized) return true;
  return (
    containsUnsupportedCjkCharacters(normalized)
    || PRACTICE_VOCALIZATION_PATTERN.test(normalized)
  );
}
