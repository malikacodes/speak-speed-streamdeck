# 05 · Saying when a change didn't happen

2026-10-17

If the helper failed while I was turning the dial, the speed would flick to the new number and then snap back, and nothing said why.

## What it does now

When a speed change doesn't take, the dial's strip and the key both show "Couldn't change speed" for two seconds. The key is only 144 pixels wide, so its version is split over two lines. I added a notice to the key's drawing, the same idea as the strip's.

Two cases stay quiet on purpose:

- The reading ended while I was turning. The strip already goes gray with the crossed-out ear, so a warning on top would be shouting.
- macOS hasn't allowed the presses yet. The key already has its own "Needs Accessibility" message for that.

## Not the same warning twice

If the helper is stuck, every click of the dial is a fresh failure, and the notice would flash on every one. So the same warning shows once, and it can show again after a change works.

One thing that isn't perfect: turning the dial back to the speed it already shows also counts as "worked", so it re-arms the warning. I left it, since the worst case is seeing the notice one extra time.

## Along the way

The code that shows a notice lived inside the dial. The key needed it too, so it's one shared function now. I didn't try to merge the other things the two have in common (the picture cache, the cleanup when one leaves the deck). Two copies in one file is fine for now.

I only checked how the notice looks by drawing it on its own black page. I haven't seen it on the real deck, since that needs the helper to fail on purpose.

## What I learned

- A snap-back with no message looks exactly like a bug, even when it's the app doing the right thing.
