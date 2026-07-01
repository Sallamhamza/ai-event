## Private Demo Access

Set `DEMO_ACCESS_PASSWORD` in Vercel to enable the private demo gate.

When this variable is present:

- Visitors are redirected to `/access` before they can open the kiosk.
- All API routes are blocked unless the same access cookie is present.
- `/api/access` remains public because it is the login endpoint.

For local testing, add the same variable to `.env.local`:

```bash
DEMO_ACCESS_PASSWORD=your-private-demo-code
```

After changing the password in Vercel, redeploy the project so the proxy uses
the updated value.

## Runtime Architecture

The kiosk runs on the Next.js App Router with a small active route surface:

- `/` renders the AIVENT kiosk UI.
- `/access` and `/api/access` handle the optional private demo gate.
- `/api/ask` is the only Q&A endpoint. It uses `data/active-event.json` through `lib/knowledge/active-event-mock.ts`.
- `/api/did-stream/*` handles the D-ID WebRTC avatar stream.
- `/api/tts` generates server-side speech audio, with browser speech synthesis as the client fallback.
- `/api/analytics` stores lightweight in-memory kiosk interaction events for the current server process.
- `/admin/analytics` shows the live pilot dashboard, and `/admin/event` provides a guarded JSON editor for event content.

`data/active-event.json` is the default event knowledge source. Set `ACTIVE_EVENT_ID=my-event` to use `data/events/my-event.json` instead. Legacy Concierge, D-ID agent, HeyGen/LiveAvatar, diagnostics, old knowledge loader, and the unused Three.js avatar experiment were removed so the codebase reflects the production kiosk flow.

## Event Knowledge Updates

Event content lives in `data/active-event.json`. After editing it, run:

```bash
npm run validate-event
```

The validator checks required sections, bilingual Q&A coverage, fallback messages, desk/navigation content, sample dialogue shape, and legacy assistant naming. Keep sample dialogue assistant turns under the `aivent` key.

For local or self-hosted pilots, `/admin/event` can edit the active JSON file directly. On read-only deployments, the save action will report that the file could not be written.

## Pilot Monitoring And Offline Shell

- `/admin/analytics` reports page views, questions, answers, voice errors, resets, and language usage for the current server process.
- The kiosk registers `public/sw.js` and caches the static shell plus avatar image so a refreshed kiosk has a basic offline fallback. Live Q&A and TTS still require network/API access.

## Security Notes

- Keep real API keys only in `.env.local` and the Vercel environment dashboard. Use `.env.example` for setup placeholders.
- The active API routes enforce same-origin browser requests, bounded JSON body parsing, and in-memory per-IP rate limits for credit-burning operations.
- The optional `DEMO_ACCESS_PASSWORD` gate protects pages and API routes through `proxy.ts`; `/api/access` remains public only for login/logout.
- A git history check for `.env.local` should return no commits:

```bash
git log --all --diff-filter=A -- .env.local
```
