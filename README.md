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

`data/active-event.json` is the single event knowledge source. Legacy Concierge, D-ID agent, HeyGen/LiveAvatar, diagnostics, old knowledge loader, and the unused Three.js avatar experiment were removed so the codebase reflects the production kiosk flow.

## Event Knowledge Updates

Event content lives in `data/active-event.json`. After editing it, run:

```bash
npm run validate-event
```

The validator checks required sections, bilingual Q&A coverage, fallback messages, desk/navigation content, sample dialogue shape, and legacy assistant naming. Keep sample dialogue assistant turns under the `aivent` key.

## Security Notes

- Keep real API keys only in `.env.local` and the Vercel environment dashboard. Use `.env.example` for setup placeholders.
- The active API routes enforce same-origin browser requests, bounded JSON body parsing, and in-memory per-IP rate limits for credit-burning operations.
- The optional `DEMO_ACCESS_PASSWORD` gate protects pages and API routes through `proxy.ts`; `/api/access` remains public only for login/logout.
- A git history check for `.env.local` should return no commits:

```bash
git log --all --diff-filter=A -- .env.local
```
