import {
  buildAccessCookieHeader,
  buildClearAccessCookieHeader,
  createAccessCookieValue,
  isAccessGateEnabled,
  isCorrectAccessPassword,
} from "@/lib/access-control";

function isSecureRequest(request: Request): boolean {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  return forwardedProto === "https" || new URL(request.url).protocol === "https:";
}

export async function POST(request: Request) {
  if (!isAccessGateEnabled()) {
    return Response.json(
      { error: "Access password is not configured." },
      { status: 500 }
    );
  }

  let body: { password?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

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
  const response = Response.json({ ok: true });
  response.headers.set("Set-Cookie", buildClearAccessCookieHeader(isSecureRequest(request)));
  return response;
}
