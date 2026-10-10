import { test } from "node:test";
import assert from "node:assert/strict";
import { SPEEDS, turn, next, pair } from "../src/speeds.js";
import { drawStrip, drawKey } from "../src/draw.js";

// Protects the plain case: one click, one step.
test("a click right is one step faster, a click left is one step slower", () => {
  assert.equal(turn(1.25, 1), 1.5);
  assert.equal(turn(1.25, -1), 1);
});

// Protects the wrap. Without it the dial would just stop at the ends.
test("the dial goes round at both ends", () => {
  assert.equal(turn(2, 1), 1);
  assert.equal(turn(1, -1), 2);
});

// A fast spin arrives as several clicks in one go. Seven clicks right is
// one full lap plus two, and it has to work backwards too.
test("a fast spin counts every click, even past a full lap", () => {
  assert.equal(turn(1, 3), 1.75);
  assert.equal(turn(1, 7), 1.5);
  assert.equal(turn(1.5, -7), 1);
});

// The on-screen button can leave me on 0.5 or 0.75, which the dial
// doesn't have. The first click has to land on a real speed, not skip one.
test("from a slow speed the dial comes back in at the nearest end", () => {
  assert.equal(turn(0.5, 1), 1);
  assert.equal(turn(0.75, 1), 1);
  assert.equal(turn(0.5, -1), 2);
});

// Protects the whole point of the key: a press goes back and forth.
test("the key goes between its two speeds", () => {
  assert.equal(next(1.25, 1.25, 2), 2);
  assert.equal(next(2, 1.25, 2), 1.25);
});

// If the dial left me on a speed that's neither pick, the key goes to
// the next pick up, not back to the start.
test("from a speed in between, the key goes up to the faster pick", () => {
  assert.equal(next(1.5, 1.25, 2), 2);
  assert.equal(next(1.75, 1.25, 2), 2);
});

// Below both picks, "next up" is the slower one.
test("from below both picks, the key goes to the slower pick", () => {
  assert.equal(next(1, 1.25, 2), 1.25);
  assert.equal(next(0.5, 1.25, 2), 1.25);
});

// Picking the faster speed in Speed 1 shouldn't change how the key acts.
test("the key works the same with the picks the other way round", () => {
  assert.equal(next(1.75, 2, 1.25), 2);
  assert.equal(next(2, 2, 1.25), 1.25);
});

// Settings arrive as text, and a brand new key has none at all.
test("the key's picks come out as numbers, and default to 1 and 2", () => {
  assert.deepEqual(pair({ one: "1.25", two: "1.75" }), { one: 1.25, two: 1.75 });
  assert.deepEqual(pair({}), { one: 1, two: 2 });
  assert.deepEqual(pair({ one: "9", two: "banana" }), { one: 1, two: 2 });
});

// The deck is pure black, so a lighter background shows as a gray square.
test("the strip and the key are drawn on pure black", () => {
  assert.match(drawStrip({ speed: 1.5, reading: true }), /<rect width="200" height="100" fill="#000000"\/>/);
  assert.match(drawKey({ speed: 1.5, reading: true, one: 1, two: 2 }), /<rect width="144" height="144" fill="#000000"\/>/);
});

// One dot per speed, and only the current one is pink.
test("the strip shows the speed and lights one dot of five", () => {
  const strip = drawStrip({ speed: 1.75, reading: true });
  assert.match(strip, />1\.75×</);
  assert.equal(strip.match(/<circle/g).length, SPEEDS.length);
  assert.equal(strip.match(/fill="#f2a7c3"/g).length, 1);
});

// Pink means "this is what you're hearing", so nothing is pink when
// nothing is being read.
test("nothing is pink while nothing is being read", () => {
  assert.doesNotMatch(drawStrip({ speed: 1.75, reading: false }), /#f2a7c3/);
  assert.doesNotMatch(drawKey({ speed: 1, reading: false, one: 1, two: 2 }), /#f2a7c3/);
});

// The crossed-out ear means "nothing is being read". It would be a lie
// on a key that's in the middle of reading.
test("the crossed-out ear only shows while nothing is being read", () => {
  const ear = /M6 8\.5a6\.5/;
  assert.match(drawKey({ speed: 1.75, reading: false, one: 1.25, two: 2 }), ear);
  assert.match(drawStrip({ speed: 1.75, reading: false }), ear);
  assert.doesNotMatch(drawKey({ speed: 1.75, reading: true, one: 1.25, two: 2 }), ear);
  assert.doesNotMatch(drawStrip({ speed: 1.75, reading: true }), ear);
});

// While paused the strip shows a pause sign where the speed was. The
// pink dot stays, so I can still see (and change) the speed it'll use.
test("a paused strip swaps the speed for a pause sign and keeps its dot", () => {
  const paused = drawStrip({ speed: 1.5, reading: true, paused: true });
  assert.equal(paused.match(/<rect x="(86|105)" y="30"/g).length, 2);
  assert.doesNotMatch(paused, />1\.5×</);
  assert.equal(paused.match(/fill="#f2a7c3"/g).length, 1);

  const reading = drawStrip({ speed: 1.5, reading: true, paused: false });
  assert.doesNotMatch(reading, /<rect x="86"/);
  assert.match(reading, />1\.5×</);
});
