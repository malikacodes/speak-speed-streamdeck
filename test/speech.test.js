import { test } from "node:test";
import assert from "node:assert/strict";
import { Speech } from "../src/speech.js";

// A stand-in for execFile. Each call takes the next reply from the list
// and answers the way execFile would: (error, stdout, stderr).
function fakeRunner(replies) {
  const calls = [];
  const runner = (file, args, options, callback) => {
    calls.push({ args, options });
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

// Protects the log line from going back to "Command failed", which reads
// the same for every kind of failure.
test("the log says the exit code and what the helper wrote to stderr", async () => {
  const failure = Object.assign(new Error("Command failed: /fake/speed"), { code: 3 });
  const { speech, warnings } = makeSpeech([{ error: failure, stderr: "no controller window\n" }]);
  await speech.refresh();
  assert.match(warnings[0], /exited with code 3/);
  assert.match(warnings[0], /no controller window/);
});

// Protects telling a hang apart from a crash. A timeout kills the helper
// with a signal, so the signal alone would read as a crash.
test("the log says timed out when the timeout killed the helper", async () => {
  const failure = Object.assign(new Error("Command failed"), { killed: true, signal: "SIGTERM", code: null });
  const { speech, warnings } = makeSpeech([{ error: failure }]);
  await speech.refresh();
  assert.match(warnings[0], /timed out/);
});

// Protects the crash case: no exit code, only a signal.
test("the log names the signal when the helper was stopped by one", async () => {
  const failure = Object.assign(new Error("Command failed"), { killed: false, signal: "SIGSEGV", code: null });
  const { speech, warnings } = makeSpeech([{ error: failure }]);
  await speech.refresh();
  assert.match(warnings[0], /SIGSEGV/);
});

// Protects a missing helper binary from reading like a bad exit.
test("the log says so when the helper can't be started at all", async () => {
  const failure = Object.assign(new Error("spawn /fake/speed ENOENT"), { code: "ENOENT" });
  const { speech, warnings } = makeSpeech([{ error: failure }]);
  await speech.refresh();
  assert.match(warnings[0], /couldn't start \(ENOENT\)/);
});

// Protects the empty answer having its own words: a clean exit with
// nothing printed isn't the same as printing junk.
test("the log tells an empty answer apart from one that isn't JSON", async () => {
  const { speech, warnings } = makeSpeech([{ stdout: "" }, { stdout: "oops" }]);
  await speech.refresh();
  await speech.refresh();
  assert.match(warnings[0], /nothing/);
  assert.match(warnings[1], /isn't JSON/);
});

// Protects the time limit: without it a stuck helper would hang forever.
test("every helper run is given the 8 second time limit", async () => {
  const { speech, runner } = makeSpeech([{ stdout: '{"state":"hidden","speed":1}' }]);
  await speech.refresh();
  assert.equal(runner.calls[0].options.timeout, 8000);
});
