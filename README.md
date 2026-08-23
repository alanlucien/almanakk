# Almanakk

Norwegian wall-calendar view on top of Google Calendar. See CLAUDE.md for the
full project description.

## Run it locally

```
python3 -m http.server 8123
```

Then open http://localhost:8123. Without a Google client ID it runs in demo
mode with sample data from the old sheet.

## Connect Google Calendar (one-time, ~15 min)

1. Go to https://console.cloud.google.com/ and sign in as alan@winterguests.com.
2. Create a project (top bar → project picker → "New project"), name it e.g.
   `almanakk`.
3. Enable the API: menu → "APIs & Services" → "Library" → search
   "Google Calendar API" → Enable.
4. OAuth consent: "APIs & Services" → "OAuth consent screen" →
   External → fill in app name `Almanakk` and your email → save.
   Under "Audience"/"Test users", add alan@winterguests.com (and anyone else
   who should be able to log in). The app can stay in "Testing" forever —
   no Google verification needed.
5. Credentials: "APIs & Services" → "Credentials" → "Create credentials" →
   "OAuth client ID" → type "Web application".
   Under "Authorized JavaScript origins" add:
   - `http://localhost:8123` (for local use)
   - later: the https address where the app is hosted
6. Copy the Client ID (ends in `.apps.googleusercontent.com`) and paste it
   into `config.js`:

   ```js
   window.ALMANAKK_CONFIG = { clientId: 'PASTE-IT-HERE.apps.googleusercontent.com' };
   ```

7. Reload the page → "Logg inn med Google" → pick calendars under
   "Kalendere". The checkboxes choose what is shown; the radio button chooses
   which calendar new quick-add events are written to.

## Not done yet (next steps)

- Deploy to a real URL (GitHub Pages or Cloudflare Pages) so it works on the
  phone away from home.
- PWA manifest + service worker so the strip view installs to the iPhone
  home screen (pointless until deployed over https).
- One-time import of the old sheet's entries into Google Calendar.
