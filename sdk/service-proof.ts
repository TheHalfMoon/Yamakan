// Before a client sends its token, the service proves it knows that token: a process that took
// the port first cannot, so it never receives one. Shared by the client and the service, on
// WebCrypto, so both compute the same thing in Node and in a browser.
//
// The client sends a fresh challenge and an id derived one way from the token's hash; neither
// gives the token or its hash. The service finds the token that id belongs to (the workspace's
// own, or a live agent token, stored only as its hash) and answers with an HMAC of the
// challenge keyed by that hash.

const encoder = new TextEncoder();
const hex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

export const HEX64 = /^[a-f0-9]{64}$/;

/** The token's hash: what the service keeps of an agent token, and the proof's key. */
export async function tokenKey(token: string) {
  return hex(await crypto.subtle.digest("SHA-256", encoder.encode(token)));
}

/** Names the token to the service without giving the token or its hash. */
export async function serviceId(key: string) {
  return hex(
    await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(`yamakan-service-id/1:${key}`),
    ),
  );
}

/**
 * The service's answer to a challenge, for the token whose hash is `key`, at its own address
 * (`origin`): a proof another service made, at another port, does not count here.
 */
export async function serviceProof(key: string, nonce: string, origin: string) {
  const hmac = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(
    await crypto.subtle.sign(
      "HMAC",
      hmac,
      encoder.encode(`yamakan-service-proof/2:${origin}:${nonce}`),
    ),
  );
}

/** A fresh challenge. */
export function newNonce() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return hex(bytes.buffer);
}

/** Equal without leaking where they differ (both are hex of one length here). */
export function sameHex(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
