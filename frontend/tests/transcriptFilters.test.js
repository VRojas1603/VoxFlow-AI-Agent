import assert from 'node:assert/strict';
import test from 'node:test';

import {
  containsUnsupportedCjkCharacters,
  shouldIgnoreUserTranscript,
} from '../src/audio/transcriptFilters.js';

test('rejects Chinese and other CJK transcripts produced from vocal practice', () => {
  assert.equal(containsUnsupportedCjkCharacters('嗯。'), true);
  assert.equal(containsUnsupportedCjkCharacters('你好'), true);
  assert.equal(shouldIgnoreUserTranscript('嗯。'), true);
  assert.equal(shouldIgnoreUserTranscript('声 ah'), true);
});

test('rejects isolated practice sounds but preserves English and Spanish commands', () => {
  assert.equal(shouldIgnoreUserTranscript('brrr brrr'), true);
  assert.equal(shouldIgnoreUserTranscript('mm hmm'), true);
  assert.equal(shouldIgnoreUserTranscript('Please lower the key'), false);
  assert.equal(shouldIgnoreUserTranscript('Baja la tonalidad, por favor'), false);
});
