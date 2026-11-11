// Desktop keeps embedded bytes. The mobile build substitutes same-origin URLs.
export async function assetArrayBuffer(asset) {
  const url = typeof asset === "object" && asset?.url;
  if (url) {
    const response = await fetch(url);
    if (!response.ok) throw Error(`Could not load asset (${response.status})`);
    return response.arrayBuffer();
  }
  const raw = typeof asset === "string" ? asset : asset?.base64 || asset?.src;
  if (typeof raw !== "string") throw Error("Missing asset");
  const encoded = raw.startsWith("data:")
    ? raw.slice(raw.indexOf(",") + 1)
    : raw;
  const rawBytes = atob(encoded);
  const bytes = new Uint8Array(rawBytes.length);
  for (let i = 0; i < rawBytes.length; i++) bytes[i] = rawBytes.charCodeAt(i);
  return bytes.buffer;
}
