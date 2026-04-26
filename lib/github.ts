import { createHmac, timingSafeEqual } from "node:crypto";

const REPO_RE = /^(?:https?:\/\/github\.com\/|git@github\.com:)?([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i;

export interface ParsedRepo {
  owner: string;
  name: string;
  fullName: string;
}

export function parseRepoUrl(input: string): ParsedRepo | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const m = trimmed.match(REPO_RE);
  if (!m) return null;
  const [, owner, name] = m;
  if (!owner || !name) return null;
  return { owner, name, fullName: `${owner}/${name}` };
}

/**
 * Verify a GitHub webhook signature (X-Hub-Signature-256: sha256=...).
 * Returns true if no secret is configured (dev mode), so unsigned local
 * payloads are accepted.
 */
export function verifySignature(rawBody: string, signatureHeader: string | null, secret: string | undefined): boolean {
  if (!secret) return true;
  if (!signatureHeader) return false;

  const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
