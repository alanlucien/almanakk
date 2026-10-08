# Almanakk — the iPhone and Mac app (stage A)

One Xcode project, two targets, two platforms. The app is a window around the live
web almanac (v3, on the preview lane until it takes over production); the widget is
native and is fed by the app. See `../STATUS.md` → "Three surfaces" and "Step 4".

## Run it on your iPhone (one time, ~5 minutes)

1. Open `Almanakk.xcodeproj` in Xcode (double-click it).
2. Plug the iPhone in with a cable. Unlock it. If it asks "Trust this computer?",
   say yes.
3. Top of the Xcode window: where it says a device name, pick your iPhone.
4. Press the ▶ Run button (or ⌘R). The first build takes a minute.
5. The phone will refuse to open the app the first time: Settings → General →
   VPN & Device Management → tap your Apple ID → Trust. Then open it from the
   home screen.
6. It opens on the Cloudflare Access page. Sign in the way you do in Safari (the
   login code to your email). It remembers you for 30 days.

Xcode signs it with your own Apple Development certificate (team BAV75G9G6M,
bundle id `com.winterguests.almanakk`). An app installed this way stops opening
after 7 days unless Xcode is used to reinstall it — or, with the paid programme,
after a year. TestFlight removes that limit; it is the next step, not this one.

## Run it on the Mac

Same project: pick "My Mac" instead of the iPhone and press Run. Or build once and
keep `build/Build/Products/Debug/Almanakk.app` in the Dock. ⌘R reloads the page.

## The widget (07.10)

Long-press the home screen → Edit → Add Widget → Almanakk. Small: the day, the city,
the week, the tour's word (a show as its red number). Medium: the same and today's
lines still ahead. Lock screen: one line. It never fetches anything: the web page
hands the app a snapshot of the coming weeks after every sync, the app keeps it in
the App Group, and the widget reads that. **So it is only as fresh as the last time
the app was opened.** Until the app has been opened once, the widget says "Åpne
Almanakk". On the Mac the same widget lives in Notification Centre / the desktop.

## What is here

- `Almanakk/AlmanakkApp.swift` — the window (and the Mac's minimum size and menu).
- `Almanakk/WebView.swift` — the web view: Safari user-agent so Google sign-in is
  allowed, outside links open in the real browser, a retry card when offline.
- `Almanakk/Assets.xcassets` — the icon, rendered from `../icon.svg` (full bleed
  for iOS, Apple's rounded grid for the Mac).
- `Almanakk/Almanakk.entitlements` (Mac) and `Almanakk-iOS.entitlements` — the
  sandbox, the network, and the App Group `group.com.winterguests.almanakk` the
  widget reads from.
- `Shared/Snapshot.swift` — the snapshot's shape, written by the app, read by the widget.
- `Widget/` — the widget extension: `AlmanakkWidget.swift`, its `Info.plist` and
  entitlements.
- `build/` — Xcode's output, not in git.
