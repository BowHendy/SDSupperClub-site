import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { HandlerContext, HandlerEvent } from "@netlify/functions";

function base64UrlToBuffer(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, "base64");
}

/**
 * Verify Netlify/GoTrue webhook JWS (`X-Webhook-Signature`).
 * Claims include iss (netlify|gotrue) and sha256 hex of the raw body.
 */
export function verifyWebhookSignature(token: string, rawBody: string, secret: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const [headerB64, payloadB64, sigB64] = parts;
    const signingInput = `${headerB64}.${payloadB64}`;
    const expected = createHmac("sha256", secret).update(signingInput).digest();
    const actual = base64UrlToBuffer(sigB64);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false;

    const payloadJson = base64UrlToBuffer(payloadB64).toString("utf8");
    const payload = JSON.parse(payloadJson) as { iss?: string; sha256?: string };
    if (payload.iss !== "netlify" && payload.iss !== "gotrue") return false;
    if (typeof payload.sha256 !== "string") return false;

    const bodyHash = createHash("sha256").update(rawBody, "utf8").digest("hex");
    const a = Buffer.from(payload.sha256, "utf8");
    const b = Buffer.from(bodyHash, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Allow Identity event handlers only when:
 * - Netlify injected `clientContext.identity` (platform trigger), or
 * - A valid webhook signature is present for NETLIFY_IDENTITY_WEBHOOK_SECRET.
 */
export function assertIdentityEventAuthorized(event: HandlerEvent, context: HandlerContext): void {
  const identity = (context as { clientContext?: { identity?: { token?: string } } }).clientContext
    ?.identity;
  if (identity?.token) return;

  const secret =
    process.env.NETLIFY_IDENTITY_WEBHOOK_SECRET ??
    process.env.IDENTITY_WEBHOOK_SECRET ??
    process.env.WEBHOOK_SECRET ??
    null;
  const header =
    event.headers["x-webhook-signature"] ??
    event.headers["X-Webhook-Signature"] ??
    null;

  if (secret && header && event.body && verifyWebhookSignature(header, event.body, secret)) {
    return;
  }

  throw new Error("Unauthorized");
}

export function authStatusFromError(e: unknown): number {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg === "Unauthorized") return 401;
  if (msg === "Forbidden") return 403;
  return 500;
}

export function publicErrorMessage(e: unknown, fallback = "Server error"): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg === "Unauthorized" || msg === "Forbidden") return msg;
  return fallback;
}
