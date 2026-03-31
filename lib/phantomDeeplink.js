/**
 * Phantom Mobile Deep Link utilities
 *
 * Implements the Phantom deep link protocol for mobile browsers (Safari/Chrome)
 * where the Phantom extension is not injected. The protocol uses:
 *   - X25519 Diffie-Hellman for key exchange
 *   - XSalsa20-Poly1305 (NaCl box) for payload encryption
 *   - bs58 encoding for all binary parameters
 *
 * Compatible with Phantom's tweetnacl-based implementation:
 *   boxBefore = hsalsa20(x25519(sk, pk), zeros_16)
 *   boxAfter  = xsalsa20poly1305(boxKey, nonce)
 *
 * Built on @noble/curves and @noble/ciphers (already installed as transitive deps).
 */

import { x25519 } from "@noble/curves/ed25519";
import { xsalsa20poly1305, hsalsa } from "@noble/ciphers/salsa";
import bs58 from "bs58";

// Inline helper: Uint8Array → Uint32Array view (avoids importing @noble/ciphers/utils)
const u32 = (bytes) =>
  new Uint32Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 4));

// Inline CSPRNG: use the browser/Node.js built-in crypto (avoids @noble/hashes/utils)
const randomBytes = (n) => {
  const b = new Uint8Array(n);
  globalThis.crypto.getRandomValues(b);
  return b;
};

// Salsa20 sigma constants ("expand 32-byte k") as Uint32Array — required by hsalsa
// Computed lazily (first call) to avoid running at module parse time during SSR
let _SIGMA32 = null;
const getSigma32 = () => {
  if (!_SIGMA32) _SIGMA32 = u32(new TextEncoder().encode("expand 32-byte k"));
  return _SIGMA32;
};

const SS = "phantom_dl_"; // localStorage key prefix

// ─── NaCl box primitives ─────────────────────────────────────────────────────

/**
 * Replicate nacl.box.before(): derive shared key from raw X25519 shared secret.
 * Applies HSalsa20 with 16 zero bytes, exactly matching tweetnacl's implementation.
 */
function boxBefore(rawSharedSecret) {
  const k32 = u32(rawSharedSecret.slice());
  const zeros = new Uint32Array(4); // 16 zero bytes
  const out = new Uint32Array(8);   // 32-byte output
  hsalsa(getSigma32(), k32, zeros, out);
  return new Uint8Array(out.buffer.slice(0, 32));
}

/** Replicate nacl.box.after() / nacl.secretbox(): XSalsa20-Poly1305 encrypt. */
function boxAfterEncrypt(message, nonce, boxKey) {
  return xsalsa20poly1305(boxKey, nonce).encrypt(message);
}

/** Replicate nacl.box.open.after(): XSalsa20-Poly1305 decrypt. */
function boxAfterDecrypt(ciphertext, nonce, boxKey) {
  return xsalsa20poly1305(boxKey, nonce).decrypt(ciphertext);
}

// ─── Keypair management ───────────────────────────────────────────────────────

/**
 * Get or create the dApp's X25519 keypair, persisted in localStorage.
 * The same keypair is reused for the session to allow decrypting callbacks.
 */
export function getDappKeypair() {
  if (typeof window === "undefined") return null;

  const stored = localStorage.getItem(SS + "keypair");
  if (stored) {
    try {
      const { pk, sk } = JSON.parse(stored);
      return {
        publicKey: new Uint8Array(pk),
        secretKey: new Uint8Array(sk),
      };
    } catch {
      // fall through and generate a new one
    }
  }

  const secretKey = x25519.utils.randomPrivateKey();
  const publicKey = x25519.getPublicKey(secretKey);

  localStorage.setItem(
    SS + "keypair",
    JSON.stringify({
      pk: Array.from(publicKey),
      sk: Array.from(secretKey),
    })
  );

  return { publicKey, secretKey };
}

// ─── Payload encryption/decryption ───────────────────────────────────────────

/**
 * Encrypt a JSON payload for sending to Phantom.
 * Returns { nonce: string (bs58), payload: string (bs58) }
 */
export function encryptPayload(payloadObj, boxKey) {
  const nonce = randomBytes(24);
  const message = Buffer.from(JSON.stringify(payloadObj));
  const encrypted = boxAfterEncrypt(message, nonce, boxKey);
  return {
    nonce: bs58.encode(Buffer.from(nonce)),
    payload: bs58.encode(Buffer.from(encrypted)),
  };
}

/**
 * Decrypt a payload returned by Phantom.
 * @param {string} dataBase58 - the "data" URL param (bs58)
 * @param {string} nonceBase58 - the "nonce" URL param (bs58)
 * @param {Uint8Array} boxKey - precomputed box key from computeBoxKey()
 */
