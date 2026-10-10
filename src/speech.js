// Talks to the Swift helper (bin/speed in the plugin folder), which is
// the part that can see and press the speed button on the Speak Selection
// controller. Everything the deck knows about the speed comes through here.
import { execFile } from "node:child_process";
import { EventEmitter } from "node:events";

export class Speech extends EventEmitter {
  // The helper's last answer:
  //   state  "ok"        something is being read and the button is there
  //          "hidden"    nothing is being read, speed is the saved one
  //          "untrusted" macOS hasn't let Stream Deck press buttons yet
  now = { state: "hidden", speed: 1 };

  // The speed I've asked for while the helper is still pressing.
  aim = null;
  busy = false;

  constructor(helperPath, logger) {
    super();
    this.helperPath = helperPath;
    this.logger = logger;
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
      execFile(this.helperPath, args, { timeout: 8000 }, (error, stdout) => {
        if (error) {
          this.logger.warn(`The speed helper failed: ${error.message}`);
          return resolve();
        }
        try {
          this.now = JSON.parse(stdout);
        } catch {
          this.logger.warn(`The speed helper sent something that isn't JSON: ${stdout}`);
        }
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
