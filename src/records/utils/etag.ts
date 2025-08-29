import * as crypto from "crypto";

export function generateEtag(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function checkIfMatch(
  ifMatchHeader: string | undefined,
  currentEtag: string
): boolean {
  if (!ifMatchHeader) return false;
  // simple equality for now; could support weak etags or lists
  return ifMatchHeader === currentEtag;
}
