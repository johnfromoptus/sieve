export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);

  // crypto.subtle is unavailable over plain HTTP (non-secure context).
  // Fall back to a manual SHA-256 so PKCE works during dev over IP.
  if (crypto.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", data);
    return base64UrlEncode(new Uint8Array(digest));
  }

  // Minimal SHA-256: import dynamically to keep the bundle small
  const { sha256 } = await import("./sha256");
  return base64UrlEncode(sha256(data));
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function generateState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}
