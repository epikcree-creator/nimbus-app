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
    { species: "gull", fill: "#E8EEF4", mid: "#8A96A4", scale: 1, w: 62, flap: 2.2 },
    { species: "swallow", fill: "#C45A3A", mid: "#243040", scale: 1, w: 58, flap: 1.65 },
    { species: "bullfinch", fill: "#D44A5A", mid: "#1A1A1C", scale: 1, w: 48, flap: 1.35 },
    { species: "waxwing", fill: "#C4B49A", mid: "#5A4A3A", scale: 1, w: 52, flap: 1.7 },
    { species: "crane", fill: "#8A8E96", mid: "#5A6068", scale: 1, w: 70, flap: 2.7 },
    { species: "gull", fill: "#F2F5F8", mid: "#A8B4C0", scale: 1, w: 56, flap: 2.2 }
  ];
  var MAX_FISH = 4, SWIM_MS = 4200;
  var fishHost = null, liveFish = [], fishRaf = 0, spawnTimer = 0;
  var seenTrade = {}, tradeQueue = [], colorIx = 0, fishPaused = false, pauseAt = 0, fishWired = false;

  function reducedMotion() {
    return !!(g.matchMedia && g.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  var uid = 0;
  function id(s) { return "v68b" + (++uid) + s; }
  function wrap(cls, inner) {
    return '<svg class="oc-critter oc-bird ' + cls + '" viewBox="0 0 160 100" overflow="visible">' + inner + "</svg>";
  }
  function eye(cx, cy) {
    return '<circle cx="' + cx + '" cy="' + cy + '" r="1.3" fill="#12141A"/>' +
      '<circle cx="' + (cx + 0.5) + '" cy="' + (cy - 0.45) + '" r="0.48" fill="#fff"/>';
  }

  /* Hand-tuned smooth wings, local coords, shoulder at 0,0.
     Wide at the root so they read as one piece with the body. */
  var WING = {
    /* long, reasonably broad, 4 soft fingers — gull / raven-ish */
    longUp: "M0 0 C -10 -8, -32 -24, -62 -30 C -74 -32, -80 -28, -78 -24 C -76 -25.5, -73 -24.5, -71 -23 C -75 -21, -72 -18, -68 -17 C -72 -15, -69 -12, -64 -12 C -42 -10, -16 -4, 0 0 Z",
    longDn: "M0 0 C -10 8, -32 24, -62 30 C -74 32, -80 28, -78 24 C -76 25.5, -73 24.5, -71 23 C -75 21, -72 18, -68 17 C -72 15, -69 12, -64 12 C -42 10, -16 4, 0 0 Z",
    /* swallow: longer, slimmer, pointed, still a surface */
    scytheUp: "M0 0 C -14 -8, -40 -26, -76 -34 C -86 -36, -90 -32, -88 -28 C -84 -30, -80 -28, -78 -26 C -82 -24, -78 -20, -70 -19 C -48 -14, -18 -5, 0 0 Z",
    scytheDn: "M0 0 C -14 8, -40 26, -76 34 C -86 36, -90 32, -88 28 C -84 30, -80 28, -78 26 C -82 24, -78 20, -70 19 C -48 14, -18 5, 0 0 Z",
    /* short rounded — bullfinch / waxwing */
    roundUp: "M0 0 C -8 -8, -24 -20, -48 -24 C -58 -25, -62 -21, -60 -18 C -58 -19.5, -55 -18.5, -53 -17 C -57 -15, -54 -12, -48 -12 C -32 -10, -12 -3, 0 0 Z",
    roundDn: "M0 0 C -8 8, -24 20, -48 24 C -58 25, -62 21, -60 18 C -58 19.5, -55 18.5, -53 17 C -57 15, -54 12, -48 12 C -32 10, -12 3, 0 0 Z",
    /* crane: broad, 5 gentle fingers */
    broadUp: "M0 0 C -12 -10, -36 -28, -68 -34 C -80 -36, -86 -32, -84 -28 C -82 -29.5, -79 -28.5, -77 -27 C -81 -25, -78 -22, -74 -21 C -78 -19, -75 -16, -70 -16 C -74 -14, -71 -11, -66 -11 C -44 -10, -16 -4, 0 0 Z",
    broadDn: "M0 0 C -12 10, -36 28, -68 34 C -80 36, -86 32, -84 28 C -82 29.5, -79 28.5, -77 27 C -81 25, -78 22, -74 21 C -78 19, -75 16, -70 16 C -74 14, -71 11, -66 11 C -44 10, -16 4, 0 0 Z"
  };

  function swallowSvg() {
    var a = id("w"), b = id("bd");
    return wrap("oc-swallow",
      '<defs>' +
        '<linearGradient id="' + a + '" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0%" stop-color="#4A5A6C"/><stop offset="100%" stop-color="#1A2430"/>' +
        '</linearGradient>' +
        '<linearGradient id="' + b + '" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="#2C3A48"/><stop offset="100%" stop-color="#1A2430"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<g transform="translate(78,48)"><g class="oc-wing-far"><path fill="url(#' + a + ')" d="' + WING.scytheUp + '"/></g></g>' +
      /* slim body + two long streamers meeting at the rump */
      '<path fill="url(#' + b + ')" d="M124 47 L116 44 C112 41 106 40 100 42 C90 40 78 43 68 48 C50 40 26 30 8 24 C12 30 40 46 68 50 C50 54 22 66 6 74 C14 68 42 56 68 52 C80 56 98 54 110 50 C116 49 120 48 124 49 Z"/>' +
      '<path fill="#E8DCC8" d="M108 48 C98 51 84 52 74 50 C86 47 100 47 110 47 Z"/>' +
      '<path fill="#C45A3A" d="M114 47 C110 50 106 50 102 48 C108 46 112 46 116 46 Z"/>' +
      '<path fill="#1A1A18" d="M122 46 L134 44.5 L122 49.5 Z"/>' +
      eye(114, 44.2) +
      '<g transform="translate(80,50)"><g class="oc-wing-near"><path fill="url(#' + a + ')" d="' + WING.scytheDn + '"/></g></g>'
    );
  }

  function gullSvg() {
    var a = id("w"), b = id("bd");
    return wrap("oc-gull",
      '<defs>' +
        '<linearGradient id="' + a + '" x1="0" y1="0" x2="1" y2="0.15">' +
          '<stop offset="0%" stop-color="#F7FAFC"/><stop offset="58%" stop-color="#C5CED6"/><stop offset="100%" stop-color="#2A3238"/>' +
        '</linearGradient>' +
        '<linearGradient id="' + b + '" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="#FFFFFF"/><stop offset="100%" stop-color="#E4EAF0"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<g transform="translate(76,48)"><g class="oc-wing-far"><path fill="url(#' + a + ')" d="' + WING.longUp + '"/></g></g>' +
      '<path fill="url(#' + b + ')" d="M126 48 L118 45 C114 41 108 41 102 43 C88 40 70 43 56 49 C48 51 42 50 40 52 C44 55 54 56 64 54 C80 58 100 55 114 51 C118 50 122 49 126 50 Z"/>' +
      '<path fill="#E8C44A" d="M124 47 L138 45 L124 51 Z"/>' +
      '<circle cx="131.5" cy="47.2" r="0.8" fill="#C43A3A"/>' +
      eye(114, 45) +
      '<g transform="translate(78,50)"><g class="oc-wing-near"><path fill="url(#' + a + ')" d="' + WING.longDn + '"/></g></g>'
    );
  }

  function bullfinchSvg() {
    var a = id("w");
    return wrap("oc-bullfinch",
      '<defs>' +
        '<linearGradient id="' + a + '" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0%" stop-color="#3A3A44"/><stop offset="100%" stop-color="#1A1A20"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<g transform="translate(78,50)"><g class="oc-wing-far">' +
        '<path fill="url(#' + a + ')" d="' + WING.roundUp + '"/>' +
        '<path fill="#F2F5F8" d="M-10 -2 C -22 -9, -34 -14, -42 -15 Q -34 -7, -18 -3 Q -12 -1, -8 0 Z"/>' +
      '</g></g>' +
      '<path fill="#8A96A0" d="M122 50 L114 47 C112 41 106 38 99 40 C88 36 74 41 64 48 C56 51 50 53 50 55 C54 58 64 58 74 56 C88 62 106 60 114 54 C118 53 120 52 122 52 Z"/>' +
      '<path fill="#F2F5F8" d="M64 48 C56 51 51 54 51 55 C55 57 64 56 70 53 Z"/>' +
      '<path fill="#D44A5A" d="M114 50 C104 58 88 60 76 55 C90 52 104 50 114 49 Z"/>' +
      '<path fill="#1A1A1C" d="M114 47 C112 41 106 38 99 40 C102 38 110 38 116 44 C118 46 118 48 116 49 Z"/>' +
      '<path fill="#1A1A1C" d="M120 49.5 L130 51.2 L120 53.5 Z"/>' +
      eye(110, 45.5) +
      '<g transform="translate(80,52)"><g class="oc-wing-near">' +
        '<path fill="url(#' + a + ')" d="' + WING.roundDn + '"/>' +
        '<path fill="#F2F5F8" d="M-10 2 C -22 9, -34 14, -42 15 Q -34 7, -18 3 Q -12 1, -8 0 Z"/>' +
      '</g></g>'
    );
  }

  function waxwingSvg() {
    var a = id("w"), b = id("bd");
    return wrap("oc-waxwing",
      '<defs>' +
        '<linearGradient id="' + a + '" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0%" stop-color="#D0C0A4"/><stop offset="100%" stop-color="#5A4A3A"/>' +
        '</linearGradient>' +
        '<linearGradient id="' + b + '" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="#D4C4A8"/><stop offset="100%" stop-color="#A89478"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<g transform="translate(78,49)"><g class="oc-wing-far"><path fill="url(#' + a + ')" d="' + WING.roundUp + '"/></g></g>' +
      /* crest is a smooth bump on the head, yellow only at the tail tip */
      '<path fill="url(#' + b + ')" d="M124 49 L116 46 C114 38 110 32 106 30 C104 34 102 38 100 41 C90 37 76 41 64 48 C54 50 46 49 42 51 C44 53 50 55 58 54 C50 58 44 63 40 66 C48 62 58 57 66 54 C80 60 102 58 114 52 C120 51 122 50 124 51 Z"/>' +
      '<path fill="#E8D060" d="M46 50 L41 51 C43 54 50 55 58 54 C52 52 48 51 46 50 Z"/>' +
      '<path fill="#1A1A1C" opacity=".9" d="M108 44 C112 44 120 46 124 49 L116 50 C112 47 108 46 106 46 Z"/>' +
      '<path fill="#2A2218" d="M122 48 L134 46.5 L122 51.5 Z"/>' +
      eye(114, 44.5) +
      '<g transform="translate(80,51)"><g class="oc-wing-near"><path fill="url(#' + a + ')" d="' + WING.roundDn + '"/></g></g>'
    );
  }

  function craneSvg() {
    var a = id("w"), b = id("bd");
    return wrap("oc-crane",
      '<defs>' +
        '<linearGradient id="' + a + '" x1="0" y1="0" x2="1" y2="0.15">' +
          '<stop offset="0%" stop-color="#C8CCD2"/><stop offset="68%" stop-color="#7A8088"/><stop offset="100%" stop-color="#2A2C30"/>' +
        '</linearGradient>' +
        '<linearGradient id="' + b + '" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0%" stop-color="#B0B4BA"/><stop offset="100%" stop-color="#7A8088"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<g transform="translate(70,50)"><g class="oc-wing-far"><path fill="url(#' + a + ')" d="' + WING.broadUp + '"/></g></g>' +
      '<path fill="none" stroke="#5A6068" stroke-width="1.55" stroke-linecap="round" d="M54 54 C 34 60, 18 66, 6 70"/>' +
      '<path fill="none" stroke="#5A6068" stroke-width="1.55" stroke-linecap="round" d="M56 56 C 38 64, 22 72, 10 78"/>' +
      '<path fill="url(#' + b + ')" d="M146 38 L138 36 C136 34 134 33 132 34 C118 40 100 47 82 51 C68 49 58 51 50 55 C46 56 44 57 46 58 C54 59 68 57 80 56 C96 59 114 52 130 44 C136 42 142 40 146 40 Z"/>' +
      '<circle cx="134" cy="33.5" r="2.2" fill="#C43A3A"/>' +
      '<path fill="#1A1A1C" d="M144 37 L155 35 L144 40.5 Z"/>' +
      eye(136, 36) +
      '<g transform="translate(72,52)"><g class="oc-wing-near"><path fill="url(#' + a + ')" d="' + WING.broadDn + '"/></g></g>'
    );
  }

  function ravenSvg() {
    var a = id("w"), b = id("bd");
    return wrap("oc-raven",
      '<defs>' +
        '<linearGradient id="' + a + '" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0%" stop-color="#3A3A48"/><stop offset="100%" stop-color="#12121A"/>' +
        '</linearGradient>' +
        '<linearGradient id="' + b + '" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" stop-color="#2E2E3A"/><stop offset="100%" stop-color="#16161E"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<g transform="translate(76,48)"><g class="oc-wing-far"><path class="oc-raven-wing" fill="url(#' + a + ')" d="' + WING.longUp + '"/></g></g>' +
      '<path class="oc-raven-body" fill="url(#' + b + ')" d="M128 48 L118 44 C114 40 108 40 102 42 C88 38 70 42 58 49 C46 47 34 50 28 54 C36 55 48 54 58 53 C50 58 36 66 26 72 C38 66 52 58 64 54 C78 60 100 57 114 52 C120 51 124 50 128 51 Z"/>' +
      '<path fill="#0A0A0A" d="M126 47 L142 43 L126 53 Z"/>' +
      eye(114, 44.5) +
      '<g transform="translate(78,50)"><g class="oc-wing-near"><path class="oc-raven-wing" fill="url(#' + a + ')" d="' + WING.longDn + '"/></g></g>'
    );
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
    var y = 0.09 + Math.random() * 0.12;
    var depth = 0.68 + Math.random() * 0.32;
    var scale = (kind === "whale" ? (color.scale || 1) : 0.9) * depth;
    var w = Math.min(70, (color.w || 56) * scale);
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
