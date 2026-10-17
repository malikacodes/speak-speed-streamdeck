# 06 · Tidying index.js

2026-10-17

No new feature this time. `src/index.js` had the same three lines written three times, so I cleaned that up.

## What was repeated

The dial turn, the strip tap and the key press each started with "if nothing is being read, look again, then work out whether I can do anything". The dial used a small `problem()` check for the second half. The key wrote the same test out by hand. Now there's one `lookThenCheck()` that does both halves and says why I can't, or nothing if I can.

The other change is a rename. `everything()` sounded like it returned everything, and it was spreading the same list twice for no reason. It's `allTargets()` now: every dial and key on the deck, each with the class that draws it.

## What I left alone

The dial and key still each have their own picture cache and their own cleanup when they leave the deck. It's two copies in one file, and joining them would mean a new layer for very little.

There's no new test for this one. Nothing changed in what the plugin does, and `index.js` is the only file that talks to Stream Deck, so the tests can't reach it. I checked it with the pretend deck and by restarting the plugin.

## What I learned

- A tidy-up that changes no behaviour is still worth tracing by hand. The tap on the strip calls `speak` for the "needs accessibility" case too, and I had to read the old code twice to see why that's the same.
