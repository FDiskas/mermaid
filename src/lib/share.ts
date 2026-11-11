/** Shareable links hold the whole diagram in the URL hash, so no server is needed. */
const HASH_KEY = "d=";

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(text.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const source = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(source).arrayBuffer());
}

export async function encodeShareHash(code: string): Promise<string> {
  const packed = await pipe(new TextEncoder().encode(code), new CompressionStream("deflate-raw"));
  return `#${HASH_KEY}${toBase64Url(packed)}`;
}

/** Returns the diagram stored in a share hash, or null when the hash is not a share link or is corrupt. */
export async function decodeShareHash(hash: string): Promise<string | null> {
  const body = hash.replace(/^#/, "");
  if (!body.startsWith(HASH_KEY)) return null;
  try {
    const bytes = await pipe(fromBase64Url(body.slice(HASH_KEY.length)), new DecompressionStream("deflate-raw"));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}
