// 그릿 — Mobile screens (Home, Explore, Lounge, Notifications, Profile)

// Bottom tab bar — center is the secret lounge plus button
const TabBar = ({ active = "home", onChange = () => {} }) => {
  const tab = (key, icon, label) => {
    const isActive = active === key;
    const iconName = isActive ? `${icon}fill` : icon;
    return (
      <button onClick={() => onChange(key)} style={{
        flex: 1, background: "none", border: "none", cursor: "pointer",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
        padding: "8px 0", fontFamily: "var(--font-sans)",
      }}>
        <Icon name={iconName} size={22} color={isActive ? "var(--brand-400)" : "var(--tx-3)"} strokeWidth={1.7} />
        <span style={{ fontSize: 9.5, fontWeight: 500, letterSpacing: "-0.01em",
          color: isActive ? "var(--brand-400)" : "var(--tx-3)" }}>{label}</span>
      </button>
    );
  };

  return (
    <div style={{
      position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 30,
      paddingBottom: 28, paddingTop: 4,
      background: "linear-gradient(180deg, transparent, rgba(10,10,10,0.92) 30%, var(--bg-0))",
      backdropFilter: "blur(20px)",
      borderTop: "0.5px solid var(--line-1)",
      display: "flex", alignItems: "center", justifyContent: "space-around",
    }}>
      {tab("home", "home", "홈")}
      {tab("explore", "search", "탐색")}
      {/* Center secret lounge button */}
      <button onClick={() => onChange("lounge")} style={{
        flex: "0 0 auto", marginTop: -16,
        width: 52, height: 52, borderRadius: "50%", border: "none", cursor: "pointer",
        background: "var(--brand-500)",
        boxShadow: "0 0 0 1px rgba(16,185,129,0.25) inset, 0 6px 22px rgba(5,150,105,0.35), 0 0 32px rgba(52,211,153,0.18)",
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative",
      }}>
        <Icon name="lock" size={22} color="#ECFDF5" strokeWidth={2.2} />
      </button>
      {tab("alerts", "bell", "알림")}
      {tab("profile", "user", "MY")}
    </div>
  );
};

