export async function GET() {
  const key = process.env.LIVEAVATAR_API_KEY?.trim() || "";

  return Response.json({
    hasLiveAvatarKey: Boolean(key),
    liveAvatarKeyLength: key.length,
    liveAvatarKeyLast4: key ? key.slice(-4) : null,
    hasAvatarId: Boolean(process.env.LIVEAVATAR_AVATAR_ID),
    avatarIdLength: process.env.LIVEAVATAR_AVATAR_ID?.length || 0,
    hasVoiceId: Boolean(process.env.LIVEAVATAR_VOICE_ID),
    voiceIdLength: process.env.LIVEAVATAR_VOICE_ID?.length || 0,
  });
}
