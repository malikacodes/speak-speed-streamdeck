# 01 · My reading speed on a dial

2026-10-10

I've been having such a fun time building things these last few weeks.
This one came to me while I was studying for my exam, which is exactly
when all my best unrelated ideas show up.

I use text to speech and speech to text all the time. It's more
convenient for me, it's more efficient, and it's faster. I've also been
finding good uses for the dial on my Stream Deck +, so the two met: I
wanted to turn the dial and have my Mac read faster or slower. (I can't
wait to buy the Stream Deck XL Pro. I've been loving this lately.)

## What I was fixing

When my Mac reads to me with Speak Selection (Option + Esc), a small
controller floats on screen with a speed button on it, like `1.25×`.
Clicking it goes up one step. It never goes down. Getting from 1.5× back
to 1.25× means clicking all the way round with the mouse while I'm trying
to listen to something.

## Wrong knob number one

> Where does the Mac keep the reading speed?

My first answer was the Speaking rate slider in System Settings. I found
where it's saved, wrote a script to flip it between normal and fast, and
hooked it to a Keyboard Maestro shortcut. I even timed the same paragraph
at different settings to find a real 2×. A quick brown fox was read to me
about fifteen times.

It worked, technically. It just wasn't the button I use. The slider is
the voice's base speed, and the controller's `1.25×` is a separate thing
on top of it. I deleted the script and the shortcut.

## Wrong knob number two

The controller saves its speed too, as a number called
`SpeakSelectionSpeakingRateRatio`. So I changed the number.

The label on the controller changed. The voice did not. Now it was
showing a speed it wasn't using, and then it got worse: the real button
stopped working, even with the mouse. The voice was stuck on 2× no matter
what the label said.

What fixed it was restarting the controller's background process:

```bash
killall AXVisualSupportAgent   # macOS starts it again by itself
```

The controller reads that number once, when it starts. After that it goes
by its own memory, and my edits just confused it. Very helpful. Thanks.

## The right one: press the actual button

If the button is the only thing that really changes the voice, then the
plan is to press the button, just not with my hand.

macOS lets one app press another app's buttons through Accessibility.
The catch was finding the controller. It belongs to a background app with
no Dock icon, and it doesn't appear in that app's list of windows. What
worked was asking macOS "where does this app have anything on screen?"
and then "what's at the middle of that?"

```
dial or key → plugin → speed helper → presses the button → voice
```

Then a surprise. I thought the button had five speeds. It has seven:

```
0.5 → 0.75 → 1 → 1.25 → 1.5 → 1.75 → 2 → back to 0.5
```

I never use the two slow ones, so I'd never noticed them hiding after 2×.
The helper skips them. And since the button only goes forward, "one step
slower" is six presses forward. That's why slower has a little lag and
faster doesn't.

## On the deck

Two actions:

- **Speed Dial.** Right is faster, left is slower, and it goes round at
  both ends.
- **Speed Toggle.** A key with two speeds I pick in its settings. My
  first rule sent it back to Speed 1 from anywhere, which felt wrong the
  moment I used it. Now it goes to the next pick up: from 1.75× with
  picks of 1.25× and 2×, it goes to 2×.

The first time I pressed the key I got Stream Deck's yellow "!" and
thought I'd broken it. Nothing was being read, that's all. The speed
button only exists while the Mac is reading, so there was nothing to
press. A warning sign was too dramatic for that, so now the key and the
strip go gray and show a small crossed-out ear, the same ear as my
Option + Esc key.

Last thing: pressing the dial, or tapping the strip, starts and stops the
reading. So the whole thing lives on one dial now. The first version of
that did nothing at all, because the helper typed Option + Esc and quit
before macOS had passed the keys along. A tiny pause fixed it.

## Did it work?

1. Select some text and press the dial. The Mac starts reading and the
   strip turns white and pink.
2. Turn right past 2×. It lands on 1×.
3. Turn left past 1×. It lands on 2×, after a second.
4. Stop the reading. The strip goes gray and the ear shows up.

## What I learned

- A number in a settings file is not the same as the thing it describes.
  Reading it is fine. Writing it behind an app's back is how I jammed a
  button I couldn't even see the code for.
- When the real control is a button, press the button.
- Two wrong knobs before the right one. That lesson keeps finding me.

## What's next

- Use it through a full study session and see if the lag on slower
  bothers me.
- Try it inside a dial stack, where only the tap should reach it.
