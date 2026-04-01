import assert from 'node:assert/strict';
import test from 'node:test';
import {
  detectSensitiveContent,
  generateRubricFeedback,
  generateStructuredResponse,
  getMockDelay,
} from '../mockEngine';
import { removeFlaggedLines } from '../utils';

test('detectSensitiveContent finds sensitive strings and line numbers', () => {
  const text = [
    'api_key = "123"',
    'safe_value = 42',
    'token = os.getenv("TOKEN")',
  ].join('\n');

  const flags = detectSensitiveContent(text);

  assert.equal(flags.length, 2);
  assert.deepEqual(
    flags.map((flag) => flag.lineNumber),
    [1, 3],
  );
  assert.equal(flags[0].match.toLowerCase(), 'api_key');
  assert.match(flags[1].lineText, /TOKEN/);
});

test('removeFlaggedLines strips flagged lines and clears warnings', () => {
  const text = [
    'secret = "top-secret"',
    'keep_me = True',
    'password = "hunter2"',
  ].join('\n');

  const flags = detectSensitiveContent(text);
  const result = removeFlaggedLines(text, flags);

  assert.equal(result.removedCount, 2);
  assert.equal(result.text, 'keep_me = True');
  assert.equal(detectSensitiveContent(result.text).length, 0);
});

test('structured response, rubric response, and delay are deterministic', () => {
  assert.deepEqual(
    generateStructuredResponse('first input'),
    generateStructuredResponse('second input'),
  );

  assert.deepEqual(
    generateRubricFeedback('first input'),
    generateRubricFeedback('second input'),
  );

  assert.equal(getMockDelay(), 1200);
});
