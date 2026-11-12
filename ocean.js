/* t263: "djuphav" layout after Oscar's X reference video (kursormaxx). Layout and colours only.
   Every number comes from state.json; missing values read "saknas". PAPER only, no orders,
   no wallet copying. The video's simulated numbers are never shown.
   t274: decorative fish may swim; labels and badges only use real closed PAPER trades. */
(function (g) {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function num(v) { var n = Number(v); return v == null || v === "" || !isFinite(n) ? null : n; }
  function money(n) { return Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function usd(v) { var n = num(v); return n == null ? "saknas" : (n < 0 ? "-$" : "$") + money(n); }
  function sUsd(v) { var n = num(v); return n == null ? "saknas" : (n < 0 ? "-$" : "+$") + money(n); }
  function hm(iso) { var d = new Date(iso); if (!iso || isNaN(d)) return "saknas"; return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", hour: "2-digit", minute: "2-digit" }).format(d); }
  function intSv(v) { var n = num(v); return n == null ? "saknas" : Math.round(n).toLocaleString("sv-SE"); }
  function sym(s) { if (!s) return ""; return s.charAt(0) === "$" ? s : "$" + s; }

  /* Four real desk agents, in the video's card order (scan, check, trade, guard). */
  var CARDS = [
    { id: "lyssnare", n: "Lyssnare", c: "#3BA3FF" },
    { id: "kedjekoll", n: "Kedjekoll", c: "#FFD23F" },
    { id: "handlare", n: "Handlare", c: "#2EE6A0" },
    { id: "skeptiker", n: "Skeptiker", c: "#FF5C8A" }
  ];
  var NAME = { lyssnare: "Lyssnare", botjagare: "Botjägare", kedjekoll: "Kedjekoll", skeptiker: "Skeptiker", storlek: "Storlek", handlare: "Handlare", dagbok: "Dagbok" };
  var COLOR = { lyssnare: "#3BA3FF", botjagare: "#A98BFF", kedjekoll: "#FFD23F", skeptiker: "#FF5C8A", storlek: "#FFB547", handlare: "#2EE6A0", dagbok: "#8FA8FF" };

  function cardSub(id, st, box, agent) {
    switch (id) {
      case "lyssnare": return num(st.coins_per_hour) == null ? "saknas" : intSv(st.coins_per_hour) + "/h";
      case "kedjekoll": return num(st.passed_today) == null ? "saknas" : intSv(st.passed_today) + " godkända";
      case "skeptiker": return num(st.failed_today) == null ? "saknas" : intSv(st.failed_today) + " stopp";
      case "handlare": {
        var open = (box.open || []).length;
        if (open) return open + (open === 1 ? " öppen" : " öppna");
        return agent && agent.active ? "redo" : "vilar";
      }
    }
    return "saknas";
  }

  function fmtBalance(host, v) {
    var n = num(v);
    host.innerHTML = "";
    if (n == null) { host.appendChild(el("span", "oc-bal-i", "saknas")); host.classList.add("miss"); return; }
    host.classList.remove("miss");
    var s = money(n), cut = s.lastIndexOf(".");
    host.appendChild(el("span", "oc-bal-i", (n < 0 ? "-$" : "$") + s.slice(0, cut)));
    host.appendChild(el("span", "oc-bal-d", s.slice(cut)));
  }

  function feedRows(state, box) {
    var crew = box.crew || {};
    var evById = {};
    (box.events || []).forEach(function (e) { if (e && e.id != null) evById["tj:" + e.id] = e; });
    var rows = [];
    (crew.feed || []).forEach(function (f) {
      if (!f) return;
      var ev = evById[f.id];
      var r = { id: f.id, ts: f.ts, agent: f.agent, t: f.t || hm(f.ts), title: "", sub: f.text || "saknas", v: "", cls: "" };
      var who = NAME[f.agent] || f.agent || "saknas";
      if (ev && ev.action === "Köp") { r.title = "Köpte " + sym(ev.symbol || "saknas"); r.sub = who + " · PAPER · " + r.t; r.v = usd(ev.amount_usd); r.dir = "up"; }
      else if (ev && ev.action === "Sälj") { var p = num(ev.pnl_usd); r.title = "Sålde " + sym(ev.symbol || "saknas"); r.sub = who + " · " + (ev.reason_sv || "sälj") + " · " + r.t; r.v = sUsd(p); r.cls = p == null ? "" : p < 0 ? "down" : "up"; r.dir = "down"; }
      else {
        var txt = String(f.text || "saknas");
        if (f.symbol && txt.indexOf(f.symbol) === 0) txt = txt.slice(f.symbol.length).replace(/^\s*·\s*/, "");
        r.title = f.symbol ? who + " · " + sym(f.symbol) : who;
        r.sub = txt + " · " + r.t;
        r.v = f.verdict === "veto" ? "Stopp" : f.verdict === "pass" ? "Klar" : "";
        r.cls = f.verdict === "veto" ? "down" : f.verdict === "pass" ? "up" : "";
        r.dir = f.verdict === "veto" ? "down" : "up";
      }
      rows.push(r);
    });
    return rows;
  }

  var seen = null;
  function renderActivity(state, box) {
    var host = $("oc-act"); if (!host) return;
    var rows = feedRows(state, box).slice(0, 8);
    var n = num(box.closed_count != null ? box.closed_count : (box.trades || []).length);
    $("oc-act-n").textContent = n == null ? "saknas" : n + " stängda";
    var fresh = {};
    if (seen) rows.forEach(function (r) { if (!seen[r.id]) fresh[r.id] = 1; });
    seen = {}; rows.forEach(function (r) { seen[r.id] = 1; });
    host.innerHTML = "";
    if (!rows.length) { host.appendChild(el("p", "oc-empty", "Inga händelser än")); return; }
    rows.forEach(function (r) {
      var row = el("div", "oc-row" + (fresh[r.id] ? " in" : ""));
      var ic = el("span", "oc-row-ico"); ic.style.setProperty("--c", COLOR[r.agent] || "#7EC8E8");
      ic.appendChild(el("i")); row.appendChild(ic);
      var mid = el("div", "oc-row-mid"); mid.appendChild(el("strong", null, r.title)); mid.appendChild(el("span", null, r.sub)); row.appendChild(mid);
      if (r.v) row.appendChild(el("b", "oc-row-v " + r.cls, r.v));
      host.appendChild(row);
    });
  }

  function render(state) {
    if (!state || !$("oc-home")) return;
    document.body.classList.add("oc");
    var box = state.challenge || {}, crew = box.crew || {}, st = crew.stats || {};
    var ks = state.kill_switch || {};
    var locked = !!(ks.buys_locked || ks.locked);
    var live = String(state.mode || "PAPER").toUpperCase() === "LIVE";
    $("oc-sub").textContent = (live ? "LIVE låst" : "PAPER") + " · " + hm(state.updated_at);
    $("oc-mode").textContent = live ? "LIVE låst" : "PAPER";
    var pill = $("oc-live");
    var running = box.status === "running" && !locked;
    pill.className = "oc-pill oc-live" + (locked ? " lock" : running ? " on" : " done");
    pill.lastChild.textContent = locked ? "Köp låsta" : running ? "Live" : box.status === "finished" ? "Klar" : box.status === "paused" ? "Pausad" : "Vilar";

    var eq = num(box.equity_usd != null ? box.equity_usd : box.cash_usd);
    fmtBalance($("oc-bal"), eq);
    var put = num(box.put_in_usd), pnl = num(box.session_pnl_usd);
    if (pnl == null && eq != null && put != null) pnl = eq - put;
    var pct = pnl != null && put ? pnl / put * 100 : null;
    var ch = $("oc-chg");
    ch.className = "oc-chg " + (pnl != null && pnl < 0 ? "down" : "up");
    ch.textContent = pnl == null ? "saknas" : (pnl < 0 ? "▼ " : "▲ ") + sUsd(pnl) + (pct == null ? "" : " (" + (pct >= 0 ? "+" : "") + pct.toFixed(1) + "%)");
    var m = num(box.multiplier), mp = $("oc-mult");
    mp.textContent = m == null ? "saknas" : m.toFixed(2) + "×";
    mp.className = "oc-mult" + (m == null ? " miss" : m < 1 ? " down" : "");

    var max = num(box.max_open), open = box.open || [];
    var dots = $("oc-dots"); dots.innerHTML = "";
    var nd = max == null ? 0 : Math.min(10, Math.max(0, Math.round(max)));
    for (var i = 0; i < nd; i++) {
      var p = open[i], d = el("i");
      if (p) { var pp = num(p.pnl_usd); d.className = pp != null && pp < 0 ? "red" : "on"; }
      dots.appendChild(d);
    }
    $("oc-dots-n").textContent = max == null ? "saknas" : open.length + "/" + Math.round(max);

    /* Speech bubble: the kill switch first, else the newest real agent line. */
    var say = $("oc-say"), sayW = $("oc-say-w");
    var f0 = (crew.feed || [])[0];
    if (locked) { say.textContent = "Köp låsta · " + (ks.reason_sv || "kill switch"); sayW.className = "oc-say lock"; }
    else if (f0) { say.textContent = (NAME[f0.agent] || f0.agent) + ": " + String(f0.text || "saknas"); sayW.className = "oc-say"; }
    else { say.textContent = "Väntar på desken"; sayW.className = "oc-say"; }

    /* Agent cards: the most recently active of the four is lit, like the video's highlighted card. */
    var agents = {}; (crew.agents || []).forEach(function (a) { agents[a.id] = a; });
    var lastTs = {}; (crew.feed || []).forEach(function (f) { var t = Date.parse(f.ts || ""); if (isFinite(t) && !(lastTs[f.agent] > t)) lastTs[f.agent] = t; });
    var lit = null, best = 0;
    CARDS.forEach(function (c) { if (agents[c.id] && agents[c.id].active && lastTs[c.id] > best) { best = lastTs[c.id]; lit = c.id; } });
    var host = $("oc-cards"); host.innerHTML = "";
    CARDS.forEach(function (c) {
      var a = agents[c.id];
      var card = el("button", "oc-card" + (c.id === lit ? " lit" : "") + (a && !a.active ? " idle" : ""));
      card.type = "button"; card.style.setProperty("--c", c.c);
      card.addEventListener("click", function () { if (g.DegenUI) g.DegenUI.go("agents"); });
      var h = el("span", "oc-card-h"); h.appendChild(el("i")); h.appendChild(el("strong", null, c.n)); card.appendChild(h);
      var subTxt = a ? cardSub(c.id, st, box, a) : "saknas";
      var sEl = el("span", "oc-card-s", subTxt); sEl.title = subTxt + (c.id === "lyssnare" ? " (mynt per timme)" : c.id === "kedjekoll" ? " idag" : c.id === "skeptiker" ? "ade idag" : ""); card.appendChild(sEl);
      host.appendChild(card);
    });

    renderActivity(state, box);
    renderSheet(state, box);
    paintTabs();
    syncFish(box);
  }

  /* ---------- summary sheet (white, bottom) ---------- */
  function renderSheet(state, box) {
    var r = box.recap || {};
    var put = num(r.put_in_usd != null ? r.put_in_usd : box.put_in_usd);
    var now = num(r.now_worth_usd != null ? r.now_worth_usd : box.equity_usd);
    var gain = put != null && now != null ? now - put : null;
    var span = (r.started_at_stockholm && r.ends_at_stockholm) ? String(r.started_at_stockholm).slice(11, 16) + "–" + String(r.ends_at_stockholm).slice(11, 16) : "tid saknas";
    var trades = num(r.trades), coins = num(r.coins);
    $("oc-sh-sub").textContent = "Senaste utmaningen · " + span + " · " + (coins == null ? "mynt saknas" : intSv(coins) + " mynt granskade");
    var big = $("oc-sh-big");
    big.textContent = gain == null ? "saknas" : sUsd(gain);
    big.className = "oc-sh-big" + (gain == null ? " miss" : gain < 0 ? " down" : "");
    $("oc-sh-from").textContent = usd(put) + " → " + usd(now);
    var m = num(r.multiplier != null ? r.multiplier : box.multiplier);
    $("oc-sh-mult").textContent = m == null ? "saknas" : m.toFixed(2) + "×";
    var wins = num(r.wins != null ? r.wins : box.wins), losses = num(r.losses != null ? r.losses : box.losses);
    $("oc-sh-t").textContent = trades == null ? "saknas" : String(trades);
    $("oc-sh-w").textContent = wins == null ? "saknas" : String(wins);
    $("oc-sh-l").textContent = losses == null ? "saknas" : String(losses);
    var live = String(state.mode || "PAPER").toUpperCase() === "LIVE";
    var btn = $("oc-sh-btn");
    btn.disabled = live;
    btn.textContent = live ? "Riktiga pengar låsta" : "Ta ut · PAPER";
  }
  function openSheet() { var s = $("oc-sheet"); if (!s) return; s.hidden = false; requestAnimationFrame(function () { s.classList.add("open"); }); }
  function closeSheet() { var s = $("oc-sheet"); if (!s) return; s.classList.remove("open"); setTimeout(function () { s.hidden = true; }, 320); }

  /* ---------- tab bar (Hem · Agenter · Aktivitet · Plånbok) ---------- */
  var TAB_OF = { hav: "hav", agents: "agents", hem: "trades", trades: "trades", wallet: "wallet", planbok: "wallet" };
  function paintTabs() {
    var cur = g.DegenUI && g.DegenUI.current ? g.DegenUI.current() : "hav";
    var on = TAB_OF[cur] || "hav";
    document.querySelectorAll("#oc-tabs button").forEach(function (b) {
      var x = b.getAttribute("data-go") === on; b.classList.toggle("on", x); b.setAttribute("aria-current", x ? "page" : "false");
    });
  }
  function wire() {
    if (wire.done) return; wire.done = true;
    document.querySelectorAll("#oc-tabs button").forEach(function (b) {
      b.addEventListener("click", function () { if (g.DegenUI) g.DegenUI.go(b.getAttribute("data-go")); });
    });
    var p = $("dg-pager");
    if (p) { var raf = 0; p.addEventListener("scroll", function () { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; paintTabs(); }); }, { passive: true }); }
    var bal = $("oc-balwrap"); if (bal) bal.addEventListener("click", openSheet);
    var bd = $("oc-sheet-bd"); if (bd) bd.addEventListener("click", closeSheet);
    var hd = $("oc-sheet-handle"); if (hd) hd.addEventListener("click", closeSheet);
    var btn = $("oc-sh-btn");
    if (btn) btn.addEventListener("click", function () {
      var st = g.__nimbusLastState || {};
      if (String(st.mode || "PAPER").toUpperCase() === "LIVE") return;
      closeSheet();
      /* The existing PAPER withdraw sheet (slide to confirm). No real order exists here. */
      if (g.NimbusCash) g.NimbusCash.open("withdraw");
    });
    /* Snow: 26 flakes, 3–9 px, soft drift, none when reduced motion is on. */
    var sea = $("oc-bubbles");
    if (sea && !reducedMotion()) {
      for (var i = 0; i < 26; i++) {
        var b = el("i"); var s = 3 + (i * 5 % 7);
        var drift = (i % 2 === 0 ? 1 : -1) * (8 + (i * 5) % 22);
        b.style.cssText = "left:" + ((i * 37) % 100) + "%;width:" + s + "px;height:" + s + "px;--o:" + (0.35 + (i % 6) * 0.07).toFixed(2) + ";--drift:" + drift + ";animation-delay:-" + ((i * 1.3) % 16).toFixed(1) + "s;animation-duration:" + (11 + (i * 3) % 10) + "s";
        sea.appendChild(b);
      }
    }
    bootFish();
  }

  /* ---------- t274/t304 birds: decorative unless a real closed PAPER trade is supplied ---------- */
  var WHALE = [
    { species: "gull", fill: "#E8EEF4", mid: "#8A96A4", scale: 1.05, w: 168, flap: 2.15 },
    { species: "swallow", fill: "#C45A3A", mid: "#243040", scale: 0.92, w: 168, flap: 1.55 },
    { species: "bullfinch", fill: "#D44A5A", mid: "#1A1A1C", scale: 0.88, w: 152, flap: 1.25 },
    { species: "waxwing", fill: "#C4B49A", mid: "#5A4A3A", scale: 0.96, w: 160, flap: 1.7 },
    { species: "crane", fill: "#8A8E96", mid: "#5A6068", scale: 1.42, w: 200, flap: 2.6 },
    { species: "gull", fill: "#F2F5F8", mid: "#A8B4C0", scale: 1.22, w: 180, flap: 2.15 }
  ];
  var MAX_FISH = 3, SWIM_MS = 3600;
  var fishHost = null, liveFish = [], fishRaf = 0, spawnTimer = 0;
  var seenTrade = {}, tradeQueue = [], colorIx = 0, fishPaused = false, pauseAt = 0, fishWired = false;

  function reducedMotion() {
    return !!(g.matchMedia && g.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
function swallowSvg() {
    return '<svg class="oc-critter oc-bird oc-swallow" viewBox="0 0 220 160" overflow="visible">' +
      '<g transform="translate(128,74)"><g class="oc-wing-far">' +
        '<path fill="#1A2836" d="M0 0 C -24 -28, -64 -62, -124 -74 L -132 -64 L -114 -64 L -136 -46 L -112 -50 L -128 -30 L -102 -36 L -112 -16 L -84 -24 C -50 -16, -18 -4, 0 0 Z"/>' +
        '<path fill="#3A4A5C" d="M0 0 C -24 -28, -64 -62, -124 -74 L -98 -50 C -56 -42, -18 -12, 0 0 Z" opacity=".55"/>' +
      '</g></g>' +
      /* deeply forked tail: two thin streamers */
      '<path fill="#1A2836" d="M92 78 L6 46 L70 78 Z"/>' +
      '<path fill="#1A2836" d="M92 84 L2 126 L70 86 Z"/>' +
      /* sleek body + cream underside */
      '<ellipse cx="136" cy="82" rx="32" ry="8.5" fill="#243040" transform="rotate(-12 136 82)"/>' +
      '<ellipse cx="140" cy="86" rx="22" ry="5" fill="#EDE3CE" transform="rotate(-12 140 86)"/>' +
      '<ellipse cx="168" cy="72" rx="10" ry="7.2" fill="#243040"/>' +
      '<ellipse cx="166" cy="76" rx="6" ry="3.4" fill="#C45A3A"/>' +
      '<path d="M177 72 L200 68 L177 77 Z" fill="#1A1A18"/>' +
      '<circle cx="170" cy="70" r="1.8" fill="#0A0A0A"/>' +
      '<circle cx="170.6" cy="69.4" r=".6" fill="#fff"/>' +
      '<g transform="translate(130,86)"><g class="oc-wing-near">' +
        '<path fill="#15202C" d="M0 0 C -16 20, -60 52, -122 78 L -134 64 L -114 62 L -140 42 L -112 42 L -130 22 L -102 24 L -116 6 L -86 14 C -48 12, -16 4, 0 0 Z"/>' +
        '<path fill="#3A4A5C" d="M0 0 C -16 20, -60 52, -122 78 L -96 52 C -54 34, -16 8, 0 0 Z" opacity=".4"/>' +
      '</g></g></svg>';
  }
function gullSvg() {
    return '<svg class="oc-critter oc-bird oc-gull" viewBox="0 0 220 160" overflow="visible">' +
      '<g transform="translate(126,76)"><g class="oc-wing-far">' +
        '<path fill="#8A96A4" d="M0 0 C -26 -22, -70 -52, -128 -62 L -138 -52 L -120 -52 L -144 -32 L -118 -36 L -136 -14 L -108 -20 L -120 -2 L -88 -10 C -52 -8, -18 -2, 0 0 Z"/>' +
        '<path fill="#E4EAF0" d="M0 0 C -26 -22, -70 -52, -128 -62 L -100 -40 C -58 -32, -18 -8, 0 0 Z" opacity=".7"/>' +
        '<path fill="#1C2228" d="M-108 -56 L-138 -52 L-120 -52 L-128 -42 Z"/>' +
        '<path fill="#1C2228" d="M-118 -36 L-144 -32 L-124 -32 Z"/>' +
      '</g></g>' +
      '<path fill="#F0F4F8" d="M86 84 L40 72 L62 84 L38 102 L86 88 Z"/>' +
      '<ellipse cx="134" cy="86" rx="34" ry="10" fill="#F7FAFC" transform="rotate(-7 134 86)"/>' +
      '<ellipse cx="138" cy="90" rx="22" ry="5.5" fill="#FFFFFF" transform="rotate(-7 138 90)"/>' +
      '<ellipse cx="170" cy="78" rx="11" ry="8" fill="#F7FAFC"/>' +
      '<path d="M180 78 L208 73 L180 84 Z" fill="#E8C44A"/>' +
      '<circle cx="192" cy="77" r="1.2" fill="#C43A3A"/>' +
      '<circle cx="172" cy="76" r="1.9" fill="#0A0A0A"/>' +
      '<circle cx="172.6" cy="75.4" r=".65" fill="#fff"/>' +
      '<g transform="translate(128,90)"><g class="oc-wing-near">' +
        '<path fill="#7A8694" d="M0 0 C -18 16, -66 48, -126 70 L -140 56 L -118 54 L -146 34 L -116 34 L -138 16 L -108 18 L -122 2 L -90 10 C -50 8, -16 4, 0 0 Z"/>' +
        '<path fill="#C5CED6" d="M0 0 C -18 16, -66 48, -126 70 L -100 46 C -56 30, -16 8, 0 0 Z" opacity=".55"/>' +
        '<path fill="#1C2228" d="M-108 62 L-140 56 L-118 54 L-128 48 Z"/>' +
        '<path fill="#1C2228" d="M-120 34 L-146 34 L-126 28 Z"/>' +
      '</g></g></svg>';
  }
function bullfinchSvg() {
    return '<svg class="oc-critter oc-bird oc-bullfinch" viewBox="0 0 220 160" overflow="visible">' +
      '<g transform="translate(124,80)"><g class="oc-wing-far">' +
        '<path fill="#2A2A30" d="M0 0 C -18 -20, -46 -40, -82 -50 L -94 -38 L -80 -40 L -98 -24 L -76 -28 L -90 -10 L -68 -16 C -40 -10, -16 -2, 0 0 Z"/>' +
        '<path fill="#F2F5F8" d="M-16 -6 L-54 -32 L-48 -16 L-16 -2 Z"/>' +
      '</g></g>' +
      '<path fill="#1A1A1C" d="M88 88 L50 78 L66 88 L48 104 L88 92 Z"/>' +
      /* white rump */
      '<ellipse cx="100" cy="88" rx="10" ry="7" fill="#F2F5F8" transform="rotate(-8 100 88)"/>' +
      /* grey back */
      '<ellipse cx="126" cy="90" rx="24" ry="13" fill="#8A96A0" transform="rotate(-8 126 90)"/>' +
      /* rose breast and belly */
      '<ellipse cx="140" cy="96" rx="18" ry="10" fill="#D44A5A" transform="rotate(-8 140 96)"/>' +
      /* black cap + rose cheek */
      '<ellipse cx="158" cy="82" rx="12.5" ry="10.5" fill="#1A1A1C"/>' +
      '<ellipse cx="154" cy="88" rx="7.5" ry="5.5" fill="#D44A5A"/>' +
      '<path d="M168 84 L184 87 L168 91 Z" fill="#1A1A1C"/>' +
      '<circle cx="160" cy="80" r="1.9" fill="#0A0A0A"/>' +
      '<circle cx="160.6" cy="79.4" r=".6" fill="#fff"/>' +
      '<g transform="translate(126,94)"><g class="oc-wing-near">' +
        '<path fill="#1A1A1C" d="M0 0 C -14 14, -44 34, -80 48 L -94 34 L -78 34 L -98 20 L -74 22 L -88 8 L -64 12 C -36 10, -14 4, 0 0 Z"/>' +
        '<path fill="#F2F5F8" d="M-14 6 L-56 32 L-48 16 L-14 4 Z"/>' +
      '</g></g></svg>';
  }
function waxwingSvg() {
    return '<svg class="oc-critter oc-bird oc-waxwing" viewBox="0 0 220 160" overflow="visible">' +
      '<g transform="translate(126,76)"><g class="oc-wing-far">' +
        '<path fill="#6A5A48" d="M0 0 C -20 -24, -56 -52, -100 -62 L -114 -50 L -98 -50 L -118 -32 L -96 -36 L -112 -16 L -86 -22 C -50 -14, -18 -4, 0 0 Z"/>' +
        '<path fill="#C4B49A" d="M0 0 C -20 -24, -56 -52, -100 -62 L -82 -42 C -48 -34, -18 -10, 0 0 Z" opacity=".5"/>' +
        '<path fill="#E8D060" d="M-88 -56 L-114 -50 L-98 -48 Z"/>' +
        '<path fill="#C43A3A" d="M-70 -36 L-78 -40 L-74 -32 Z"/>' +
      '</g></g>' +
      /* tail with yellow tip */
      '<path fill="#5A4A3A" d="M86 86 L36 68 L60 86 L34 114 L86 92 Z"/>' +
      '<path fill="#E8D060" d="M42 74 L36 68 L48 78 Z"/>' +
      '<path fill="#E8D060" d="M40 108 L34 114 L50 104 Z"/>' +
      '<ellipse cx="132" cy="88" rx="30" ry="12" fill="#C4B49A" transform="rotate(-8 132 88)"/>' +
      '<ellipse cx="136" cy="93" rx="18" ry="6" fill="#E2D4BE" transform="rotate(-8 136 93)"/>' +
      /* crest */
      '<path d="M156 70 L176 50 L170 74 Z" fill="#A89478"/>' +
      '<ellipse cx="162" cy="78" rx="12" ry="9" fill="#C4B49A"/>' +
      /* black mask */
      '<path fill="#1A1A1C" d="M152 76 C 156 72, 172 74, 176 80 L 168 82 C 164 78, 156 78, 152 80 Z"/>' +
      '<path d="M174 78 L194 75 L174 84 Z" fill="#2A2218"/>' +
      '<circle cx="166" cy="76" r="1.9" fill="#0A0A0A"/>' +
      '<circle cx="166.6" cy="75.4" r=".6" fill="#fff"/>' +
      '<g transform="translate(128,92)"><g class="oc-wing-near">' +
        '<path fill="#5A4A3A" d="M0 0 C -16 18, -54 44, -102 62 L -116 48 L -98 46 L -122 28 L -96 30 L -112 12 L -84 16 C -48 12, -16 4, 0 0 Z"/>' +
        '<path fill="#C4B49A" d="M0 0 C -16 18, -54 44, -102 62 L -82 40 C -46 26, -16 8, 0 0 Z" opacity=".45"/>' +
        '<path fill="#E8D060" d="M-90 54 L-116 48 L-100 46 Z"/>' +
        '<path fill="#C43A3A" d="M-68 28 L-76 32 L-70 22 Z"/>' +
      '</g></g></svg>';
  }
function craneSvg() {
    return '<svg class="oc-critter oc-bird oc-crane" viewBox="0 0 240 170" overflow="visible">' +
      '<g transform="translate(122,84)"><g class="oc-wing-far">' +
        '<path fill="#6A7078" d="M0 0 C -26 -28, -72 -68, -132 -80 L -148 -66 L -126 -66 L -154 -44 L -122 -50 L -148 -24 L -114 -32 L -132 -8 L -96 -16 C -56 -12, -20 -2, 0 0 Z"/>' +
        '<path fill="#9AA0A8" d="M0 0 C -26 -28, -72 -68, -132 -80 L -106 -54 C -62 -44, -20 -10, 0 0 Z" opacity=".5"/>' +
        '<path fill="#1A1A1C" d="M-114 -72 L-148 -66 L-126 -66 L-136 -54 L-118 -64 Z"/>' +
        '<path fill="#1A1A1C" d="M-124 -50 L-154 -44 L-130 -44 Z"/>' +
        '<path fill="#1A1A1C" d="M-130 -32 L-148 -24 L-126 -26 Z"/>' +
      '</g></g>' +
      /* trailing legs */
      '<path fill="none" stroke="#5A6068" stroke-width="2.1" stroke-linecap="round" d="M78 94 L4 108"/>' +
      '<path fill="none" stroke="#5A6068" stroke-width="2.1" stroke-linecap="round" d="M80 98 L10 118"/>' +
      '<ellipse cx="124" cy="92" rx="32" ry="11" fill="#8A8E96" transform="rotate(-6 124 92)"/>' +
      '<ellipse cx="130" cy="96" rx="18" ry="5.5" fill="#B0B4BA" transform="rotate(-6 130 96)"/>' +
      /* straight outstretched neck */
      '<path stroke="#8A8E96" stroke-width="6.5" stroke-linecap="round" fill="none" d="M152 88 L206 66"/>' +
      '<ellipse cx="210" cy="64" rx="9" ry="6.2" fill="#8A8E96"/>' +
      '<circle cx="204" cy="58" r="3.1" fill="#C43A3A"/>' +
      '<path d="M218 64 L242 59 L218 69 Z" fill="#1A1A1C"/>' +
      '<circle cx="212" cy="62" r="1.55" fill="#0A0A0A"/>' +
      '<circle cx="212.5" cy="61.5" r=".5" fill="#fff"/>' +
      '<g transform="translate(124,96)"><g class="oc-wing-near">' +
        '<path fill="#5A6068" d="M0 0 C -20 22, -70 58, -132 84 L -150 68 L -126 66 L -156 44 L -122 44 L -146 24 L -114 26 L -132 6 L -96 14 C -54 12, -18 4, 0 0 Z"/>' +
        '<path fill="#9AA0A8" d="M0 0 C -20 22, -70 58, -132 84 L -106 56 C -60 38, -18 8, 0 0 Z" opacity=".45"/>' +
        '<path fill="#1A1A1C" d="M-114 74 L-150 68 L-126 66 L-138 56 Z"/>' +
        '<path fill="#1A1A1C" d="M-128 44 L-156 44 L-132 36 Z"/>' +
        '<path fill="#1A1A1C" d="M-130 24 L-146 24 L-128 16 Z"/>' +
      '</g></g></svg>';
  }
function ravenSvg() {
    return '<svg class="oc-critter oc-raven" viewBox="0 0 220 160" overflow="visible">' +
      '<g transform="translate(124,76)"><g class="oc-wing-far">' +
        '<path class="oc-raven-wing" fill="#1A1A22" d="M0 0 C -22 -26, -62 -58, -116 -70 L -132 -56 L -112 -56 L -140 -34 L -110 -40 L -134 -16 L -102 -24 L -118 -2 L -86 -12 C -50 -10, -18 -2, 0 0 Z"/>' +
        '<path fill="#2A2A36" d="M0 0 C -22 -26, -62 -58, -116 -70 L -92 -46 C -54 -38, -18 -10, 0 0 Z" opacity=".55"/>' +
        '<path class="oc-raven-wing" fill="#0A0A10" d="M-100 -62 L-132 -56 L-112 -56 L-124 -46 Z"/>' +
        '<path class="oc-raven-wing" fill="#0A0A10" d="M-108 -40 L-140 -34 L-116 -34 Z"/>' +
        '<path class="oc-raven-wing" fill="#0A0A10" d="M-114 -24 L-134 -16 L-110 -18 Z"/>' +
      '</g></g>' +
      /* wedge / diamond tail */
      '<path class="oc-raven-tail" fill="#14141C" d="M86 86 L24 70 L54 86 L20 122 L86 92 Z"/>' +
      '<ellipse class="oc-raven-body" cx="128" cy="88" rx="32" ry="12" fill="#2A2A34" transform="rotate(-8 128 88)"/>' +
      '<ellipse class="oc-raven-body" cx="162" cy="80" rx="13" ry="10" fill="#2A2A34"/>' +
      /* shaggy throat */
      '<path class="oc-raven-body" fill="#1A1A22" d="M150 86 C 148 96, 158 100, 166 90"/>' +
      '<path d="M174 80 L206 72 L174 90 Z" fill="#0A0A0A"/>' +
      '<circle cx="166" cy="77" r="2" fill="#000"/>' +
      '<circle cx="166.7" cy="76.3" r=".65" fill="#fff"/>' +
      '<g transform="translate(126,90)"><g class="oc-wing-near">' +
        '<path class="oc-raven-wing" fill="#12121A" d="M0 0 C -18 20, -60 52, -118 74 L -136 58 L -114 56 L -142 34 L -110 36 L -132 16 L -100 18 L -116 0 L -84 8 C -48 10, -16 4, 0 0 Z"/>' +
        '<path fill="#2A2A36" d="M0 0 C -18 20, -60 52, -118 74 L -92 48 C -52 32, -16 8, 0 0 Z" opacity=".45"/>' +
        '<path class="oc-raven-wing" fill="#0A0A10" d="M-100 64 L-136 58 L-114 56 L-126 48 Z"/>' +
        '<path class="oc-raven-wing" fill="#0A0A10" d="M-112 36 L-142 34 L-118 28 Z"/>' +
      '</g></g></svg>';
  }
  function whaleSvg(c) {
    var fn = { swallow: swallowSvg, gull: gullSvg, bullfinch: bullfinchSvg, waxwing: waxwingSvg, crane: craneSvg };
    return (fn[c && c.species] || gullSvg)();
  }
  function sharkSvg() { return ravenSvg(); }
  function riderHtml() {
    return '<span class="oc-rider"><span class="oc-rider-av"><img src="icons/mark.png" alt="" width="28" height="28" /></span>' +
      '<span class="oc-rider-face"><i class="l"></i><i class="r"></i><b>^</b><b>^</b></span></span>';
  }
  /* Only closed challenge trades with a real symbol and a finite PnL. Nothing is invented. */
  function closedPaper(box) {
    var out = [];
    ((box && box.trades) || []).forEach(function (t) {
      if (!t) return;
      var p = num(t.pnl_usd != null ? t.pnl_usd : t.pnl);
      var s = t.symbol || t.token || "";
      if (typeof s !== "string") return;
      s = s.replace(/^\$/, "").trim();
      if (p == null || !s) return;
      var id = t.id != null ? "t:" + t.id : ("s:" + s + ":" + String(t.closed_at || t.ts || "") + ":" + p);
      out.push({ id: id, symbol: s, pnl: p, win: p >= 0 });
    });
    return out;
  }
  function syncFish(box) {
    closedPaper(box).forEach(function (r) {
      if (seenTrade[r.id]) return;
      seenTrade[r.id] = 1;
      tradeQueue.push(r);
    });
  }
  function setFishPaused(p) {
    if (p && !fishPaused) {
      pauseAt = performance.now();
      fishPaused = true;
      if (fishRaf) { cancelAnimationFrame(fishRaf); fishRaf = 0; }
    } else if (!p && fishPaused) {
      var dt = performance.now() - pauseAt;
      liveFish.forEach(function (f) { f.t0 += dt; });
      fishPaused = false;
      tickOn();
    }
  }
  function scareBot(on) {
    var bot = $("oc-bot"), eyes = $("oc-bot-eyes");
    if (bot) bot.classList.toggle("scared", !!on);
    if (eyes) eyes.hidden = !on;
  }
  function floatBadge(ev, color, x, ypx, loss) {
    if (!ev || !fishHost) return;
    var b = el("div", "oc-fbadge " + (loss ? "down" : "up"));
    if (!loss && color) b.style.setProperty("--c", color.fill);
    b.textContent = sym(ev.symbol) + " " + sUsd(ev.pnl);
    b.style.left = Math.round(x) + "px";
    b.style.top = Math.round(ypx) + "px";
    fishHost.appendChild(b);
    setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 1800);
  }
  function spawnOne(event) {
    if (reducedMotion() || !fishHost) return false;
    if (liveFish.length >= MAX_FISH) return false;
    var ev = event && event.symbol && event.pnl != null && isFinite(Number(event.pnl)) ? { symbol: String(event.symbol).replace(/^\$/, "").trim(), pnl: Number(event.pnl), win: event.win != null ? !!event.win : Number(event.pnl) >= 0, id: event.id } : null;
    if (ev && !ev.symbol) ev = null;
    var kind = ev ? (ev.win ? "whale" : "shark") : (Math.random() < 0.78 ? "whale" : "shark");
    var color = WHALE[colorIx++ % WHALE.length];
    var dir = Math.random() < 0.5 ? 1 : -1;
    var y = Math.random() < 0.5 ? (0.12 + Math.random() * 0.12) : (0.28 + Math.random() * 0.14);
    var depth = 0.74 + Math.random() * 0.46;
    var scale = (kind === "whale" ? (color.scale || 1) : 0.96) * depth;
    var w = (color.w || 168) * scale;
    var wrap = el("div", "oc-swimmer " + kind + (ev ? " ev" : " deco") + (color.species ? " sp-" + color.species : ""));
    wrap.style.width = w + "px";
    wrap.style.setProperty("--flap-dur", ((color.flap || 1.8) * (0.92 + Math.random() * 0.2)).toFixed(2) + "s");
    wrap.style.setProperty("--flap-delay", (-Math.random() * 2.2).toFixed(2) + "s");
    if (depth < 0.9) wrap.style.opacity = (0.75 + depth * 0.22).toFixed(2);
    var html = ev ? ('<span class="oc-flab">' + sym(ev.symbol) + "</span>") : "";
    html += kind === "whale" ? whaleSvg(color) : sharkSvg();
    if (ev && kind === "whale") html += riderHtml();
    wrap.innerHTML = html;
    var critter = wrap.querySelector(".oc-critter");
    if (dir < 0 && critter) critter.style.transform = "scaleX(-1)";
    fishHost.appendChild(wrap);
    var startX = dir > 0 ? -w - 8 : (fishHost.clientWidth || g.innerWidth || 390) + 8;
    var rec = {
      el: wrap, ev: ev, kind: kind, dir: dir, x: startX, y: y, w: w,
      t0: performance.now(), mid: false, shot: false, dur: SWIM_MS + Math.round(Math.random() * 1400 - 200),
      phase: Math.random() * Math.PI * 2, amp: 9 + Math.random() * 12, color: color
    };
    wrap.style.transform = "translate(" + rec.x.toFixed(1) + "px," + (rec.y * (fishHost.clientHeight || 844)).toFixed(1) + "px)";
    liveFish.push(rec);
    tickOn();
    return true;
  }
  function tick(now) {
    fishRaf = 0;
    if (fishPaused || reducedMotion() || !fishHost) return;
    var W = fishHost.clientWidth || g.innerWidth || 390;
    var H = fishHost.clientHeight || g.innerHeight || 844;
    var midX = W / 2, keep = [];
    for (var i = 0; i < liveFish.length; i++) {
      var f = liveFish[i], elapsed = now - f.t0, travel = W + f.w + 16;
      if (!f.shot) f.x = f.dir > 0 ? (-f.w + (elapsed / f.dur) * travel) : (W - (elapsed / f.dur) * travel);
      else f.x += f.dir * 22;
      var ypx = f.y * H + Math.sin(f.phase + elapsed / 340) * f.amp;
      f.el.style.transform = "translate(" + f.x.toFixed(1) + "px," + ypx.toFixed(1) + "px)";
      var cx = f.x + f.w / 2;
      if (!f.mid && ((f.dir > 0 && cx >= midX) || (f.dir < 0 && cx <= midX))) {
        f.mid = true;
        if (f.ev && f.kind === "whale") {
          f.el.classList.add("ride");
          floatBadge(f.ev, f.color, cx, ypx - 8, false);
        } else if (f.ev && f.kind === "shark") {
          f.el.classList.add("mad");
          f.shot = true;
          scareBot(true);
          setTimeout(function () { scareBot(false); }, 1200);
          floatBadge(f.ev, null, cx, ypx - 8, true);
        }
      }
      var gone = f.dir > 0 ? (f.x > W + 24) : (f.x < -f.w - 24);
      if (gone) { if (f.el.parentNode) f.el.parentNode.removeChild(f.el); }
      else keep.push(f);
    }
    liveFish = keep;
    if (liveFish.length) fishRaf = requestAnimationFrame(tick);
  }
  function tickOn() {
    if (!fishRaf && !fishPaused && !reducedMotion()) fishRaf = requestAnimationFrame(tick);
  }
  function bootFish() {
    if (fishWired) return;
    fishHost = $("oc-fish");
    if (!fishHost || reducedMotion()) return;
    fishWired = true;
    document.addEventListener("visibilitychange", function () { setFishPaused(document.hidden); });
    function loop() {
      spawnTimer = 0;
      if (!fishPaused && !document.hidden) spawnOne(tradeQueue.shift() || null);
      spawnTimer = setTimeout(loop, 3000 + Math.random() * 2000);
    }
    spawnTimer = setTimeout(loop, 700);
  }

  function testReset() {
    liveFish.forEach(function (f) { if (f.el && f.el.parentNode) f.el.parentNode.removeChild(f.el); });
    liveFish = [];
    if (fishHost) fishHost.querySelectorAll(".oc-fbadge").forEach(function (b) { b.parentNode.removeChild(b); });
    scareBot(false);
    if (fishRaf) { cancelAnimationFrame(fishRaf); fishRaf = 0; }
  }

  g.OceanUI = {
    render: render, open: openSheet, close: closeSheet,
    /* Hooks for tests only. Production never calls these with invented numbers. */
    spawnFish: function (ev) { return spawnOne(ev || null); },
    _testReset: testReset
  };
  function hook() {
    if (!g.SwipeUI || g.SwipeUI.__oc) return;
    var r = g.SwipeUI.render;
    g.SwipeUI.render = function (s) { try { r(s); } catch (e) { if (g.console) console.error(e); } try { render(s); } catch (e2) { if (g.console) console.error(e2); } };
    g.SwipeUI.__oc = true;
  }
  wire();
  hook();
  if (g.__nimbusLastState) { try { render(g.__nimbusLastState); } catch (e) { if (g.console) console.error(e); } }
})(window);
