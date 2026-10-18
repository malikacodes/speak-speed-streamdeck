# 02 · Finding out why the helper failed

2026-10-17

The deck was already working, but when the helper failed the log only said "Command failed", and I couldn't tell a crash from a hang from a missing file.

## What was wrong

Every failure came out as the same line:

```
The speed helper failed: Command failed: .../speed set 1
```

A bad exit, a crash and my eight second timeout all read the same. There was a second, quieter line too: "sent something that isn't JSON:" with nothing after it, which turned out to be a clean exit that printed nothing.

## Making it testable first

The part that talks to the helper called `execFile` directly, so there was no way to test it without the real helper and my real Mac's speech. I made it take the thing that runs the helper as an argument. It still defaults to `execFile`. In the tests I hand it a stand-in that answers whatever I tell it to, like a stunt double for the helper.

## What it says now

- a bad exit: `exited with code 3: <whatever the helper printed to stderr>`
- the timeout: `timed out after 8 seconds`
- a crash: `was stopped by SIGSEGV`
- no helper file at all: `couldn't start (ENOENT)`
- a clean exit with nothing printed: its own line, apart from junk that isn't JSON

The timeout was the sneaky one. Node kills a slow helper with a signal, so on its own it looks like a crash. The `killed` flag is what says it was the timeout.

## What I left alone

After a failure the deck still keeps the old speed, and a failed change still snaps the dial back with no warning. Those are next.

## What I learned

- If a log line is the same for three different failures, it's really one failure with three costumes on.
