export const ACCESS_COOKIE_NAME = "aivent_demo_access";
export const ACCESS_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 12;

const ACCESS_TOKEN_MESSAGE = "aivent-demo-access-v1";

function getAccessPassword(): string {
  return process.env.DEMO_ACCESS_PASSWORD?.trim() || "";
}

function bytesToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function signAccessToken(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(ACCESS_TOKEN_MESSAGE)
  );

  return bytesToHex(signature);
}

export function isAccessGateEnabled(): boolean {
  return Boolean(getAccessPassword());
}

export function isCorrectAccessPassword(password: unknown): boolean {
  const configuredPassword = getAccessPassword();
  return (
    Boolean(configuredPassword) &&
    typeof password === "string" &&
    password === configuredPassword
  );
}

export async function createAccessCookieValue(): Promise<string> {
  const password = getAccessPassword();
  if (!password) return "";
  return signAccessToken(password);
}

export async function isValidAccessCookie(value: string | undefined | null): Promise<boolean> {
  if (!isAccessGateEnabled()) return true;
  if (!value) return false;

  const expectedValue = await createAccessCookieValue();
  return value === expectedValue;
}

export function buildAccessCookieHeader(value: string, secure: boolean): string {
  const parts = [
    `${ACCESS_COOKIE_NAME}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${ACCESS_COOKIE_MAX_AGE_SECONDS}`,
  ];

  if (secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export function buildClearAccessCookieHeader(secure: boolean): string {
  const parts = [
    `${ACCESS_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];

  if (secure) {
    parts.push("Secure");
  }

  return parts.join("; ");
}
