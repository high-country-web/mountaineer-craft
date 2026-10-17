import { timingSafeEqual } from "node:crypto";

export function validOAuthState(expected: string | undefined, actual: unknown): boolean {
  if (!expected || typeof actual !== "string") return false;
  const left = Buffer.from(expected), right = Buffer.from(actual);
  return left.length === right.length && timingSafeEqual(left, right);
}
