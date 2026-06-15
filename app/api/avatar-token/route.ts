// app/api/avatar-token/route.ts
// Returns a short-lived HeyGen streaming session token.
// The client passes this to the HeyGen SDK to start a streaming session.

export async function POST() {
  try {
    const apiKey = process.env.HEYGEN_API_KEY?.trim();

    if (!apiKey) {
      return Response.json(
        { error: "Missing HEYGEN_API_KEY in .env.local" },
        { status: 500 }
      );
    }

    // HeyGen requires mixed-case X-Api-Key header (case-sensitive)
    const response = await fetch(
      "https://api.heygen.com/v1/streaming.create_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": apiKey,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("HeyGen token error:", data);
      return Response.json(
        {
          error: "Failed to create HeyGen session token",
          status: response.status,
          details: data,
        },
        { status: response.status }
      );
    }

    return Response.json({
      sessionToken: data.data?.token,
      avatarId: process.env.HEYGEN_AVATAR_ID?.trim() ?? "",
      voiceId: process.env.HEYGEN_VOICE_ID?.trim() ?? "",
    });
  } catch (error) {
    console.error("AVATAR TOKEN ERROR:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { error: "Failed to create avatar token", debug: message },
      { status: 500 }
    );
  }
}
