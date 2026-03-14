import { ed25519 } from "@noble/curves/ed25519";
import { PublicKey } from "@solana/web3.js";

const SIGNATURE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Verify a signed challenge message from a Solana wallet.
 *
 * The message must contain a line matching "Timestamp: <unix ms>" which is
 * checked against the current time. The ed25519 signature must be valid for
 * the given walletAddress.
 *
 * @param {string} walletAddress  Base58 public key
 * @param {string} signedMessage  The plaintext challenge that was signed
 * @param {string} signature      Base64-encoded signature bytes
 * @returns {{ ok: boolean, reason?: string }}
 */
export function verifyWalletSignature(walletAddress, signedMessage, signature) {
  try {
    const match = signedMessage.match(/Timestamp:\s*(\d+)/);
    if (!match) return { ok: false, reason: "Invalid challenge message format" };
    const ts = parseInt(match[1], 10);
    if (isNaN(ts)) return { ok: false, reason: "Invalid timestamp in challenge" };
    if (Date.now() - ts > SIGNATURE_MAX_AGE_MS) {
      return { ok: false, reason: "Challenge expired — please try again" };
    }

    const msgBytes = new TextEncoder().encode(signedMessage);
    const sigBytes = Buffer.from(signature, "base64");
    const pubKeyBytes = new PublicKey(walletAddress).toBytes();

    const valid = ed25519.verify(sigBytes, msgBytes, pubKeyBytes);
    if (!valid) return { ok: false, reason: "Signature verification failed" };
    return { ok: true };
  } catch {
    return { ok: false, reason: "Signature verification error" };
  }
}
