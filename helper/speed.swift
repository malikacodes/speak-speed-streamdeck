// Finds the Speak Selection controller (the little floating panel with
// pause, stop and the "1.25×" button) and presses its speed button.
//
//   speed            say what the button reads right now
//   speed set 1.5    press it until it reads 1.5×, then say what it reads
//   speed speak      press Option + Esc, which starts or stops the reading
//   speed pause      press the controller's pause button, or its play
//                    button if it's already paused
//
// It answers with one line of JSON:
//   {"state":"ok","speed":1.25,"paused":false}
//   {"state":"hidden","speed":1.25}   the controller isn't on screen, so nothing
//                                     is being read. The speed is the saved one.
//   {"state":"untrusted"}    macOS hasn't let Stream Deck control the computer yet
//
// Why press the button instead of saving the number? I tried saving it
// (SpeakSelectionSpeakingRateRatio in the controller's preferences). The
// label on the controller changed and the voice didn't, and after that
// the real button stopped working until I restarted the controller's
// process. So: never write that number. The button is the only safe way
// in.
//
// The button only goes forward, through seven speeds:
//   0.5 → 0.75 → 1 → 1.25 → 1.5 → 1.75 → 2 → back to 0.5
// so "one step slower" is really six presses forward. Sometimes that
// takes a couple of seconds, because the controller can be slow to take
// a press.
import AppKit
import ApplicationServices

func attribute(_ element: AXUIElement, _ name: String) -> AnyObject? {
    var value: AnyObject?
    return AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success ? value : nil
}

func children(_ element: AXUIElement) -> [AXUIElement] {
    attribute(element, "AXChildren") as? [AXUIElement] ?? []
}

// The speed button is the only one whose label ends in a times sign.
func speedButton(in element: AXUIElement) -> AXUIElement? {
    children(element).first { (attribute($0, "AXDescription") as? String)?.hasSuffix("×") == true }
}

// "1.25×" to 1.25. Some languages write it "1,25×".
func speed(of button: AXUIElement) -> Double? {
    guard let label = attribute(button, "AXDescription") as? String else { return nil }
    return Double(label.dropLast().replacingOccurrences(of: ",", with: "."))
}

// The controller belongs to a background app with no Dock icon, and it
// doesn't show up in that app's list of windows. So I ask macOS where
// that app has anything on screen, then ask what's at the middle of it.
func findController() -> AXUIElement? {
    let owner = NSRunningApplication.runningApplications(withBundleIdentifier: "com.apple.accessibility.AXVisualSupportAgent").first
    guard let pid = owner?.processIdentifier else { return nil }
    let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as? [[String: Any]] ?? []

    for window in windows where window[kCGWindowOwnerPID as String] as? pid_t == pid {
        guard let bounds = window[kCGWindowBounds as String] as? [String: CGFloat],
              let x = bounds["X"], let y = bounds["Y"], let width = bounds["Width"], let height = bounds["Height"] else { continue }

        var hit: AXUIElement?
        let middle = (Float(x + width / 2), Float(y + height / 2))
        guard AXUIElementCopyElementAtPosition(AXUIElementCreateSystemWide(), middle.0, middle.1, &hit) == .success, let found = hit else { continue }

        // The middle might land on the panel or on one of its buttons, so
        // check the thing I hit and then the thing holding it.
        if speedButton(in: found) != nil { return found }
        if let parent = attribute(found, "AXParent"), CFGetTypeID(parent) == AXUIElementGetTypeID(),
           speedButton(in: parent as! AXUIElement) != nil { return (parent as! AXUIElement) }
    }
    return nil
}

// The pause button and the play button are the same button. It's named
// after its picture, "pause.fill" while reading and "play.fill" while
// paused, and those names don't change with the Mac's language the way
// the labels "Pause" and "Play" would.
func pauseButton(in controller: AXUIElement) -> AXUIElement? {
    children(controller).first {
        let name = attribute($0, "AXIdentifier") as? String ?? ""
        return name.hasPrefix("pause") || name.hasPrefix("play")
    }
}

func isPaused(_ controller: AXUIElement) -> Bool {
    guard let button = pauseButton(in: controller) else { return false }
    return (attribute(button, "AXIdentifier") as? String)?.hasPrefix("play") == true
}

// What the controller last saved. Reading it is harmless, it's only
// writing it that breaks things. I use it to show the speed on the deck
// while nothing is being read.
func savedSpeed() -> Double {
    let saved = CFPreferencesCopyAppValue("SpeakSelectionSpeakingRateRatio" as CFString, "com.apple.accessibility.AXVisualSupportAgent" as CFString)
    return (saved as? NSNumber)?.doubleValue ?? 1
}

func answer(_ json: String) -> Never {
    print(json)
    exit(0)
}

guard AXIsProcessTrusted() else { answer(#"{"state":"untrusted"}"#) }

// Types the Speak Selection shortcut, the same as pressing the keys. If
// I ever change the shortcut in System Settings > Accessibility > Read &
// Speak, it has to change here too. 53 is the Esc key.
if CommandLine.arguments.count == 2, CommandLine.arguments[1] == "speak" {
    for keyDown in [true, false] {
        let key = CGEvent(keyboardEventSource: nil, virtualKey: 53, keyDown: keyDown)
        key?.flags = .maskAlternate
        key?.post(tap: .cghidEventTap)
        // A short hold. Without it the helper can quit before macOS has
        // passed the key along, and nothing happens.
        usleep(50_000)
    }
    // The controller takes a moment to show up or go away, so the answer
    // here would be out of date. The plugin asks again shortly after.
    answer(#"{"state":"hidden","speed":\#(savedSpeed())}"#)
}
guard let controller = findController(), let button = speedButton(in: controller) else {
    answer(#"{"state":"hidden","speed":\#(savedSpeed())}"#)
}

let arguments = CommandLine.arguments
if arguments.count == 3, arguments[1] == "set", let target = Double(arguments[2]) {
    // Seven speeds, so seven presses would bring it all the way round.
    // If the target isn't one of them, this stops after one lap.
    for _ in 0..<7 where speed(of: button) != target {
        let before = speed(of: button)
        guard AXUIElementPerformAction(button, "AXPress" as CFString) == .success else { break }

        // Give the controller a moment to take each press before the next
        // one, or a quick run of presses can count as fewer.
        for _ in 0..<50 where speed(of: button) == before { usleep(10_000) }
    }
}

if arguments.count == 2, arguments[1] == "pause", let toggle = pauseButton(in: controller) {
    let before = isPaused(controller)
    if AXUIElementPerformAction(toggle, "AXPress" as CFString) == .success {
        // Wait for the button to swap its picture, so the answer below
        // is the new state and not the old one.
        for _ in 0..<50 where isPaused(controller) == before { usleep(10_000) }
    }
}

guard let now = speed(of: button) else { answer(#"{"state":"hidden","speed":\#(savedSpeed())}"#) }
answer(#"{"state":"ok","speed":\#(now),"paused":\#(isPaused(controller))}"#)
