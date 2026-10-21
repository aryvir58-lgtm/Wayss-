# WAYSS

**Social, Beyond the Feed.**

A responsive React + TypeScript + Vite foundation for WAYSS. It works as a PC web app and a mobile-friendly/PWA-style Android web app.

## Important: no PC terminal required

You can use GitHub's browser interface to upload this project. You do NOT need Android Studio, Bash, or a local terminal.

### 1. Supabase setup

Open your Supabase project in the browser.

1. Open **SQL Editor**.
2. Create a new query.
3. Copy everything from `supabase/schema.sql`.
4. Run it.
5. In **Project Settings → API**, copy the Project URL and Publishable/Anon key.
6. In the project root, create `.env` from `.env.example`:
   `VITE_SUPABASE_URL=...`
   `VITE_SUPABASE_PUBLISHABLE_KEY=...`

Never put a `service_role` key in `.env` or frontend code.

### 2. Browser-only deployment

Recommended easiest path: import the ZIP into GitHub from the browser, then connect the repository to Netlify or Vercel. Set the two environment variables in the hosting dashboard and use:

Build command: `npm run build`
Publish directory: `dist`

No local Node.js install is required.

### 3. What is already included

- WAYSS responsive shell
- Feed / For You / Connected UI
- Orbit discovery UI
- Create sheet with Echo / Signal / Glimpse / Flux entry points
- Flux screen
- You profile
- Hush entry point
- Supabase authentication wiring
- Profile foundation
- Core Supabase schema + RLS
- Connections
- Blocks
- Posts
- Likes
- Comments
- Saves
- Notifications
- Public/private post access model
- Dark/light appearance
- Mobile bottom navigation
- Desktop sidebar
- Accessibility-minded controls
- Reduced-motion support

### 4. What still needs backend implementation

This ZIP deliberately does not fake functionality. The next implementation pass should connect the UI to the schema and add:

- Real feed queries and pagination
- Real Glimpses media upload/expiry/viewers
- Flux video storage/playback
- Hush conversations/messages
- Voice notes
- WebRTC signaling + TURN
- Story mentions/collaboration
- CoCreate
- Circles
- Vault collections
- Capsules
- Pulse preferences
- Reports/moderation
- Admin verification workflow
- Account deletion cleanup
- Production-grade rate limiting and storage policies

Those require provider configuration and additional server-side policies. The UI does not pretend they work before they are connected.

## Android

The current app is responsive and can run in a mobile browser or be installed as a PWA where supported.

For a true APK later, use a browser-based GitHub Actions build with a Capacitor wrapper. This avoids installing Android Studio or a terminal on your PC.

## Security

RLS is enabled in the included SQL. Review and expand policies before production. Never trust client-side role flags or localStorage for admin permissions.

## Brand

WAYSS — Social, Beyond the Feed.
Less clutter. More connection.
