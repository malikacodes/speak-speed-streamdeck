import { fileURLToPath } from "node:url";
import streamDeck, { action, SingletonAction } from "@elgato/streamdeck";
import { Speech } from "./speech.js";
import { turn, next, pair } from "./speeds.js";
import { drawStrip, drawKey } from "./draw.js";

const NOTICE_MS = 2000;

// How often to check the controller, so the deck catches up when I click
// the on-screen button or start and stop reading.
const CHECK_MS = 2000;

// The helper is compiled into the plugin folder by "npm run helper".
const helperPath = fileURLToPath(new URL("../com.malikacodes.speak-speed.sdPlugin/bin/speed", import.meta.url));
const speech = new Speech(helperPath, streamDeck.logger);

// Stream Deck takes an image as a base64 "data URI", which is the whole
// picture packed into one long string.
function asImage(svg) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

// Why a turn or a press can't do anything right now, or null if it can.
// The speed button only exists while something is being read.
function problem() {
  if (speech.now.state === "untrusted") return "Needs Accessibility";
  if (!speech.reading) return "Start reading first";
  return null;
}

class SpeedDial extends SingletonAction {
  // Per dial on screen: the message it's showing for a moment (if any)
  // and the last picture sent to it.
  notices = new Map();
  lastImages = new Map();

  async onWillAppear(ev) {
    await speech.refresh();
    await this.render(ev.action);
  }

  onWillDisappear(ev) {
    this.notices.delete(ev.action.id);
    this.lastImages.delete(ev.action.id);
  }

  // Right is faster, left is slower, and it wraps at both ends. A fast
  // spin arrives as several clicks at once and they all count.
  async onDialRotate(ev) {
    // Look first, in case reading started since the last check.
    if (!speech.reading) await speech.refresh();
    const stuck = problem();
    if (stuck) return this.showNotice(ev.action, stuck);
    await speech.set(turn(speech.shown, ev.payload.ticks));
  }

  // Pressing the dial starts the reading, or stops it. It's the same as
  // Option + Esc, so the whole thing lives on one dial.
  async onDialDown() {
    await speech.speak();
  }

  // Tapping the strip does the same. Inside a dial stack the press
  // belongs to the stack, so this is the way in from there.
  async onTouchTap() {
    await speech.speak();
  }

  async showNotice(target, text) {
    this.notices.set(target.id, text);
    await this.render(target);
    setTimeout(() => {
      // Only clear it if a newer message hasn't replaced it.
      if (this.notices.get(target.id) !== text) return;
      this.notices.delete(target.id);
      this.render(target).catch(() => {});
    }, NOTICE_MS);
  }

  async render(target) {
    // Every setFeedback is a message to Stream Deck, so a picture only
    // goes out when it's different from the last one.
    const image = asImage(drawStrip({ speed: speech.shown, reading: speech.reading, notice: this.notices.get(target.id) }));
    if (this.lastImages.get(target.id) === image) return;
    this.lastImages.set(target.id, image);
    await target.setFeedback({ canvas: image });
  }
}

class SpeedToggle extends SingletonAction {
  settings = new Map();
  lastImages = new Map();

  async onWillAppear(ev) {
    this.settings.set(ev.action.id, ev.payload.settings ?? {});
    await speech.refresh();
    await this.render(ev.action);
  }

  async onDidReceiveSettings(ev) {
    this.settings.set(ev.action.id, ev.payload.settings ?? {});
    await this.render(ev.action);
  }

  onWillDisappear(ev) {
    this.settings.delete(ev.action.id);
    this.lastImages.delete(ev.action.id);
  }

  // Goes to the next of my two speeds (see next in speeds.js).
  async onKeyDown(ev) {
    if (!speech.reading) await speech.refresh();

    // The yellow warning triangle is for the one thing that needs fixing:
    // Stream Deck isn't allowed to press buttons yet.
    if (speech.now.state === "untrusted") return ev.action.showAlert();

    // Nothing is being read, so there's no speed button to press. The
    // crossed-out ear on the key already says so. No need to shout.
    if (!speech.reading) return;

    const { one, two } = pair(this.settings.get(ev.action.id));
    await speech.set(next(speech.shown, one, two));
  }

  async render(target) {
    const image = asImage(drawKey({ speed: speech.shown, reading: speech.reading, ...pair(this.settings.get(target.id)) }));
    if (this.lastImages.get(target.id) === image) return;
    this.lastImages.set(target.id, image);
    await target.setImage(image);
  }
}

const dial = new (action({ UUID: "com.malikacodes.speak-speed.dial" })(SpeedDial))();
const toggle = new (action({ UUID: "com.malikacodes.speak-speed.toggle" })(SpeedToggle))();
streamDeck.actions.registerAction(dial);
streamDeck.actions.registerAction(toggle);

function everything() {
  return [...[...dial.actions].map(target => [dial, target]), ...[...toggle.actions].map(target => [toggle, target])];
}

// Redraw every dial and key whenever the speed changes, whoever changed
// it: the dial, the key, or me clicking the controller.
speech.on("change", () => {
  for (const [owner, target] of everything()) {
    owner.render(target).catch(error => streamDeck.logger.warn(`Couldn't redraw: ${error.message}`));
  }
});

// No point checking the controller when none of this is on the deck page
// I'm looking at.
setInterval(() => {
  if (everything().length > 0) speech.refresh();
}, CHECK_MS);

streamDeck.connect();
