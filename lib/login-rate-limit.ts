import { NextRequest } from "next/server";

export const LOGIN_RATE_LIMIT_MAX = 5;
export const LOGIN_RATE_LIMIT_WINDOW_MS = 60_000;

const failedAttemptsByIp = new Map<string, number[]>();

function pruneTimestamps(timestamps: number[], now: number): number[] {
  return timestamps.filter((ts) => now - ts < LOGIN_RATE_LIMIT_WINDOW_MS);
}

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
}

export function isLoginRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = pruneTimestamps(failedAttemptsByIp.get(ip) ?? [], now);
  if (recent.length === 0) {
    failedAttemptsByIp.delete(ip);
    return false;
  }
  failedAttemptsByIp.set(ip, recent);
  return recent.length >= LOGIN_RATE_LIMIT_MAX;
}

export function recordFailedLogin(ip: string): void {
  const now = Date.now();
  const recent = pruneTimestamps(failedAttemptsByIp.get(ip) ?? [], now);
  recent.push(now);
  failedAttemptsByIp.set(ip, recent);
}

export function clearFailedLogins(ip: string): void {
  failedAttemptsByIp.delete(ip);
}

/** Clears all tracked attempts. Intended for tests. */
export function resetLoginRateLimitStore(): void {
  failedAttemptsByIp.clear();
}
