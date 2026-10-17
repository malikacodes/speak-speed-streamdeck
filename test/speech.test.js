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

// Protects the deck from answers that parse as JSON but aren't a state:
// null would make every redraw throw.
for (const [name, stdout] of [["null", "null"], ["an empty object", "{}"], ["a number", "5"], ["ok with no speed", '{"state":"ok"}'], ["hidden with no speed", '{"state":"hidden"}'], ["an unknown state", '{"state":"sleeping","speed":1}'], ["a speed that isn't a number", '{"state":"ok","speed":"fast"}']]) {
  test(`an answer that is ${name} is ignored and logged`, async () => {
    const { speech, warnings } = makeSpeech([{ stdout: '{"state":"ok","speed":2}' }, { stdout }]);
    await speech.refresh();
    await speech.refresh();
    assert.deepEqual(speech.now, { state: "ok", speed: 2 });
    assert.equal(warnings.length, 1);
  });
}

// The helper really does send {"state":"untrusted"} with no speed
// (helper/speed.swift), so that answer is good. The deck keeps the last
// speed it knew, or the dial would have nothing to draw.
test("untrusted with no speed is accepted and keeps the last speed", async () => {
  const { speech, warnings } = makeSpeech([{ stdout: '{"state":"ok","speed":1.5}' }, { stdout: '{"state":"untrusted"}' }]);
  await speech.refresh();
  await speech.refresh();
  assert.deepEqual(speech.now, { state: "untrusted", speed: 1.5 });
  assert.deepEqual(warnings, []);
});

// Protects the very first answer being "untrusted": there's no earlier
// speed, so the starting one of 1 has to carry over.
test("untrusted as the first answer keeps the starting speed", async () => {
  const { speech } = makeSpeech([{ stdout: '{"state":"untrusted"}' }]);
  await speech.refresh();
  assert.deepEqual(speech.now, { state: "untrusted", speed: 1 });
});

// A runner that doesn't answer until the test says so, to stand in for a
// helper that's still busy pressing. It also remembers the most helpers
// that were ever running at once, which should never be more than one.
function heldRunner() {
  const calls = [];
  let running = 0;
  const runner = (file, args, options, callback) => {
    running += 1;
    runner.mostAtOnce = Math.max(runner.mostAtOnce, running);
    calls.push({
      args,
      answer: (stdout, error = null) => {
        running -= 1;
        callback(error, stdout, "");
      },
    });
  };
  runner.calls = calls;
  runner.mostAtOnce = 0;
  return runner;
}

function makeHeldSpeech() {
  const warnings = [];
  const runner = heldRunner();
  const speech = new Speech("/fake/speed", { warn: message => warnings.push(message) }, runner);
  speech.now = { state: "ok", speed: 1 };
  return { speech, warnings, runner };
}

// Lets the promises that are ready run, so a call that was going to start
// a helper has done it by the time the test looks.
const settle = () => new Promise(resolve => setImmediate(resolve));
const ok = speed => JSON.stringify({ state: "ok", speed });

// Protects the dial: spinning through three speeds quickly asks the
// helper for the first and the last, and skips the one in between.
test("while a change is underway, the newest speed is the next one asked for", async () => {
  const { speech, runner } = makeHeldSpeech();
  const first = speech.set(1.5);
  await speech.set(1.75);
  await speech.set(2);
  runner.calls[0].answer(ok(1.5));
  await settle();
  assert.deepEqual(runner.calls.map(call => call.args), [["set", "1.5"], ["set", "2"]]);
  runner.calls[1].answer(ok(2));
  await first;
  assert.equal(speech.now.speed, 2);
  assert.equal(speech.aim, null);
});

// Protects against the 2 second check landing in the middle of a change
// and putting an older speed back.
test("a refresh during a change is skipped", async () => {
  const { speech, runner } = makeHeldSpeech();
  const change = speech.set(2);
  await speech.refresh();
  assert.equal(runner.calls.length, 1);
  runner.calls[0].answer(ok(2));
  await change;
});

// Protects the one-at-a-time rule for the other three jobs, which used
// to leave the lane open while they ran.
for (const job of ["refresh", "speak", "pause"]) {
  test(`while ${job} is running, no other helper starts`, async () => {
    const { speech, runner } = makeHeldSpeech();
    const running = speech[job]();
    await settle();
    await speech.refresh();
    await speech.speak();
    await speech.pause();
    assert.equal(runner.calls.length, 1);
    runner.calls[0].answer(ok(1));
    await running;
    assert.equal(speech.busy, false);
  });
}

