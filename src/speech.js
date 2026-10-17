// Talks to the Swift helper (bin/speed in the plugin folder), which is
// the part that can see and press the speed button on the Speak Selection
// controller. Everything the deck knows about the speed comes through here.
import { execFile } from "node:child_process";
import { EventEmitter } from "node:events";

const HELPER_TIMEOUT_MS = 8000;

// execFile's error says "Command failed" for every kind of failure, so
// this picks the real reason out of it: a timeout kills the helper with a
// signal (killed is true), a crash has a signal and no exit code, a bad
// exit has a code, and a missing binary has a code like "ENOENT".
function whatWentWrong(error, stderr) {
  const said = String(stderr ?? "").trim();
  const detail = said ? `: ${said}` : "";
  if (error.killed) return `timed out after ${HELPER_TIMEOUT_MS / 1000} seconds${detail}`;
  if (error.signal) return `was stopped by ${error.signal}${detail}`;
  if (typeof error.code === "number") return `exited with code ${error.code}${detail}`;
  return `couldn't start (${error.code ?? error.message})${detail}`;
}

// JSON.parse is happy with null, 5 or {}, none of which the deck can draw.
// A good answer has a state I know, and a speed unless it's "untrusted".
function isAnswer(answer) {
  if (answer === null || typeof answer !== "object") return false;
  if (answer.state === "untrusted") return true;
  return (answer.state === "ok" || answer.state === "hidden") && typeof answer.speed === "number";
}

export class Speech extends EventEmitter {
  // The helper's last answer:
  //   state  "ok"        something is being read and the button is there
  //                      (paused says whether it's holding its place)
  //          "hidden"    nothing is being read, speed is the saved one
  //          "untrusted" macOS hasn't let Stream Deck press buttons yet
  now = { state: "hidden", speed: 1 };

  // The speed I've asked for while the helper is still pressing.
  aim = null;
  busy = false;

  // runner is whatever starts the helper. It's execFile for real, and a
  // stand-in in the tests, so they never need the actual helper.
  constructor(helperPath, logger, runner = execFile) {
    super();
    this.helperPath = helperPath;
    this.logger = logger;
    this.runner = runner;
  }

  get reading() {
    return this.now.state === "ok";
  }

  // What to show: the speed I'm heading for if a change is underway, or
  // the real one. Going slower can take a couple of seconds (see the
  // helper), and a dial that sits still that long feels broken.
  get shown() {
    return this.aim ?? this.now.speed;
  }

  // Runs the helper once and keeps its answer.
  run(args) {
    return new Promise(resolve => {
      this.runner(this.helperPath, args, { timeout: HELPER_TIMEOUT_MS }, (error, stdout, stderr) => {
        if (error) {
          this.logger.warn(`The speed helper ${whatWentWrong(error, stderr)}`);
          return resolve();
        }
        if (stdout.trim() === "") {
          this.logger.warn("The speed helper finished but sent nothing");
          return resolve();
        }
        let answer;
        try {
          answer = JSON.parse(stdout);
        } catch {
          this.logger.warn(`The speed helper sent something that isn't JSON: ${stdout}`);
          return resolve();
        }
        if (!isAnswer(answer)) {
          this.logger.warn(`The speed helper sent an answer I don't recognise: ${stdout}`);
          return resolve();
        }
        // "untrusted" never carries a speed, so the last known one stays.
        this.now = answer.state === "untrusted" ? { ...answer, speed: this.now.speed } : answer;
        resolve();
      });
    });
  }

  async refresh() {
    // A change in progress will report back on its own.
    if (this.busy) return;
    await this.run([]);
    this.emit("change");
  }

  // Starts reading the selected text, or stops if it's already reading:
  // the helper presses Option + Esc for me. Then it looks again once the
  // controller has had time to appear or go away.
  async speak() {
    if (this.busy) return;
    await this.run(["speak"]);
    setTimeout(() => this.refresh(), 800);
  }

  // Pauses the reading, or picks it back up from the same spot. The
  // helper presses the controller's pause button, which turns into a
  // play button while it's paused.
  async pause() {
    if (this.busy) return;
    await this.run(["pause"]);
    this.emit("change");
  }

  get paused() {
    return this.reading && this.now.paused === true;
  }

  // Asks for a speed. Only one helper runs at a time, like a single
  // checkout lane: if I spin the dial while it's still pressing, the
  // newest speed waits its turn and the ones in between get skipped.
  async set(speed) {
    this.aim = speed;
    this.emit("change");
    if (this.busy) return;

    this.busy = true;
    while (this.aim !== null && this.aim !== this.now.speed) {
      const target = this.aim;
      await this.run(["set", String(target)]);
      // Stop if it didn't take (reading ended, or the helper failed), or
      // this would keep asking forever.
      if (!this.reading || this.now.speed !== target) break;
    }
    this.aim = null;
    this.busy = false;
    this.emit("change");
  }
}
