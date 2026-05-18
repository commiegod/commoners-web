// Illuminated drop-cap wrapper. Pulls the first letter of `children` (must be
// a plain string for the cap to read cleanly) and renders it as a large
// initial floated against the rest of the paragraph.
//
// Usage:
//   <DropCap>The Commoner's DAO turns individual self-interest into ...</DropCap>
//
// Pass `as="p"` (default) or any block-level element. Pass `tone="accent"`
// to render the cap in the warm-red accent instead of the gold token.

export default function DropCap({
  children,
  as: Tag = "p",
  tone = "gold",
  className = "",
}) {
  if (typeof children !== "string" || children.length === 0) {
    return <Tag className={className}>{children}</Tag>;
  }
  const first = children.charAt(0);
  const rest = children.slice(1);
  const capColor =
    tone === "accent" ? "text-[#9c3a1f]" : "text-foreground";

  return (
    <Tag className={`leading-relaxed ${className}`}>
      <span
        className={`font-blackletter ${capColor} float-left mr-3 select-none`}
        style={{
          fontSize: "3.6rem",
          lineHeight: 0.85,
          paddingTop: "0.35rem",
          fontWeight: 700,
        }}
        aria-hidden="true"
      >
        {first}
      </span>
      <span className="sr-only">{first}</span>
      {rest}
    </Tag>
  );
}