export function decryptPayload(dataBase58, nonceBase58, boxKey) {
  const ciphertext = bs58.decode(dataBase58);
  const nonce = bs58.decode(nonceBase58);
  const decrypted = boxAfterDecrypt(new Uint8Array(ciphertext), new Uint8Array(nonce), boxKey);
  if (!decrypted) throw new Error("Phantom payload decryption failed — possible tampering or wrong keys");
  return JSON.parse(Buffer.from(decrypted).toString("utf-8"));
}

/**
 * Compute the NaCl box shared key from the dApp secret key and Phantom's public key.
 * @param {string} phantomPublicKeyBase58 - Phantom's encryption public key
 */
export function computeBoxKey(phantomPublicKeyBase58) {
  const { secretKey } = getDappKeypair();
  const phantomPK = new Uint8Array(bs58.decode(phantomPublicKeyBase58));
  const rawShared = x25519.getSharedSecret(secretKey, phantomPK);
  return boxBefore(rawShared);
}

// ─── URL builders ─────────────────────────────────────────────────────────────

/**
 * Build the Phantom deep link connect URL.
 * @param {object} opts
 * @param {string} opts.appUrl - your site's origin (e.g. "https://commonersdao.com")
 * @param {string} opts.redirectLink - full URL to /phantom-callback
 * @param {string} [opts.cluster] - "mainnet-beta" (default)
 */
export function buildConnectURL({ appUrl, redirectLink, cluster = "mainnet-beta" }) {
  const { publicKey } = getDappKeypair();
  const dappPublicKeyBase58 = bs58.encode(Buffer.from(publicKey));

  const params = new URLSearchParams({
    app_url: appUrl,
    dapp_encryption_public_key: dappPublicKeyBase58,
    redirect_link: redirectLink,
    cluster,
  });

  return `https://phantom.app/ul/v1/connect?${params}`;
}

/**
 * Build the Phantom deep link signMessage URL.
 * @param {object} opts
 * @param {Uint8Array} opts.messageBytes - the raw bytes to sign
 * @param {string} opts.session - the session token from the connect response
 * @param {Uint8Array} opts.boxKey - the precomputed box key
 * @param {string} opts.redirectLink - full URL to /phantom-callback (with action=signMessage)
 */
export function buildSignMessageURL({ messageBytes, session, boxKey, redirectLink }) {
  const { publicKey } = getDappKeypair();
  const dappPublicKeyBase58 = bs58.encode(Buffer.from(publicKey));

  const payloadObj = {
    message: bs58.encode(Buffer.from(messageBytes)),
    session,
  };

  const { nonce, payload } = encryptPayload(payloadObj, boxKey);

  const params = new URLSearchParams({
    dapp_encryption_public_key: dappPublicKeyBase58,
    nonce,
    redirect_link: redirectLink,
    payload,
  });

  return `https://phantom.app/ul/v1/signMessage?${params}`;
}

// ─── Session persistence ──────────────────────────────────────────────────────

/**
 * Save the established Phantom session to localStorage.
 * Called after successfully processing the connect callback.
 */
export function saveDeeplinkSession({ publicKey, session, phantomPublicKey, boxKey }) {
  localStorage.setItem(SS + "public_key", publicKey);
  localStorage.setItem(SS + "session", session);
  localStorage.setItem(SS + "phantom_pubkey", phantomPublicKey);
  localStorage.setItem(SS + "box_key", JSON.stringify(Array.from(boxKey)));
}

/**
 * Load an existing Phantom session from localStorage.
 * Returns null if no session is stored.
 */
export function loadDeeplinkSession() {
  if (typeof window === "undefined") return null;

  const publicKey = localStorage.getItem(SS + "public_key");
  const session = localStorage.getItem(SS + "session");
  const phantomPublicKey = localStorage.getItem(SS + "phantom_pubkey");
  const boxKeyRaw = localStorage.getItem(SS + "box_key");

  if (!publicKey || !session || !boxKeyRaw) return null;

  return {
    publicKey,
    session,
    phantomPublicKey,
    boxKey: new Uint8Array(JSON.parse(boxKeyRaw)),
  };
}

/** Clear the Phantom deep link session from localStorage. */
export function clearDeeplinkSession() {
  if (typeof window === "undefined") return;
  [
    "keypair",
    "public_key",
    "session",
    "phantom_pubkey",
    "box_key",
  ].forEach((k) => localStorage.removeItem(SS + k));
}

// ─── Device detection ─────────────────────────────────────────────────────────

/**
 * Returns true when:
 *   - the user is on a mobile device (iOS or Android)
 *   - AND Phantom has NOT injected window.solana into this browser
 *
 * In this case, the deep link flow is needed.
 */
export function needsPhantomDeepLink() {
  if (typeof window === "undefined") return false;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const isPhantomInjected = !!window.solana?.isPhantom;
  return isMobile && !isPhantomInjected;
}
