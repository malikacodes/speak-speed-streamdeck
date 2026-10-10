# I Put My Mac's Reading Speed on a Stream Deck Dial

I have my Mac read things to me with Speak Selection (Option + Esc).
While it reads, a little controller floats on screen with a speed button
on it: `1.25×`. Click it and it goes up a step. Only up. To go from 1.5×
back to 1.25× I'd have to click all the way round, with the mouse, while
trying to listen.

So now it's on my Stream Deck, two ways.

| Action | What it does |
|---|---|
| 🎛 Speed Dial | Turn right for faster, left for slower: 1× → 1.25× → 1.5× → 1.75× → 2×. It goes round at both ends, so right from 2× is 1× and left from 1× is 2×. Press the dial to start or stop the reading (it presses Option + Esc for me). Tap the strip to pause, and tap again to carry on from the same spot. The strip shows the speed. |
| ⏩ Speed Toggle | A key that switches between two speeds. I pick them in the key's settings: Speed 1 and Speed 2. If the dial left me on a speed in between, a press goes up to the faster one. |

Both show the current speed, in pink while something is being read. When
nothing is, they go gray and a small crossed-out ear shows up.

## How it works

```
dial or key → plugin → speed helper → presses the controller's button → voice
```

The plugin is plain JavaScript. It can't see other apps' buttons, so
there's a small Swift program (`helper/speed.swift`) that can. It finds
the controller on screen, reads the speed button's label, and presses it
until it says the speed I asked for.

The button only goes forward, and it has seven speeds, not five:

```
0.5 → 0.75 → 1 → 1.25 → 1.5 → 1.75 → 2 → back to 0.5
```

I never use the two slow ones, so the dial skips them. "One step slower"
is really six presses forward. The computer doesn't complain.

## What I learned

My first try didn't touch the button at all. The controller saves its
speed as a number in its preferences (`SpeakSelectionSpeakingRateRatio`),
and I thought I could just change the number.

That went badly. The label on the controller changed and the voice
didn't, so it was showing a speed it wasn't using. Then the real button
stopped working, even when I clicked it with the mouse. It stayed broken
until I restarted the controller's background process:

```bash
killall AXVisualSupportAgent
```

(macOS starts it again by itself.) The controller only reads that number
once, when it starts, and after that it trusts its own memory. So the
rule in this project is: read the number if you like, never write it.

The one before that was even more wrong: I changed the Speaking rate
slider in System Settings, which is a different setting altogether. Two
wrong knobs before the right one. That lesson keeps finding me.

## Setup

Mac only. It needs Stream Deck 7.1 or newer, Node, and Xcode's command
line tools (for `swiftc`).

```bash
npm install
npm run helper
streamdeck link com.malikacodes.speak-speed.sdPlugin
```

`npm run helper` compiles `helper/speed.swift` into the plugin folder.
The compiled file isn't in the repo, so this step isn't optional.
`streamdeck` is Elgato's CLI (`npm install -g @elgato/cli`).

Then drag Speed Dial onto a dial and Speed Toggle onto a key. They're
under Speak Speed in the action list.

Stream Deck needs permission to press buttons in other apps: System
Settings > Privacy & Security > Accessibility, and switch on Stream
Deck. Without it the strip says "Needs Accessibility" and the key shows
Stream Deck's yellow warning triangle.

## Good to know

- It only works while something is being read. The speed button doesn't
  exist the rest of the time. Turning the dial then gets "Start reading
  first" on the strip, and pressing the key does nothing. The crossed-out
  ear is the reminder.
- Going slower can lag by a second or three. Slower is six presses and
  the controller is sometimes slow to take one. Faster is one press, and
  it's quick.
- It finds the button by its label ending in `×`. If Apple redesigns the
  controller, the helper will need another look. I tested on macOS 26.6.
- The deck checks the controller every two seconds, so after I click the
  on-screen button it can take a moment to catch up.
- The dial's press types Option + Esc. If I change the Speak Selection
  shortcut in System Settings, it has to change in the helper too.
- While it's paused the strip shows a pause sign where the speed was.
  The dots still show the speed.
- Changing the speed while paused can start the reading again. That's
  the controller's doing: its own speed button does the same.
- If nothing is being read, a tap starts the reading. Inside a dial
  stack the press belongs to the stack, so there the tap is the way in.

## Tests

```bash
npm test
```

They cover the stepping and wrapping, which speed the key picks, the
crossed-out ear, the pause sign, and that everything is drawn on pure
black.
