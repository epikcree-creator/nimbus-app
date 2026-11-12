/* PAWS v75 — lean app, clean aurora theme. Reads state.json exactly like v72/v71 (same storage keys, same fragment #d=..&t=.., same poll cadence).
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

  var APP_AGENTS = [
    { id: "scanner", n: "Scanner" }, { id: "auditor", n: "Auditor" }, { id: "analyst", n: "Analyst" },
    { id: "executor", n: "Executor" }, { id: "risk", n: "Risk" }
  ];
  /* Team roster for Oscar's view. Role lines are descriptions only; status and last activity come from state.team[id] if the
     desk ever publishes it, otherwise they read "saknas" (never invented). */
  var TEAM = [
    { id: "hunter", n: "Hunter", r: "Jagar strategier och nya köpregler" },
    { id: "judge", n: "Judge", r: "Granskar och godkänner ändringar" },
    { id: "engineer", n: "Engineer", r: "Bygger och driftsätter koden" },
    { id: "sentinel", n: "Sentinel", r: "Vakar över desken och larmar" },
    { id: "scout", n: "Scout", r: "Bevakar X och nya lanseringar" },
    { id: "whale", n: "Whale Watcher", r: "Följer stora plånböcker", keys: ["whale_watcher", "whale"] },
    { id: "auditor", n: "Auditor", r: "Kontrollerar data och resultat", keys: ["auditor_bot", "auditor_team"] },
    { id: "risk", n: "Risk Manager", r: "Positionsstorlek och stop-loss", keys: ["risk_manager", "risk"] },
    { id: "reporter", n: "Reporter", r: "Sammanfattar för Oscar" }
  ];

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
  function avatar(row, sell) {
    var a = el("span", "av" + (sell ? " sell" : ""));
    var s = String(row.symbol || "?").replace(/^\$/, "");
    a.textContent = s.slice(0, 2).toUpperCase();
    return a;
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
    row.appendChild(v);
    var lo = num(p.stop_price), hi = num(p.take_profit_price), cur = num(p.current_price);
    if (lo != null && hi != null && cur != null && hi > lo) {
      var f = Math.max(0, Math.min(1, (cur - lo) / (hi - lo)));
      var g = el("div", "gauge"); g.title = "stopp → mål";
      var b = el("b"); b.style.width = (f * 100).toFixed(1) + "%"; g.appendChild(b);
      var i = el("i"); i.style.left = "calc(" + (f * 100).toFixed(1) + "% - 1px)"; g.appendChild(i);
      row.appendChild(g);
    }
    return row;
  }
  var KIND = { "köp": "KÖP" };
  function evRow(e, fresh) {
    var buy = e.action === "Köp";
    var row = el("div", "row" + (fresh ? " fresh" : "")); row.dataset.ev = e.id; row.dataset.mint = e.mint || "";
    row.appendChild(avatar(e, !buy));
    var m = el("div", "row-m"), st = el("strong");
    st.appendChild(el("span", "badge" + (buy ? "" : " s"), buy ? "KÖP" : (e.kind && e.kind !== "sälj" ? e.kind : "SÄLJ")));
    st.appendChild(document.createTextNode(sym(e.symbol)));
    m.appendChild(st);
    m.appendChild(el("span", null, hm(e.ts) + " · " + (buy ? "PAPER-köp" : brand(e.reason_sv || "sälj"))));
    row.appendChild(m);
    var v;
    if (buy) { v = el("div", "row-v", usd(e.amount_usd)); }
    else { var p = num(e.pnl_usd); v = el("div", "row-v " + (p == null ? "" : p < 0 ? "down" : "up"), sUsd(p)); if (num(e.amount_usd) != null) v.appendChild(el("small", null, usd(e.amount_usd))); }
    row.appendChild(v);
    return row;
  }
  function fill(host, rows, emptyText) {
    host.innerHTML = "";
    if (!rows.length) { host.appendChild(el("div", "empty", emptyText)); return; }
    rows.forEach(function (r) { host.appendChild(r); });
  }
  function chips(host, hb) {
    host.innerHTML = "";
    var ok = 0;
    APP_AGENTS.forEach(function (a) {
      var v = hb[a.id], live = hbOk(v); if (live) ok++;
      var c = el("span", "chip" + (live ? " ok" : "")); c.appendChild(el("i")); c.appendChild(document.createTextNode(a.n));
      c.appendChild(el("small", null, v == null ? "saknas" : live ? "igång" : String(v).slice(0, 14)));
      host.appendChild(c);
    });
    return ok;
  }
  function paintStatic() {
    var boss = $("boss"); boss.innerHTML = "";
    var av = el("span", "av"); var im = el("img"); im.src = "icons/mark.png"; im.alt = ""; av.appendChild(im); boss.appendChild(av);
    var d = el("div"), h = el("h3", null, "PAWS"); h.appendChild(el("span", "decal", "Chef")); d.appendChild(h);
    d.appendChild(el("p", null, "Leder teamet och tar de slutliga besluten.")); boss.appendChild(d);
    var host = $("roster"); host.innerHTML = "";
    TEAM.forEach(function (b) {
      var r = el("div", "bot"); r.id = "bot-" + b.id;
      r.appendChild(el("span", "av", b.n.split(/\s+/).map(function (w) { return w[0]; }).join("").slice(0, 2).toUpperCase()));
      var m = el("div"); m.appendChild(el("strong", null, b.n)); m.appendChild(el("span", "role", b.r)); r.appendChild(m);
      var s = el("div", "st"); s.appendChild(el("b", null, "saknas")); s.appendChild(el("span", null, "senast: saknas")); r.appendChild(s);
      host.appendChild(r);
    });
  }
  function renderTeam(state) {
    var team = (state && state.team) || {};
    TEAM.forEach(function (b) {
      var t = null; [b.id].concat(b.keys || []).forEach(function (k) { if (!t && team[k]) t = team[k]; });
      var s = document.querySelector("#bot-" + b.id + " .st"); if (!s) return;
      var status = t && (t.status_sv || t.status), act = t && (t.last_activity_sv || t.last_activity), at = t && (t.last_at || t.updated_at);
      s.className = "st" + (status && /^(ok|aktiv|igång|live)/i.test(String(status)) ? " ok" : "");
      s.firstChild.textContent = status ? brand(String(status)).slice(0, 14) : "saknas";
      s.lastChild.textContent = "senast: " + (act ? brand(String(act)).slice(0, 26) : at ? dm(at) : "saknas");
    });
  }

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
    $("ch-tag").textContent = stt === "running" ? "pågår" : stt === "finished" || stt === "aborted" ? "klar" : stt ? stt : "saknas";
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
    fill($("trades-list"), evs.slice(0, 40).map(function (e) { return evRow(e, false); }), "Inga PAPER-trades än");
    $("tr-tag").textContent = String(evs.length);
    var sum = $("tr-sum"); sum.innerHTML = "";
    [["Stängda", closed == null ? "saknas" : String(closed), ""], ["Vinster", wins == null ? "saknas" : String(wins), ""], ["Realiserat", sUsd(rp), rp == null ? "" : rp < 0 ? "down" : "up"]].forEach(function (x) {
      var d = el("div"); d.appendChild(el("dt", null, x[0])); d.appendChild(el("dd", x[2], x[1])); sum.appendChild(d);
    });

    /* app agents */
    var n1 = chips($("ag-strip"), hb); chips($("ag-strip2"), hb);
    var tot = APP_AGENTS.length, txt = Object.keys(hb).length ? n1 + "/" + tot + " live" : "saknas";
    $("ag-tag").textContent = txt; $("ag-tag2").textContent = txt;
    renderTeam(state);

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
    var cd = $("ch-count"), bar = $("ch-bar"); if (!cd) return;
    var ends = Date.parse(cd.dataset.ends || ""), st = Date.parse(cd.dataset.started || "");
    if (!isFinite(ends) || !cd.dataset.run) { cd.textContent = cd.dataset.ends ? "klar" : "--:--:--"; if (cd.dataset.ends && isFinite(st)) bar.style.width = "100%"; return; }
    var sec = Math.max(0, Math.floor((ends - Date.now()) / 1000));
    var dd = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60), r = sec % 60, p = function (n) { return String(n).padStart(2, "0"); };
    cd.textContent = (dd ? dd + "d " : "") + p(h) + ":" + p(m) + ":" + p(r);
    if (isFinite(st) && ends > st) bar.style.width = Math.min(100, Math.max(0, (Date.now() - st) / (ends - st) * 100)).toFixed(1) + "%";
  }
  setInterval(tickCountdown, 1000);

  /* ---------- tabs + horizontal swipe ---------- */
  var TABS = ["home", "trades", "team"];
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

    pager.addEventListener("touchstart", function (e) {
      if (e.touches.length !== 1) { dragging = false; return; }
      onStart(e.touches[0].clientX, e.touches[0].clientY, e);
    }, { passive: true });
    pager.addEventListener("touchmove", function (e) {
      if (!e.touches.length) return;
      onMove(e.touches[0].clientX, e.touches[0].clientY, e);
    }, { passive: false });
    pager.addEventListener("touchend", function (e) {
      var t = e.changedTouches[0];
      onEnd(t ? t.clientX : lastX, t ? t.clientY : lastY);
    }, { passive: true });
    pager.addEventListener("touchcancel", function () {
      if (dragging && locked === "h") showTab(TABS[tabIndex], { keepScroll: true, animate: true });
      dragging = false;
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

  paintStatic();
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
