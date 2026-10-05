# Almanakk — the iPhone and Mac app (stage A)

One Xcode project, one target, two platforms. It is a window around the live web
almanac at https://almanakk-v2.pages.dev/v2/ — the renderer, the sign-in and the
data are the web app's. See `../STATUS.md` → "Three surfaces" for why this is stage
A and what stage B is.

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

## What is here

- `Almanakk/AlmanakkApp.swift` — the window (and the Mac's minimum size and menu).
- `Almanakk/WebView.swift` — the web view: Safari user-agent so Google sign-in is
  allowed, outside links open in the real browser, a retry card when offline.
- `Almanakk/Assets.xcassets` — the icon, rendered from `../icon.svg` (full bleed
  for iOS, Apple's rounded grid for the Mac).
- `Almanakk/Almanakk.entitlements` — Mac sandbox with network, nothing else.
- `build/` — Xcode's output, not in git.
