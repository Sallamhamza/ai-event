// GET /api/did-test — diagnostic: calls D-ID directly and returns raw response
export async function GET() {
  const key = process.env.DID_API_KEY?.trim();
  if (!key) {
    return Response.json({ error: "DID_API_KEY missing from environment" }, { status: 500 });
  }

  const auth = `Basic ${key}`;

  // 1. Credits check
  const creditsRes = await fetch("https://api.d-id.com/credits", {
    headers: { Authorization: auth },
  }).catch(e => ({ ok: false, status: 0, json: async () => ({ fetch_error: String(e) }) } as Response));
  const credits = await creditsRes.json().catch(() => null);

  // 2. Try creating a stream
  const streamRes = await fetch("https://api.d-id.com/talks/streams", {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      source_url: "https://d-id-public-bucket.s3.amazonaws.com/alice.jpg",
      compatibility_mode: "on",
      stream_warmup: true,
      config: { stitch: true },
    }),
  }).catch(e => ({ ok: false, status: 0, json: async () => ({ fetch_error: String(e) }) } as Response));
  const streamData = await streamRes.json().catch(() => null);

  // Close the stream if it was created
  if (streamRes.ok && streamData?.id) {
    await fetch(`https://api.d-id.com/talks/streams/${streamData.id}`, {
      method: "DELETE",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: streamData.session_id }),
    }).catch(() => {});
  }

  return Response.json({
    keyPresent: true,
    keyLength: key.length,
    keyPrefix: key.slice(0, 8) + "...",
    credits: { status: creditsRes.status, ok: creditsRes.ok, data: credits },
    stream: { status: streamRes.status, ok: streamRes.ok, data: streamData },
  });
}
