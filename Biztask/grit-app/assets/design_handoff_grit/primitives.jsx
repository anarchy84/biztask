// Shared primitives for 그릿 — icons, badges, post cards
// Loaded as a Babel script; all components are exported to window.

// ─────── Icons (24x24 stroke-based) ───────
const Icon = ({ name, size = 22, color = "currentColor", strokeWidth = 1.6 }) => {
  const paths = {
    home: <><path d="M3 11.5L12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></>,
    homefill: <><path d="M3 11.5L12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" fill={color}/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9z"/><path d="M10 21a2 2 0 0 0 4 0"/></>,
    bellfill: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9z" fill={color}/><path d="M10 21a2 2 0 0 0 4 0" fill={color}/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></>,
    userfill: <><circle cx="12" cy="8" r="4" fill={color}/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" fill={color}/></>,
    heart: <><path d="M12 20s-7-4.5-9.5-9C1 7.5 3 4 6.5 4c2 0 3.5 1 5.5 3 2-2 3.5-3 5.5-3 3.5 0 5.5 3.5 4 7-2.5 4.5-9.5 9-9.5 9z"/></>,
    heartfill: <><path d="M12 20s-7-4.5-9.5-9C1 7.5 3 4 6.5 4c2 0 3.5 1 5.5 3 2-2 3.5-3 5.5-3 3.5 0 5.5 3.5 4 7-2.5 4.5-9.5 9-9.5 9z" fill={color}/></>,
    comment: <><path d="M21 12a8 8 0 0 1-12 7l-5 1.5L5.5 16A8 8 0 1 1 21 12z"/></>,
    repost: <><path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></>,
    bookmark: <><path d="M5 3h14v18l-7-4-7 4z"/></>,
    bookmarkfill: <><path d="M5 3h14v18l-7-4-7 4z" fill={color}/></>,
    share: <><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8 11l8-4M8 13l8 4"/></>,
    chevron: <><path d="M9 6l6 6-6 6"/></>,
    sparkle: <><path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7z"/><path d="M19 17l.6 1.5L21 19l-1.4.5L19 21l-.5-1.5L17 19l1.4-.5z"/></>,
    lock: <><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></>,
    trending: <><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></>,
    fire: <><path d="M12 3s4 4 4 8a4 4 0 0 1-8 0c0-1 .5-2 1.5-3-.5 2 1 3 1 1 0-3 1.5-6 1.5-6z"/></>,
    map: <><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v16M15 6v16"/></>,
    hash: <><path d="M5 9h14M5 15h14M9 3l-3 18M18 3l-3 18"/></>,
    handshake: <><path d="M11 17l-3 3a2 2 0 0 1-3-3l5-5"/><path d="M13 17l3 3a2 2 0 0 0 3-3l-5-5"/><path d="M3 12l5-5 4 4 4-4 5 5"/></>,
    briefcase: <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2.1-1.6-2-3.5-2.5.8a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.3a7 7 0 0 0-2 1.2L5 5.7l-2 3.5 2.1 1.6a7 7 0 0 0 0 2.4L3 14.8l2 3.5 2.5-.8a7 7 0 0 0 2 1.2L10 21h4l.5-2.3a7 7 0 0 0 2-1.2l2.5.8 2-3.5-2.1-1.6c.1-.4.1-.8.1-1.2z"/></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></>,
    arrow: <><path d="M5 12h14M13 5l7 7-7 7"/></>,
    reply: <><path d="M9 17l-5-5 5-5"/><path d="M4 12h11a5 5 0 0 1 5 5v3"/></>,
    quote: <><path d="M7 8h4v4H7zM7 12c0 3-2 5-3 5M14 8h4v4h-4zM14 12c0 3-2 5-3 5"/></>,
    check: <><path d="M5 12l5 5L20 7"/></>,
    pin: <><path d="M12 2l3 7h6l-5 4 2 7-6-4-6 4 2-7-5-4h6z"/></>,
    flame: <><path d="M12 2c1 3-1 5-2 6.5C8 11 8 13 9 14a3 3 0 0 0 6 0c0-2-2-3-2-5 0-2 2-3 2-5"/><path d="M7 14a5 5 0 0 0 10 0"/></>,
  };
  const fill = name.endsWith("fill") ? "none" : "none";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill}
         stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
         style={{ flexShrink: 0 }}>
      {paths[name]}
    </svg>
  );
};

// ─────── Verified holographic mark ───────
const Verified = ({ size = 14 }) => (
  <span className="verified-holo" style={{ width: size, height: size }}>
    <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none"
         stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12l5 5L20 7" />
    </svg>
  </span>
);

