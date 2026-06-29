import {
  buildAccessCookieHeader,
  buildClearAccessCookieHeader,
  createAccessCookieValue,
  isAccessGateEnabled,
  isCorrectAccessPassword,
} from "@/lib/access-control";
import { asRecord, checkRateLimit, enforceSameOrigin, readJsonBody } from "@/lib/api-security";

const MAX_ACCESS_BODY_BYTES = 1_000;

function isSecureRequest(request: Request): boolean {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  return forwardedProto === "https" || new URL(request.url).protocol === "https:";
}

export async function POST(request: Request) {
  const originGuard = enforceSameOrigin(request);
  if (originGuard) return originGuard;

  if (!isAccessGateEnabled()) {
    return Response.json(
      { error: "Access password is not configured." },
      { status: 500 }
    );
  }

  const rateLimit = checkRateLimit(request, {
    key: "access-login",
    limit: 10,
    windowMs: 10 * 60_000,
  });
  if (rateLimit) return rateLimit;

  const bodyResult = await readJsonBody(request, {
    maxBytes: MAX_ACCESS_BODY_BYTES,
    invalidMessage: "Invalid request.",
  });
  if (!bodyResult.ok) return bodyResult.response;

  const body = asRecord(bodyResult.data);
  if (!body) return Response.json({ error: "Invalid request." }, { status: 400 });

  if (!isCorrectAccessPassword(body.password)) {
    return Response.json({ error: "Invalid access code." }, { status: 401 });
  }

  const response = Response.json({ ok: true });
  response.headers.set(
    "Set-Cookie",
    buildAccessCookieHeader(await createAccessCookieValue(), isSecureRequest(request))
  );

  return response;
}

export async function DELETE(request: Request) {
  const originGuard = enforceSameOrigin(request);
  if (originGuard) return originGuard;

  const response = Response.json({ ok: true });
  response.headers.set("Set-Cookie", buildClearAccessCookieHeader(isSecureRequest(request)));
  return response;
}