// Protects a turn of the dial that arrives while a refresh is running:
// it has to wait its turn, not run beside it and not get lost.
test("a change asked for during a refresh waits for it, then happens", async () => {
  const { speech, runner } = makeHeldSpeech();
  const looking = speech.refresh();
  const change = speech.set(2);
  await settle();
  assert.equal(runner.calls.length, 1);
  runner.calls[0].answer(ok(1));
  await settle();
  assert.deepEqual(runner.calls[1].args, ["set", "2"]);
  runner.calls[1].answer(ok(2));
  await looking;
  await change;
  assert.equal(runner.mostAtOnce, 1);
  assert.equal(speech.now.speed, 2);
});

// Protects against a failed change leaving the deck stuck: busy would
// block every later job and aim would keep the dial on the wrong speed.
test("a failed change clears busy and the speed it was heading for", async () => {
  const { speech, runner } = makeHeldSpeech();
  const change = speech.set(2);
  runner.calls[0].answer("", Object.assign(new Error("Command failed"), { code: 1 }));
  await change;
  assert.equal(speech.busy, false);
  assert.equal(speech.aim, null);
  assert.equal(speech.shown, 1);
  const looking = speech.refresh();
  await settle();
  assert.equal(runner.calls.length, 2);
  runner.calls[1].answer(ok(1));
  await looking;
});

// Protects the wait for a pause or speak too, and the newest-wins rule
// while a change is still waiting for its turn.
test("two changes asked for during a pause wait, and only the newest happens", async () => {
  const { speech, runner } = makeHeldSpeech();
  const pausing = speech.pause();
  const first = speech.set(1.5);
  const second = speech.set(2);
  await settle();
  assert.equal(runner.calls.length, 1);
  runner.calls[0].answer(ok(1));
  await settle();
  assert.deepEqual(runner.calls.map(call => call.args), [["pause"], ["set", "2"]]);
  runner.calls[1].answer(ok(2));
  await Promise.all([pausing, first, second]);
  assert.equal(runner.mostAtOnce, 1);
  assert.equal(speech.aim, null);
});

// Collects what the deck would be told to show.
function listenForWarnings(speech) {
  const heard = [];
  speech.on("warning", text => heard.push(text));
  return heard;
}

const bad = { error: Object.assign(new Error("Command failed"), { code: 1 }) };

// Protects the dial snapping back with no word: a change that didn't
// happen has to say so.
test("a change that fails sends one warning", async () => {
  const { speech } = makeSpeech([bad]);
  speech.now = { state: "ok", speed: 1 };
  const heard = listenForWarnings(speech);
  await speech.set(2);
  assert.deepEqual(heard, ["Couldn't change speed"]);
});

// Protects against the same warning flashing again on every turn of the
// dial while nothing has changed. A change that works resets it.
test("the same warning isn't sent twice until a change works", async () => {
  const { speech } = makeSpeech([bad, bad, { stdout: ok(2) }, bad]);
  speech.now = { state: "ok", speed: 1 };
  const heard = listenForWarnings(speech);
  await speech.set(1.5);
  await speech.set(1.75);
  assert.equal(heard.length, 1);
  await speech.set(2);
  speech.now = { state: "ok", speed: 2 };
  await speech.set(1);
  assert.equal(heard.length, 2);
});

// Protects the quiet case: if the reading just ended, the strip already
// shows the crossed-out ear, and a warning on top would be noise.
test("no warning when the reading ended during the change", async () => {
  const { speech } = makeSpeech([{ stdout: '{"state":"hidden","speed":1}' }]);
  speech.now = { state: "ok", speed: 1 };
  const heard = listenForWarnings(speech);
  await speech.set(2);
  assert.deepEqual(heard, []);
});

// Protects the happy path from crying wolf.
test("no warning when the change works", async () => {
  const { speech } = makeSpeech([{ stdout: ok(2) }]);
  speech.now = { state: "ok", speed: 1 };
  const heard = listenForWarnings(speech);
  await speech.set(2);
  assert.deepEqual(heard, []);
});
