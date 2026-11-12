/* PAWS v79 — layout C "Ljus" on the v78 engine (same data contract, swipe pager, poll cadence). Originally v75: lean app. Reads state.json exactly like v72/v71 (same storage keys, same fragment #d=..&t=.., same poll cadence).
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
var HUES = [["#7C5CF0","#B9A4FB"],["#5B6CF0","#9DB4FF"],["#9A5CF0","#E0A8F5"],["#6D5BD0","#A78BFA"],["#B05CD8","#F0A8D8"]];
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
    row.appendChild(v);
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
    sp.appendChild(document.createTextNode(hm(e.ts) + " · " + (buy ? "PAPER-köp" : brand(e.reason_sv || "sälj"))));
    m.appendChild(sp);
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
function dayKey(iso) { var d = new Date(iso); if (!iso || isNaN(d)) return "okänd"; return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit" }).format(d); }
  function dayLabel(iso) {
    var k = dayKey(iso); if (k === "okänd") return "Tid saknas";
    var now = Date.now();
    if (k === dayKey(new Date(now).toISOString())) return "Idag";
    if (k === dayKey(new Date(now - 86400000).toISOString())) return "Igår";
    return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", day: "numeric", month: "long" }).format(new Date(iso));
  }
  function fillGrouped(host, evs, emptyText) {
    host.innerHTML = "";
    if (!evs.length) { var l0 = el("div", "list"); l0.appendChild(el("div", "empty", emptyText)); host.appendChild(l0); return; }
    var cur = null, list = null;
    evs.forEach(function (e) {
      var k = dayKey(e.ts);
      if (k !== cur) { cur = k; host.appendChild(el("div", "dl", dayLabel(e.ts))); list = el("div", "list"); host.appendChild(list); }
      list.appendChild(evRow(e, false));
    });
  }
  function paintStatic() {
    var boss = $("boss"); boss.innerHTML = "";
    var im = el("img", "bimg"); im.src = "icons/hydra.png?v=79"; im.alt = ""; boss.appendChild(im);
    var d = el("div"), h = el("h3", null, "PAWS"); h.appendChild(el("span", null, "CHEF")); d.appendChild(h);
    d.appendChild(el("p", null, "Leder teamet och tar de slutliga besluten.")); boss.appendChild(d);
    var host = $("roster"); host.innerHTML = "";
    TEAM.forEach(function (b) {
      var r = el("div", "bot"); r.id = "bot-" + b.id;
      var a = el("div", "a");
      var av = el("span", "av", b.n.split(/\s+/).map(function (w) { return w[0]; }).join("").slice(0, 2).toUpperCase());
      var h2 = hueOf(b.n); av.style.setProperty("--h1", h2[0]); av.style.setProperty("--h2", h2[1]);
      a.appendChild(av);
      var m = el("div"); m.appendChild(el("strong", null, b.n)); m.appendChild(el("div", "st", "saknas")); a.appendChild(m);
      r.appendChild(a);
      r.appendChild(el("span", "role", b.r));
      var l = el("span", "last", ""); l.hidden = true; r.appendChild(l);
      host.appendChild(r);
    });
  }
  function renderTeam(state) {
    var team = (state && state.team) || {};
    TEAM.forEach(function (b) {
      var t = null; [b.id].concat(b.keys || []).forEach(function (k) { if (!t && team[k]) t = team[k]; });
      var s = document.querySelector("#bot-" + b.id + " .st"), l = document.querySelector("#bot-" + b.id + " .last"); if (!s) return;
      var status = t && (t.status_sv || t.status), act = t && (t.last_activity_sv || t.last_activity), at = t && (t.last_at || t.updated_at);
      s.className = "st" + (status && /^(ok|aktiv|igång|live)/i.test(String(status)) ? " ok" : "");
      s.textContent = status ? brand(String(status)).slice(0, 18) : "saknas";
      var lt = act ? brand(String(act)).slice(0, 30) : at ? dm(at) : "";
      l.textContent = lt ? "senast: " + lt : ""; l.hidden = !lt;
    });
  }

  /* ---------- Förslag: real state.suggestions.cards only. Nothing is invented; missing values read "saknas". ---------- */
  var deckIdx = 0, deckKey = "";
  function compactUsd(n) { var a = Math.abs(n); return (n < 0 ? "-$" : "$") + (a >= 1e6 ? (a / 1e6).toFixed(1) + "M" : a >= 1e3 ? (a / 1e3).toFixed(1) + "k" : a.toFixed(a >= 10 ? 0 : 2)); }
  function scoreVal(p) {
    var v = p && p.value;
    if (v == null || v === "" || v === "saknas") return null;
    if (typeof v === "number") { if (/pct/.test(p.key || "")) return v.toFixed(1) + " %"; if (/usd/.test(p.key || "")) return compactUsd(v); return String(v); }
    return brand(String(v));
  }
  var CK = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>', CX = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>', CD = '<svg viewBox="0 0 24 24"><path d="M7 12h10"/></svg>';
  function cardEl(c, i, n) {
    var d = el("div", "dc");
    var h = el("div", "h"); h.appendChild(avatar({ symbol: c.symbol || c.initials || "?" }));
    var t = el("div"); t.appendChild(el("b", null, c.symbol ? sym(c.symbol) : "saknas")); t.appendChild(el("span", "n", c.name ? String(c.name) : "namn saknas")); h.appendChild(t);
    var rating = c.rating ? String(c.rating) : null;
    h.appendChild(el("span", "rt" + (rating === "Starkt" ? " ok" : rating === "Medel" ? " warn" : ""), rating || "betyg saknas"));
    d.appendChild(h);
    var parts = (c.score || []).filter(function (p) { return p && p.key !== "rating"; });
    if (parts.length) {
      var met = el("div", "met");
      parts.slice(0, 4).forEach(function (p) {
        var x = el("div"); x.appendChild(el("span", null, brand(p.label_sv || p.key || "")));
        var v = scoreVal(p); x.appendChild(el("b", v == null ? "miss" : "", v == null ? "saknas" : v)); met.appendChild(x);
      });
      d.appendChild(met);
    }
    var gates = c.gates && c.gates.gates;
    if (gates && gates.length) {
      gates.forEach(function (g) {
        var na = g.status === "saknas", ok = !!g.ok;
        var row = el("div", "ck " + (ok ? "" : na ? "na" : "no")); var ic = el("i"); ic.innerHTML = ok ? CK : na ? CD : CX; row.appendChild(ic);
        row.appendChild(el("span", null, brand(g.label_sv || g.code || "saknas")));
        var dt = g.detail_sv && g.detail_sv !== "saknas" ? String(g.detail_sv) : null;
        row.appendChild(el("b", dt ? "" : "miss", dt || "saknas")); d.appendChild(row);
      });
    } else { d.appendChild(el("p", "fnote", "Rug-filter: saknas")); }
    var note = c.notes_missing ? null : c.notes; if (note) d.appendChild(el("p", "fnote", brand(String(note))));
    if (c.rated_at) d.appendChild(el("p", "fnote", "Bedömd " + hm(c.rated_at)));
    var acts = el("div", "acts");
    if (n > 1) { var nx = el("button", "btn", "Nästa förslag"); nx.type = "button"; nx.dataset.next = "1"; acts.appendChild(nx); }
    /* The app has no PAPER-buy path for proposals (state.json is read-only). The button is shown disabled; nothing is sent. */
    var buy = el("button", "btn pri two"); buy.type = "button"; buy.disabled = true; buy.appendChild(document.createTextNode("Paper-köp")); buy.appendChild(el("small", null, "saknas"));
    acts.appendChild(buy); d.appendChild(acts);
    return d;
  }
  function renderSuggestions(state) {
    var sg = state && state.suggestions, cards = (sg && sg.cards) || [], host = $("deck"), sub = $("fs-sub");
    sub.textContent = sg && sg.note_sv ? brand(String(sg.note_sv)) : "saknas";
    var key = cards.map(function (c) { return c.mint; }).join(",");
    if (key !== deckKey) { deckKey = key; deckIdx = 0; }
    if (deckIdx >= cards.length) deckIdx = 0;
    host.innerHTML = "";
    if (!cards.length) {
      var e = el("div", "empty-card"); var lc = el("span", "logo-chip big"); var im = el("img"); im.src = "icons/hydra.png?v=79"; im.alt = ""; lc.appendChild(im); e.appendChild(lc);
      e.appendChild(el("h3", null, sg ? "Inga förslag just nu" : "Förslag saknas"));
      e.appendChild(el("p", null, sg && sg.note_sv ? brand(String(sg.note_sv)) : "Desken publicerar inga förslag."));
      host.appendChild(e); return;
    }
    var deck = el("div", "deck");
    var left = cards.length - 1;
    if (left >= 2) deck.appendChild(el("div", "ghost g2"));
    if (left >= 1) deck.appendChild(el("div", "ghost g1"));
    deck.appendChild(cardEl(cards[deckIdx], deckIdx, cards.length));
    host.appendChild(deck);
    if (cards.length > 1) {
      var dots = el("div", "dots");
      cards.forEach(function (c, i) { dots.appendChild(el("i", i === deckIdx ? "on" : "")); });
      host.appendChild(dots);
    }
    var nx = host.querySelector("[data-next]");
    if (nx) nx.addEventListener("click", function () { deckIdx = (deckIdx + 1) % cards.length; renderSuggestions(last); });
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

    /* app agents */
    var n1 = chips($("ag-strip2"), hb);
    var tot = APP_AGENTS.length, txt = Object.keys(hb).length ? n1 + "/" + tot + " live" : "saknas";
    $("ag-tag2").textContent = txt;
    renderTeam(state);
    renderSuggestions(state);

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
  var TABS = ["home", "trades", "team", "forslag"];
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
