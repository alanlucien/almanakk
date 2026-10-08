# Almanakk — retired GitHub Pages address

alanlucien.github.io/almanakk/ forwarded here until 08.10.2026, when the almanac moved
to https://almanakk-v2.pages.dev/ (Cloudflare Pages, behind Cloudflare Access). This
branch only forwards: every page, and any unknown path via 404.html, unregisters the old
service worker, empties its caches and sends the visitor on. No sw.js is served, so old
installs also drop their service worker on their next update check.

The app's code is on `main`.
