# 03 · Checking what the helper says

2026-10-17

The deck trusted anything the helper printed, as long as it was valid JSON. That's a lower bar than it sounds.

## What was wrong

`JSON.parse` is happy with `null`, `5` and `{}`. If the helper ever said `null`, the deck would store it as the current state and every redraw after that would throw, because there'd be no `state` to read.

Now an answer has to have a state I know (`ok`, `hidden` or `untrusted`) and, unless it's `untrusted`, a number for the speed. Anything else gets logged with the text it sent, and the deck keeps the last good answer.

## The one I got wrong first

I'd planned to reject `untrusted` without a speed too. Then I opened the Swift file: that's exactly what the helper sends when macOS hasn't allowed Stream Deck to press buttons yet. Rejecting it would have turned off the "Needs Accessibility" message, which is the one case that needs it. So `untrusted` is fine, and it keeps whatever speed the deck knew before, so the dial still has a number to draw.

## What I left alone

The `paused` field isn't checked. Only `true` counts, so a strange value just means not paused.

## What I learned

- I wrote the test list from my own idea of the helper, not from the helper. Read the code that makes the answer first.
