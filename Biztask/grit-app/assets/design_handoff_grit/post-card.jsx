// 그릿 — Post card component
// Used in home feed and profile.

const PostCard = ({ post, density = "regular", cardStyle = "border" }) => {
  const pad = density === "tight" ? 12 : density === "loose" ? 20 : 16;
  const gap = density === "tight" ? 8 : density === "loose" ? 14 : 11;

  const cardSurface =
    cardStyle === "glass" ? {
      background: "rgba(20,20,20,0.55)",
      backdropFilter: "blur(20px) saturate(160%)",
      WebkitBackdropFilter: "blur(20px) saturate(160%)",
      border: "0.5px solid var(--line-2)",
    } : cardStyle === "shadow" ? {
      background: "var(--bg-1)",
      border: "0.5px solid transparent",
      boxShadow: "0 4px 24px rgba(0,0,0,0.5), 0 0 0 0.5px var(--line-1)",
    } : { /* border */
      background: "var(--bg-1)",
      border: "0.5px solid var(--line-2)",
    };

  return (
    <article style={{
      ...cardSurface,
      borderRadius: "var(--r-lg)",
      padding: pad,
      fontFamily: "var(--font-sans)",
      color: "var(--tx-1)",
      display: "flex", flexDirection: "column", gap,
    }}>
      {/* Relational pretext */}
      {post.relation && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          fontSize: 11, color: "var(--tx-3)",
          paddingLeft: 2,
        }}>
          <Icon name="handshake" size={12} color="var(--tx-3)" />
          <span>{post.relation}</span>
        </div>
      )}

      {/* Header */}
      <header style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <Avatar name={post.user.name} hue={post.user.hue} size={38} ring={post.user.verified} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, fontSize: 14, letterSpacing: "-0.01em" }}>{post.user.name}</span>
            {post.user.verified && <Verified size={13} />}
            <span style={{ color: "var(--tx-4)", fontSize: 12 }}>·</span>
            <span style={{ color: "var(--tx-3)", fontSize: 12 }}>{post.time}</span>
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
            {post.user.tags.map((t, i) => <Badge key={i}>{t.label}</Badge>)}
          </div>
        </div>
        <button style={{ background: "none", border: "none", color: "var(--tx-3)", cursor: "pointer", padding: 4 }}>
          <svg width="18" height="4" viewBox="0 0 18 4"><circle cx="2" cy="2" r="1.5" fill="currentColor"/><circle cx="9" cy="2" r="1.5" fill="currentColor"/><circle cx="16" cy="2" r="1.5" fill="currentColor"/></svg>
        </button>
      </header>

      {/* Body */}
      {post.body && (
        <p style={{
          margin: 0, fontSize: 14.5, lineHeight: 1.55,
          color: "var(--tx-1)", letterSpacing: "-0.01em",
          textWrap: "pretty", whiteSpace: "pre-wrap",
        }}>{post.body}</p>
      )}

      {/* Image */}
      {post.image && (
        <div className="img-placeholder" style={{
          borderRadius: 14, aspectRatio: post.image.aspect || "4/3",
          margin: `2px ${-pad}px 2px ${-pad}px`,
          marginLeft: -pad, marginRight: -pad,
          borderRadius: 0,
          position: "relative", overflow: "hidden",
        }}>
          {post.image.label && (
            <div style={{
              position: "absolute", left: 12, bottom: 12,
              padding: "5px 10px", borderRadius: 999,
              background: "rgba(0,0,0,0.5)", backdropFilter: "blur(12px)",
              fontSize: 11, color: "white", fontWeight: 500,
            }}>{post.image.label}</div>
          )}
        </div>
      )}

      {/* Quote card */}
      {post.quoted && (
        <div style={{
          border: "0.5px solid var(--line-2)", borderRadius: 14,
          padding: 12, fontSize: 13, color: "var(--tx-2)",
          background: "rgba(255,255,255,0.02)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <Avatar name={post.quoted.name} hue={post.quoted.hue} size={20} />
            <span style={{ fontWeight: 600, fontSize: 12, color: "var(--tx-1)" }}>{post.quoted.name}</span>
            {post.quoted.verified && <Verified size={11} />}
            <span style={{ color: "var(--tx-4)", fontSize: 11 }}>· {post.quoted.time}</span>
          </div>
          <p style={{ margin: 0, lineHeight: 1.5 }}>{post.quoted.body}</p>
        </div>
      )}

      {/* Actions */}
      <footer style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginTop: 2, color: "var(--tx-3)",
      }}>
        <ActionBtn icon="comment" count={post.stats.comments} />
        <ActionBtn icon="repost" count={post.stats.reposts} accent="var(--brand-400)" />
        <ActionBtn icon="heart" count={post.stats.likes} accent="var(--c-like)" liked={post.liked} />
        <ActionBtn icon="bookmark" />
        <ActionBtn icon="share" />
      </footer>
    </article>
  );
};

const ActionBtn = ({ icon, count, accent, liked }) => {
  const [active, setActive] = React.useState(liked);
  const showFill = active && (icon === "heart" || icon === "bookmark");
  const iconName = showFill ? `${icon}fill` : icon;
  const color = active ? (accent || "var(--brand-400)") : "var(--tx-3)";
  return (
    <button onClick={() => setActive(a => !a)} style={{
      display: "flex", alignItems: "center", gap: 5,
      background: "none", border: "none", padding: "4px 6px",
      cursor: "pointer", color, fontFamily: "var(--font-sans)",
      fontSize: 12, fontWeight: 500, letterSpacing: "-0.01em",
      transition: "color .15s",
    }}>
      <Icon name={iconName} size={17} color={color} strokeWidth={1.7} />
      {count != null && <span className="tnum">{count > 999 ? `${(count/1000).toFixed(1)}k` : count}</span>}
    </button>
  );
};

Object.assign(window, { PostCard, ActionBtn });
