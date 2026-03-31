"use client";

/**
 * ConnectButton
 *
 * Drop-in replacement for WalletMultiButton that is aware of the Phantom
 * deep link flow on mobile Safari / Chrome.
 *
 * - Mobile (no Phantom injection): renders a button that triggers the deep link
 *   connect flow and shows the truncated wallet address when connected.
 * - Desktop / Phantom in-app browser: delegates to WalletMultiButton as before.
 */

import dynamic from "next/dynamic";
import { usePhantomDeeplink } from "../context/PhantomDeeplinkContext";

const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false }
);

export default function ConnectButton({ style }) {
  const deeplink = usePhantomDeeplink();

  if (deeplink?.needsDeepLink) {
    if (deeplink.connected) {
      const addr = deeplink.publicKey;
      return (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span
            style={{
              fontSize: style?.fontSize ?? "0.75rem",
              color: style?.color ?? "#1a1a1a",
              border: style?.border ?? "1px solid #1a1a1a",
              borderRadius: style?.borderRadius ?? "9999px",
              padding: style?.padding ?? "0.375rem 0.75rem",
              lineHeight: 1.5,
              fontFamily: "monospace",
              backgroundColor: style?.backgroundColor ?? "transparent",
            }}
          >
            {addr.slice(0, 4)}…{addr.slice(-4)}
          </span>
          <button
            onClick={deeplink.disconnect}
            style={{
              fontSize: "0.65rem",
              color: "#888",
              cursor: "pointer",
              background: "none",
              border: "none",
              padding: 0,
            }}
          >
            ✕
          </button>
        </div>
      );
    }

    return (
      <button
        onClick={() => deeplink.connect()}
        style={{
          backgroundColor: style?.backgroundColor ?? "transparent",
          border: style?.border ?? "1px solid #1a1a1a",
          color: style?.color ?? "#1a1a1a",
          fontSize: style?.fontSize ?? "0.75rem",
          borderRadius: style?.borderRadius ?? "9999px",
          padding: style?.padding ?? "0.375rem 0.75rem",
          lineHeight: 1.5,
          cursor: "pointer",
          width: style?.width,
          fontWeight: style?.fontWeight,
          display: "flex",
          justifyContent: style?.justifyContent ?? "center",
          alignItems: "center",
        }}
      >
        Connect Phantom
      </button>
    );
  }

  return <WalletMultiButton style={style} />;
}
