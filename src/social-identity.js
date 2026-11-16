import {
  usernameOf,
  publicKeyOf,
  serviceURL,
} from "../server/social-protocol.mjs";
const open = () =>
  new Promise((resolve, reject) => {
    const r = indexedDB.open("dcsmcraft-accounts", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("identities");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(Error("Account storage is unavailable."));
  });
export async function identityGet(url) {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction("identities", "readonly"),
        r = tx.objectStore("identities").get(serviceURL(url));
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => reject(r.error);
    });
  } finally {
    db.close();
  }
}
export async function identityPut(url, identity) {
  const db = await open();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction("identities", "readwrite");
      tx.objectStore("identities").put(identity, serviceURL(url));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function newIdentity(username) {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  return {
    username: usernameOf(username),
    publicKey: publicKeyOf(
      await crypto.subtle.exportKey("jwk", pair.publicKey),
    ),
    privateKey: pair.privateKey,
    registered: false,
  };
}
export async function exportIdentity(url, identity) {
  if (!identity) throw Error("Create an account first.");
  return {
    format: "dcsmcraft-account",
    version: 1,
    service: serviceURL(url),
    username: identity.username,
    publicKey: identity.publicKey,
    privateKey: await crypto.subtle.exportKey("jwk", identity.privateKey),
  };
}
export async function importIdentity(raw) {
  if (
    raw?.format !== "dcsmcraft-account" ||
    raw.version !== 1 ||
    !raw.privateKey?.d
  )
    throw Error("Invalid account backup.");
  const pub = publicKeyOf(raw.publicKey),
    priv = publicKeyOf(raw.privateKey);
  if (pub.x !== priv.x || pub.y !== priv.y)
    throw Error("Account keys do not match.");
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    raw.privateKey,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"],
  );
  const msg = new TextEncoder().encode("DCSMCRAFT account backup");
  const proof = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    msg,
  );
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    pub,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  if (
    !(await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      proof,
      msg,
    ))
  )
    throw Error("Account keys do not match.");
  const identity = {
    username: usernameOf(raw.username),
    publicKey: pub,
    privateKey,
    registered: true,
  };
  const url = serviceURL(raw.service);
  await identityPut(url, identity);
  return { url, identity };
}
