import { cookies } from "next/headers";

const COOKIE_NAME = "gym-auth";
const TOKEN_PREFIX = "gym-v1:";

function makeToken(pin: string): string {
  // Simple HMAC-like token: hash the pin with a prefix
  // Not cryptographically strong but sufficient for a personal app
  const encoder = new TextEncoder();
  const data = encoder.encode(TOKEN_PREFIX + pin);
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data[i];
    hash = ((hash << 5) - hash + char) | 0;
  }
  return TOKEN_PREFIX + Math.abs(hash).toString(36);
}

export function getExpectedToken(): string {
  const pin = process.env.APP_PIN;
  if (!pin) throw new Error("APP_PIN environment variable is not set");
  return makeToken(pin);
}

export function validatePin(pin: string): boolean {
  const expected = process.env.APP_PIN;
  if (!expected) return false;
  return pin === expected;
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;
  try {
    return token === getExpectedToken();
  } catch {
    return false;
  }
}

export { COOKIE_NAME, makeToken as createToken };
