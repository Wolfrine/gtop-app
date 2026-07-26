import { Timestamp } from "firebase-admin/firestore";

export function updateTokenFromTimestamp(timestamp: Timestamp): string {
  return `${timestamp.seconds}:${String(timestamp.nanoseconds).padStart(9, "0")}`;
}

export function timestampFromUpdateToken(token: string): Timestamp {
  const match = /^(-?\d+):(\d{9})$/.exec(token);
  if (!match) throw new Error("Invalid Firestore update token.");
  const seconds = Number(match[1]);
  const nanoseconds = Number(match[2]);
  if (
    !Number.isSafeInteger(seconds) ||
    nanoseconds < 0 ||
    nanoseconds >= 1_000_000_000
  )
    throw new Error("Invalid Firestore update token.");
  return new Timestamp(seconds, nanoseconds);
}
