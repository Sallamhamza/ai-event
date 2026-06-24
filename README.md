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
