import { test } from "node:test";
import assert from "node:assert/strict";
import { Speech } from "../src/speech.js";

// A stand-in for execFile. Each call takes the next reply from the list
// and answers the way execFile would: (error, stdout, stderr).
function fakeRunner(replies) {
  const calls = [];
  const runner = (file, args, options, callback) => {
    calls.push(args);
    const { error = null, stdout = "", stderr = "" } = replies.shift() ?? {};
    callback(error, stdout, stderr);
  };
  runner.calls = calls;
  return runner;
}

function makeSpeech(replies) {
  const warnings = [];
  const runner = fakeRunner(replies);
  const speech = new Speech("/fake/speed", { warn: message => warnings.push(message) }, runner);
  return { speech, warnings, runner };
}

// Protects the normal case: what the helper says is what the deck knows.
test("a good answer from the helper becomes what the deck knows", async () => {
  const { speech, warnings } = makeSpeech([{ stdout: '{"state":"ok","speed":1.5,"paused":false}' }]);
  await speech.refresh();
  assert.deepEqual(speech.now, { state: "ok", speed: 1.5, paused: false });
  assert.deepEqual(warnings, []);
});

// Protects against a blank answer wiping out what the deck last knew.
test("an empty answer leaves the last known state alone", async () => {
  const { speech, warnings } = makeSpeech([{ stdout: '{"state":"ok","speed":2}' }, { stdout: "" }]);
  await speech.refresh();
  await speech.refresh();
  assert.deepEqual(speech.now, { state: "ok", speed: 2 });
  assert.equal(warnings.length, 1);
});

// Protects against a helper that exits with an error replacing the
// state, and against the failure going unlogged.
test("a helper that fails leaves the last known state alone and says so", async () => {
  const failure = Object.assign(new Error("Command failed: /fake/speed"), { code: 1 });
  const { speech, warnings } = makeSpeech([{ stdout: '{"state":"ok","speed":2}' }, { error: failure }]);
  await speech.refresh();
  await speech.refresh();
  assert.deepEqual(speech.now, { state: "ok", speed: 2 });
  assert.equal(warnings.length, 1);
});