// ─────── Industry/Region badge ───────
// Default: neutral charcoal. Pass tone="accent" for emerald, or color for semantic.
const Badge = ({ children, tone = "neutral", color, style = {} }) => {
  let bg, fg, bd;
  if (color) {
    bg = `color-mix(in oklch, ${color} 14%, transparent)`;
    fg = `color-mix(in oklch, ${color} 60%, white)`;
    bd = `1px solid color-mix(in oklch, ${color} 28%, transparent)`;
  } else if (tone === "accent") {
    bg = "rgba(16,185,129,0.08)";
    fg = "#34D399";
    bd = "1px solid rgba(16,185,129,0.22)";
  } else {
    bg = "var(--bg-2)";
    fg = "var(--tx-2)";
    bd = "1px solid var(--line-2)";
  }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 999,
      fontSize: 11, fontWeight: 500, letterSpacing: "-0.01em",
      background: bg, color: fg, border: bd,
      whiteSpace: "nowrap", flexShrink: 0,
      ...style,
    }}>{children}</span>
  );
};

// ─────── Avatar — flat charcoal placeholder w/ initial ───────
const Avatar = ({ name = "?", size = 40, hue = 280, ring = false }) => {
  const initial = name.replace(/[^A-Za-z가-힣]/, "").charAt(0) || "?";
  // hue used only as a deterministic lightness seed for variety; all neutral grays
  const lightness = 0.20 + ((hue % 60) / 60) * 0.08;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `oklch(${lightness} 0.005 250)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "rgba(255,255,255,0.85)", fontWeight: 600, fontSize: size * 0.4,
      flexShrink: 0,
      border: "1px solid var(--line-2)",
      boxShadow: ring ? "0 0 0 2px var(--bg-0), 0 0 0 3.5px var(--brand-500)" : "none",
      fontFamily: "var(--font-sans)",
    }}>{initial}</div>
  );
};

// ─────── Trust ring (그릿 지수) — 3 styles ───────
const TrustScore = ({ value = 87, size = 56, style = "ring", label = true }) => {
  const pct = value / 100;
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;

  if (style === "bar") {
    return (
      <div style={{ width: "100%" }}>
        {label && (
          <div style={{ display: "flex", justifyContent: "space-between",
                        fontSize: 11, color: "var(--tx-3)", marginBottom: 4,
                        fontFamily: "var(--font-sans)" }}>
            <span>그릿 지수</span>
            <span className="tnum" style={{ color: "var(--tx-1)", fontWeight: 600 }}>{value}</span>
          </div>
        )}
        <div style={{ height: 6, background: "var(--brand-800)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{
            width: `${value}%`, height: "100%",
            background: "var(--brand-400)",
          }} />
        </div>
      </div>
    );
  }

  if (style === "radar") {
    const stats = [
      { l: "활동", v: 0.85 }, { l: "매너", v: 0.92 }, { l: "응답", v: 0.78 },
      { l: "신뢰", v: 0.88 }, { l: "전문성", v: 0.81 },
    ];
    const cx = size / 2, cy = size / 2, rad = size / 2 - 6;
    const pts = stats.map((s, i) => {
      const a = (Math.PI * 2 * i) / stats.length - Math.PI / 2;
      return [cx + Math.cos(a) * rad * s.v, cy + Math.sin(a) * rad * s.v].join(",");
    }).join(" ");
    return (
      <svg width={size} height={size}>
        {[0.4, 0.7, 1].map((k, i) => (
          <polygon key={i} points={stats.map((_, j) => {
            const a = (Math.PI * 2 * j) / stats.length - Math.PI / 2;
            return [cx + Math.cos(a) * rad * k, cy + Math.sin(a) * rad * k].join(",");
          }).join(" ")} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
        ))}
        <polygon points={pts} fill="rgba(16,185,129,0.2)" stroke="var(--brand-400)" strokeWidth="1.2" />
      </svg>
    );
  }

  // default: ring
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none"
                stroke="var(--brand-800)" strokeWidth="3" />
        <circle cx={size/2} cy={size/2} r={r} fill="none"
                stroke="var(--brand-400)" strokeWidth="3" strokeLinecap="round"
                strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        fontFamily: "var(--font-sans)", color: "var(--tx-1)",
      }}>
        <span style={{ fontSize: size * 0.3, fontWeight: 700, lineHeight: 1 }} className="tnum">{value}</span>
        {label && size > 50 && <span style={{ fontSize: 8, color: "var(--tx-3)", marginTop: 1, letterSpacing: "0.05em" }}>그릿</span>}
      </div>
    </div>
  );
};

Object.assign(window, { Icon, Verified, Badge, Avatar, TrustScore });
