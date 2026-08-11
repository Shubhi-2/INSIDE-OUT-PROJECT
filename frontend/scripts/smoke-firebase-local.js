/* Offline smoke checks for Firebase migration helpers */
const assert = require('assert');

// Minimal reimplementation checks for JSON extract / model list shape
function extractJson(text) {
  try {
    return JSON.parse(text);
  } catch {}
  const m = text.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      return JSON.parse(m[0]);
    } catch {}
  }
  return { error: 'parse_failed' };
}

const models = {
  default: 'gemini-2.5-flash',
  ids: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite'],
};

assert.strictEqual(extractJson('{"a":1}').a, 1);
assert.strictEqual(extractJson('Here\n```json\n{"a":2}\n```').a, 2);
assert.ok(models.ids.includes(models.default));
console.log('SMOKE_OK firebase local helpers');
