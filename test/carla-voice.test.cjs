'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const loadTs = require('./load-ts.cjs');

const { latestAssistantResponseFromTranscript } = loadTs('src/main/carlaVoice.ts');

test('Carla voice selects the newest textual assistant response', () => {
  const transcript = [
    JSON.stringify({ type: 'user', uuid: 'u1', message: { content: 'Do the work.' } }),
    JSON.stringify({ type: 'assistant', uuid: 'a1', message: { content: [{ type: 'text', text: 'I am starting.' }, { type: 'tool_use', name: 'Read' }] } }),
    JSON.stringify({ type: 'assistant', uuid: 'a2', message: { content: [{ type: 'text', text: 'Finished it.' }] } })
  ].join('\n');

  assert.deepEqual(latestAssistantResponseFromTranscript(transcript), {
    text: 'Finished it.',
    key: 'a2'
  });
});

test('Carla voice ignores assistant records that contain no spoken text', () => {
  const transcript = JSON.stringify({
    type: 'assistant',
    uuid: 'tool-only',
    message: { content: [{ type: 'tool_use', name: 'Read' }] }
  });
  assert.equal(latestAssistantResponseFromTranscript(transcript), null);
});

test('Carla voice does not repeat an older response after a new unanswered user turn', () => {
  const transcript = [
    JSON.stringify({ type: 'assistant', uuid: 'old', message: { content: [{ type: 'text', text: 'Already said.' }] } }),
    JSON.stringify({ type: 'user', uuid: 'new', message: { content: 'A command with no answer yet.' } })
  ].join('\n');
  assert.equal(latestAssistantResponseFromTranscript(transcript), null);
});

test('identical Carla wording in separate turns retains separate transcript keys', () => {
  const transcript = [
    JSON.stringify({ type: 'assistant', uuid: 'turn-1', message: { content: [{ type: 'text', text: 'All done.' }] } }),
    JSON.stringify({ type: 'assistant', uuid: 'turn-2', message: { content: [{ type: 'text', text: 'All done.' }] } })
  ].join('\n');
  assert.equal(latestAssistantResponseFromTranscript(transcript).key, 'turn-2');
});
