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
      var ic = el("span", "oc-row-ico"); ic.style.setProperty("--c", COLOR[r.agent] || "#43DAF6");
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
    /* Bubbles: 18 dots, 5–15 px, 30–50 % opacity, none when reduced motion is on. */
    var sea = $("oc-bubbles");
    if (sea && !reducedMotion()) {
      for (var i = 0; i < 18; i++) {
        var b = el("i"); var s = 5 + (i * 7 % 11);
        b.style.cssText = "left:" + ((i * 37) % 100) + "%;width:" + s + "px;height:" + s + "px;--o:" + (0.3 + (i % 6) * 0.033).toFixed(2) + ";animation-delay:-" + ((i * 1.7) % 14).toFixed(1) + "s;animation-duration:" + (10 + (i * 3) % 9) + "s";
        sea.appendChild(b);
      }
    }
    bootFish();
  }

  /* ---------- t274 fish: decorative unless a real closed PAPER trade is supplied ---------- */
  var WHALE = [
    { fill: "#3BA3FF", mid: "#1E88E5" },
    { fill: "#26C6C0", mid: "#00897B" },
    { fill: "#A98BFF", mid: "#7E57C2" },
    { fill: "#FF7AB6", mid: "#EC407A" },
    { fill: "#FF9A3C", mid: "#FB8C00" },
    { fill: "#FFD23F", mid: "#F9A825", scale: 1.5 }
  ];
  var MAX_FISH = 3, SWIM_MS = 2500;
  var fishHost = null, liveFish = [], fishRaf = 0, spawnTimer = 0;
  var seenTrade = {}, tradeQueue = [], colorIx = 0, fishPaused = false, pauseAt = 0, fishWired = false;

  function reducedMotion() {
    return !!(g.matchMedia && g.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function whaleSvg(c) {
    return '<svg class="oc-critter oc-whale" viewBox="0 0 140 70">' +
      '<path fill="' + c.mid + '" d="M28 35 C 10 20 0 12 6 6 C 16 18 26 26 36 32"/>' +
      '<path fill="' + c.mid + '" d="M28 35 C 10 50 0 58 6 64 C 16 52 26 44 36 38"/>' +
      '<path fill="' + c.fill + '" d="M32 35 C 36 16 62 8 92 12 C 116 16 132 24 134 34 C 132 50 112 60 84 60 C 54 60 36 50 32 35 Z"/>' +
      '<ellipse cx="88" cy="44" rx="30" ry="10" fill="#fff" opacity=".25"/>' +
      '<path fill="' + c.mid + '" d="M70 50 Q 66 66 86 58 Z"/>' +
      '<path fill="' + c.mid + '" d="M78 16 Q 84 6 94 14" />' +
      '<circle cx="114" cy="30" r="3.3" fill="#0A1630"/>' +
      '<circle cx="115.2" cy="29" r="1.15" fill="#fff"/>' +
      '<path d="M122 38 Q 126 42 116 42" fill="none" stroke="#0A1630" stroke-width="1.4" stroke-linecap="round"/>' +
      "</svg>";
  }
  function sharkSvg() {
    return '<svg class="oc-critter oc-shark" viewBox="0 0 150 70">' +
      '<path class="oc-shark-body" fill="#4A5568" d="M20 35 L 48 20 Q 90 8 124 30 L 148 35 L 124 40 Q 90 62 48 50 Z"/>' +
      '<path class="oc-shark-fin" fill="#3A4454" d="M74 18 L 88 2 L 98 20 Z"/>' +
      '<path class="oc-shark-tail" fill="#3A4454" d="M24 35 L 2 8 L 14 35 L 2 62 Z"/>' +
      '<path class="oc-shark-pec" fill="#3A4454" d="M70 46 L 58 66 L 86 52 Z"/>' +
      '<polygon fill="#F5F5F5" points="118,34 122,40 124,34 128,40 130,34 134,40 136,34"/>' +
      '<circle cx="116" cy="28" r="2.6" fill="#0A0A0A"/>' +
      '<path d="M98 30 Q 98 38 92 38" fill="none" stroke="#2A3340" stroke-width="1.5"/>' +
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
    var y = Math.random() < 0.5 ? (0.20 + Math.random() * 0.10) : (0.52 + Math.random() * 0.12);
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
