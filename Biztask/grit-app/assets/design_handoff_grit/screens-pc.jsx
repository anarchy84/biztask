// 그릿 — PC 3-column layout (X/Twitter style for business owners)

const PCLayout = ({ density = "regular", cardStyle = "border" }) => {
  return (
    <div className="aurora-bg" style={{
      width: "100%", minHeight: "100%",
      fontFamily: "var(--font-sans)", color: "var(--tx-1)",
      display: "grid",
      gridTemplateColumns: "260px 1fr 340px",
      gap: 0,
    }}>
      {/* LEFT — Nav */}
      <aside style={{
        borderRight: "0.5px solid var(--line-1)",
        padding: "20px 14px",
        display: "flex", flexDirection: "column",
        position: "sticky", top: 0, height: "100vh",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px 24px" }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: "var(--brand-500)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 800, fontSize: 14, color: "#ECFDF5", letterSpacing: "-0.02em",
            fontFamily: "var(--font-display)",
          }}>그</div>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 22,
            fontWeight: 700, letterSpacing: "-0.03em" }}>그릿</span>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {[
            { icon: "homefill", label: "홈", active: true },
            { icon: "search", label: "탐색" },
            { icon: "lock", label: "시크릿 라운지", lounge: true },
            { icon: "bell", label: "알림", count: 12 },
            { icon: "comment", label: "메시지" },
            { icon: "bookmark", label: "저장" },
            { icon: "user", label: "프로필" },
            { icon: "settings", label: "설정" },
          ].map((n, i) => (
            <button key={i} style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "11px 14px", borderRadius: 12,
              background: n.active ? "rgba(16,185,129,0.1)" : "transparent",
              border: n.active ? "1px solid rgba(16,185,129,0.25)" : "1px solid transparent",
              color: n.active ? "var(--tx-1)" : "var(--tx-1)",
              cursor: "pointer", fontFamily: "inherit",
              fontSize: 14.5, fontWeight: n.active ? 600 : 500,
              letterSpacing: "-0.01em",
              position: "relative",
            }}>
              <Icon name={n.icon} size={20}
                color={n.active ? "var(--brand-400)" : (n.lounge ? "var(--brand-400)" : "var(--tx-2)")}
                strokeWidth={n.active ? 2 : 1.6} />
              <span style={{ flex: 1, textAlign: "left" }}>{n.label}</span>
              {n.count && (
                <span className="tnum" style={{
                  fontSize: 10.5, fontWeight: 600,
                  padding: "2px 6px", borderRadius: 999,
                  background: "var(--c-like)", color: "white",
                }}>{n.count}</span>
              )}
              {n.lounge && (
                <span style={{ fontSize: 9, color: "var(--brand-400)",
                  letterSpacing: "0.08em", fontWeight: 700 }}>SECRET</span>
              )}
            </button>
          ))}
        </nav>

        <button className="btn-primary" style={{
          marginTop: 14, padding: "13px", fontSize: 14.5, fontWeight: 600,
        }}>새 게시물</button>

        <div style={{ marginTop: "auto", padding: "12px 14px",
          borderRadius: 14, border: "0.5px solid var(--line-2)",
          display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar name="아나키" hue={280} size={36} ring />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>아나키</span>
              <Verified size={11} />
            </div>
            <div style={{ fontSize: 11, color: "var(--tx-3)" }}>그릿 87</div>
          </div>
        </div>
      </aside>

      {/* CENTER — Feed */}
      <main style={{ borderRight: "0.5px solid var(--line-1)", minWidth: 0 }}>
        <div style={{
          position: "sticky", top: 0, zIndex: 10,
          background: "rgba(7,6,11,0.7)", backdropFilter: "blur(20px)",
          borderBottom: "0.5px solid var(--line-1)",
          padding: "16px 22px 0",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h1 style={{ margin: 0, fontFamily: "var(--font-display)",
              fontSize: 21, fontWeight: 700, letterSpacing: "-0.02em" }}>홈</h1>
            <Icon name="sparkle" size={20} color="var(--tx-2)" />
          </div>
          <div style={{ display: "flex", gap: 22 }}>
            {["추천", "팔로우", "내 업종", "동네"].map((c, i) => (
              <button key={c} style={{
                background: "none", border: "none", cursor: "pointer",
                padding: "8px 0", fontFamily: "inherit", fontSize: 13.5,
                fontWeight: i === 0 ? 600 : 500,
                color: i === 0 ? "var(--tx-1)" : "var(--tx-3)",
                position: "relative",
              }}>{c}
                {i === 0 && <div style={{ position: "absolute", left: 0, right: 0, bottom: -1, height: 3,
                  background: "var(--brand-400)",
                  borderRadius: 3 }} />}
              </button>
            ))}
          </div>
        </div>

        {/* Composer */}
        <div style={{ padding: "16px 22px", borderBottom: "0.5px solid var(--line-1)",
          display: "flex", gap: 12 }}>
          <Avatar name="아나키" hue={280} size={42} />
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 16, color: "var(--tx-3)", padding: "10px 0",
              minHeight: 30,
            }}>오늘은 어떤 인사이트를 공유하실래요?</div>
            <div style={{ display: "flex", justifyContent: "space-between",
              alignItems: "center", marginTop: 8 }}>
              <div style={{ display: "flex", gap: 14, color: "var(--tx-2)" }}>
                <Icon name="map" size={18} />
                <Icon name="hash" size={18} />
                <Icon name="quote" size={18} />
                <Icon name="lock" size={18} />
              </div>
              <button className="btn-primary" style={{ padding: "8px 18px", fontSize: 13 }}>게시</button>
            </div>
          </div>
        </div>

        {/* Feed */}
        <div style={{ padding: "10px 12px" }}>
          {SAMPLE_POSTS.map(p => (
            <div key={p.id} style={{ marginBottom: 10 }}>
              <PostCard post={p} density={density} cardStyle={cardStyle} />
            </div>
          ))}
        </div>
      </main>

      {/* RIGHT — Trends + Suggested */}
      <aside style={{ padding: "16px 18px", display: "flex",
        flexDirection: "column", gap: 14, minWidth: 0,
        position: "sticky", top: 0, alignSelf: "flex-start", maxHeight: "100vh",
        overflowY: "auto",
      }} className="no-scrollbar">
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 14px", borderRadius: 999,
          background: "rgba(255,255,255,0.05)", border: "0.5px solid var(--line-2)",
        }}>
          <Icon name="search" size={15} color="var(--tx-3)" />
          <span style={{ color: "var(--tx-3)", fontSize: 13 }}>검색</span>
        </div>

        {/* Trending */}
        <section className="glass" style={{ borderRadius: 16, padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <Icon name="flame" size={14} color="var(--tx-2)" />
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em" }}>실시간 업종 트렌드</h3>
          </div>
          {TRENDING.slice(0, 5).map((t, i) => (
            <div key={t.tag} style={{
              padding: "8px 0",
              borderBottom: i < 4 ? "0.5px solid var(--line-1)" : "none",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span className="tnum" style={{ fontSize: 11, color: "var(--tx-4)", fontWeight: 600, width: 14 }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Icon name="hash" size={10} color="var(--tx-2)" />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{t.tag}</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--tx-3)", marginTop: 1, whiteSpace: "nowrap" }}>
                  <span className="tnum">{t.count}</span> 게시물
                </div>
              </div>
              <span className="tnum" style={{ fontSize: 11, fontWeight: 600,
                color: "var(--brand-300)" }}>{t.change}</span>
            </div>
          ))}
        </section>

        {/* Suggested */}
        <section className="glass" style={{ borderRadius: 16, padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <Icon name="handshake" size={14} color="var(--tx-2)" />
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em" }}>추천 사장님</h3>
          </div>
          {SUGGESTED_USERS.slice(0, 3).map(u => (
            <div key={u.name} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "8px 0",
            }}>
              <Avatar name={u.name} hue={u.hue} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>{u.name}</span>
                  {u.verified && <Verified size={11} />}
                </div>
                <div style={{ fontSize: 11, color: "var(--brand-300)" }}>공통 {u.mutual}명</div>
              </div>
              <button className="btn-ghost" style={{ padding: "5px 11px", fontSize: 11 }}>팔로우</button>
            </div>
          ))}
        </section>

        {/* Lounge teaser */}
        <section style={{
          borderRadius: 16, padding: 16,
          background: "var(--bg-2)",
          border: "1px solid var(--line-2)",
          color: "var(--tx-1)", overflow: "hidden", position: "relative",
        }}>
          <Icon name="lock" size={16} color="var(--brand-400)" />
          <h3 style={{ margin: "8px 0 4px", fontFamily: "var(--font-display)",
            fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em" }}>시크릿 라운지</h3>
          <p style={{ margin: 0, fontSize: 12, color: "var(--tx-2)", lineHeight: 1.5 }}>
            파란딱지 사장님끼리만 보이는 247건의 매칭이 진행중이에요.
          </p>
          <button style={{
            marginTop: 10, padding: "6px 12px", borderRadius: 999,
            background: "transparent", border: "1px solid var(--line-3)",
            color: "var(--brand-300)", fontSize: 11, fontWeight: 600, cursor: "pointer",
            fontFamily: "inherit",
          }}>입장하기 →</button>
        </section>
      </aside>
    </div>
  );
};

Object.assign(window, { PCLayout });
