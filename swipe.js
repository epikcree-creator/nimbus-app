/* Degen (was Swipe Mode) t164/t170 layout: Hem · Trades · Agenter · Plånbok.
   Real desk data only (state.json). Missing values read "saknas". PAPER only. */
(function (global) {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  var SVGNS = "http://www.w3.org/2000/svg";
  function sv(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }
  function num(v) { var n = Number(v); return v == null || v === "" || !isFinite(n) ? null : n; }
  function usd(v, d) { var n = num(v); if (n == null) return "saknas"; return (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: d == null ? 2 : d, maximumFractionDigits: d == null ? 2 : d }); }
  function sUsd(v) { var n = num(v); if (n == null) return "saknas"; return (n >= 0 ? "+$" : "-$") + Math.abs(n).toFixed(2); }
  function sPct(v) { var n = num(v); if (n == null) return "saknas"; return (n >= 0 ? "+" : "") + n.toFixed(n >= 100 || n <= -100 ? 0 : 1) + "%"; }
  function price(v) {
    var n = num(v); if (n == null) return "saknas";
    if (n === 0) return "0";
    if (Math.abs(n) >= 1) return n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
    return n.toPrecision(3).replace(/e-(\d+)/, function (m, e) { return "e-" + e; });
  }
  function reduced() { return !!(global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches); }
  var TZ = "Europe/Stockholm";
  function hm(iso) {
    var d = new Date(iso); if (!iso || isNaN(d.getTime())) return "saknas";
    return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(d);
  }
  function dayHm(iso) {
    var d = new Date(iso); if (!iso || isNaN(d.getTime())) return "saknas";
    var wd = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, weekday: "short" }).format(d).replace(".", "");
    return wd + " " + hm(iso);
  }
  function dayLabel(d) {
    return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" }).format(d);
  }
  function sym(row) { return (row && (row.symbol || (row.mint || "").slice(0, 6))) || "saknas"; }

  var CREW_ICON = {
    lyssnare: "M4 12a8 8 0 0 1 16 0M7.5 12a4.5 4.5 0 0 1 9 0M12 12v8",
    botjagare: "M12 3v4M12 17v4M3 12h4M17 12h4M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z",
    kedjekoll: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
    skeptiker: "M12 3l8 4v5c0 4.5-3.4 7.6-8 9-4.6-1.4-8-4.5-8-9V7zM9 12h6",
    storlek: "M12 4v16M5 8h14M5 8l-3 6a3 3 0 0 0 6 0zM19 8l-3 6a3 3 0 0 0 6 0z",
    handlare: "M13 2L4 14h7l-1 8 10-12h-7z",
    dagbok: "M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11"
  };
  function crewIcon(id, color) {
    var s = sv("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" });
    s.appendChild(sv("path", { d: CREW_ICON[id] || CREW_ICON.lyssnare, fill: "none", stroke: color || "#1F6FE0", "stroke-width": "1.8", "stroke-linecap": "round", "stroke-linejoin": "round" }));
    return s;
  }
  function agentMap(crew) {
    var m = {};
    ((crew && crew.agents) || []).forEach(function (a) { m[a.id] = a; });
    return m;
  }
  function coinBadge(row) {
    var wrap = el("span", "coin-ico");
    if (row && row.image_url) {
      var img = new Image();
      img.alt = "";
      img.loading = "lazy";
      img.referrerPolicy = "no-referrer";
      img.onerror = function () { wrap.textContent = sym(row).replace(/^\$/, "").slice(0, 1).toUpperCase(); img.remove(); };
      img.src = row.image_url;
      wrap.appendChild(img);
    } else {
      wrap.textContent = sym(row).replace(/^\$/, "").slice(0, 1).toUpperCase() || "?";
    }
    return wrap;
  }

  /* ---------- HEM: balance card ---------- */
  var __prog = { start: null, end: null };
  function paintProgress() {
    var fill = $("hero-prog-fill");
    if (!fill) return;
    if (__prog.start == null || __prog.end == null || __prog.end <= __prog.start) { fill.style.width = "0%"; return; }
    var p = (Date.now() - __prog.start) / (__prog.end - __prog.start);
    fill.style.width = (Math.max(0, Math.min(1, p)) * 100).toFixed(2) + "%";
  }
  function renderBalance(box) {
    var closed = (box.trades || []).length;
    var stats = $("hero-stats");
    if (stats) {
      var wr = box.recap && num(box.recap.win_rate_pct);
      stats.textContent = closed + " trades · " + (closed && wr != null ? wr.toFixed(0) + "% vinst" : "vinst saknas");
    }
    var st = Date.parse(box.started_at || ""), en = Date.parse(box.ends_at || "");
    __prog.start = isFinite(st) ? st : null;
    __prog.end = isFinite(en) ? en : null;
    var a = $("hero-prog-start"), b = $("hero-prog-end");
    if (a) a.textContent = __prog.start ? "start " + dayHm(box.started_at) : "start saknas";
    if (b) b.textContent = __prog.end ? "slut " + dayHm(box.ends_at) : "slut saknas";
    paintProgress();
  }

  /* ---------- HEM: chart ---------- */
  function smoothPath(pts) {
    if (!pts.length) return "";
    if (pts.length === 1) return "M" + pts[0][0] + "," + pts[0][1];
    var d = "M" + pts[0][0].toFixed(1) + "," + pts[0][1].toFixed(1);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      var c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += " C" + c1x.toFixed(1) + "," + c1y.toFixed(1) + " " + c2x.toFixed(1) + "," + c2y.toFixed(1) + " " + p2[0].toFixed(1) + "," + p2[1].toFixed(1);
    }
    return d;
  }
  function tradeMarks(box) {
    var out = [];
    (box.events || []).forEach(function (e) {
      var t = Date.parse(e.ts || "");
      if (!isFinite(t)) return;
      var buy = e.action === "Köp" || e.kind === "köp";
      var pnl = num(e.pnl_usd);
      out.push({
        id: e.id, mint: e.mint, t: t, buy: buy,
        cls: buy ? "buy" : (pnl != null && pnl < 0 ? "loss" : "win"),
        label: buy ? ("köp " + sym(e)) : (sym(e) + " " + (pnl == null ? "saknas" : sUsd(pnl)))
      });
    });
    return out.sort(function (a, b) { return a.t - b.t; });
  }
  function renderChart(box) {
    var host = $("sw-chart");
    if (!host) return;
    var pts = (box.equity_points || []).map(function (p) { return { t: Date.parse(p.ts || ""), v: num(p.v) }; })
      .filter(function (p) { return isFinite(p.t) && p.v != null; });
    var sub = $("chart-sub");
    if (sub) sub.textContent = "live · " + dayLabel(new Date()) + " · Stockholm";
    host.innerHTML = "";
    if (!pts.length) {
      host.appendChild(el("p", "empty-hint", "Saldokurva saknas"));
      return;
    }
    var W = 360, H = 150, padL = 6, padR = 46, padT = 22, padB = 14;
    var base = num(box.put_in_usd != null ? box.put_in_usd : box.capital_usd);
    var t0 = pts[0].t, t1 = Math.max(pts[pts.length - 1].t, Date.now());
    if (t1 - t0 < 60000) t1 = t0 + 60000;
    var vals = pts.map(function (p) { return p.v; });
    if (base != null) vals.push(base);
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    var span = hi - lo;
    if (span < 1e-6) { lo -= 1; hi += 1; } else { lo -= span * 0.12; hi += span * 0.12; }
    function X(t) { return padL + (t - t0) / (t1 - t0) * (W - padL - padR); }
    function Y(v) { return padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB); }
    // thin the series for a calm line
    var step = Math.max(1, Math.floor(pts.length / 60));
    var xy = [];
    pts.forEach(function (p, i) { if (i % step === 0 || i === pts.length - 1) xy.push([X(p.t), Y(p.v)]); });
    var last = pts[pts.length - 1];
    xy.push([X(t1), Y(last.v)]);
    var svg = sv("svg", { viewBox: "0 0 " + W + " " + H, class: "sw-chart-svg", role: "img", "aria-label": "Saldo över tid" });
    var defs = sv("defs");
    var g = sv("linearGradient", { id: "swFill", x1: "0", y1: "0", x2: "0", y2: "1" });
    g.appendChild(sv("stop", { offset: "0%", "stop-color": "#1F6FE0", "stop-opacity": "0.16" }));
    g.appendChild(sv("stop", { offset: "100%", "stop-color": "#1F6FE0", "stop-opacity": "0" }));
    defs.appendChild(g);
    svg.appendChild(defs);
    var line = smoothPath(xy);
    svg.appendChild(sv("path", { d: line + " L" + xy[xy.length - 1][0].toFixed(1) + "," + (H - padB) + " L" + xy[0][0].toFixed(1) + "," + (H - padB) + " Z", fill: "url(#swFill)", stroke: "none" }));
    if (base != null) {
      svg.appendChild(sv("line", { x1: padL, x2: W - padR, y1: Y(base), y2: Y(base), class: "base-line" }));
      var bt = sv("text", { x: W - padR + 4, y: Y(base) + 3.5, class: "base-text" });
      bt.textContent = "$" + base.toFixed(0);
      svg.appendChild(bt);
    }
    svg.appendChild(sv("path", { d: line, class: "eq-line", fill: "none" }));
    svg.appendChild(sv("circle", { cx: xy[xy.length - 1][0], cy: xy[xy.length - 1][1], r: 3.2, class: "eq-now" }));
    var marks = tradeMarks(box).filter(function (m) { return m.t >= t0 - 60000; }).slice(-8);
    function valueAt(t) {
      var v = pts[0].v;
      for (var i = 0; i < pts.length; i++) { if (pts[i].t <= t) v = pts[i].v; else break; }
      return v;
    }
    marks.forEach(function (m, i) {
      var mx = X(Math.min(m.t, t1)), my = Y(valueAt(m.t));
      var gm = sv("g", { class: "mark " + m.cls, "data-ev": String(m.id), "data-mint": m.mint || "" });
      gm.appendChild(sv("circle", { cx: mx, cy: my, r: 4.2 }));
      var up = i % 2 === 0;
      var ty = up ? my - 9 : my + 16;
      if (ty < 9) ty = my + 16;
      if (ty > H - 2) ty = my - 9;
      var txt = sv("text", { x: Math.min(Math.max(mx, 30), W - padR - 4), y: ty, "text-anchor": "middle", class: "mark-text" });
      txt.textContent = m.label;
      gm.appendChild(txt);
      svg.appendChild(gm);
    });
    host.appendChild(svg);
    var cs = $("chart-start"), ce = $("chart-end");
    if (cs) cs.textContent = hm(new Date(t0).toISOString());
    if (ce) ce.textContent = "nu " + hm(new Date().toISOString());
  }

  /* ---------- HEM: odometer empty state ---------- */
  function odo(node, value) {
    if (!node) return;
    var txt = value == null ? "saknas" : Number(value).toLocaleString("sv-SE");
    if (node.dataset.v === txt) return;
    node.dataset.v = txt;
    node.setAttribute("aria-label", txt);
    if (value == null) { node.textContent = "saknas"; return; }
    var old = node.querySelectorAll(".odo-col");
    var chars = txt.split("");
    if (old.length !== chars.filter(function (c) { return /\d/.test(c); }).length) {
      node.innerHTML = "";
      chars.forEach(function (c) {
        if (!/\d/.test(c)) { node.appendChild(el("span", "odo-sep", c === "\u00a0" || c === " " ? "\u2009" : c)); return; }
        var d = el("span", "odo-d");
        var col = el("span", "odo-col");
        for (var k = 0; k <= 9; k++) col.appendChild(el("span", null, String(k)));
        col.style.transform = "translateY(0)";
        d.appendChild(col);
        node.appendChild(d);
      });
      old = node.querySelectorAll(".odo-col");
      void node.offsetWidth;
    }
    var di = 0;
    chars.forEach(function (c) {
      if (!/\d/.test(c)) return;
      old[di].style.transform = "translateY(-" + (Number(c) * 10) + "%)";
      di += 1;
    });
  }
  function renderEmpty(box, crew) {
    var card = $("hem-empty");
    if (!card) return;
    var none = !(box.trades || []).length && !(box.open || []).length;
    card.hidden = !none;
    if (!none) return;
    var st = (crew && crew.stats) || {};
    odo($("odo-checks"), st.checks_today);
    odo($("odo-perh"), st.coins_per_hour);
    odo($("odo-watch"), st.near_watch);
    var note = $("odo-note");
    if (note) {
      var p = num(st.passed_today);
      note.textContent = "Inga trades än. " + (p == null ? "Pass idag saknas." : (p + " mynt har klarat STRICT idag."));
    }
  }

  /* ---------- HEM: why no trades (t170) ---------- */
  // Labels the desk writes into feed rows (desk/swipe_crew.py FAIL_SV). Used only
  // when the published state has no stats.block_reasons yet (before 21:40 restart).
  var WHY_LABELS = ["tunn pool", "RugCheck-varning", "topp-10 tung", "val-holder", "LP olåst",
    "mint öppen", "freeze öppen", "dev håller för mycket", "creator håller för mycket", "data saknas"];
  function whyFromFeed(crew) {
    var rows = ((crew && crew.feed) || []).filter(function (e) {
      return /^strict:/.test(String(e.id || "")) && e.verdict !== "pass";
    });
    // "för ung" rows are rechecked at 15 min, not blocked: count them apart.
    var young = rows.filter(function (e) { return String(e.text || "").indexOf("för ung") !== -1; }).length;
    var mature = rows.filter(function (e) { return String(e.text || "").indexOf("för ung") === -1; });
    var counts = {};
    mature.forEach(function (e) {
      var t = String(e.text || "");
      WHY_LABELS.forEach(function (l) { if (t.indexOf(l) !== -1) counts[l] = (counts[l] || 0) + 1; });
    });
    var list = Object.keys(counts).map(function (k) { return { label_sv: k, n: counts[k], pct: mature.length ? 100 * counts[k] / mature.length : null }; });
    list.sort(function (a, b) { return b.n - a.n; });
    return { failed: mature.length, young: young, reasons: list.slice(0, 5),
      scope: mature.length ? "senaste " + mature.length + " i flödet" : "saknas" };
  }
  function renderWhy(box, crew) {
    var card = $("hem-why");
    if (!card) return;
    var none = !(box.open || []).length;
    card.hidden = !none;
    if (!none) return;
    var st = (crew && crew.stats) || {};
    var data;
    if (Array.isArray(st.block_reasons)) {
      data = { failed: num(st.failed_today), young: num(st.young_today), reasons: st.block_reasons,
        scope: (num(st.failed_today) == null ? "saknas" : st.failed_today.toLocaleString("sv-SE") + " stoppade idag") };
    } else {
      data = whyFromFeed(crew);
    }
    $("why-scope").textContent = data.scope;
    var list = $("why-list");
    list.innerHTML = "";
    var reasons = (data.reasons || []).filter(function (r) { return num(r.pct) != null; });
    if (!reasons.length) {
      list.appendChild(el("li", "why-empty", "Orsaker saknas"));
    }
    reasons.slice(0, 5).forEach(function (r, i) {
      var li = el("li", "why-row" + (i === 0 ? " top" : ""));
      var lab = el("span", "why-lab", r.label_sv || r.code || "saknas");
      var pct = el("b", "why-pct", Math.round(num(r.pct)) + " %");
      var bar = el("i", "why-bar");
      var fill = el("u");
      fill.style.width = Math.max(2, Math.min(100, num(r.pct))).toFixed(1) + "%";
      bar.appendChild(fill);
      li.appendChild(lab); li.appendChild(pct); li.appendChild(bar);
      list.appendChild(li);
    });
    var note = $("why-note");
    var p = num(st.passed_today);
    var top = reasons[0];
    var parts = [];
    if (top) parts.push(Math.round(num(top.pct)) + " % av mynten som var gamla nog stoppades av " + top.label_sv + ".");
    if (num(data.young) != null && data.young > 0) parts.push(data.young.toLocaleString("sv-SE") + " var under 15 min och kollas igen.");
    if (p != null) parts.push(p + " klarade STRICT idag, inget klarade alla filter.");
    parts.push("Filtren lättas inte. Väntar på mynt som klarar alla filter.");
    note.textContent = parts.join(" ");
  }

  /* ---------- positions ---------- */
  function openRow(r) {
    var row = el("article", "pos-row");
    var pnl = num(r.pnl_usd), pp = num(r.pnl_pct);
    row.classList.add(pnl == null ? "flat" : pnl >= 0 ? "up" : "down");
    row.appendChild(coinBadge(r));
    var mid = el("div", "pos-mid");
    var top = el("div", "pos-top");
    top.appendChild(el("strong", null, sym(r)));
    top.appendChild(el("span", "spot-badge", "Spot PAPER"));
    mid.appendChild(top);
    mid.appendChild(el("div", "pos-sub", "entry " + price(r.entry_price) + " · nu " + (r.current_price_missing ? "saknas" : price(r.current_price)) + " · stop " + price(r.stop_price)));
    row.appendChild(mid);
    var right = el("div", "pos-right");
    right.appendChild(el("b", null, pnl == null ? "saknas" : sUsd(pnl)));
    right.appendChild(el("span", null, pp == null ? "saknas" : "(" + sPct(pp) + ")"));
    row.appendChild(right);
    return row;
  }
  function closedPct(t) {
    var p = num(t.pnl_usd), s = num(t.size_usd);
    if (p != null && s) return (p / s) * 100;
    /* t186: size_usd is 0 on some challenge rows; fall back to the real entry/exit prices. */
    var en = num(t.entry_price), ex = num(t.exit_price);
    return en && ex != null ? (ex / en - 1) * 100 : null;
  }
  function renderOpen(hostId, nId, box) {
    var host = $(hostId);
    if (!host) return;
    var rows = box.open || [];
    var n = $(nId);
    if (n) n.textContent = rows.length + " öppna";
    host.innerHTML = "";
    if (!rows.length) { host.appendChild(el("p", "empty-hint", box.status === "paused" ? "Inga öppna positioner (pausad)." : "Inga öppna positioner.")); return; }
    rows.forEach(function (r) { host.appendChild(openRow(r)); });
  }
  function renderClosedStrip(box) {
    var host = $("hem-closed");
    if (!host) return;
    var rows = box.trades || [];
    var n = $("hem-closed-n");
    if (n) n.textContent = rows.length + " totalt";
    host.innerHTML = "";
    if (!rows.length) { host.appendChild(el("p", "empty-hint", "Inga stängda trades än.")); return; }
    rows.slice(0, 10).forEach(function (t) {
      var pnl = num(t.pnl_usd);
      var c = el("article", "closed-card " + (pnl == null ? "flat" : pnl >= 0 ? "up" : "down"));
      c.setAttribute("data-id", String(t.id));
      c.setAttribute("data-mint", t.mint || "");
      var top = el("div", "cc-top");
      top.appendChild(coinBadge(t));
      top.appendChild(el("strong", null, sym(t)));
      top.appendChild(el("span", "spot-badge", "Spot"));
      c.appendChild(top);
      var bot = el("div", "cc-bot");
      bot.appendChild(el("b", null, closedPct(t) == null ? "saknas" : sPct(closedPct(t))));
      bot.appendChild(el("span", null, pnl == null ? "saknas" : sUsd(pnl)));
      c.appendChild(bot);
      host.appendChild(c);
    });
  }
  function renderClosedList(box) {
    var host = $("tr-closed");
    if (!host) return;
    var rows = box.trades || [];
    var n = $("tr-closed-n");
    if (n) n.textContent = rows.length + " stängda";
    var on = $("tr-open-n");
    if (on) on.textContent = (box.open || []).length + " öppna";
    host.innerHTML = "";
    if (!rows.length) { host.appendChild(el("p", "empty-hint", "Inga stängda trades än.")); return; }
    rows.forEach(function (t) {
      var pnl = num(t.pnl_usd);
      var row = el("article", "pos-row " + (pnl == null ? "flat" : pnl >= 0 ? "up" : "down"));
      row.appendChild(coinBadge(t));
      var mid = el("div", "pos-mid");
      var top = el("div", "pos-top");
      top.appendChild(el("strong", null, sym(t)));
      top.appendChild(el("span", "spot-badge", "Spot PAPER"));
      mid.appendChild(top);
      mid.appendChild(el("div", "pos-sub", "entry " + price(t.entry_price) + " → exit " + price(t.exit_price) + " · " + (t.exit_reason || "saknas") + " · " + hm(t.closed_at)));
      row.appendChild(mid);
      var right = el("div", "pos-right");
      right.appendChild(el("b", null, pnl == null ? "saknas" : sUsd(pnl)));
      right.appendChild(el("span", null, closedPct(t) == null ? "saknas" : "(" + sPct(closedPct(t)) + ")"));
      row.appendChild(right);
      host.appendChild(row);
    });
  }

  /* ---------- feed (Hem) with typing only for new real events ---------- */
  var __seenFeed = null;
  function typeInto(node, full) {
    if (reduced()) { node.textContent = full; return; }
    var t0 = performance.now(), dur = Math.min(700, Math.max(180, full.length * 14));
    node.classList.add("typing");
    (function step(now) {
      var k = Math.min(1, (now - t0) / dur);
      node.textContent = full.slice(0, Math.round(full.length * k));
      if (k < 1) requestAnimationFrame(step); else node.classList.remove("typing");
    })(t0);
  }
  function renderHemFeed(crew) {
    var host = $("hem-feed");
    if (!host) return;
    var sub = $("hem-feed-sub");
    var feed = (crew && crew.feed) || [];
    var am = agentMap(crew);
    if (sub) sub.textContent = crew ? (crew.active + " av " + crew.total + " agenter aktiva · " + (crew.state || "saknas")) : "agenter saknas";
    var first = __seenFeed == null;
    var seen = __seenFeed || {};
    host.innerHTML = "";
    if (!feed.length) { host.appendChild(el("p", "empty-hint", "Inga agenthändelser ännu.")); }
    feed.slice(0, 8).forEach(function (e) {
      var a = am[e.agent] || {};
      var row = el("div", "fl " + (e.verdict || "info"));
      var tag = el("span", "fl-tag", a.name || e.agent || "saknas");
      tag.style.setProperty("--agent", a.color || "#1F6FE0");
      row.appendChild(tag);
      var tx = el("span", "fl-text");
      row.appendChild(tx);
      if (!first && !seen[e.id]) typeInto(tx, e.text || "saknas");
      else tx.textContent = e.text || "saknas";
      host.appendChild(row);
    });
    var next = {};
    feed.forEach(function (e) { next[e.id] = true; });
    __seenFeed = next;
  }

  /* ---------- AGENTER ---------- */
  function renderChips(crew) {
    var host = $("crew-chips");
    if (!host) return;
    var list = (crew && crew.agents) || [];
    if (!list.length) { host.innerHTML = ""; host.appendChild(el("p", "empty-hint", "Agenter saknas")); return; }
    if (host.children.length !== list.length) {
      host.innerHTML = "";
      list.forEach(function (a) {
        var chip = el("div", "chip");
        chip.setAttribute("data-id", a.id);
        chip.style.setProperty("--agent", a.color);
        var sq = el("span", "chip-sq");
        sq.appendChild(crewIcon(a.id, a.color));
        chip.appendChild(sq);
        chip.appendChild(el("span", "chip-name", a.name));
        chip.appendChild(el("span", "chip-st", ""));
        chip.title = a.role_sv || a.name;
        chip.addEventListener("click", function () {
          var f = $("crew-filter");
          if (!f) return;
          f.value = f.value === a.name ? "" : a.name;
          applyFilter();
        });
        host.appendChild(chip);
      });
    }
    list.forEach(function (a) {
      var chip = host.querySelector('.chip[data-id="' + a.id + '"]');
      if (!chip) return;
      chip.classList.toggle("on", !!a.active);
      chip.querySelector(".chip-st").textContent = a.active ? "aktiv" : "väntar";
    });
  }
  var VERDICT = { info: "i", pass: "✓", veto: "✕" };
  function renderCrewFeed(crew) {
    var host = $("crew-feed");
    if (!host) return;
    var feed = ((crew && crew.feed) || []).slice(0, 30).reverse();
    var am = agentMap(crew);
    var atBottom = host.scrollHeight - host.scrollTop - host.clientHeight < 40;
    host.innerHTML = "";
    if (!feed.length) { host.appendChild(el("p", "empty-hint", "Inga agenthändelser ännu.")); return; }
    feed.forEach(function (e) {
      var a = am[e.agent] || {};
      var row = el("div", "msg " + (e.verdict || "info"));
      row.setAttribute("data-agent", a.name || e.agent || "");
      row.setAttribute("data-text", (e.text || "").toLowerCase());
      row.style.setProperty("--agent", a.color || "#1F6FE0");
      var av = el("span", "msg-av");
      av.appendChild(crewIcon(e.agent, a.color));
      row.appendChild(av);
      var body = el("div", "msg-body");
      var head = el("div", "msg-head");
      head.appendChild(el("strong", null, a.name || e.agent || "saknas"));
      head.appendChild(el("time", null, e.t || "saknas"));
      body.appendChild(head);
      var bub = el("div", "msg-bub");
      var v = el("i", "verdict " + (e.verdict || "info"), VERDICT[e.verdict] || "i");
      v.setAttribute("aria-label", e.verdict === "pass" ? "godkänd" : e.verdict === "veto" ? "veto" : "info");
      bub.appendChild(v);
      bub.appendChild(el("span", null, e.text || "saknas"));
      body.appendChild(bub);
      row.appendChild(body);
      host.appendChild(row);
    });
    applyFilter();
    if (atBottom || !host.dataset.scrolled) { host.scrollTop = host.scrollHeight; host.dataset.scrolled = "1"; }
  }
  function applyFilter() {
    var f = $("crew-filter");
    var q = f ? String(f.value || "").trim().toLowerCase() : "";
    document.querySelectorAll("#crew-feed .msg").forEach(function (m) {
      m.hidden = !!q && m.getAttribute("data-agent").toLowerCase() !== q && m.getAttribute("data-text").indexOf(q) === -1;
    });
    document.querySelectorAll("#crew-chips .chip").forEach(function (c) {
      c.classList.toggle("sel", !!q && c.querySelector(".chip-name").textContent.toLowerCase() === q);
    });
  }

  var __coreN = 0;
  function renderCore(crew) {
    var host = $("crew-core");
    if (!host) return;
    var list = (crew && crew.agents) || [];
    var title = $("core-title");
    if (title) title.textContent = list.length + " agenter → " + ((global.NimbusBrand && NimbusBrand.name) || "PAWS") + "-kärnan";
    if (__coreN === list.length && host.querySelector("svg")) {
      list.forEach(function (a, i) {
        var n = host.querySelector('.core-node[data-i="' + i + '"]');
        if (n) n.classList.toggle("on", !!a.active);
      });
      syncMotion();
      return;
    }
    host.innerHTML = "";
    var W = 320, H = 220, cx = 160, cy = 186, r = 150;
    var svg = sv("svg", { viewBox: "0 0 " + W + " " + H, class: "core-svg" });
    var nodes = list.map(function (a, i) {
      var ang = Math.PI + (Math.PI * (i + 0.5)) / list.length;
      return [cx + r * Math.cos(ang) * 0.95, cy + r * Math.sin(ang) * 0.95];
    });
    list.forEach(function (a, i) {
      var p = nodes[i], id = "crew-path-" + i;
      svg.appendChild(sv("path", { id: id, d: "M " + p[0].toFixed(1) + " " + p[1].toFixed(1) + " Q " + p[0].toFixed(1) + " " + ((p[1] + cy) / 2 + 12).toFixed(1) + " " + cx + " " + (cy - 26), fill: "none", class: "core-path" }));
      var dot = sv("circle", { r: "2.4", fill: a.color, class: "core-particle", opacity: "0" });
      var begin = (i * 0.35) + "s";
      dot.appendChild(sv("set", { attributeName: "opacity", to: "1", begin: begin, fill: "freeze" }));
      var mot = sv("animateMotion", { dur: (2.6 + (i % 3) * 0.4) + "s", repeatCount: "indefinite", begin: begin });
      var mp = sv("mpath", { href: "#" + id });
      mp.setAttributeNS("http://www.w3.org/1999/xlink", "href", "#" + id);
      mot.appendChild(mp);
      dot.appendChild(mot);
      svg.appendChild(dot);
    });
    host.appendChild(svg);
    var arc = el("div", "core-arc");
    list.forEach(function (a, i) {
      var n = el("div", "core-node" + (a.active ? " on" : ""));
      n.setAttribute("data-i", String(i));
      n.style.setProperty("--agent", a.color);
      n.style.left = (nodes[i][0] / W * 100) + "%";
      n.style.top = (nodes[i][1] / H * 100) + "%";
      n.appendChild(el("span", "core-node-name", a.name));
      n.appendChild(el("i", "core-bead"));
      arc.appendChild(n);
    });
    host.appendChild(arc);
    var hub = el("div", "core-hub");
    var img = new Image(); img.src = "icons/mark.png"; img.alt = ""; img.width = 40; img.height = 40;
    hub.appendChild(img);
    hub.appendChild(el("div", "core-hub-name", (((global.NimbusBrand && NimbusBrand.name) || "PAWS").toUpperCase()) + "-KÄRNAN"));
    host.appendChild(hub);
    __coreN = list.length;
    syncMotion();
  }
  function syncMotion() {
    var host = $("crew-core");
    var svg = host && host.querySelector("svg");
    if (!svg) return;
    var off = reduced() || document.hidden;
    try { if (off) svg.pauseAnimations(); else svg.unpauseAnimations(); } catch (e) {}
  }
  document.addEventListener("visibilitychange", syncMotion);

  /* ---------- PLÅNBOK ---------- */
  function renderWallet(state, box, crew) {
    var oscar = num(state.bankroll_usd);
    var book = num(box.equity_usd != null ? box.equity_usd : box.cash_usd);
    var total = $("wal-total");
    if (total) total.textContent = oscar == null && book == null ? "saknas" : usd((oscar || 0) + (book || 0));
    var sub = $("wal-sub");
    if (sub) sub.textContent = "Oscars papperssaldo " + usd(oscar) + " + utmaningsbok " + usd(book) + " · PAPER";
    var stEl = $("desk-state");
    if (stEl) {
      var s = (crew && crew.state) || "saknas";
      stEl.textContent = s;
      stEl.className = "state-badge " + (s === "AKTIV" ? "on" : "");
    }
    var dots = $("desk-dots");
    if (dots && crew) {
      dots.innerHTML = "";
      crew.agents.forEach(function (a) {
        var d = el("i", a.active ? "on" : "");
        d.style.setProperty("--agent", a.color);
        d.title = a.name;
        dots.appendChild(d);
      });
    }
    var line = $("desk-line");
    if (line) {
      var st = (crew && crew.stats) || {};
      line.textContent = crew
        ? (crew.active + "/" + crew.total + " aktiva · " + (st.checks_today == null ? "kontroller saknas" : st.checks_today + " kontroller idag") + " · " + (box.status_sv || "saknas"))
        : "saknas";
    }
    var assets = $("wal-assets");
    if (assets) {
      assets.innerHTML = "";
      var sum = (oscar || 0) + (book || 0);
      [
        { ico: "$", name: "PAPER USD", sub: "Oscars papperssaldo · orört av utmaningen", v: oscar },
        { ico: "logo", name: "Utmaningsbok", sub: "kassa " + usd(box.cash_usd) + " · " + (box.open || []).length + " öppna · insatt " + usd(box.put_in_usd, 0), v: book }
      ].forEach(function (a) {
        var row = el("div", "asset");
        var ic = el("span", "asset-ico" + (a.ico === "logo" ? " logo" : ""));
        if (a.ico === "logo") { var im = new Image(); im.src = "icons/mark.png"; im.alt = ""; ic.appendChild(im); } else ic.textContent = a.ico;
        row.appendChild(ic);
        var mid = el("div", "asset-mid");
        mid.appendChild(el("strong", null, a.name));
        mid.appendChild(el("span", null, a.sub));
        var bar = el("div", "asset-bar");
        var fill = el("i");
        fill.style.width = (sum > 0 && a.v != null ? (a.v / sum) * 100 : 0).toFixed(1) + "%";
        bar.appendChild(fill);
        mid.appendChild(bar);
        row.appendChild(mid);
        row.appendChild(el("b", "asset-v", usd(a.v)));
        assets.appendChild(row);
      });
    }
    var act = $("wal-activity");
    if (act) {
      var rows = [];
      ((crew && crew.cash_activity) || []).forEach(function (c) {
        rows.push({ ts: Date.parse(c.ts || ""), title: c.title, sub: c.t + " · " + String(c.subtitle || "saknas").replace(/^Papperspengar\s*/, ""), v: c.amount_usd == null ? "saknas" : (c.kind === "uttag" ? "-" : "+") + usd(c.amount_usd), cls: c.kind === "uttag" ? "down" : "up", ico: c.kind === "uttag" ? "↑" : "↓" });
      });
      (box.events || []).forEach(function (e) {
        var buy = e.action === "Köp";
        var p = num(e.pnl_usd);
        rows.push({ ts: Date.parse(e.ts || ""), title: (buy ? "Köp · " : "Sälj · ") + sym(e), sub: "Utmaningsbok · " + hm(e.ts), v: buy ? ("-" + usd(e.amount_usd)) : (p == null ? "saknas" : sUsd(p)), cls: buy ? "flat" : (p != null && p < 0 ? "down" : "up"), ico: buy ? "B" : "S" });
      });
      rows.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
      act.innerHTML = "";
      if (!rows.length) act.appendChild(el("p", "empty-hint", "Ingen aktivitet ännu."));
      rows.slice(0, 12).forEach(function (r) {
        var row = el("div", "asset");
        row.appendChild(el("span", "asset-ico act", r.ico));
        var mid = el("div", "asset-mid");
        mid.appendChild(el("strong", null, r.title || "saknas"));
        mid.appendChild(el("span", null, r.sub || "saknas"));
        row.appendChild(mid);
        row.appendChild(el("b", "asset-v " + r.cls, r.v));
        act.appendChild(row);
      });
    }
  }

  /* ---------- in-app notice + trade→marker link ---------- */
  var __seenEv = null, __seenClosed = null;
  function notice(title, body) {
    var n = $("sw-notice");
    if (!n) return;
    $("sw-notice-title").textContent = title;
    $("sw-notice-body").textContent = body;
    n.hidden = false;
    n.classList.remove("in"); void n.offsetWidth; n.classList.add("in");
    clearTimeout(n.__t);
    n.__t = setTimeout(function () { n.hidden = true; }, 4500);
  }
  function linkTrade(trade) {
    if (reduced()) return;
    var panel = $("panel-hem");
    if (!panel || panel.hidden) return;
    var card = document.querySelector('#hem-closed .closed-card[data-id="' + trade.id + '"]');
    var marks = document.querySelectorAll('#sw-chart .mark[data-mint="' + (trade.mint || "") + '"]');
    var mark = marks.length ? marks[marks.length - 1].querySelector("circle") : null;
    if (!card || !mark) return;
    var a = card.getBoundingClientRect(), b = mark.getBoundingClientRect();
    var x1 = a.left + a.width / 2, y1 = a.top + 6, x2 = b.left + b.width / 2, y2 = b.top + b.height / 2;
    var color = num(trade.pnl_usd) != null && num(trade.pnl_usd) < 0 ? "#D93636" : "#0E9F5A";
    var s = sv("svg", { class: "sw-link", width: global.innerWidth, height: global.innerHeight });
    var d = "M" + x1 + "," + y1 + " C" + x1 + "," + (y1 - 60) + " " + x2 + "," + (y2 + 60) + " " + x2 + "," + y2;
    var mask = sv("mask", { id: "swLinkMask" });
    var mp = sv("path", { d: d, stroke: "#fff", "stroke-width": "4", fill: "none", pathLength: "100", class: "sw-link-draw" });
    mask.appendChild(mp);
    s.appendChild(mask);
    s.appendChild(sv("path", { d: d, stroke: color, "stroke-width": "1.6", "stroke-dasharray": "3 4", fill: "none", mask: "url(#swLinkMask)" }));
    document.body.appendChild(s);
    setTimeout(function () { s.classList.add("out"); }, 1600);
    setTimeout(function () { s.remove(); }, 2200);
  }
  function watchEvents(box, crew) {
    var evs = box.events || [];
    var closed = box.trades || [];
    if (__seenEv == null) {
      __seenEv = {}; evs.forEach(function (e) { __seenEv[e.id] = true; });
      __seenClosed = {}; closed.forEach(function (t) { __seenClosed[t.id] = true; });
      return;
    }
    evs.slice().reverse().forEach(function (e) {
      if (e.id == null || __seenEv[e.id]) return;
      __seenEv[e.id] = true;
      var buy = e.action === "Köp";
      notice("HANDLARE · " + (buy ? "köpte " : "sålde ") + sym(e), buy ? (usd(e.amount_usd) + " · entry " + price(e.entry_price) + " · PAPER") : ((num(e.pnl_usd) == null ? "saknas" : sUsd(e.pnl_usd)) + " · " + (e.kind || "sälj") + " · PAPER"));
    });
    closed.forEach(function (t) {
      if (__seenClosed[t.id]) return;
      __seenClosed[t.id] = true;
      setTimeout(function () { linkTrade(t); }, 120);
    });
  }

  /* ---------- tabs + wiring ---------- */
  function onTab(name) {
    if (name === "agenter") {
      var f = $("crew-feed");
      if (f) setTimeout(function () { f.scrollTop = f.scrollHeight; }, 0);
    }
  }
  function wire() {
    if (wire.done) return;
    wire.done = true;
    var f = $("crew-filter");
    if (f) f.addEventListener("input", applyFilter);
    var h = $("btn-history");
    if (h) h.addEventListener("click", function () {
      var t = $("wal-activity-head");
      if (t) t.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
    });
    wireCashSheet();
    setInterval(paintProgress, 1000);
  }

  /* ---------- Insättning / Uttag bottom sheet ---------- */
  function wireCashSheet() {
    var sheet = $("cash-sheet"), input = $("cash-amount"), pills = $("cash-pills");
    var slide = $("cash-slide"), knob = $("cash-slide-knob"), text = $("cash-slide-text");
    var form = $("cash-form"), ok = $("cash-confirm");
    if (!sheet || !input || !slide || !knob || !form || !ok) return;
    function avail() { try { return global.NimbusCash ? global.NimbusCash.available() : null; } catch (e) { return null; } }
    function kind() { return sheet.dataset.kind || "deposit"; }
    function paintPills() {
      pills.innerHTML = "";
      var k = kind();
      var opts = k === "withdraw" ? [["25%", 0.25], ["50%", 0.5], ["75%", 0.75], ["Max", 1]] : [["$25", 25], ["$50", 50], ["$100", 100], ["$200", 200]];
      var a = avail();
      opts.forEach(function (o) {
        var b = el("button", "pill-btn", o[0]);
        b.type = "button";
        b.addEventListener("click", function () {
          var v = k === "withdraw" ? (a == null ? null : Math.floor(a * o[1] * 100) / 100) : o[1];
          if (v == null) return;
          input.value = String(v);
          fit();
          pills.querySelectorAll(".pill-btn").forEach(function (x) { x.classList.toggle("on", x === b); });
        });
        pills.appendChild(b);
      });
      var av = $("cash-avail");
      if (av) av.textContent = "Tillgängligt " + (a == null ? "saknas" : usd(a)) + " · PAPER";
      if (text) text.textContent = (k === "withdraw" ? "Dra för att ta ut" : "Dra för att sätta in") + " ›››";
    }
    function fit() { input.style.width = Math.max(1, String(input.value || "0").length) + 0.3 + "ch"; }
    input.addEventListener("input", fit);
    function reset() { fit(); knob.style.transform = "translateX(0)"; slide.classList.remove("done"); slide.setAttribute("aria-valuenow", "0"); }
    var obs = new MutationObserver(function () { if (sheet.open) { paintPills(); reset(); input.blur(); } });
    obs.observe(sheet, { attributes: true, attributeFilter: ["open"] });
    var drag = null;
    function maxX() { return slide.clientWidth - knob.offsetWidth - 8; }
    function commit() {
      slide.classList.add("done");
      if (form.requestSubmit) form.requestSubmit(ok); else ok.click();
      setTimeout(reset, 400);
    }
    slide.addEventListener("pointerdown", function (ev) {
      drag = { x0: ev.clientX, dx: 0 };
      try { slide.setPointerCapture(ev.pointerId); } catch (e) {}
      knob.style.transition = "none";
    });
    slide.addEventListener("pointermove", function (ev) {
      if (!drag) return;
      drag.dx = Math.max(0, Math.min(maxX(), ev.clientX - drag.x0));
      knob.style.transform = "translateX(" + drag.dx + "px)";
      slide.setAttribute("aria-valuenow", String(Math.round(drag.dx / Math.max(1, maxX()) * 100)));
    });
    function end() {
      if (!drag) return;
      var done = drag.dx >= maxX() * 0.9;
      drag = null;
      knob.style.transition = "";
      if (done) { knob.style.transform = "translateX(" + maxX() + "px)"; commit(); } else reset();
    }
    slide.addEventListener("pointerup", end);
    slide.addEventListener("pointercancel", end);
    slide.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); commit(); }
    });
    sheet.addEventListener("click", function (ev) { if (ev.target === sheet) sheet.close(); });
  }

  function render(state) {
    if (!state) return;
    wire();
    var box = state.challenge || {};
    var crew = box.crew || null;
    renderBalance(box);
    renderChart(box);
    renderEmpty(box, crew);
    renderWhy(box, crew);
    renderOpen("hem-open", "hem-open-n", box);
    renderOpen("tr-open", "tr-open-n", box);
    renderClosedStrip(box);
    renderClosedList(box);
    renderHemFeed(crew);
    renderChips(crew);
    renderCrewFeed(crew);
    renderCore(crew);
    renderWallet(state, box, crew);
    var sub = $("sw-sub");
    if (sub) sub.textContent = (crew ? crew.total : 7) + " agenter · Solana spot";
    watchEvents(box, crew);
  }

  global.SwipeUI = { render: render, onTab: onTab };
  if (global.__nimbusLastState) {
    try { render(global.__nimbusLastState); } catch (e) {}
  }
})(window);
