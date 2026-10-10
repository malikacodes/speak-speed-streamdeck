// The speeds I use and how the dial and the key move between them. No
// macOS in here, so the tests can run it.

// The controller's button has seven speeds. I never want the two slow
// ones (0.5 and 0.75), so the deck only knows about these five.
export const SPEEDS = [1, 1.25, 1.5, 1.75, 2];

// Where the dial lands after turning. ticks is how many clicks: positive
// is right (faster), negative is left (slower). It wraps both ways, so
// right from 2 is 1 and left from 1 is 2.
export function turn(current, ticks) {
  let at = SPEEDS.indexOf(current);

  // On one of the slow speeds (the on-screen button can still get there):
  // the first click right lands on 1, the first click left lands on 2.
  if (at === -1) at = ticks > 0 ? -1 : 0;

  // JavaScript's % keeps the minus sign (-1 % 5 is -1), so I add 5 back
  // before taking it again.
  return SPEEDS[(((at + ticks) % SPEEDS.length) + SPEEDS.length) % SPEEDS.length];
}

// Where the key goes: the next pick up from wherever I am. If neither
// pick is faster than where I am, it goes round to the slower one. With
// picks 1.25 and 2, that's 1.5 → 2, 1.75 → 2, and 2 → 1.25. It doesn't
// matter which pick is Speed 1 and which is Speed 2.
export function next(current, one, two) {
  const low = Math.min(one, two);
  const high = Math.max(one, two);
  if (current < low) return low;
  return current < high ? high : low;
}

// The key's two picks from its settings. They're saved as text ("1.5"),
// and a key I haven't set up yet toggles between 1 and 2.
export function pair(settings) {
  const pick = (value, fallback) => (SPEEDS.includes(Number(value)) ? Number(value) : fallback);
  return { one: pick(settings?.one, 1), two: pick(settings?.two, 2) };
}

// 1.5 to "1.5×", the same way the controller writes it.
export function label(speed) {
  return `${speed}×`;
}
