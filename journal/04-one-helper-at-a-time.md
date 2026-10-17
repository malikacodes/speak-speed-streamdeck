# 04 · One helper at a time

2026-10-17

Turning the dial worked, but two things could still start a helper while another one was busy pressing.

## What was wrong

I had a rule that only one helper runs at a time, like a single checkout lane, but only the speed change used it. The 2 second check, the start/stop press and the pause press all ran outside it. So a check could start while a pause was still going, and a check that started just before a speed change could finish in the middle of it and put the older speed back on the dial. If the helper hung, the 2 second tick kept piling more behind it until the 8 second timeout.

## What I did

Everything now goes through the same lane: check, speak, pause and speed change. The first three skip if the lane is taken, because there's no point checking twice. A speed change is different: it can't be skipped, because that's the whole dial. So it waits for whatever is in the lane, then goes. Spin the dial three clicks while it waits and only the last speed gets asked for.

I wrote the tests with a stand-in helper that doesn't answer until the test says so, which made it easy to hold the lane shut and watch what tried to get in. Most of them fail on the old code, which was the point of writing them first. The three that already passed (newest speed wins, a check during a change is skipped, a failed change cleans up) are there to keep it that way.

## What I left alone

There's a gap of a few microtasks between one job leaving the lane and a waiting speed change taking it. A check could only slip into it from another microtask. Dial turns and timers are never microtasks, so I didn't build around it.

## What I learned

- A "one at a time" rule only counts if every job obeys it.
