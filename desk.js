/* PAWS v81 desk — shows the Overnight Desk (plan B data files) inside the PAWS app.
   Data: {base}/state.json, chart.json, activity.json, screen.jpg, polled every 15 s.
   The pairing (#d=<data base>&t=<token>) is read once from the URL fragment, kept in localStorage
   and removed from the address bar. Nothing secret lives in this file.
   PAPER only: there is no buy or sell button anywhere; LIVE is shown but locked.
   FOMO links are only ever the exact strings the desk publishes (links.py); the app never builds one.
   A missing value reads "saknas"; numbers are never invented. Old Nimbus data (v80 contract) opens classic.html. */
(function () {
  "use strict";
  var LS_BASE = "nimbus_data_base", LS_TOKEN = "nimbus_app_token", POLL_MS = 15000;
  var BOTS = [
    { id: "scanner", n: "Scanner", c: "#64d2ff", r: "Hittar nya pumpfun-pooler" },
    { id: "analyst", n: "Analyst", c: "#ffd60a", r: "8 lager + social, score 0–100" },
    { id: "brain", n: "Brain", c: "#bf5af2", r: "Storlek per trade" },
    { id: "executor", n: "Executor", c: "#00d35a", r: "Klickar Köp och tar vinst" },
    { id: "risk", n: "Risk", c: "#ff6b9a", r: "Vaktar öppna positioner" }
  ];
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function num(v) { if (v == null || v === "") return null; var n = Number(v); return isFinite(n) ? n : null; }
  function pick(o) { for (var i = 1; i < arguments.length; i++) { var k = arguments[i]; if (o && o[k] != null && o[k] !== "") return o[k]; } return null; }
  function money(n) { return Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function usd(v) { var n = num(v); return n == null ? "saknas" : (n < 0 ? "-$" : "$") + money(n); }
  function sUsd(v) { var n = num(v); return n == null ? "saknas" : (n < 0 ? "-$" : "+$") + money(n); }
  function sPct(v, d) { var n = num(v); return n == null ? "saknas" : (n >= 0 ? "+" : "") + n.toFixed(d == null ? 2 : d) + "%"; }
  function tsMs(iso) { if (typeof iso === "number") return iso < 1e12 ? iso * 1000 : iso; var s = String(iso || ""); if (!s) return NaN; if (/^\d{4}-\d\d-\d\d \d/.test(s)) s = s.replace(" ", "T"); if (/T/.test(s) && !/[zZ]|[+-]\d\d:?\d\d$/.test(s)) s += "Z"; return Date.parse(s); }
  var TZ = "Europe/Stockholm";
  function hm(iso) { var t = tsMs(iso); if (!isFinite(t)) return "saknas"; return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(t)); }
  function hms(iso) { var t = tsMs(iso); if (!isFinite(t)) return "saknas"; return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(t)); }
  function dayKey(t) { return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(t)); }
  function dayLabel(iso) { var t = tsMs(iso); if (!isFinite(t)) return "Tid saknas"; var k = dayKey(t); if (k === dayKey(Date.now())) return "Idag"; if (k === dayKey(Date.now() - 864e5)) return "Igår"; return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, day: "numeric", month: "long" }).format(new Date(t)); }
  function ageS(iso) { var t = tsMs(iso); return isFinite(t) ? Math.max(0, (Date.now() - t) / 1000) : Infinity; }
  function sym(s) { if (!s) return "saknas"; s = String(s); return s.charAt(0) === "$" ? s : "$" + s; }
  function safeUrl(u) { if (typeof u !== "string") return null; return /^https:\/\/fomo\.family\//.test(u) ? u : null; }
  function fomoLink(url, label) { var u = safeUrl(url); if (!u) return null; var a = el("a", "fomo", label || "Öppna på FOMO"); a.href = u; a.target = "_blank"; a.rel = "noopener"; a.addEventListener("click", function (e) { e.stopPropagation(); }); return a; }
  function swap(host, tmp) { if (tmp.innerHTML === host.innerHTML) return; host.innerHTML = ""; while (tmp.firstChild) host.appendChild(tmp.firstChild); }
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- pairing ---------- */
  function loadConfig() {
    var hash = (location.hash || "").replace(/^#/, ""), frag = {};
    if (hash) hash.split("&").forEach(function (p) { var i = p.indexOf("="); if (i > 0) { try { frag[decodeURIComponent(p.slice(0, i))] = decodeURIComponent(p.slice(i + 1)); } catch (e) {} } });
    if (frag.d) { try { localStorage.setItem(LS_BASE, frag.d); } catch (e) {} }
    if (frag.t) { try { localStorage.setItem(LS_TOKEN, frag.t); } catch (e) {} }
    if (frag.d || frag.t) { try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {} }
    var base = null; try { base = localStorage.getItem(LS_BASE); } catch (e) {}
    if (window.__DESK_DATA_BASE__) base = window.__DESK_DATA_BASE__;
    if (base && !/^https:\/\//i.test(base) && !window.__DESK_DATA_BASE__) base = null;
    return { base: base ? base.replace(/\/+$/, "") : null };
  }
  var cfg = loadConfig();

  /* ---------- tabs + swipe ---------- */
  var TABS = ["home", "agenter", "trades", "konto"], tabIndex = 0;
  function showTab(name) {
    var i = TABS.indexOf(name); if (i < 0) i = 0; tabIndex = i;
    $("track").style.transform = "translateX(" + (-100 * i) + "%)";
    document.querySelectorAll(".tab").forEach(function (b) { b.classList.toggle("on", b.dataset.tab === TABS[i]); });
  }
  document.querySelectorAll(".tab").forEach(function (b) { b.addEventListener("click", function () { $("track").classList.add("anim"); showTab(b.dataset.tab); }); });
  document.querySelectorAll("[data-go]").forEach(function (b) { b.addEventListener("click", function () { $("track").classList.add("anim"); showTab(b.dataset.go); }); });
  (function swipe() {
    var sx = 0, sy = 0, on = false;
    $("pager").addEventListener("touchstart", function (e) { if (e.target.closest(".carousel,.rng,.cv-wrap")) { on = false; return; } on = true; sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    $("pager").addEventListener("touchend", function (e) {
      if (!on) return; on = false; var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { $("track").classList.add("anim"); showTab(TABS[Math.max(0, Math.min(TABS.length - 1, tabIndex + (dx < 0 ? 1 : -1)))]); }
    }, { passive: true });
  })();

  /* ---------- balance odometer ---------- */
  var lastBalTxt = null;
  function renderBalance(v) {
    var host = $("bal"), n = num(v);
    if (n == null) { host.className = "bal miss"; host.innerHTML = '<span class="bal-i">saknas</span>'; lastBalTxt = null; return; }
    host.className = "bal";
    var txt = "$" + money(n), whole = txt.slice(0, -3), cents = txt.slice(-3);
    if (txt === lastBalTxt) return;
    var prev = lastBalTxt; lastBalTxt = txt; host.innerHTML = "";
    whole.split("").forEach(function (ch, i) {
      var s = el("span", "dg", ch);
      if (!reduce && prev && prev.charAt(i) !== ch && /\d/.test(ch)) { s.style.transform = "translateY(-.35em)"; s.style.transitionDelay = (i * 30) + "ms"; requestAnimationFrame(function () { requestAnimationFrame(function () { s.style.transform = ""; }); }); }
      host.appendChild(s);
    });
    host.appendChild(el("span", "cents", cents));
  }

  /* ---------- chart ---------- */
  var chartData = { pts: [], marks: [], start: null }, range = "LIVE";
  var RANGE_MS = { LIVE: 30 * 60e3, "1H": 3600e3, "4H": 4 * 3600e3, "1D": 864e5, "1W": 7 * 864e5, ALL: Infinity };
  function normChart(c) {
    c = c || {};
    var src = c.points || c.series || c.balance || [];
    var pts = [];
    (Array.isArray(src) ? src : []).forEach(function (p) {
      var t, v;
      if (Array.isArray(p)) { t = tsMs(p[0]); v = num(p[1]); } else if (p) { t = tsMs(pick(p, "ts", "t", "time")); v = num(pick(p, "value", "v", "balance")); }
      if (isFinite(t) && v != null) pts.push({ t: t, v: v });
    });
    pts.sort(function (a, b) { return a.t - b.t; });
    var marks = (Array.isArray(c.marks) ? c.marks : []).map(function (m) { return { t: tsMs(pick(m, "ts", "t")), kind: String(pick(m, "kind") || ""), label: String(pick(m, "label", "title") || "") }; }).filter(function (m) { return isFinite(m.t) && m.label; });
    return { pts: pts, marks: marks, start: num(pick(c, "night_start", "start")) };
  }
  function drawChart() {
    var cv = $("chart"), wrap = cv.parentNode, W = wrap.clientWidth, H = wrap.clientHeight, dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    var g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    var marksHost = $("marks"); marksHost.innerHTML = "";
    var all = chartData.pts, span = RANGE_MS[range], last = all.length ? all[all.length - 1].t : Date.now();
    var pts = span === Infinity ? all : all.filter(function (p) { return p.t >= last - span; });
    if (pts.length < 2 && all.length >= 2) pts = all.slice(-2);
    if (pts.length < 2) { $("eq-note").textContent = all.length ? "1 punkt" : "inga punkter ännu"; g.strokeStyle = "rgba(255,255,255,.35)"; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke(); return; }
    var lo = Infinity, hi = -Infinity; pts.forEach(function (p) { lo = Math.min(lo, p.v); hi = Math.max(hi, p.v); });
    var st = chartData.start; if (st != null) { lo = Math.min(lo, st); hi = Math.max(hi, st); }
    if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
    var t0 = pts[0].t, t1 = pts[pts.length - 1].t, pad = 6;
    function X(t) { return pad + (t1 === t0 ? 0 : (t - t0) / (t1 - t0)) * (W - 2 * pad); }
    function Y(v) { return pad + (1 - (v - lo) / (hi - lo)) * (H - 2 * pad); }
    if (st != null) { g.save(); g.setLineDash([4, 5]); g.strokeStyle = "rgba(255,255,255,.4)"; g.lineWidth = 1; g.beginPath(); g.moveTo(0, Y(st)); g.lineTo(W, Y(st)); g.stroke(); g.restore(); }
    var grad = g.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, "rgba(156,245,198,.38)"); grad.addColorStop(1, "rgba(156,245,198,0)");
    g.beginPath(); pts.forEach(function (p, i) { if (i) g.lineTo(X(p.t), Y(p.v)); else g.moveTo(X(p.t), Y(p.v)); });
    g.lineTo(X(t1), H); g.lineTo(X(t0), H); g.closePath(); g.fillStyle = grad; g.fill();
    g.beginPath(); pts.forEach(function (p, i) { if (i) g.lineTo(X(p.t), Y(p.v)); else g.moveTo(X(p.t), Y(p.v)); });
    g.strokeStyle = "#9CF5C6"; g.lineWidth = 2.2; g.lineJoin = "round"; g.stroke();
    var lp = pts[pts.length - 1]; g.fillStyle = "#fff"; g.beginPath(); g.arc(X(lp.t), Y(lp.v), 4, 0, 7); g.fill();
    $("eq-note").textContent = pts.length + " punkter · " + hm(lp.t);
    var rows = [];
    chartData.marks.filter(function (m) { return m.t >= t0 && m.t <= t1; }).forEach(function (m) {
      var x = X(m.t), row = 0; while (rows[row] != null && x - rows[row] < 70) row++; rows[row] = x;
      var near = pts.reduce(function (b, p) { return Math.abs(p.t - m.t) < Math.abs(b.t - m.t) ? p : b; }, pts[0]);
      var k = /buy|bought|köp/i.test(m.kind) ? "buy" : /stop|loss|-/i.test(m.kind + m.label.charAt(0)) ? "loss" : "win";
      var d = el("span", "mk " + k, m.label); d.style.left = Math.max(30, Math.min(W - 30, x)) + "px"; d.style.top = Math.max(14, Y(near.v) - 6 - row * 18) + "px"; marksHost.appendChild(d);
    });
  }
  $("rng").addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; range = b.dataset.r; $("rng").querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x === b); }); drawChart(); });
  window.addEventListener("resize", drawChart);

  /* ---------- bots ---------- */
  function botsOf(state) {
    var b = state.bots || state.bot_cards || {}, out = {};
    if (Array.isArray(b)) b.forEach(function (x) { if (x && (x.id || x.name)) out[String(x.id || x.name).toLowerCase()] = x; }); else out = b;
    return out;
  }
  function botStatus(state, id) {
    var b = botsOf(state)[id] || {}, hb = (state.heartbeats || {})[id];
    var st = String(pick(b, "status") || "").toLowerCase();
    if (st === "paused" || st === "pausad") return { s: "off", label: "Pausad" };
    var age = ageS(pick(b, "heartbeat", "last_seen") || hb);
    if (age <= 120) return { s: "on", label: "Igång" };
    if (isFinite(age)) return { s: "off", label: "Tyst sedan " + hm(pick(b, "heartbeat", "last_seen") || hb) };
    return { s: "na", label: "saknas" };
  }
  function ring(score) {
    var s = num(score), NS = "http://www.w3.org/2000/svg", svg = document.createElementNS(NS, "svg"); svg.setAttribute("viewBox", "0 0 48 48"); svg.setAttribute("class", "ring2");
    var c1 = document.createElementNS(NS, "circle"); c1.setAttribute("cx", 24); c1.setAttribute("cy", 24); c1.setAttribute("r", 19); c1.setAttribute("fill", "none"); c1.setAttribute("stroke", "#FFDDE3"); c1.setAttribute("stroke-width", 6); svg.appendChild(c1);
    if (s != null) { var c2 = document.createElementNS(NS, "circle"); c2.setAttribute("cx", 24); c2.setAttribute("cy", 24); c2.setAttribute("r", 19); c2.setAttribute("fill", "none"); c2.setAttribute("stroke", s >= 70 ? "#2FD28A" : "#ff6b81"); c2.setAttribute("stroke-width", 6); c2.setAttribute("stroke-linecap", "round"); c2.setAttribute("stroke-dasharray", (119.4 * Math.max(0, Math.min(100, s)) / 100) + " 200"); c2.setAttribute("transform", "rotate(-90 24 24)"); svg.appendChild(c2); }
    var t = document.createElementNS(NS, "text"); t.setAttribute("x", 24); t.setAttribute("y", 29); t.setAttribute("text-anchor", "middle"); t.setAttribute("style", "font:800 14px var(--f);fill:#3B1228"); t.textContent = s == null ? "–" : String(Math.round(s)); svg.appendChild(t);
    return svg;
  }
  function botCard(state, def, full) {
    var b = botsOf(state)[def.id] || {}, st = botStatus(state, def.id);
    var c = el("div", full ? "agc" : "bc");
    var h = el("div", "bc-h"); var d = el("span", "dot"); d.style.background = def.c; h.appendChild(d); h.appendChild(el("strong", null, def.n)); h.appendChild(el("span", "sp"));
    h.appendChild(el("span", "stt " + st.s, st.label));
    if (full) { var sw = el("span", "sw" + (st.s === "off" ? " off" : "")); sw.title = "Paus styrs via Telegram (plan B)"; h.appendChild(sw); }
    c.appendChild(h);
    var count = num(pick(b, "count", "today", "n"));
    var big, sub = pick(b, "detail", "subtitle");
    if (def.id === "scanner") big = count == null ? "saknas" : count + " pooler";
    else if (def.id === "analyst") big = count == null ? "saknas" : count + " granskade";
    else if (def.id === "brain") { var sz = num(pick(b, "size_usd")), pc = num(pick(b, "pct_cash")); big = sz == null ? "Storlek" : usd(sz) + (pc != null ? " · " + pc.toFixed(1) + "% av kassan" : ""); sub = sub || pick(b, "rule") || "80+ = full storlek · under 80 = halv"; }
    else if (def.id === "executor") big = count == null ? "saknas" : count + " trades";
    else big = pick(b, "headline") || (st.s === "on" ? "Vaktar" : "saknas");
    if (pick(b, "headline") && def.id !== "risk") big = String(b.headline);
    var top = el("div", null); top.style.display = "flex"; top.style.alignItems = "center"; top.style.gap = "10px";
    var tx = el("div"); tx.style.flex = "1"; tx.style.minWidth = "0"; tx.appendChild(el("div", "bc-big", big)); tx.appendChild(el("div", "bc-sub", sub || def.r)); top.appendChild(tx);
    if (def.id === "analyst") top.appendChild(ring(pick(b, "score", "last_score")));
    c.appendChild(top);
    if (def.id === "scanner" && Array.isArray(b.feed) && b.feed.length) {
      var f = el("div", "feed"); b.feed.slice(0, full ? 6 : 3).forEach(function (x) { var pass = /pass|→|analyst/i.test(String(x.verdict || "")); f.appendChild(el("div", pass ? "fp" : "fk", sym(x.symbol) + (pass ? " → Analyst" : " · " + (x.reason || "stoppad")))); }); c.appendChild(f);
    }
    if (def.id === "analyst") {
      var ly = el("div", "lyr"), L = Array.isArray(b.layers) ? b.layers : [];
      for (var i = 0; i < 8; i++) { var x = L[i], k = x == null ? "" : (x === true || x.pass === true || x.pass === 1) ? "ok" : (x === false || x.pass === false || x.pass === 0) ? "no" : ""; ly.appendChild(el("i", k)); }
      c.appendChild(ly);
      if (num(b.social_pts) != null) c.appendChild(el("div", "bc-sub", "Social " + (b.social_pts >= 0 ? "+" : "") + b.social_pts));
    }
    if (def.id === "executor" && pick(b, "bar")) { c.appendChild(el("div", "bc-sub", String(b.bar))); var br = el("div", "bar"), bb = el("b"); bb.style.width = Math.max(0, Math.min(100, num(b.bar_pct) || 0)) + "%"; br.appendChild(bb); c.appendChild(br); }
    if (def.id === "risk") { var p = el("div", "pills"); p.appendChild(el("span", "pl r", "stop " + (num(b.stop_pct) != null ? "-" + Math.abs(b.stop_pct) + "%" : "saknas"))); p.appendChild(el("span", "pl g", "trail " + (num(b.trail_pct) != null ? b.trail_pct + "%" : "saknas"))); c.appendChild(p); }
    if (full) {
      var ds = Array.isArray(b.decisions) ? b.decisions.slice(0, 20) : [];
      var dec = el("div", "dec");
      if (!ds.length) dec.appendChild(el("div", null, "Inga beslut publicerade ännu"));
      ds.forEach(function (x) { var r = el("div"); r.appendChild(el("b", null, (x.symbol ? sym(x.symbol) + " · " : "") + (x.verdict || "") + (x.reason ? " · " + x.reason : ""))); var a = fomoLink(x.coin_url, "FOMO"); r.appendChild(a || el("span", null, hm(x.ts))); dec.appendChild(r); });
      c.appendChild(dec);
    }
    c.style.borderTop = "3px solid " + def.c;
    return c;
  }

  /* ---------- live screen ---------- */
  var frontA = true, lastShotKey = null, lastScreenOkTs = null;
  function refreshScreen(state) {
    if (!cfg.base) return;
    var sts = pick(state, "screen_ts", "frame_ts");
    var key = sts || Math.floor(Date.now() / POLL_MS);
    if (key === lastShotKey) return updateLiveLabels(state);
    var next = frontA ? $("scr-b") : $("scr-a"), cur = frontA ? $("scr-a") : $("scr-b");
    var img = new Image();
    img.onload = function () { next.src = img.src; next.classList.add("show"); cur.classList.remove("show"); frontA = !frontA; lastShotKey = key; lastScreenOkTs = sts || new Date().toISOString(); $("live-empty").hidden = true; $("fs-img").src = img.src; updateLiveLabels(state); };
    img.onerror = function () { updateLiveLabels(state); };
    img.src = cfg.base + "/screen.jpg?k=" + encodeURIComponent(String(key));
  }
  function updateLiveLabels(state) {
    var l = $("lv-l"), fresh = lastScreenOkTs && ageS(lastScreenOkTs) < 30;
    var paused = state && /private|privat/i.test(String(pick(state, "screen_status") || ""));
    l.className = "lv-l" + (fresh && !paused ? " on" : "");
    l.lastChild.textContent = paused ? "Pausad · privat" : !lastScreenOkTs ? "Väntar på bild" : fresh ? "Live · Botens dator" : "Senaste bild " + hm(lastScreenOkTs);
    var lane = (state && state.lane) || {}, r = $("lv-r"), def = BOTS.filter(function (b) { return b.id === String(lane.bot || "").toLowerCase(); })[0];
    r.textContent = def ? def.n + (lane.action ? " · " + lane.action : "") : "Vilar"; r.style.color = def ? def.c : "#fff";
    var fl = $("fs-fomo"), u = safeUrl(pick(lane, "coin_url") || pick(state || {}, "screen_coin_url")); if (u) { fl.href = u; fl.hidden = false; } else fl.hidden = true;
  }
  function renderLastOrder(state) {
    var o = state.last_order, host = $("lastord"); host.innerHTML = "";
    if (!o) { host.textContent = "Ingen order ännu"; return; }
    host.appendChild(el("span", null, (o.title || ((o.side === "sell" ? "Sålde " : "Köpte ") + sym(o.symbol))) + " · " + usd(pick(o, "usd", "fill_usd")) + " · " + (o.status === "done" ? "verifierad" : (o.status || "saknas"))));
    var ck = el("span", "chk");
    [["screen_ok", "S"], ["api_ok", "A"], ["chain_ok", "K"]].forEach(function (k) { var v = o[k[0]], i = el("i", v === true || v === 1 ? "ok" : v === false || v === 0 ? "no" : "", k[1]); i.title = k[0]; ck.appendChild(i); });
    host.appendChild(ck);
  }
  $("live").addEventListener("click", function () { if (!$("fs-img").src) return; $("fs").hidden = false; });
  $("fs-x").addEventListener("click", function () { $("fs").hidden = true; });

  /* ---------- rows ---------- */
  var ICON = { bought: "M12 5v14M5 12h14", sold: "M7 17L17 7M8 7h9v9", stopped: "M7 7l10 10M17 8v9H8", rejected: "M6 6l12 12M18 6L6 18" };
  var KIND_SV = { bought: "KÖP", sold: "SÅLD", stopped: "STOPP", rejected: "AVVISAD" };
  function actRow(a) {
    var kind = String(a.kind || "").toLowerCase(), row = el("div", "row tap");
    var ic = el("span", "av ic" + (kind === "sold" ? " tp" : kind === "stopped" ? " sl" : kind === "rejected" ? " rj" : ""));
    ic.innerHTML = '<svg viewBox="0 0 24 24"><path d="' + (ICON[kind] || ICON.bought) + '"/></svg>'; row.appendChild(ic);
    var m = el("div", "row-m"); m.appendChild(el("strong", null, a.title || "saknas"));
    var sp = el("span"); var bd = el("i", "badge" + (kind === "sold" ? " s" : kind === "stopped" ? " sl" : ""), KIND_SV[kind] || kind.toUpperCase()); bd.style.fontStyle = "normal"; sp.appendChild(bd);
    sp.appendChild(document.createTextNode(a.subtitle || ((a.bot || "") + " · " + hm(a.ts)))); m.appendChild(sp); row.appendChild(m);
    var val = String(a.value == null ? "" : a.value), cls = /^\+/.test(val) ? " up" : /^-/.test(val) ? " down" : "";
    var vp = val.split(" · "), vv = el("div", "row-v" + cls, vp[0] || (kind === "rejected" ? "Skippad" : "saknas"));
    if (vp.length > 1) vv.appendChild(el("small", null, vp.slice(1).join(" · "))); row.appendChild(vv);
    var s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("class", "chev"); s.innerHTML = '<path d="M9 6l6 6-6 6"/>'; row.appendChild(s);
    row.addEventListener("click", function () { openWhy(a); });
    return row;
  }
  function posRow(p) {
    var row = el("div", "row tap"), s = String(p.symbol || p.name || "?").replace(/^\$/, "");
    var av = el("span", "av", s.slice(0, 2).toUpperCase()), h = hueOf(s); av.style.setProperty("--h1", h[0]); av.style.setProperty("--h2", h[1]); row.appendChild(av);
    var m = el("div", "row-m"); m.appendChild(el("strong", null, sym(p.symbol || p.name)));
    m.appendChild(el("span", null, "Köpt " + hm(p.opened_at) + " · " + usd(p.size_usd) + " in · Executor")); row.appendChild(m);
    var pnl = num(p.pnl_usd), v = el("div", "row-v" + (pnl == null ? "" : pnl < 0 ? " down" : " up"), pnl == null ? "pris saknas" : sUsd(pnl));
    if (num(p.pnl_pct) != null) v.appendChild(el("small", null, sPct(p.pnl_pct, 1))); row.appendChild(v);
    row.addEventListener("click", function () { openPos(p); });
    return row;
  }

  var HUES = [["#A23F69","#BE5A84"],["#8E3A5E","#B04F79"],["#B04A78","#C45F8E"],["#7D3354","#A64B73"],["#9A3D73","#B9568A"]];
  function hueOf(s) { var n = 0; s = String(s || "?"); for (var i = 0; i < s.length; i++) n += s.charCodeAt(i); return HUES[n % HUES.length]; }

  /* ---------- Varför sheet ---------- */
  function kvr(k, v, cls) { var d = el("div", "kvr"); d.appendChild(el("span", null, k)); d.appendChild(el("b", v == null || v === "saknas" ? "miss" : cls || "", v == null ? "saknas" : String(v))); return d; }
  function block(title, kids) { var w = el("div", "wy"); w.appendChild(el("h4", null, title)); kids.forEach(function (k) { if (k) w.appendChild(k); }); return w; }
  function openSheet(title, sub, body) { $("sheet-title").textContent = title; $("sheet-sub").textContent = sub; var b = $("sheet-body"); b.innerHTML = ""; body.forEach(function (x) { if (x) b.appendChild(x); }); $("sheet").hidden = false; }
  function closeSheet() { $("sheet").hidden = true; }
  $("sheet-x").addEventListener("click", closeSheet); $("sheet-scrim").addEventListener("click", closeSheet);
  function openWhy(a) {
    var why = a.why || a.reason || null, kind = String(a.kind || "").toLowerCase();
    var parts = [block("Vad hände", [kvr("Händelse", KIND_SV[kind] || kind), kvr("Bot", a.bot), kvr("Tid", hms(a.ts)), kvr("Värde", a.value)])];
    var wp = el("p", why ? "" : "miss", why ? String(typeof why === "string" ? why : JSON.stringify(why)) : (a.subtitle || "Desken har inte publicerat något skäl för raden"));
    parts.push(block("Varför", [wp]));
    var L = Array.isArray(a.layers) ? a.layers : null;
    if (L) { var gl = el("div", "gl"); L.slice(0, 8).forEach(function (x) { var ok = x.pass === true || x.pass === 1, no = x.pass === false || x.pass === 0; var s = el("span", ok ? "" : no ? "no" : "na"); s.appendChild(el("i", null, ok ? "✓" : no ? "✕" : "–")); s.appendChild(document.createTextNode((x.name || "lager") + (x.value_text ? " · " + x.value_text : ""))); gl.appendChild(s); }); parts.push(block("8 lager", [gl])); }
    var link = fomoLink(a.coin_url); if (link) { link.className = "btn"; link.style.marginTop = "12px"; parts.push(link); }
    openSheet(a.title || "Varför", (a.bot || "") + " · " + hm(a.ts) + " · PAPER", parts);
  }
  function openPos(p) {
    var parts = [block("Position", [kvr("Insats", usd(p.size_usd)), kvr("Entry", p.entry_price), kvr("Nu", pick(p, "price", "current_price")), kvr("P&L", pnl(p), num(p.pnl_usd) == null ? "" : num(p.pnl_usd) < 0 ? "down" : "up"), kvr("Stopp", p.stop_price), kvr("Öppnad", hms(p.opened_at))])];
    var link = fomoLink(p.coin_url); if (link) { link.className = "btn"; link.style.marginTop = "12px"; parts.push(link); }
    openSheet(sym(p.symbol || p.name), "Executor · PAPER · ingen säljknapp i appen", parts);
  }
  function pnl(p) { var n = num(p.pnl_usd); return n == null ? "saknas" : sUsd(n) + (num(p.pnl_pct) != null ? " (" + sPct(p.pnl_pct, 1) + ")" : ""); }

  /* ---------- render ---------- */
  var lastState = null, lastAct = [], lastOkAt = null;
  function render(state, act, chart) {
    lastState = state;
    var mode = String(state.mode || "PAPER").toUpperCase();
    $("paper-pill").hidden = mode !== "PAPER"; $("mode-decal").lastChild.textContent = mode === "LIVE" ? "LIVE" : "PAPER";
    renderBalance(pick(state, "balance", "balance_usd", "equity"));
    var tp = num(pick(state, "today_pct")); var td = $("today"); td.className = "pnl" + (tp == null ? "" : tp < 0 ? " down" : " up"); td.textContent = tp == null ? "idag saknas" : sPct(tp) + " idag";
    var mu = num(pick(state, "multiplier")); $("mult").hidden = mu == null; if (mu != null) $("mult").textContent = mu.toFixed(2) + "×";
    $("cash").textContent = usd(pick(state, "cash", "free_cash"));
    var pos = state.positions || state.open_positions || [];
    $("nopen").textContent = Array.isArray(pos) ? String(pos.length) : "saknas"; $("open-tag").textContent = Array.isArray(pos) ? pos.length : 0;
    if (chart) { chartData = normChart(chart); if (chartData.start == null) chartData.start = num(pick(state, "night_start")); drawChart(); }
    // pipeline
    var tmp = el("div"), running = 0;
    BOTS.forEach(function (d, i) { var st = botStatus(state, d.id); if (st.s === "on") running++; var p = el("div", "pp " + st.s); p.appendChild(el("span", "nd", String(i + 1))); p.appendChild(el("b", "s", d.n)); p.appendChild(el("em", null, st.s === "on" ? "igång" : st.s === "off" ? "vilar" : "saknas")); tmp.appendChild(p); });
    swap($("pipe"), tmp);
    $("bots-h").textContent = "Agenter · " + running + " av 5 igång"; $("ag-tag").textContent = running + "/5 igång";
    var car = el("div"); BOTS.forEach(function (d) { car.appendChild(botCard(state, d, false)); }); swap($("carousel"), car);
    var al = el("div"); BOTS.forEach(function (d) { al.appendChild(botCard(state, d, true)); }); swap($("agent-list"), al);
    // positions
    var pl = el("div"); if (!Array.isArray(pos) || !pos.length) pl.appendChild(el("div", "empty", "Väntar på första traden")); else pos.forEach(function (p) { pl.appendChild(posRow(p)); }); swap($("open-list"), pl);
    // activity
    if (act) lastAct = act;
    var rc = el("div"); if (!lastAct.length) rc.appendChild(el("div", "empty", "Inget ännu i natt")); else lastAct.slice(0, 5).forEach(function (a) { rc.appendChild(actRow(a)); }); $("recent").innerHTML = ""; while (rc.firstChild) $("recent").appendChild(rc.firstChild);
    var tr = $("trades"); tr.innerHTML = "";
    if (!lastAct.length) { var l0 = el("div", "list"); l0.appendChild(el("div", "empty", "Inget ännu i natt")); tr.appendChild(l0); }
    else { var cur = null, list = null; lastAct.forEach(function (a) { var k = dayLabel(a.ts); if (k !== cur) { cur = k; tr.appendChild(el("div", "dl", k)); list = el("div", "list"); tr.appendChild(list); } list.appendChild(actRow(a)); }); }
    var cnt = { bought: 0, sold: 0, stopped: 0, rejected: 0 }; lastAct.forEach(function (a) { var k = String(a.kind || "").toLowerCase(); if (k in cnt) cnt[k]++; });
    var sum = el("dl"); [["Köp", cnt.bought], ["Sälj", cnt.sold + cnt.stopped], ["Avvisade", cnt.rejected]].forEach(function (x) { var d = el("div"); d.appendChild(el("dt", null, x[0])); d.appendChild(el("dd", null, String(x[1]))); sum.appendChild(d); }); swap($("tr-sum"), sum);
    renderLastOrder(state); refreshScreen(state); renderAccount(state);
  }
  function renderAccount(state) {
    var links = state.links || {}, acct = el("div");
    function linkRow(title, sub, url) { var r = el("div", "row"); var m = el("div", "row-m"); m.appendChild(el("strong", null, title)); m.appendChild(el("span", null, sub)); r.appendChild(m); var a = fomoLink(url, "Öppna"); r.appendChild(a || el("div", "row-v", "saknas")); return r; }
    acct.appendChild(linkRow("Din FOMO-profil", state.fomo_handle ? "@" + String(state.fomo_handle).replace(/^@/, "") : "profil", pick(links, "profile_url", "profile")));
    acct.appendChild(linkRow("Bjud in en vän", "FOMO-inbjudan", pick(links, "signup_url", "signup")));
    var push = el("div", "row"); var pm = el("div", "row-m"); pm.appendChild(el("strong", null, "Pushar")); pm.appendChild(el("span", null, "Plan B: bara via Telegram")); push.appendChild(pm); acct.appendChild(push);
    swap($("acct"), acct);
    var sg = el("div"), S = state.settings;
    if (S && typeof S === "object" && Object.keys(S).length) {
      Object.keys(S).forEach(function (grp) { var v = S[grp], g = el("div", "setg"); g.appendChild(el("h4", null, grp)); if (v && typeof v === "object") Object.keys(v).forEach(function (k) { var r = el("div"); r.appendChild(el("span", null, k)); r.appendChild(el("b", null, String(v[k]))); g.appendChild(r); }); else { var r = el("div"); r.appendChild(el("span", null, grp)); r.appendChild(el("b", null, String(v))); g.appendChild(r); } sg.appendChild(g); });
    } else { var e = el("div", "setg"); e.appendChild(el("div", null, "Desken publicerar inga inställningar ännu")); sg.appendChild(e); }
    swap($("settings"), sg);
    var cn = el("div"); var host = "saknas"; try { host = new URL(cfg.base).host; } catch (e) {}
    [["Desk", host], ["Senaste data", pick(state, "ts") ? hms(state.ts) : "saknas"], ["Uppdatering", "var 15:e sekund"], ["Läge", String(state.mode || "PAPER")]].forEach(function (x) { var r = el("div", "row"); var m = el("div", "row-m"); m.appendChild(el("strong", null, x[0])); m.style.flex = "none"; r.appendChild(m); var vv = el("div", "row-v", x[1]); vv.style.flex = "1"; vv.style.minWidth = "0"; vv.style.fontSize = "14px"; vv.style.overflow = "hidden"; vv.style.textOverflow = "ellipsis"; vv.style.whiteSpace = "nowrap"; r.appendChild(vv); cn.appendChild(r); });
    swap($("conn"), cn);
  }

  /* ---------- polling ---------- */
  var timer = null, retryAt = 0, failing = false;
  function fetchJson(name, optional) {
    return fetch(cfg.base + "/" + name, { cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer" }).then(function (r) {
      if (!r.ok) { if (optional) return null; throw new Error(name + " http " + r.status); }
      return r.json();
    }).catch(function (e) { if (optional) return null; throw e; });
  }
  function isOldContract(s) { return s && (s.challenge != null || s.pipeline != null || s.journal != null) && !(s.heartbeats && s.heartbeats.brain) && s.hosting !== "B"; }
  function setChip(cls, txt) { $("live-chip").className = "live-chip " + cls; $("live-txt").textContent = txt; }
  function poll() {
    if (window.__DESK_MOCK__) { var M = window.__DESK_MOCK__; render(M.state, (M.activity || {}).items || [], M.chart); setChip("warn", "DEMO-data"); return; }
    if (!cfg.base) { $("boot").hidden = false; setChip("off", "Ej kopplad"); return; }
    if (document.hidden) return;
    Promise.all([fetchJson("state.json"), fetchJson("activity.json", true), fetchJson("chart.json", true)]).then(function (r) {
      var s = r[0] || {};
      if (isOldContract(s)) { location.replace("classic.html"); return; }
      var act = r[1] ? (r[1].items || r[1].rows || (Array.isArray(r[1]) ? r[1] : [])) : null;
      failing = false; $("err").hidden = true; lastOkAt = Date.now(); $("boot").hidden = true;
      render(s, act, r[2]);
      var age = ageS(s.ts);
      if (age < 60) setChip("on", "Live"); else setChip("warn", "Senast " + hm(s.ts));
    }).catch(function (e) {
      failing = true; retryAt = Date.now() + POLL_MS; setChip("off", "Offline");
      if (!lastState) $("boot").hidden = false;
      tickErr(); if (window.console) console.warn("desk poll failed", e && e.message);
    });
  }
  function tickErr() {
    if (!failing) return;
    var n = Math.max(0, Math.round((retryAt - Date.now()) / 1000));
    $("err").hidden = false; $("err").textContent = "Desk offline · försöker igen om " + n + " s · senast uppdaterad " + (lastOkAt ? hms(new Date(lastOkAt).toISOString()) : "aldrig");
  }
  setInterval(tickErr, 1000);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) poll(); });
  if ("serviceWorker" in navigator && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) navigator.serviceWorker.register("./sw.js").catch(function () {});
  // loading skeletons
  ["open-list", "recent"].forEach(function (id) { $(id).appendChild(el("div", "skc")); });
  showTab("home");
  window.PawsDesk = { render: render, showTab: showTab, poll: poll };
  poll(); timer = setInterval(poll, POLL_MS);
})();