// Top header — logo + search
const TopHeader = ({ title = "그릿" }) => (
  <div style={{
    position: "sticky", top: 0, zIndex: 20,
    padding: "62px 18px 12px",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    background: "linear-gradient(180deg, var(--bg-0) 60%, transparent)",
    fontFamily: "var(--font-sans)",
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8,
        background: "var(--brand-500)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 13,
        color: "#ECFDF5", letterSpacing: "-0.02em",
      }}>그</div>
      <span style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700,
        color: "var(--tx-1)", letterSpacing: "-0.03em" }}>{title}</span>
    </div>
    <div style={{ display: "flex", gap: 6 }}>
      <button style={{
        width: 36, height: 36, borderRadius: "50%", border: "none", cursor: "pointer",
        background: "rgba(255,255,255,0.06)", color: "var(--tx-1)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon name="sparkle" size={18} color="var(--brand-400)" />
      </button>
    </div>
  </div>
);

// Filter chips
const FilterChips = () => (
  <div style={{ display: "flex", gap: 6, padding: "0 18px 12px", overflowX: "auto" }}
       className="no-scrollbar">
    {["추천", "팔로우", "내 업종", "동네", "라이브"].map((c, i) => (
      <button key={c} style={{
        padding: "7px 13px", borderRadius: 999,
        border: i === 0 ? "0.5px solid transparent" : "0.5px solid var(--line-2)",
        background: i === 0 ? "rgba(16,185,129,0.12)" : "transparent",
        color: i === 0 ? "var(--brand-300)" : "var(--tx-2)",
        fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 500,
        whiteSpace: "nowrap", cursor: "pointer",
        boxShadow: i === 0 ? "inset 0 0 0 1px rgba(16,185,129,0.3)" : "none",
      }}>{c}</button>
    ))}
  </div>
);

// ─── HOME ───
const HomeScreen = ({ density, cardStyle }) => (
  <div className="aurora-bg" style={{ minHeight: "100%", paddingBottom: 90 }}>
    <TopHeader />
    <FilterChips />
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 12px" }}>
      {SAMPLE_POSTS.map(p => <PostCard key={p.id} post={p} density={density} cardStyle={cardStyle} />)}
    </div>
  </div>
);

// ─── EXPLORE / NETWORK ───
const ExploreScreen = ({ cardStyle }) => (
  <div className="aurora-bg" style={{ minHeight: "100%", paddingBottom: 90 }}>
    <TopHeader title="탐색" />
    {/* Search */}
    <div style={{ padding: "0 18px 12px" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "11px 14px", borderRadius: 14,
        background: "rgba(255,255,255,0.05)",
        border: "0.5px solid var(--line-2)",
      }}>
        <Icon name="search" size={16} color="var(--tx-3)" />
        <span style={{ color: "var(--tx-3)", fontSize: 13.5, fontFamily: "var(--font-sans)", whiteSpace: "nowrap" }}>
          업종, 지역, 키워드 검색
        </span>
      </div>
    </div>

    {/* Trending */}
    <section style={{ padding: "8px 18px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <Icon name="flame" size={16} color="var(--tx-2)" />
        <h3 style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: 14,
          fontWeight: 600, color: "var(--tx-1)", letterSpacing: "-0.01em" }}>지금 뜨는 키워드</h3>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1,
        background: "var(--bg-1)", border: "0.5px solid var(--line-2)",
        borderRadius: "var(--r-md)", overflow: "hidden" }}>
        {TRENDING.map((t, i) => (
          <div key={t.tag} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "12px 14px",
            borderBottom: i < TRENDING.length - 1 ? "0.5px solid var(--line-1)" : "none",
            fontFamily: "var(--font-sans)",
          }}>
            <span className="tnum" style={{
              fontSize: 11, color: "var(--tx-4)", width: 14, flexShrink: 0, fontWeight: 600,
            }}>{i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 0 }}>
                <Icon name="hash" size={11} color="var(--tx-2)" />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--tx-1)",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.tag}</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--tx-3)", marginTop: 2,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                <span className="tnum">{t.count}</span> 게시물 · {t.region}
              </div>
            </div>
            <span className="tnum" style={{
              fontSize: 11, fontWeight: 600, color: "var(--brand-300)",
              flexShrink: 0, whiteSpace: "nowrap",
            }}>{t.change}</span>
          </div>
        ))}
      </div>
    </section>

    {/* Suggested */}
    <section style={{ padding: "0 18px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <Icon name="handshake" size={16} color="var(--tx-2)" />
        <h3 style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: 14,
          fontWeight: 600, color: "var(--tx-1)", letterSpacing: "-0.01em" }}>추천 사장님</h3>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {SUGGESTED_USERS.map(u => (
          <div key={u.name} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: 12, borderRadius: 14,
            background: "var(--bg-1)", border: "0.5px solid var(--line-2)",
            fontFamily: "var(--font-sans)",
          }}>
            <Avatar name={u.name} hue={u.hue} size={42} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--tx-1)" }}>{u.name}</span>
                {u.verified && <Verified size={12} />}
              </div>
              <div style={{ fontSize: 11, color: "var(--tx-3)", marginTop: 2 }}>
                <span style={{ color: "var(--brand-300)" }}>공통 팔로워 {u.mutual}명</span>
                <span style={{ color: "var(--tx-4)" }}> · {u.tag}</span>
              </div>
            </div>
            <TrustScore value={u.grit} size={36} label={false} />
            <button className="btn-primary" style={{
              padding: "6px 14px", fontSize: 12,
            }}>팔로우</button>
          </div>
        ))}
      </div>
    </section>
  </div>
);

