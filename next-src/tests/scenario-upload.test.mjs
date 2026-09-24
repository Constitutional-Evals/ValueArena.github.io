import test from 'node:test';
import assert from 'node:assert/strict';
import { parseScenarios } from '../src/lib/scenario-upload.ts';
test('JSONL supports multiline content, BOM, CRLF and JSON strings', () => {
  assert.deepEqual(parseScenarios('\ufeff{"scenario":"First\\nparagraph"}\r\n"Second"\n'), ['First\nparagraph', 'Second']);
});
test('scenario uploads reject repeated action rows and malformed input', () => {
  assert.throws(() => parseScenarios('{"scenario":"Q"}\n{"scenario":" Q "}'), /duplicate/);
  assert.throws(() => parseScenarios('[{"scenario":"Q"}]'), /nonempty/);
  assert.throws(() => parseScenarios('{bad}'), /Line 1/);
  assert.throws(() => parseScenarios('{"dilemma":"Q"}'), /scenario/);
  assert.throws(() => parseScenarios(''), /between 1 and 200/);
});
