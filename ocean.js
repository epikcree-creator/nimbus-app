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
    { fill: "#E8EEF4", mid: "#B8C4D0" },
    { fill: "#8AA0B4", mid: "#5C7388" },
    { fill: "#C4A882", mid: "#8A6E4E" },
    { fill: "#B8C4D4", mid: "#7A8A9A" },
    { fill: "#D4C4B0", mid: "#9A8A78" },
    { fill: "#F2F5F8", mid: "#A8B4C0", scale: 1.4 }
  ];
  var MAX_FISH = 3, SWIM_MS = 3200;
  var fishHost = null, liveFish = [], fishRaf = 0, spawnTimer = 0;
  var seenTrade = {}, tradeQueue = [], colorIx = 0, fishPaused = false, pauseAt = 0, fishWired = false;

  function reducedMotion() {
    return !!(g.matchMedia && g.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function whaleSvg(c) {
    return '<svg class="oc-critter oc-bird" viewBox="0 0 140 70">' +
      '<path class="oc-bird-wing" fill="' + c.mid + '" d="M64 34 C 42 6, 16 6, 6 20 C 28 12, 50 26, 68 38"/>' +
      '<path fill="' + c.fill + '" d="M46 38 C 56 24, 86 20, 114 30 C 128 36, 134 42, 126 46 C 108 54, 76 54, 54 46 C 46 42, 44 40, 46 38 Z"/>' +
      '<path fill="' + c.mid + '" d="M48 36 C 30 32, 14 36, 4 28 C 16 40, 34 44, 52 40"/>' +
      '<ellipse cx="116" cy="32" rx="10" ry="8" fill="' + c.fill + '"/>' +
      '<path d="M124 32 L140 30 L126 38 Z" fill="' + c.mid + '"/>' +
      '<circle cx="118" cy="30" r="2.3" fill="#0A1630"/>' +
      '<circle cx="118.8" cy="29.3" r="0.8" fill="#fff"/>' +
      '<ellipse cx="90" cy="42" rx="16" ry="5" fill="#fff" opacity=".22"/>' +
      "</svg>";
  }
  function sharkSvg() {
    return '<svg class="oc-critter oc-raven" viewBox="0 0 150 70">' +
      '<path class="oc-raven-wing" fill="#1A1A22" d="M70 34 C 48 4, 20 6, 8 20 C 30 12, 54 26, 74 38"/>' +
      '<path class="oc-raven-body" fill="#2A2A34" d="M50 36 C 62 20, 92 16, 122 28 C 138 34, 146 40, 138 46 C 118 56, 80 56, 56 46 C 48 42, 46 38, 50 36 Z"/>' +
      '<path class="oc-raven-tail" fill="#1A1A22" d="M52 36 C 34 32, 16 36, 4 28 C 18 40, 36 46, 54 42"/>' +
      '<ellipse cx="120" cy="32" rx="11" ry="8" fill="#2A2A34"/>' +
      '<path d="M128 32 L148 28 L130 38 Z" fill="#1A1A22"/>' +
      '<circle cx="124" cy="30" r="2.4" fill="#0A0A0A"/>' +
      '<circle cx="124.8" cy="29.2" r="0.7" fill="#fff"/>' +
      "</svg>";
  }
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
    var scale = kind === "whale" ? (color.scale || 1) : 1;
    var w = (kind === "whale" ? 118 : 126) * scale;
    var wrap = el("div", "oc-swimmer " + kind + (ev ? " ev" : " deco"));
    wrap.style.width = w + "px";
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
      t0: performance.now(), mid: false, shot: false, dur: SWIM_MS,
      phase: Math.random() * Math.PI * 2, amp: 7 + Math.random() * 5, color: color
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
      var ypx = f.y * H + Math.sin(f.phase + elapsed / 280) * f.amp;
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