// ─── SECRET LOUNGE ───
const LoungeScreen = () => (
  <div className="aurora-bg" style={{ minHeight: "100%", paddingBottom: 90, position: "relative" }}>
    {/* Vault hero */}
    <div style={{ padding: "70px 18px 0", fontFamily: "var(--font-sans)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <Icon name="lock" size={14} color="var(--brand-300)" />
        <span style={{ fontSize: 11, color: "var(--brand-300)", letterSpacing: "0.08em",
          textTransform: "uppercase", fontWeight: 600 }}>SECRET · 인증 회원 전용</span>
      </div>
      <h1 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 30,
        fontWeight: 700, letterSpacing: "-0.03em", color: "var(--tx-1)",
        textWrap: "balance" }}>시크릿<br/>라운지</h1>
      <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--tx-3)",
        lineHeight: 1.5 }}>사장님끼리만 보이는 비공개 채널.<br/>매칭, 구인구직, 진짜 후기.</p>
    </div>

    {/* Vault tiles */}
    <div style={{ padding: "20px 18px 0", display: "grid",
      gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      {[
        { icon: "handshake", label: "B2B 매칭", count: "247", sub: "거래처 매칭 진행중", bg: "#171717", accent: "var(--brand-400)" },
        { icon: "briefcase", label: "구인구직", count: "1,082", sub: "오픈 포지션", bg: "#141414", accent: "var(--brand-500)" },
        { icon: "eye", label: "비공개 후기", count: "3,421", sub: "진짜 후기만", bg: "#171717", accent: "var(--brand-500)" },
        { icon: "sparkle", label: "VIP 라운지", count: "그릿 90+", sub: "파란딱지 전용", bg: "#141414", accent: "var(--brand-400)" },
      ].map((v, i) => (
        <div key={i} style={{
          aspectRatio: "1.05",
          background: v.bg,
          borderRadius: 18, padding: 14,
          display: "flex", flexDirection: "column", justifyContent: "space-between",
          fontFamily: "var(--font-sans)", color: "var(--tx-1)",
          position: "relative", overflow: "hidden",
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          border: "1px solid var(--line-2)",
        }}>
          <Icon name={v.icon} size={22} color={v.accent} strokeWidth={1.6} />
          <div>
            <div style={{ fontSize: 11, color: "var(--tx-3)", letterSpacing: "-0.01em" }}>{v.sub}</div>
            <div className="tnum" style={{ fontFamily: "var(--font-display)",
              fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.1, color: "var(--tx-1)" }}>{v.count}</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4, color: "var(--tx-2)" }}>{v.label}</div>
          </div>
        </div>
      ))}
    </div>

    {/* Active matches */}
    <section style={{ padding: "20px 18px 0" }}>
      <h3 style={{ margin: "0 0 10px", fontFamily: "var(--font-sans)",
        fontSize: 13, fontWeight: 600, color: "var(--tx-2)",
        letterSpacing: "0.02em", textTransform: "uppercase" }}>오늘의 매칭</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[
          { who: "F&B 도매업체", desc: "유기농 채소 공급 가능 · 강북", grit: 92 },
          { who: "주류 도매상", desc: "수제맥주 신규 라인업 · 전국", grit: 86 },
          { who: "POS 시스템사", desc: "수수료 1.8%, 첫달 무료", grit: 78 },
        ].map((m, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: 12, borderRadius: 14,
            background: "rgba(20,16,32,0.55)",
            backdropFilter: "blur(20px) saturate(160%)",
            border: "0.5px solid var(--line-2)",
            fontFamily: "var(--font-sans)",
          }}>
            <TrustScore value={m.grit} size={36} label={false} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--tx-1)" }}>{m.who}</div>
              <div style={{ fontSize: 11, color: "var(--tx-3)", marginTop: 2 }}>{m.desc}</div>
            </div>
            <button style={{
              border: "1px solid rgba(16,185,129,0.3)", borderRadius: 999, padding: "6px 12px",
              fontSize: 11, fontWeight: 600, color: "var(--brand-300)",
              background: "rgba(16,185,129,0.1)", cursor: "pointer",
              fontFamily: "var(--font-sans)",
            }}>제안하기</button>
          </div>
        ))}
      </div>
    </section>
  </div>
);

