const encoder = new TextEncoder();

const decodeBase64Url = (value: string) => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const equal = (left: Uint8Array, right: Uint8Array) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

async function verifyWithKey(token: string, key: string, body: string, expectedUrl: string) {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) return false;
  const parsedHeader = JSON.parse(new TextDecoder().decode(decodeBase64Url(header))) as { alg?: string };
  if (parsedHeader.alg !== "HS256") return false;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    decodeBase64Url(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const validSignature = await crypto.subtle.verify(
    "HMAC",
    cryptoKey,
    decodeBase64Url(signature),
    encoder.encode(`${header}.${payload}`),
  );
  if (!validSignature) return false;
  const claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload))) as {
    iss?: string; sub?: string; exp?: number; nbf?: number; body?: string;
  };
  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== "Upstash" || claims.sub !== expectedUrl || !claims.exp || claims.exp < now || (claims.nbf && claims.nbf > now)) return false;
  if (!claims.body) return false;
  const bodyHash = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(body)));
  return equal(decodeBase64Url(claims.body), bodyHash);
}

export async function verifyQStashRequest(input: {
  signature: string | null;
  body: string;
  expectedUrl: string;
  currentSigningKey: string | undefined;
  nextSigningKey: string | undefined;
}) {
  const { currentSigningKey, nextSigningKey } = input;
  if (!input.signature || !currentSigningKey || !nextSigningKey) return false;
  try {
    return (
      (await verifyWithKey(input.signature, currentSigningKey, input.body, input.expectedUrl)) ||
      (await verifyWithKey(input.signature, nextSigningKey, input.body, input.expectedUrl))
    );
  } catch {
    return false;
  }
}
