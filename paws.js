/* PAWS v80c — v79 + pipeline row, saldokurva, Varför-ark, Agenter-flik (same data contract). Layout C "Ljus" on the v78 engine (same data contract, swipe pager, poll cadence). Originally v75: lean app. Reads state.json exactly like v72/v71 (same storage keys, same fragment #d=..&t=.., same poll cadence).
   Real desk data only; missing values read "saknas". PAPER only: there are no order buttons anywhere. */
(function () {
  "use strict";
  var LS_BASE = "nimbus_data_base", LS_TOKEN = "nimbus_app_token", POLL_MS = 15000;
  var $ = function (id) { return document.getElementById(id); };
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function num(v) { var n = Number(v); return v == null || v === "" || !isFinite(n) ? null : n; }
  function money(n) { return Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function usd(v) { var n = num(v); return n == null ? "saknas" : (n < 0 ? "-$" : "$") + money(n); }
  function sUsd(v) { var n = num(v); return n == null ? "saknas" : (n < 0 ? "-$" : "+$") + money(n); }
  function sPct(v) { var n = num(v); return n == null ? "" : (n >= 0 ? "+" : "") + n.toFixed(1) + "%"; }
  function hm(iso) { var d = new Date(iso); if (!iso || isNaN(d)) return "saknas"; return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", hour: "2-digit", minute: "2-digit" }).format(d); }
  function dm(iso) { var d = new Date(iso); if (!iso || isNaN(d)) return "saknas"; return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d); }
  function brand(s) {
    if (typeof s !== "string") return s;
    var n = (window.NimbusBrand && NimbusBrand.name) || "PAWS";
    return s.replace(/\bDegen\b/g, n).replace(/\bSora\b/g, n).replace(/\bC\.C\b/g, n).replace(/\bChairman\b/g, n).replace(/Swipe Mode/g, n);
  }
  function sym(s) { if (!s) return "saknas"; return s.charAt(0) === "$" ? s : "$" + s; }
  function hbOk(v) { return typeof v === "string" && /^ok\b/i.test(v); }

  function loadConfig() {
    var hash = (location.hash || "").replace(/^#/, ""), frag = {};
    if (hash) hash.split("&").forEach(function (p) { var i = p.indexOf("="); if (i > 0) frag[decodeURIComponent(p.slice(0, i))] = decodeURIComponent(p.slice(i + 1)); });
    if (frag.d) { try { localStorage.setItem(LS_BASE, frag.d); } catch (e) {} }
    if (frag.t) { try { localStorage.setItem(LS_TOKEN, frag.t); } catch (e) {} }
    if (frag.d || frag.t) { try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {} }
    var base = null; try { base = localStorage.getItem(LS_BASE); } catch (e) {}
    if (window.__NIMBUS_DATA_BASE__) base = window.__NIMBUS_DATA_BASE__;
    return { dataBase: base || null };
  }

  /* ---------- new-trade detection ---------- */
  var listeners = [], seenBuy = null, last = null;
  function emitNewBuys(box, ev) {
    var fresh = [];
    var buys = (box.events || []).filter(function (e) { return e && e.action === "Köp"; });
    var openIds = (box.open || []).map(function (p) { return "o" + p.id; });
    if (seenBuy == null) {
      seenBuy = {};
      buys.forEach(function (e) { seenBuy["e" + e.id] = 1; });
      openIds.forEach(function (k) { seenBuy[k] = 1; });
      /* first paint: a buy younger than 90 s still counts as new */
      buys.forEach(function (e) { var t = Date.parse(e.ts || ""); if (isFinite(t) && Date.now() - t < 90000) fresh.push(e); });
      return fresh.slice(0, 1);
    }
    buys.forEach(function (e) { if (!seenBuy["e" + e.id]) { seenBuy["e" + e.id] = 1; fresh.push(e); } });
    (box.open || []).forEach(function (p) {
      var k = "o" + p.id;
      if (!seenBuy[k]) { seenBuy[k] = 1; if (!fresh.some(function (e) { return e.mint && e.mint === p.mint; })) fresh.push({ mint: p.mint, symbol: p.symbol, amount_usd: p.size_usd, id: "p" + p.id, ts: p.opened_at }); }
    });
    return fresh.reverse();
  }

  /* ---------- render ---------- */
var HUES = [["#A23F69","#BE5A84"],["#8E3A5E","#B04F79"],["#B04A78","#C45F8E"],["#7D3354","#A64B73"],["#9A3D73","#B9568A"]];
  function hueOf(s) { var n = 0; s = String(s || "?"); for (var i = 0; i < s.length; i++) n += s.charCodeAt(i); return HUES[n % HUES.length]; }
  function avatar(row) {
    var a = el("span", "av");
    var s = String(row.symbol || "?").replace(/^\$/, "");
    a.textContent = s.slice(0, 2).toUpperCase();
    var h = hueOf(s); a.style.setProperty("--h1", h[0]); a.style.setProperty("--h2", h[1]);
    return a;
  }
  var ICONS = {
    buy: "M12 5v14M5 12h14",
    tp: "M7 17L17 7M8 7h9v9",
    sl: "M7 7l10 10M17 8v9H8"
  };
  function iconTile(kind) {
    var t = el("span", "av ic" + (kind === "tp" ? " tp" : kind === "sl" ? " sl" : ""));
    t.innerHTML = '<svg viewBox="0 0 24 24"><path d="' + ICONS[kind] + '"/></svg>';
    return t;
  }
  function openRow(p) {
    var row = el("div", "row"); row.dataset.mint = p.mint || ""; row.dataset.pid = p.id;
    row.appendChild(avatar(p));
    var m = el("div", "row-m"); m.appendChild(el("strong", null, sym(p.symbol)));
    m.appendChild(el("span", null, "Köpt " + hm(p.opened_at) + " · " + usd(p.size_usd) + (p.entry_reason_sv ? " · " + brand(p.entry_reason_sv) : "")));
    row.appendChild(m);
    var pnl = num(p.pnl_usd), pct = num(p.pnl_pct);
    var v = el("div", "row-v " + (pnl == null ? "" : pnl < 0 ? "down" : "up"), pnl == null ? "pris saknas" : sUsd(pnl));
    if (pct != null) v.appendChild(el("small", null, sPct(pct)));
    row.appendChild(v); tapify(row, "pid");
    var lo = num(p.stop_price), hi = num(p.take_profit_price), cur = num(p.current_price);
    if (lo != null && hi != null && cur != null && hi > lo) {
      var f = Math.max(0, Math.min(1, (cur - lo) / (hi - lo)));
      var g = el("div", "gauge"); g.title = "stopp → mål";
      var b = el("b"); b.style.width = (f * 100).toFixed(1) + "%"; g.appendChild(b);
      var i = el("i"); i.style.left = (f * 100).toFixed(1) + "%"; g.appendChild(i);
      row.appendChild(g);
    }
    return row;
  }
  function evRow(e, fresh) {
    var buy = e.action === "Köp";
    var k = String(e.kind || "").toUpperCase();
    var kind = buy ? "buy" : k === "SL" ? "sl" : "tp";
    var row = el("div", "row" + (fresh ? " fresh" : "")); row.dataset.ev = e.id; row.dataset.mint = e.mint || "";
    row.appendChild(iconTile(kind));
    var m = el("div", "row-m");
    m.appendChild(el("strong", null, sym(e.symbol)));
    var sp = el("span");
    sp.appendChild(el("i", "badge" + (buy ? "" : kind === "sl" ? " sl" : " s"), buy ? "KÖP" : (e.kind && String(e.kind).toLowerCase() !== "sälj" ? String(e.kind).toUpperCase() : "SÄLJ")));
    sp.lastChild.style.fontStyle = "normal";
    sp.appendChild(document.createTextNode(hm(e.ts) + " · " + (buy ? "PAPER-köp" : (exitSv(e.reason_sv) || "sälj"))));
    m.appendChild(sp);
    row.appendChild(m);
    var v;
    if (buy) { v = el("div", "row-v", usd(e.amount_usd)); }
    else { var p = num(e.pnl_usd); v = el("div", "row-v " + (p == null ? "" : p < 0 ? "down" : "up"), sUsd(p)); if (num(e.amount_usd) != null) v.appendChild(el("small", null, usd(e.amount_usd))); }
    row.appendChild(v); tapify(row, "ev");
    return row;
  }
    function fill(host, rows, emptyText) {
    var tmp = document.createElement("div");
    if (!rows.length) tmp.appendChild(el("div", "empty", emptyText)); else rows.forEach(function (r) { tmp.appendChild(r); });
    if (tmp.innerHTML === host.innerHTML) return;
    host.innerHTML = ""; while (tmp.firstChild) host.appendChild(tmp.firstChild);
  }
function dayKey(iso) { var d = new Date(iso); if (!iso || isNaN(d)) return "okänd"; return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit" }).format(d); }
  function dayLabel(iso) {
    var k = dayKey(iso); if (k === "okänd") return "Tid saknas";
    var now = Date.now();
    if (k === dayKey(new Date(now).toISOString())) return "Idag";
    if (k === dayKey(new Date(now - 86400000).toISOString())) return "Igår";
    return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", day: "numeric", month: "long" }).format(new Date(iso));
  }
  function fillGrouped(host, evs, emptyText) {
    var tmp = document.createElement("div");
    if (!evs.length) { var l0 = el("div", "list"); l0.appendChild(el("div", "empty", emptyText)); tmp.appendChild(l0); }
    else {
      var cur = null, list = null;
      evs.forEach(function (e) {
        var k = dayKey(e.ts);
        if (k !== cur) { cur = k; tmp.appendChild(el("div", "dl", dayLabel(e.ts))); list = el("div", "list"); tmp.appendChild(list); }
        list.appendChild(evRow(e, false));
      });
    }
    if (tmp.innerHTML === host.innerHTML) return;
    host.innerHTML = ""; while (tmp.firstChild) host.appendChild(tmp.firstChild);
  }

  /* ---------- helpers for v80 ---------- */
  function tsMs(iso) { var s = String(iso || ""); if (!s) return NaN; if (/^\d{4}-\d\d-\d\d \d\d:\d\d/.test(s)) s = s.replace(" ", "T"); if (!/[zZ]|[+-]\d\d:?\d\d$/.test(s)) s += "Z"; return Date.parse(s); }
  function ago(iso) { var t = tsMs(iso); if (!isFinite(t)) return ""; var d = Math.max(0, Date.now() - t) / 1000; if (d < 90) return "nyss"; if (d < 3600) return Math.round(d / 60) + " min sedan"; if (d < 86400) return Math.round(d / 3600) + " h sedan"; return dm(iso); }
  function tapify(row, kind) {
    row.classList.add("tap"); row.tabIndex = 0; row.setAttribute("role", "button"); row.setAttribute("aria-label", "Visa varför");
    var s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("class", "chev");
    s.innerHTML = '<path d="M9 6l6 6-6 6"/>'; row.appendChild(s);
  }

  /* ---------- pipeline model: the 7 desk steps (Scanner → Rugfilter → Analyst → Sizer → Executor → Logger → Equity).
     Everything is read from state.json (heartbeats, agents, pipeline, journal, suggestions, challenge); a missing value reads "saknas". ---------- */
  var STEPS = [
    { id: "scanner", n: "Scanner", r: "Hittar nya tokens", hb: "scanner" },
    { id: "rugfilter", n: "Rugfilter", r: "Hårda stopp (rug-kontroller)", hb: "auditor" },
    { id: "analyst", n: "Analyst", r: "Score och profil", hb: "analyst" },
    { id: "sizer", n: "Sizer", r: "Storlek och stop-loss", hb: "risk" },
    { id: "executor", n: "Executor", r: "PAPER-order", hb: "executor" },
    { id: "logger", n: "Logger", r: "Orsak per beslut", hb: null },
    { id: "equity", n: "Equity", r: "Saldo och kurva", hb: null }
  ];
  function stageN(pl, key) {
    var s = ((pl && pl.stages) || []).filter(function (x) { return x && x.key === key; })[0];
    return s ? num(s.n) : null;
  }
  function lastDecision(ag, key) {
    var a = ag && ag[key], d = a && a.decisions && a.decisions[0];
    if (!d) return null;
    var txt = (d.title ? sym(d.title) + " · " : "") + (d.verdict ? String(d.verdict) : "") + (d.reason ? " · " + brand(String(d.reason)) : "");
    return { text: txt.replace(/^ · /, ""), ts: d.ts };
  }
  function hbState(hb, key) {
    if (!key) return null;
    var v = hb && hb[key];
    if (v == null) return { s: "na", label: "saknas", ts: null };
    if (hbOk(v)) { var m = /@\s*(.+)$/.exec(String(v)); return { s: "on", label: "igång", ts: m ? m[1] : null }; }
    return { s: "off", label: "vilar", ts: null };
  }
  function pipeModel(state) {
    var box = state.challenge || {}, hb = state.heartbeats || {}, ag = state.agents || {}, pl = state.pipeline || null, jr = state.journal || null, sug = state.suggestions || null;
    var win = pl ? num(pl.window_min) : null, wtxt = win != null ? "senaste " + win + " min" : "";
    var scan = stageN(pl, "scan"), strict = stageN(pl, "strict"), gates = stageN(pl, "gates"), gp = stageN(pl, "gates_pass"), fills = stageN(pl, "fills");
    var cards = sug && sug.cards ? sug.cards.length : (sug && num(sug.count) != null ? num(sug.count) : null);
    if (stageN(pl, "xrating") != null) cards = stageN(pl, "xrating");
    var evs = (box.events || []).filter(function (e) { return e && (e.action === "Köp" || e.action === "Sälj"); });
    var pts = validPoints(box), eq = num(box.equity_usd), put = num(box.put_in_usd != null ? box.put_in_usd : box.capital_usd);
    var out = [];
    STEPS.forEach(function (S) {
      var o = { id: S.id, name: S.n, role: S.r, st: hbState(hb, S.hb), val: null, sub: "", count: "", last: null, extra: "" };
      var ld = S.hb ? lastDecision(ag, S.hb) : null;
      if (S.id === "scanner") {
        o.val = scan; o.sub = win != null ? win + " min" : ""; o.count = scan == null ? "" : scan + " skannade " + wtxt;
        o.last = ld;
      } else if (S.id === "rugfilter") {
        o.val = strict; o.sub = scan != null ? "av " + scan : ""; o.count = strict == null ? "" : strict + (scan != null ? " av " + scan : "") + " klarade STRICT " + wtxt;
        var tb = pl && (pl.top_blocks || []).filter(function (b) { return b.stage === "STRICT"; })[0];
        if (tb) o.extra = "Vanligaste stopp: " + brand(tb.label_sv) + " (" + tb.n + ")";
        o.last = ld;
      } else if (S.id === "analyst") {
        o.val = cards; o.sub = "kort"; o.count = cards == null ? "" : cards + (cards === 1 ? " kort" : " kort") + " med färskt betyg just nu";
        var c0 = sug && sug.cards && sug.cards[0];
        o.last = ld || (c0 && c0.rated_at ? { text: sym(c0.symbol) + " · " + (c0.rating || "betyg saknas"), ts: c0.rated_at } : null);
      } else if (S.id === "sizer") {
        o.val = gp; o.sub = gates != null ? "av " + gates : ""; o.count = gp == null ? "" : gp + (gates != null ? " av " + gates : "") + " klarade grindarna " + wtxt;
        var bits = []; if (num(box.ticket_usd) != null) bits.push("ticket " + usd(box.ticket_usd)); if (num(box.stop_loss_pct) != null) bits.push("stop-loss −" + num(box.stop_loss_pct) + " %"); if (num(box.max_open) != null) bits.push("max " + Math.round(box.max_open) + " öppna");
        o.extra = bits.join(" · ");
        o.last = ld;
      } else if (S.id === "executor") {
        o.val = fills; o.sub = "köp"; o.count = fills == null ? "" : fills + " PAPER-köp " + wtxt;
        var e0 = evs[0];
        o.last = e0 ? { text: (e0.action === "Köp" ? "Köp " : "Sälj ") + sym(e0.symbol) + (num(e0.amount_usd) != null ? " · " + usd(e0.amount_usd) : ""), ts: e0.ts } : ld;
      } else if (S.id === "logger") {
        var cn = jr ? num(jr.count) : null; o.val = cn; o.sub = "poster";
        o.count = cn == null ? "" : cn + (cn === 1 ? " post" : " poster") + " i journalen";
        o.st = cn == null ? { s: "na", label: "saknas" } : cn > 0 ? { s: "on", label: "har poster" } : { s: "off", label: "tom" };
        var j0 = jr && jr.entries && jr.entries[0];
        o.last = j0 ? { text: (j0.action ? j0.action + " " : "") + (j0.symbol ? sym(j0.symbol) : "") + (j0.reason_sv ? " · " + brand(String(j0.reason_sv)) : ""), ts: j0.ts } : null;
      } else if (S.id === "equity") {
        o.val = eq; o.money = true;
        var pp = eq != null && put ? (eq - put) / put * 100 : null; o.sub = pp != null ? sPct(pp) : "";
        o.count = eq == null ? "" : usd(eq) + " PAPER-saldo" + (pts.length ? " · " + pts.length + " punkter i kurvan" : "");
        var lp = pts.length ? pts[pts.length - 1] : null; o.last = lp ? { text: "Saldo " + usd(lp.v), ts: lp.ts } : null;
        var fresh = lp && isFinite(tsMs(lp.ts)) && Date.now() - tsMs(lp.ts) < 180000;
        o.st = eq == null ? { s: "na", label: "saknas" } : fresh ? { s: "on", label: "uppdateras" } : { s: "off", label: "senast " + (lp ? ago(lp.ts) : "okänt") };
      }
      o.unit = o.money ? (eq == null ? "" : "PAPER-saldo" + (pts.length ? " · " + pts.length + " punkter i kurvan" : "")) : o.count.replace(/^\S+\s/, "");
      out.push(o);
    });
    return out;
  }
  function pipeVal(o, exact) {
    if (o.val == null) return { t: "saknas", s: true };
    if (o.money) { var n = o.val; return { t: exact ? usd(n) : (n < 0 ? "-$" : "$") + Math.round(Math.abs(n)), s: false }; }
    return { t: String(Math.round(o.val)), s: false };
  }
  function swapIn(host, build) {
    var tmp = document.createElement("div"); build(tmp);
    if (tmp.innerHTML === host.innerHTML) return;
    host.innerHTML = ""; while (tmp.firstChild) host.appendChild(tmp.firstChild);
  }
  function renderPipeline(state) {
    var m = pipeModel(state), host = document.createElement("div");
    var ok = 0, known = 0;
    m.forEach(function (o, i) {
      var c = el("div", "pp " + (o.st ? o.st.s : "na")); c.setAttribute("role", "listitem");
      c.appendChild(el("span", "nd", String(i + 1)));
      var v = pipeVal(o); c.appendChild(el("b", v.s ? "s" : "", v.t));
      c.appendChild(el("em", null, o.name));
      c.appendChild(el("small", null, o.sub || ""));
      host.appendChild(c);
      if (o.st) { known++; if (o.st.s === "on") ok++; }
    });
    var pl = state.pipeline; var win = pl ? num(pl.window_min) : null;
    swapIn($("pipe"), function (t) { while (host.firstChild) t.appendChild(host.firstChild); });
    $("pipe-note").textContent = pl ? "Antal " + (win != null ? "senaste " + win + " min" : "") + " · " + ok + " av " + known + " steg rapporterar live" : "Pipeline-antal saknas i datan just nu";
  }
  function renderAgents(state) {
    var m = pipeModel(state), host = document.createElement("div");
    var on = 0;
    m.forEach(function (o, i) {
      var s = o.st ? o.st.s : "na"; if (s === "on") on++;
      var a = el("article", "ag " + s); a.id = "ag-" + o.id;
      a.appendChild(el("span", "nd", String(i + 1)));
      var b = el("div", "bd"), t = el("div", "t"); t.appendChild(el("strong", null, o.name)); t.appendChild(el("span", "sp"));
      t.appendChild(el("span", "stt " + s, o.st ? o.st.label : "saknas")); b.appendChild(t);
      b.appendChild(el("div", "role", o.role));
      var v = pipeVal(o, true), big = el("div", "big"); big.appendChild(el("b", v.s ? "s" : "", v.t));
      big.appendChild(el("span", null, o.val == null ? "ingen räknare publicerad" : o.unit)); b.appendChild(big);
      if (o.extra) b.appendChild(el("div", "ln", o.extra));
      var ln = el("div", "ln"); ln.appendChild(el("i", null, "Senast"));
      if (o.last && o.last.text) ln.appendChild(document.createTextNode(o.last.text + (o.last.ts ? " · " + (ago(o.last.ts) || hm(o.last.ts)) : "")));
      else ln.appendChild(document.createTextNode(o.st && o.st.ts ? "puls " + (ago(o.st.ts) || "saknas") + " · beslut saknas" : "saknas"));
      b.appendChild(ln);
      a.appendChild(b); host.appendChild(a);
    });
    swapIn($("agents"), function (t) { while (host.firstChild) t.appendChild(host.firstChild); });
    $("ag-tag").textContent = state.heartbeats || state.journal ? on + "/" + m.length + " live" : "saknas";
  }

  /* ---------- saldokurva: only real points from state.challenge.equity_points; never interpolated or invented ---------- */
  function validPoints(box) {
    var raw = (box && box.equity_points) || [];
    return raw.map(function (p) { return p && { ts: p.ts, v: num(p.v) }; }).filter(function (p) { return p && p.v != null && isFinite(tsMs(p.ts)); });
  }
  var SVGNS = "http://www.w3.org/2000/svg";
  function svgEl(n, at) { var e = document.createElementNS(SVGNS, n); for (var k in at) e.setAttribute(k, at[k]); return e; }
  function renderCurve(box) {
    var host = $("eq-pl"); host.innerHTML = "";
    var pts = validPoints(box), put = num(box.put_in_usd != null ? box.put_in_usd : box.capital_usd), eq = num(box.equity_usd);
    var note = $("eq-note"), L = $("eq-l"), R = $("eq-r");
    var W = host.clientWidth || 306, H = host.clientHeight || 72, pad = 6;
    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "none" }); host.appendChild(svg);
    var flatVal = pts.length ? pts[pts.length - 1].v : (eq != null ? eq : put);
    if (pts.length < 2) {
      note.textContent = "Ingen historik än";
      if (flatVal == null) { L.textContent = "saknas"; R.textContent = "saknas"; return; }
      var y = H / 2;
      svg.appendChild(svgEl("line", { x1: pad, x2: W - pad, y1: y, y2: y, stroke: "rgba(255,255,255,.75)", "stroke-width": 2, "stroke-dasharray": "2 6", "stroke-linecap": "round" }));
      svg.appendChild(svgEl("circle", { cx: W - pad, cy: y, r: 4.5, fill: "#fff" }));
      L.textContent = put != null ? "Start " + usd(put) : "start saknas"; R.textContent = usd(flatVal);
      return;
    }
    var t0 = tsMs(pts[0].ts), t1 = tsMs(pts[pts.length - 1].ts), span = Math.max(1, t1 - t0);
    var lo = Math.min.apply(null, pts.map(function (p) { return p.v; })), hi = Math.max.apply(null, pts.map(function (p) { return p.v; }));
    if (put != null) { lo = Math.min(lo, put); hi = Math.max(hi, put); }
    var flat = hi - lo < 0.005;
    if (flat) { lo -= 0.5; hi += 0.5; } else { var pd = (hi - lo) * 0.12; lo -= pd; hi += pd; }
    function X(p) { return pad + (tsMs(p.ts) - t0) / span * (W - 2 * pad); }
    function Y(v) { return pad + (1 - (v - lo) / (hi - lo)) * (H - 2 * pad); }
    if (put != null) svg.appendChild(svgEl("line", { x1: pad, x2: W - pad, y1: Y(put), y2: Y(put), stroke: "rgba(255,255,255,.35)", "stroke-width": 1, "stroke-dasharray": "3 4" }));
    var d = pts.map(function (p, i) { return (i ? "L" : "M") + X(p).toFixed(1) + " " + Y(p.v).toFixed(1); }).join(" ");
    var area = d + " L" + X(pts[pts.length - 1]).toFixed(1) + " " + (H - pad) + " L" + X(pts[0]).toFixed(1) + " " + (H - pad) + " Z";
    var defs = svgEl("defs", {}), g = svgEl("linearGradient", { id: "eqg", x1: 0, y1: 0, x2: 0, y2: 1 });
    g.appendChild(svgEl("stop", { offset: "0", "stop-color": "#fff", "stop-opacity": ".28" })); g.appendChild(svgEl("stop", { offset: "1", "stop-color": "#fff", "stop-opacity": "0" }));
    defs.appendChild(g); svg.appendChild(defs);
    svg.appendChild(svgEl("path", { d: area, fill: "url(#eqg)" }));
    svg.appendChild(svgEl("path", { d: d, fill: "none", stroke: "#fff", "stroke-width": 2.2, "stroke-linejoin": "round", "stroke-linecap": "round" }));
    var lp = pts[pts.length - 1]; svg.appendChild(svgEl("circle", { cx: X(lp), cy: Y(lp.v), r: 4.5, fill: "#fff" }));
    note.textContent = flat ? "Oförändrad · " + pts.length + " punkter" : pts.length + " punkter";
    L.textContent = dm(pts[0].ts); R.textContent = hm(lp.ts) + " · " + usd(lp.v);
  }

  /* ---------- Varför-ark: real fields only; what the desk does not publish per trade reads "saknas" ---------- */
  var EXIT_SV = { take_profit: "Take profit", stop_loss: "Stop-loss", trail: "Trailing stop", trailing: "Trailing stop", stake_out: "Insats uttagen (2×)", ladder_5x: "Stege 5×", ladder_20x: "Stege 20×", timeout: "Tidsgräns", manual: "Manuell", expired: "Utmaningen slut" };
  function exitSv(r) { if (!r) return null; var k = String(r).toLowerCase(); return EXIT_SV[k] || brand(String(r)); }
  function nearest(list, key, ts) {
    var t = tsMs(ts), best = null, bd = Infinity;
    list.forEach(function (x) { var d = Math.abs(tsMs(x[key]) - t); if (!isFinite(d)) d = 1e15; if (d < bd) { bd = d; best = x; } });
    return best;
  }
  function gatesFor(state, mint) {
    var box = state.challenge || {}, lg = box.last_gates;
    if (lg && lg.mint === mint && lg.checklist) return { g: lg.checklist, src: "senaste grindkontrollen", at: lg.ts };
    var cards = (state.suggestions && state.suggestions.cards) || [];
    for (var i = 0; i < cards.length; i++) if (cards[i].mint === mint && cards[i].gates) return { g: cards[i].gates, src: "aktuellt förslag", at: cards[i].rated_at };
    return null;
  }
  function whyModel(state, ref) {
    var box = state.challenge || {}, trades = box.trades || [], opens = box.open || [], evs = box.events || [];
    var ev = null, pos = null, kind = "";
    if (ref.ev != null) ev = evs.filter(function (e) { return String(e.id) === String(ref.ev); })[0] || null;
    if (ref.pid != null) pos = opens.filter(function (p) { return String(p.id) === String(ref.pid); })[0] || null;
    if (ev && !pos) {
      var mint = ev.mint, cl = trades.filter(function (t) { return t.mint === mint; }), op = opens.filter(function (p) { return p.mint === mint; });
      if (ev.action === "Köp") pos = nearest(cl.map(function (t) { return { t: t, k: t.opened_at }; }).concat(op.map(function (p) { return { t: p, k: p.opened_at }; })), "k", ev.ts);
      else pos = nearest(cl.map(function (t) { return { t: t, k: t.closed_at }; }), "k", ev.ts);
      if (pos) pos = pos.t; else if (op.length) pos = op[0];
    }
    var closed = !!(pos && pos.closed_at);
    var mintK = (pos && pos.mint) || (ev && ev.mint), symb = (pos && pos.symbol) || (ev && ev.symbol);
    var buyEv = evs.filter(function (e) { return e.action === "Köp" && e.mint === mintK; });
    var be = pos && pos.opened_at ? nearest(buyEv, "ts", pos.opened_at) : buyEv[0];
    var sellEv = ev && ev.action === "Sälj" ? ev : null;
    return { ev: ev, pos: pos, closed: closed, mint: mintK, symbol: symb, buyEv: be, sellEv: sellEv, gates: gatesFor(state, mintK), box: box };
  }
  function kv(label, val, cls) { var r = el("div", "kvr"); r.appendChild(el("span", null, label)); r.appendChild(el("b", cls || (val === "saknas" ? "miss" : ""), val)); return r; }
  function wy(title, tag) { var s = el("section", "wy"), h = el("h4", null, title); if (tag) h.appendChild(el("em", null, tag)); s.appendChild(h); return s; }
  function openSheet(state, ref) {
    var W = whyModel(state, ref), pos = W.pos, ev = W.ev, box = W.box;
    if (!pos && !ev) return;
    var body = $("sheet-body"); body.innerHTML = "";
    var av = avatar({ symbol: W.symbol }); var avh = $("sheet-av"); avh.innerHTML = ""; avh.appendChild(av);
    $("sheet-title").textContent = "Varför " + sym(W.symbol);
    var status = W.closed ? "Stängd" : pos ? "Öppen" : (ev && ev.action === "Sälj" ? "Sälj" : "Köp");
    $("sheet-sub").textContent = status + " · PAPER · simulerat" + (ev ? " · " + dm(ev.ts) : pos && pos.opened_at ? " · " + dm(pos.opened_at) : "");
    /* 1 trigger */
    var s1 = wy("Trigger", pos && pos.rating ? "betyg " + pos.rating : null);
    var why = (pos && pos.entry_reason_sv) || (W.buyEv && W.buyEv.reason_sv) || null;
    s1.appendChild(el("p", why ? "" : "miss", why ? brand(String(why)) : "saknas"));
    body.appendChild(s1);
    /* 2 rug */
    var s2 = wy("Rugfilter", W.gates ? W.gates.src : null);
    if (W.gates && W.gates.g && W.gates.g.gates && W.gates.g.gates.length) {
      var gs = W.gates.g.gates, okN = gs.filter(function (x) { return x.ok; }).length;
      s2.appendChild(el("p", "", okN + " av " + gs.length + " grindar klarade" + (W.gates.g.passed === false ? " · stoppad" : "")));
      var gl = el("div", "gl");
      gs.forEach(function (x) { var c = el("span", x.ok ? "" : x.status === "saknas" ? "na" : "no"); c.appendChild(el("i", null, x.ok ? "✓" : x.status === "saknas" ? "–" : "✕")); c.appendChild(el("span", null, brand(x.label_sv || x.code))); gl.appendChild(c); });
      s2.appendChild(gl);
    } else s2.appendChild(el("p", "miss", "saknas · rugkontroll per trade publiceras inte"));
    body.appendChild(s2);
    /* 3 size */
    var s3 = wy("Storlek", null), init = pos ? num(pos.initial_stake_usd != null ? pos.initial_stake_usd : pos.size_usd) : (ev ? num(ev.amount_usd) : null), tk = num(box.ticket_usd);
    s3.appendChild(kv("Insats", init == null ? "saknas" : usd(init)));
    s3.appendChild(kv("Regel", tk == null ? "saknas" : (init != null && Math.abs(init - tk) < 0.01 ? "fast ticket " + usd(tk) : "ticket " + usd(tk))));
    var eff = W.gates && W.gates.g ? num(W.gates.g.effective_ticket_usd) : null;
    if (eff != null && tk != null && Math.abs(eff - tk) > 0.01) s3.appendChild(kv("Sizer justerade", usd(eff) + (W.gates.g.half_ticket ? " (halv ticket)" : "")));
    var sl = pos ? num(pos.stop_price) : null;
    s3.appendChild(kv("Stop-loss", sl == null ? "saknas" : "$" + sl.toPrecision(3) + (num(box.stop_loss_pct) != null ? " (−" + num(box.stop_loss_pct) + " %)" : "")));
    s3.appendChild(kv("Varför just denna storlek", "saknas"));
    body.appendChild(s3);
    /* 4 fill */
    var s4 = wy("Fill och slip", null), ep = pos ? num(pos.entry_price) : (ev ? num(ev.entry_price) : null);
    s4.appendChild(kv("Inköpspris", ep == null ? "saknas" : "$" + ep.toPrecision(4)));
    s4.appendChild(kv("Avgifter", pos && num(pos.fees_usd) != null ? usd(pos.fees_usd) : "saknas"));
    s4.appendChild(kv("Slip mot quote", "saknas"));
    body.appendChild(s4);
    /* 5 exit */
    var s5 = wy("Utgång", W.closed ? "stängd" : pos ? "öppen" : null);
    if (W.closed) {
      s5.appendChild(el("p", pos.exit_reason ? "" : "miss", pos.exit_reason ? exitSv(pos.exit_reason) : "saknas"));
      s5.appendChild(kv("Utpris", num(pos.exit_price) == null ? "saknas" : "$" + num(pos.exit_price).toPrecision(4)));
      var pn = num(pos.pnl_usd); s5.appendChild(kv("Resultat", sUsd(pn), pn == null ? "" : pn < 0 ? "down" : "up"));
      if (pos.opened_at && pos.closed_at) { var mins = Math.round((tsMs(pos.closed_at) - tsMs(pos.opened_at)) / 60000); s5.appendChild(kv("Hålltid", isFinite(mins) ? (mins >= 90 ? Math.round(mins / 60) + " h" : mins + " min") : "saknas")); }
    } else if (W.sellEv) {
      s5.appendChild(el("p", W.sellEv.reason_sv ? "" : "miss", W.sellEv.reason_sv ? brand(String(W.sellEv.reason_sv)) : "saknas"));
      var pe = num(W.sellEv.pnl_usd); s5.appendChild(kv("Resultat", sUsd(pe), pe == null ? "" : pe < 0 ? "down" : "up"));
    } else {
      s5.appendChild(el("p", "miss", "Ännu ingen utgång · positionen är öppen"));
      var tp = pos ? num(pos.take_profit_price) : null, cu = pos ? num(pos.current_price) : null;
      s5.appendChild(kv("Mål (take profit)", tp == null ? "saknas" : "$" + tp.toPrecision(3)));
      s5.appendChild(kv("Nu", cu == null ? "saknas" : "$" + cu.toPrecision(4)));
    }
    body.appendChild(s5);
    var sh = $("sheet"); sh.hidden = false; body.scrollTop = 0;
    sheetOpener = document.activeElement;
    $("sheet-x").focus();
  }
  var sheetOpener = null;
  function closeSheet() { var sh = $("sheet"); if (sh.hidden) return; sh.hidden = true; if (sheetOpener && sheetOpener.focus) try { sheetOpener.focus(); } catch (e) {} }
  document.addEventListener("click", function (e) {
    var t = e.target; if (!t || !t.closest) return;
    if (t.closest("#sheet-x") || t.id === "sheet-scrim") { closeSheet(); return; }
    var row = t.closest(".row.tap"); if (row && last) { openSheet(last, { ev: row.dataset.ev, pid: row.dataset.pid }); return; }
    if (t.closest("#pipe") || t.closest("#to-agenter")) showTab("agenter", { animate: true });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeSheet();
    if ((e.key === "Enter" || e.key === " ") && e.target && e.target.classList && e.target.classList.contains("tap") && last) { e.preventDefault(); openSheet(last, { ev: e.target.dataset.ev, pid: e.target.dataset.pid }); }
  });
  window.addEventListener("resize", function () { if (last) renderCurve(last.challenge || {}); });

  var cdTimer = null;
    function render(state) {
    if (!state) return;
    last = state;
    var box = state.challenge || {}, hb = state.heartbeats || {};
    var live = String(state.mode || "PAPER").toUpperCase() === "LIVE";
    /* status chip */
    var age = Date.now() - Date.parse(state.updated_at || ""), chip = $("live-chip");
    var stale = !isFinite(age) || age > 120000;
    chip.className = "live-chip " + (stale ? "warn" : "on");
    $("live-txt").textContent = stale ? "Data gammal" : (box.status === "running" ? "Live" : "Ansluten");

    /* hero */
    var eq = num(box.equity_usd != null ? box.equity_usd : box.cash_usd), put = num(box.put_in_usd != null ? box.put_in_usd : box.capital_usd);
    var bal = $("bal"); bal.innerHTML = "";
    if (eq == null) { bal.classList.add("miss"); bal.appendChild(el("span", "bal-i", "saknas")); }
    else { bal.classList.remove("miss"); var s = money(eq), c = s.lastIndexOf("."); bal.appendChild(el("span", "bal-i", (eq < 0 ? "-$" : "$") + s.slice(0, c))); bal.appendChild(el("span", "bal-d", s.slice(c))); }
    var pnl = num(box.session_pnl_usd); if (pnl == null && eq != null && put != null) pnl = eq - put;
    var pct = pnl != null && put ? pnl / put * 100 : null, pe = $("pnl");
    pe.className = "pnl" + (pnl == null ? "" : pnl < 0 ? " down" : " up");
    pe.textContent = pnl == null ? "saknas" : (pnl < 0 ? "▼ " : "▲ ") + sUsd(pnl) + (pct == null ? "" : " (" + sPct(pct) + ")");
    var open = box.open || [], mo = num(box.max_open);
    $("hs-open").textContent = open.length + (mo != null ? "/" + Math.round(mo) : "");
    var wins = num(box.wins), wt = num(box.win_target_count);
    $("hs-wins").textContent = wins == null ? "saknas" : wins + (wt != null ? "/" + wt : "");
    var mult = num(box.multiplier); $("hs-mult").textContent = mult == null ? "saknas" : mult.toFixed(2) + "×";
    $("hero-note").textContent = live ? "LIVE · låst" : (brand(box.paper_label_sv) || "PAPER · simulerat · inga riktiga pengar");

    /* challenge */
    var pill = $("ch-pill"), stt = box.status;
    pill.className = "pill " + (stt === "running" ? "on" : stt === "paused" ? "pause" : "done");
    pill.lastChild.textContent = box.status_sv || (stt ? stt : "saknas");
    var cd = $("ch-count"); cd.dataset.ends = box.ends_at || ""; cd.dataset.started = box.started_at || ""; cd.dataset.run = stt === "running" || stt === "aborting" || stt === "paused" ? "1" : "";
    tickCountdown();
    $("ch-span").textContent = box.started_at && box.ends_at ? dm(box.started_at) + " → " + dm(box.ends_at) : "tid saknas";
    $("c-cash").textContent = usd(box.cash_usd); $("c-ticket").textContent = usd(box.ticket_usd);
    var rp = num(box.realized_pnl_usd); var rc = $("c-real"); rc.textContent = sUsd(rp); rc.className = rp == null ? "" : rp < 0 ? "down" : "up";
    var closed = num(box.closed_count != null ? box.closed_count : (box.trades || []).length); $("c-closed").textContent = closed == null ? "saknas" : String(closed);

    /* open positions + recent trades */
    var fresh = emitNewBuys(box);
    var freshIds = {}; fresh.forEach(function (e) { freshIds[e.id] = 1; });
    $("open-tag").textContent = String(open.length);
    fill($("open-list"), open.map(openRow), "Inga öppna positioner just nu");
    var evs = (box.events || []).filter(function (e) { return e && (e.action === "Köp" || e.action === "Sälj"); });
    fill($("recent-list"), evs.slice(0, 4).map(function (e) { return evRow(e, !!freshIds[e.id]); }), "Inga PAPER-trades än");
    fillGrouped($("trades-list"), evs.slice(0, 40), "Inga PAPER-trades än");
    $("tr-sub").textContent = evs.length + (evs.length === 1 ? " händelse" : " händelser") + " · allt simulerat i PAPER";
    var sum = $("tr-sum"); sum.innerHTML = "";
    [["Stängda", closed == null ? "saknas" : String(closed), ""], ["Vinster", wins == null ? "saknas" : String(wins), ""], ["Realiserat", sUsd(rp), rp == null ? "" : rp < 0 ? "down" : "up"]].forEach(function (x) {
      var d = el("div"); d.appendChild(el("dt", null, x[0])); d.appendChild(el("dd", x[2], x[1])); sum.appendChild(d);
    });

    renderPipeline(state);
    renderCurve(box);
    renderAgents(state);

    $("boot").hidden = true;
    if (fresh.length) {
      listeners.forEach(function (fn) { try { fn(fresh); } catch (e) { if (window.console) console.error(e); } });
      fresh.forEach(function (e) {
        var nodes = [];
        if (e.id != null) document.querySelectorAll('.row[data-ev="' + e.id + '"]').forEach(function (n) { nodes.push(n); });
        if (e.mint) document.querySelectorAll('.row[data-mint="' + e.mint + '"]').forEach(function (n) { if (nodes.indexOf(n) < 0) nodes.push(n); });
        nodes.forEach(function (row) {
          row.classList.add("hit");
          setTimeout(function () { row.classList.remove("hit"); }, 3600);
        });
      });
    }
  }

  function tickCountdown() {
    var cd = $("ch-count"), ring = $("ch-ring"), dayEl = $("ch-day"); if (!cd) return;
    var ends = Date.parse(cd.dataset.ends || ""), st = Date.parse(cd.dataset.started || "");
    var C = 251.33, frac = null;
    if (isFinite(st) && isFinite(ends) && ends > st) {
      var total = Math.max(1, Math.round((ends - st) / 86400000));
      var elapsed = Math.min(1, Math.max(0, (Date.now() - st) / (ends - st)));
      frac = elapsed; dayEl.textContent = Math.min(total, Math.floor(elapsed * (ends - st) / 86400000) + 1) + "/" + total;
    } else { dayEl.textContent = "–"; }
    if (!isFinite(ends) || !cd.dataset.run) {
      cd.textContent = cd.dataset.ends ? "klar" : "--:--:--";
      if (cd.dataset.ends && frac != null) frac = 1;
    } else {
      var sec = Math.max(0, Math.floor((ends - Date.now()) / 1000));
      var dd = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60), r = sec % 60, p = function (n) { return String(n).padStart(2, "0"); };
      cd.textContent = (dd ? dd + "d " : "") + p(h) + ":" + p(m) + ":" + p(r);
    }
    ring.style.strokeDashoffset = String(C * (1 - (frac == null ? 0 : Math.max(frac, 0.015))));
  }
  setInterval(tickCountdown, 1000);

  /* ---------- tabs + horizontal swipe ---------- */
  var TABS = ["home", "trades", "agenter"];
  var tab = "home", tabIndex = 0;
  function reduceMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function pageWidth() {
    var p = $("pager");
    return (p && p.clientWidth) || window.innerWidth || 1;
  }
  function indexX(i) { return -i * pageWidth(); }
  function closestIndex(x) {
    return Math.max(0, Math.min(TABS.length - 1, Math.round(-x / pageWidth())));
  }
  function setTrack(x, animate) {
    var track = $("pager-track");
    if (!track) return;
    var go = !!animate && !reduceMotion();
    track.classList.toggle("anim", go);
    track.style.transform = "translate3d(" + x + "px,0,0)";
  }
  function tabInkRect(i) {
    var b = document.querySelector('.tab[data-tab="' + TABS[i] + '"]');
    var nav = document.querySelector(".tabs");
    if (!b || !nav) return { left: 0, width: 0 };
    var br = b.getBoundingClientRect(), nr = nav.getBoundingClientRect();
    return { left: br.left - nr.left + br.width * 0.30, width: br.width * 0.40 };
  }
  function setInk(left, width, animate) {
    var ink = $("tabs-ink");
    if (!ink) return;
    ink.style.transition = (animate && !reduceMotion()) ? "left .32s cubic-bezier(.22,.8,.3,1),width .32s cubic-bezier(.22,.8,.3,1)" : "none";
    ink.style.left = left + "px";
    ink.style.width = width + "px";
  }
  function interpolateInk(i0, i1, f) {
    var a = tabInkRect(i0), b = tabInkRect(i1);
    setInk(a.left + (b.left - a.left) * f, a.width + (b.width - a.width) * f, false);
  }
  function placeInk(t, animate) {
    var i = TABS.indexOf(t);
    if (i < 0) i = 0;
    var r = tabInkRect(i);
    setInk(r.left, r.width, animate !== false);
  }
  function markPages(t) {
    document.querySelectorAll(".page").forEach(function (p) {
      var on = p.dataset.page === t;
      p.setAttribute("aria-hidden", on ? "false" : "true");
      try { p.inert = !on; } catch (e) {}
    });
    document.querySelectorAll(".tab").forEach(function (b) { b.classList.toggle("on", b.dataset.tab === t); });
  }
  function showTab(t, opts) {
    opts = opts || {};
    var i = TABS.indexOf(t);
    if (i < 0) return;
    tab = t;
    tabIndex = i;
    setTrack(indexX(i), opts.animate !== false);
    markPages(t);
    placeInk(t, opts.animate !== false);
    if (!opts.keepScroll) {
      var page = document.querySelector('.page[data-page="' + t + '"]');
      if (page) page.scrollTop = 0;
    }
    document.dispatchEvent(new CustomEvent("paws:tab", { detail: t }));
  }
  function ignoreSwipe(el) {
    return !!(el && el.closest && el.closest("button, a, input, select, textarea, .bar, .gauge, .tabs, [data-no-swipe]"));
  }
  function bindPager() {
    var pager = $("pager"), track = $("pager-track");
    if (!pager || !track) return;
    var startX = 0, startY = 0, startT = 0, baseX = 0, locked = null, dragging = false, lastX = 0, lastY = 0;
    var THRESH = 10;

    function rubber(dx) {
      var raw = baseX + dx, min = indexX(TABS.length - 1), max = 0;
      if (raw > max) return max + (raw - max) * 0.32;
      if (raw < min) return min + (raw - min) * 0.32;
      return raw;
    }
    function follow(tx) {
      setTrack(tx, false);
      var w = pageWidth(), pos = -tx / w;
      if (pos < 0) pos = 0;
      if (pos > TABS.length - 1) pos = TABS.length - 1;
      var i0 = Math.floor(pos), i1 = Math.ceil(pos), f = pos - i0;
      interpolateInk(i0, i1, f);
      var closest = closestIndex(tx);
      document.querySelectorAll(".tab").forEach(function (b) { b.classList.toggle("on", b.dataset.tab === TABS[closest]); });
    }
    function onStart(x, y, ev) {
      if (ignoreSwipe(ev.target)) { dragging = false; return; }
      startX = lastX = x; startY = lastY = y; startT = Date.now();
      baseX = indexX(tabIndex);
      locked = null;
      dragging = true;
      track.classList.remove("anim");
    }
    function onMove(x, y, ev) {
      if (!dragging || locked === "v") return;
      lastX = x; lastY = y;
      var dx = x - startX, dy = y - startY;
      if (!locked) {
        if (Math.abs(dx) < THRESH && Math.abs(dy) < THRESH) return;
        locked = (Math.abs(dx) > Math.abs(dy)) ? "h" : "v";
        if (locked === "v") return;
      }
      if (locked === "h") {
        if (ev.cancelable) ev.preventDefault();
        follow(rubber(dx));
      }
    }
    function onEnd(x, y) {
      if (!dragging) return;
      dragging = false;
      if (locked !== "h") return;
      var dx = x - startX, dt = Math.max(1, Date.now() - startT), v = dx / dt, w = pageWidth();
      var tx = rubber(dx), i = closestIndex(tx);
      if (Math.abs(v) > 0.35 || (Math.abs(dx) > w * 0.18 && Math.abs(v) > 0.15)) {
        i = dx < 0 ? Math.min(TABS.length - 1, tabIndex + 1) : Math.max(0, tabIndex - 1);
      }
      showTab(TABS[i], { keepScroll: true, animate: true });
    }

    /* Touch listeners are bound to the touchstart target for the length of the gesture: a poll re-render may detach that
       element mid-swipe, and a detached target's touchmove/touchend would otherwise never reach the pager (stuck half-way). */
    pager.addEventListener("touchstart", function (e) {
      if (e.touches.length !== 1) { dragging = false; return; }
      onStart(e.touches[0].clientX, e.touches[0].clientY, e);
      if (!dragging) return;
      var tg = e.target;
      function mv(ev) { if (ev.touches.length) onMove(ev.touches[0].clientX, ev.touches[0].clientY, ev); }
      function done() { tg.removeEventListener("touchmove", mv); tg.removeEventListener("touchend", en); tg.removeEventListener("touchcancel", cn); }
      function en(ev) { done(); var t = ev.changedTouches[0]; onEnd(t ? t.clientX : lastX, t ? t.clientY : lastY); }
      function cn() { done(); if (dragging && locked === "h") showTab(TABS[tabIndex], { keepScroll: true, animate: true }); dragging = false; }
      tg.addEventListener("touchmove", mv, { passive: false });
      tg.addEventListener("touchend", en, { passive: true });
      tg.addEventListener("touchcancel", cn, { passive: true });
    }, { passive: true });

    pager.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "touch") return;
      if (e.button !== 0) return;
      onStart(e.clientX, e.clientY, e);
    });
    window.addEventListener("pointermove", function (e) {
      if (e.pointerType === "touch") return;
      if (!dragging) return;
      onMove(e.clientX, e.clientY, e);
    });
    window.addEventListener("pointerup", function (e) {
      if (e.pointerType === "touch") return;
      if (!dragging) return;
      onEnd(e.clientX, e.clientY);
    });
    window.addEventListener("resize", function () {
      setTrack(indexX(tabIndex), false);
      placeInk(tab, false);
    });
  }
  document.querySelectorAll(".tab").forEach(function (b) {
    b.addEventListener("click", function () { showTab(b.dataset.tab); });
  });
  $("to-trades").addEventListener("click", function () { showTab("trades"); });

  /* ---------- polling (same endpoint and cadence as v71) ---------- */
  var timer = null, curMs = POLL_MS, cfg = loadConfig();
  function fetchJson(url) { return fetch(url, { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); }); }
  function poll() {
    if (document.hidden) return;
    if (window.__NIMBUS_MOCK_STATE__) { render(window.__NIMBUS_MOCK_STATE__); return; }
    if (!cfg.dataBase) { $("boot").hidden = !!last; return; }
    fetchJson(cfg.dataBase.replace(/\/$/, "") + "/state.json").then(function (state) {
      render(state);
      var ch = (state && state.challenge) || {}, want = Number(ch.publish_interval_ms);
      if (!isFinite(want) || want < 3000) want = (ch.live_view || ch.status === "paused" || ch.status === "running") ? 5000 : POLL_MS;
      if (want !== curMs) schedule(want);
    }).catch(function (err) {
      window.__nimbusLastError = String((err && err.stack) || err);
      if (window.console) console.error(err);
      var chip = $("live-chip"); chip.className = "live-chip off"; $("live-txt").textContent = "Offline";
      if (!last) $("boot").hidden = false;
    });
  }
  function schedule(ms) { if (timer) clearInterval(timer); curMs = ms; timer = setInterval(poll, ms); }
  document.addEventListener("visibilitychange", function () { if (!document.hidden) poll(); });

  bindPager();
  showTab("home", { animate: false, keepScroll: true });
  if (window.requestAnimationFrame) requestAnimationFrame(function () { placeInk("home", false); });
  if ("serviceWorker" in navigator && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) navigator.serviceWorker.register("./sw.js").catch(function () {});
  window.Paws = {
    onNewTrade: function (fn) { listeners.push(fn); },
    render: render, showTab: showTab, currentTab: function () { return tab; },
    state: function () { return last; }
  };
  poll(); schedule(POLL_MS);
})();