// ─── NOTIFICATIONS ───
const NotificationsScreen = () => {
  const items = [
    { type: "quote", who: "을지로프린스", what: "님이 회원님 글을 인용했어요.",
      preview: "POS 교체 후기 진심 공감", time: "2분 전", verified: true, hue: 220 },
    { type: "follow", who: "강남숯불왕", what: "님이 회원님을 팔로우합니다.",
      time: "15분 전", verified: true, hue: 30 },
    { type: "like", who: "까칠한여우 외 24명", what: "이 회원님 글을 좋아합니다.",
      preview: "임대료 협상 후기 공유합니다...", time: "1시간 전", hue: 0 },
    { type: "match", who: "B2B 매칭", what: " · 신선육 도매업체에서 제안이 도착했어요.",
      time: "3시간 전", hue: 280, vault: true },
    { type: "comment", who: "리테일러7", what: "님이 댓글을 남겼어요.",
      preview: "저희 가게도 비슷한 상황이라 공유 감사합니다", time: "5시간 전", hue: 160 },
    { type: "milestone", who: "그릿 지수가 90을 돌파했어요", what: " 🎉",
      time: "어제", milestone: true },
  ];

  const iconFor = (t) => ({
    quote: "quote", follow: "user", like: "heart",
    match: "handshake", comment: "comment", milestone: "sparkle",
  })[t];
  const colorFor = (t) => ({
    quote: "var(--c-verify)", follow: "var(--c-verify)",
    like: "var(--c-like)", match: "var(--brand-400)",
    comment: "var(--tx-2)", milestone: "var(--brand-400)",
  })[t];

  return (
    <div className="aurora-bg" style={{ minHeight: "100%", paddingBottom: 90 }}>
      <TopHeader title="알림" />
      <div style={{ display: "flex", gap: 6, padding: "0 18px 14px" }}>
        {["전체", "@언급", "팔로우", "매칭"].map((c, i) => (
          <button key={c} style={{
            padding: "6px 12px", borderRadius: 999,
            border: i === 0 ? "0.5px solid transparent" : "0.5px solid var(--line-2)",
            background: i === 0 ? "rgba(16,185,129,0.12)" : "transparent",
            color: i === 0 ? "var(--brand-300)" : "var(--tx-3)",
            fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 500,
            cursor: "pointer",
          }}>{c}</button>
        ))}
      </div>
      <div style={{ padding: "0 12px" }}>
        {items.map((n, i) => (
          <div key={i} style={{
            display: "flex", gap: 12, padding: "14px 12px",
            borderBottom: "0.5px solid var(--line-1)",
            fontFamily: "var(--font-sans)",
            background: i < 2 ? "rgba(16,185,129,0.04)" : "transparent",
            borderRadius: 12, marginBottom: 2,
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
              background: "var(--bg-2)",
              border: `1px solid ${n.type === 'like' ? 'rgba(239,68,68,0.3)' : n.type === 'quote' || n.type === 'follow' ? 'rgba(59,130,246,0.3)' : 'var(--line-2)'}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              position: "relative",
            }}>
              <Icon name={iconFor(n.type)} size={18} color={colorFor(n.type)} strokeWidth={1.8} />
              {n.vault && (
                <div style={{ position: "absolute", bottom: -2, right: -2,
                  width: 14, height: 14, borderRadius: "50%",
                  background: "var(--bg-0)",
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name="lock" size={9} color="var(--brand-400)" />
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, color: "var(--tx-1)", lineHeight: 1.4 }}>
                <span style={{ fontWeight: 600 }}>{n.who}</span>
                {n.verified && <span style={{ display: "inline-flex", verticalAlign: "middle", marginLeft: 3 }}><Verified size={11} /></span>}
                <span style={{ color: "var(--tx-2)" }}>{n.what}</span>
              </div>
              {n.preview && (
                <div style={{ fontSize: 12, color: "var(--tx-3)", marginTop: 4,
                  padding: "6px 10px", borderRadius: 8,
                  background: "rgba(255,255,255,0.04)",
                  borderLeft: `2px solid ${colorFor(n.type)}` }}>
                  {n.preview}
                </div>
              )}
              <div style={{ fontSize: 11, color: "var(--tx-4)", marginTop: 4 }}>{n.time}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── PROFILE ───
const ProfileScreen = ({ gritStyle = "ring", profileLayout = "stacked" }) => {
  const stats = [
    { l: "팔로워", v: "8,247" }, { l: "팔로잉", v: "412" }, { l: "게시물", v: "187" },
  ];
  const tabs = ["내 게시물", "답글", "비즈니스 제안", "저장"];
  const [activeTab, setActiveTab] = React.useState(0);

  return (
    <div className="aurora-bg" style={{ minHeight: "100%", paddingBottom: 90 }}>
      {/* Cover */}
      <div style={{
        height: 180, position: "relative",
        background: "#1A1A1A",
        borderBottom: "1px solid var(--line-2)",
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(80% 60% at 50% 0%, rgba(5,150,105,0.10), transparent 70%)",
        }} />
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)",
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(60% 50% at 50% 30%, black, transparent 80%)",
          WebkitMaskImage: "radial-gradient(60% 50% at 50% 30%, black, transparent 80%)",
        }} />
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(180deg, transparent 50%, var(--bg-0))",
        }} />
      </div>

      {profileLayout === "stacked" ? (
        // Stacked: avatar overlap, info below
        <div style={{ padding: "0 18px", marginTop: -40, fontFamily: "var(--font-sans)" }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div style={{ position: "relative" }}>
              <Avatar name="아나키" hue={280} size={84} ring />
              <div style={{ position: "absolute", bottom: 4, right: 4 }}>
                <TrustScore value={87} size={28} label={false} style={gritStyle === "radar" ? "radar" : "ring"} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, paddingBottom: 6 }}>
              <button className="btn-ghost" style={{ padding: "8px 14px", fontSize: 12 }}>
                <Icon name="settings" size={14} color="var(--tx-2)" />
              </button>
              <button className="btn-primary" style={{ padding: "8px 18px", fontSize: 13 }}>프로필 편집</button>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 22,
                fontWeight: 700, color: "var(--tx-1)", letterSpacing: "-0.02em" }}>아나키</h2>
              <Verified size={16} />
              <Badge tone="accent">PRO</Badge>
            </div>
            <div style={{ marginTop: 4, display: "flex", gap: 5, flexWrap: "wrap" }}>
              <Badge>마포구 · 요식업</Badge>
              <Badge>5년차</Badge>
            </div>
            <p style={{ margin: "10px 0 0", fontSize: 13.5, color: "var(--tx-2)", lineHeight: 1.5 }}>
              연남동 작은 비스트로 운영중. 매장 운영 노하우, 인력 관리, 비용 절감 경험 공유합니다.
            </p>
          </div>
        </div>
      ) : (
        // Card layout — info inside glass card
        <div style={{ padding: "0 14px", marginTop: -54, fontFamily: "var(--font-sans)" }}>
          <div className="glass" style={{ borderRadius: 20, padding: 16 }}>
            <div style={{ display: "flex", gap: 14 }}>
              <Avatar name="아나키" hue={280} size={64} ring />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 18,
                    fontWeight: 700, color: "var(--tx-1)" }}>아나키</span>
                  <Verified size={14} />
                </div>
                <div style={{ display: "flex", gap: 5, marginTop: 5, flexWrap: "wrap" }}>
                  <Badge>마포 · 요식</Badge>
                  <Badge>5년차</Badge>
                </div>
              </div>
              <TrustScore value={87} size={48} style={gritStyle === "radar" ? "radar" : "ring"} label={false} />
            </div>
            <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--tx-2)", lineHeight: 1.5 }}>
              연남동 작은 비스트로. 운영 노하우 공유합니다.
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "flex", padding: "16px 18px",
        fontFamily: "var(--font-sans)", gap: 16 }}>
        {stats.map((s, i) => (
          <div key={i} style={{ flex: 1 }}>
            <div className="tnum" style={{ fontSize: 20, fontWeight: 700,
              color: "var(--tx-1)", letterSpacing: "-0.02em", lineHeight: 1.1 }}>{s.v}</div>
            <div style={{ fontSize: 11, color: "var(--tx-3)", marginTop: 3, fontWeight: 400 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Mutual */}
      <div style={{ padding: "0 18px 14px", display: "flex", alignItems: "center",
        gap: 10, fontFamily: "var(--font-sans)" }}>
        <div style={{ display: "flex" }}>
          {[280, 220, 30, 0].map((h, i) => (
            <div key={i} style={{ marginLeft: i === 0 ? 0 : -8, position: "relative", zIndex: 4 - i }}>
              <Avatar name="?" hue={h} size={22} />
            </div>
          ))}
        </div>
        <span style={{ fontSize: 11.5, color: "var(--tx-3)" }}>
          <span style={{ color: "var(--brand-300)", fontWeight: 600 }}>23명</span>의 공통 팔로워
        </span>
      </div>

      {/* Grit detailed */}
      <div style={{ padding: "0 18px 16px", fontFamily: "var(--font-sans)" }}>
        {gritStyle === "bar" && <TrustScore value={87} style="bar" />}
        {gritStyle === "level" && (
          <div style={{ padding: 14, borderRadius: 14, border: "1px solid var(--line-2)",
            background: "var(--bg-1)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: "var(--tx-2)", fontWeight: 500 }}>다이아몬드 사장님</span>
              <span className="tnum" style={{ fontSize: 14, color: "var(--brand-300)", fontWeight: 700, letterSpacing: "-0.01em" }}>LV 87</span>
            </div>
            <TrustScore value={87} style="bar" label={false} />
            <div style={{ fontSize: 11, color: "var(--tx-3)", marginTop: 8 }}>
              다음 단계까지 13점 · 매칭 응답률 +5%
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "0.5px solid var(--line-2)",
        padding: "0 6px", fontFamily: "var(--font-sans)" }}>
        {tabs.map((t, i) => (
          <button key={t} onClick={() => setActiveTab(i)} style={{
            flex: 1, background: "none", border: "none", cursor: "pointer",
            padding: "12px 6px", fontSize: 12.5, fontWeight: i === activeTab ? 600 : 500,
            color: i === activeTab ? "var(--tx-1)" : "var(--tx-3)",
            position: "relative",
          }}>{t}
            {i === activeTab && (
              <div style={{ position: "absolute", left: 12, right: 12, bottom: -0.5,
                height: 2, background: "var(--brand-400)",
                borderRadius: 2 }} />
            )}
          </button>
        ))}
      </div>

      {/* Posts grid (own posts) */}
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {SAMPLE_POSTS.slice(0, 2).map(p => (
          <PostCard key={p.id} post={{ ...p, relation: undefined }} density="tight" cardStyle="border" />
        ))}
      </div>
    </div>
  );
};

Object.assign(window, { TabBar, TopHeader, FilterChips,
  HomeScreen, ExploreScreen, LoungeScreen, NotificationsScreen, ProfileScreen });
