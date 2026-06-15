// app/api/did-stream/close/route.ts
// Called via navigator.sendBeacon on page unload — must be POST.
// Closes an active D-ID stream session so it doesn't count against the concurrent limit.

const DID_API = "https://api.d-id.com";

function authHeader() {
  const key = process.env.DID_API_KEY?.trim();
  if (!key) return "";
  return `Basic ${key}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { streamId, sessionId } = body;
    if (!streamId) return new Response("ok", { status: 200 });

    await fetch(`${DID_API}/talks/streams/${streamId}`, {
      method: "DELETE",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ session_id: sessionId }),
    });

    return new Response("ok", { status: 200 });
  } catch {
    return new Response("ok", { status: 200 }); // always 200 for beacon
  }
}
