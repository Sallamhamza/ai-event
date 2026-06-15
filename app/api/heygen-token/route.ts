export async function POST() {
    const endpoint = "https://api.liveavatar.com/v1/sessions/token";

    try {
        const apiKey = process.env.LIVEAVATAR_API_KEY?.trim();
        const avatarId = process.env.LIVEAVATAR_AVATAR_ID?.trim();
        const voiceId = process.env.LIVEAVATAR_VOICE_ID?.trim();

        if (!apiKey) {
            return Response.json(
                { error: "Missing LIVEAVATAR_API_KEY in .env.local" },
                { status: 500 }
            );
        }

        if (!avatarId) {
            return Response.json(
                { error: "Missing LIVEAVATAR_AVATAR_ID in .env.local" },
                { status: 500 }
            );
        }

        if (!voiceId) {
            return Response.json(
                { error: "Missing LIVEAVATAR_VOICE_ID in .env.local" },
                { status: 500 }
            );
        }

        const requestBody = {
            avatar_id: avatarId,
            avatar_persona: {
                voice_id: voiceId,
                language: "en",
                voice_settings: {
                    speed: 1,
                },
                stt_config: {
                    provider: "deepgram",
                },
            },
            mode: "FULL",
            is_sandbox: true,
            video_settings: {
                quality: "low",
                encoding: "H264",
            },
            max_session_duration: 300,
            interactivity_type: "PUSH_TO_TALK",
        };

        const authAttempts: Array<{ name: string; headers: Record<string, string> }> = [
            {
                name: "X-API-KEY",
                headers: {
                    "Content-Type": "application/json",
                    "X-API-KEY": apiKey,
                },
            },
            {
                name: "Authorization Bearer",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                },
            },
        ];

        const results = [];

        for (const attempt of authAttempts) {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: attempt.headers,
                body: JSON.stringify(requestBody),
            });

            const data = await response.json();

            if (response.ok) {
                return Response.json({
                    success: true,
                    authMode: attempt.name,
                    endpoint,
                    token: data.data?.session_token,
                    sessionId: data.data?.session_id,
                    raw: data,
                });
            }

            results.push({
                authMode: attempt.name,
                status: response.status,
                details: data,
            });

            // If the error changes from 401 to another error,
            // it means authentication likely worked but another field is wrong.
            if (response.status !== 401 && response.status !== 403) {
                return Response.json(
                    {
                        error: "LiveAvatar API reached, but request payload was rejected",
                        authMode: attempt.name,
                        endpoint,
                        status: response.status,
                        details: data,
                    },
                    { status: response.status }
                );
            }
        }

        return Response.json(
            {
                error: "Both authentication methods failed",
                endpoint,
                keyLast4: apiKey.slice(-4),
                keyLength: apiKey.length,
                results,
            },
            { status: 401 }
        );
    } catch (error) {
        console.error("LIVEAVATAR TOKEN ERROR:", error);

        const message =
            error instanceof Error ? error.message : "Unknown LiveAvatar error";

        return Response.json(
            {
                error: "Failed to create LiveAvatar token",
                endpoint,
                debug: message,
            },
            { status: 500 }
        );
    }
}