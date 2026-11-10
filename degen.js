/* Degen t182: two-column "blood moon" layout after Oscar's TikTok reference.
   Phone: horizontal scroll-snap pages (Wallet · Agents · Utmaning · Trades · Flöde · Plånbok).
   >=900px: Wallet 40% + Agents 60% side by side, extra pages to the right.
   Real desk data only (state.json). Missing values read "saknas" or "—". PAPER only; LIVE stays locked. */
(function (g) {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  var NS = "http://www.w3.org/2000/svg";
  function sv(tag, a) { var n = document.createElementNS(NS, tag); for (var k in a) n.setAttribute(k, a[k]); return n; }
  function num(v) { var n = Number(v); return v == null || v === "" || !isFinite(n) ? null : n; }
  function usd(v, d) { var n = num(v); if (n == null) return "saknas"; d = d == null ? 2 : d; return (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function sUsd(v) { var n = num(v); if (n == null) return "—"; return (n >= 0 ? "+$" : "-$") + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function sPct(n) { if (n == null || !isFinite(n)) return "—"; return (n >= 0 ? "+" : "") + n.toFixed(Math.abs(n) >= 100 ? 0 : 1) + "%"; }
  function sym(r) { var s = (r && (r.symbol || (r.mint || "").slice(0, 6))) || "saknas"; return s.charAt(0) === "$" ? s : "$" + s; }
  function reduced() { return !!(g.matchMedia && g.matchMedia("(prefers-reduced-motion: reduce)").matches); }
  function hm(iso) { var d = new Date(iso); if (!iso || isNaN(d)) return "saknas"; return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", hour: "2-digit", minute: "2-digit" }).format(d); }
  function brand() { return (g.NimbusBrand && g.NimbusBrand.name) || "Degen"; }

  /* Each real desk agent keeps one unique neon colour. */
  var AG = {
    lyssnare:  { c: "#FF8A1F", n: "Lyssnare",  r: "intag · X-koll", k: "mynt / h" },
    botjagare: { c: "#A259FF", n: "Botjägare", r: "bundlers · snipers", k: "bevakas" },
    kedjekoll: { c: "#22D3EE", n: "Kedjekoll", r: "STRICT on-chain", k: "godkända idag" },
    skeptiker: { c: "#FF4D6D", n: "Skeptiker", r: "momentum · 7 grindar", k: "stoppade idag" },
    storlek:   { c: "#FFD60A", n: "Storlek",   r: "ticketstorlek", k: "ticket" },
    handlare:  { c: "#2EE6A0", n: "Handlare",  r: "PAPER köp och sälj", k: "sedan start" },
    dagbok:    { c: "#5B8CFF", n: "Dagbok",    r: "journal · lärdomar", k: "stängda" }
  };
  var ICON = {
    lyssnare: "M4 12a8 8 0 0 1 16 0M7.5 12a4.5 4.5 0 0 1 9 0M12 12v8",
    botjagare: "M12 3v4M12 17v4M3 12h4M17 12h4M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z",
    kedjekoll: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
    skeptiker: "M12 3l8 4v5c0 4.5-3.4 7.6-8 9-4.6-1.4-8-4.5-8-9V7zM9 12h6",
    storlek: "M12 4v16M5 8h14M5 8l-3 6a3 3 0 0 0 6 0zM19 8l-3 6a3 3 0 0 0 6 0z",
    handlare: "M13 2L4 14h7l-1 8 10-12h-7z",
    dagbok: "M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h11"
  };
  function agentIcon(id) {
    var s = sv("svg", { viewBox: "0 0 24 24", "aria-hidden": "true" });
    s.appendChild(sv("path", { d: ICON[id] || ICON.lyssnare, fill: "none", stroke: "#fff", "stroke-width": "2.1", "stroke-linecap": "round", "stroke-linejoin": "round" }));
    return s;
  }
  function coin(r, badgeColor) {
    var w = el("span", "dg-coin");
    var letter = sym(r).replace(/^\$/, "").slice(0, 1).toUpperCase() || "?";
    if (r && r.image_url) {
      var im = new Image(); im.alt = ""; im.loading = "lazy"; im.referrerPolicy = "no-referrer";
      im.onerror = function () { im.remove(); w.textContent = letter; };
      im.src = r.image_url; w.appendChild(im);
    } else w.textContent = letter;
    if (badgeColor) { var b = el("i", "dg-coin-badge"); b.style.background = badgeColor; w.appendChild(b); }
    return w;
  }

  /* ---------- odometer ---------- */
  function odometer(host, text) {
    if (!host) return;
    if (host.__txt === text) return;
    var old = host.__txt; host.__txt = text;
    host.setAttribute("aria-label", text);
    var shape = text.replace(/\d/g, "0");
    if (!old || old.replace(/\d/g, "0") !== shape || reduced()) {
      host.innerHTML = "";
      for (var i = 0; i < text.length; i++) {
        var ch = text.charAt(i);
        if (/\d/.test(ch)) {
          var cell = el("span", "odo-d"); var strip = el("span", "odo-s");
          for (var d = 0; d <= 9; d++) strip.appendChild(el("span", null, String(d)));
          cell.appendChild(strip); host.appendChild(cell);
          strip.style.transform = "translateY(" + (-(old ? Number(ch) : 0)) + "em)";
          (function (s, v) { requestAnimationFrame(function () { requestAnimationFrame(function () { s.style.transform = "translateY(" + (-v) + "em)"; }); }); })(strip, Number(ch));
        } else host.appendChild(el("span", "odo-c", ch));
      }
      return;
    }
    var cells = host.children;
    for (var j = 0; j < text.length; j++) {
      var c = text.charAt(j);
      if (/\d/.test(c) && cells[j] && cells[j].firstChild) cells[j].firstChild.style.transform = "translateY(" + (-Number(c)) + "em)";
    }
  }

  /* ---------- charts ---------- */
  function linePath(pts) {
    var d = "";
    for (var i = 0; i < pts.length; i++) {
      if (!i) { d = "M" + pts[0][0].toFixed(1) + "," + pts[0][1].toFixed(1); continue; }
      var p0 = pts[i - 2] || pts[i - 1], p1 = pts[i - 1], p2 = pts[i], p3 = pts[i + 1] || p2;
      d += " C" + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + "," + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) + " " +
        (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + "," + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) + " " + p2[0].toFixed(1) + "," + p2[1].toFixed(1);
    }
    return d;
  }
  var gid = 0;
  function neonChart(values, color, opts) {
    opts = opts || {};
    var W = 200, H = 60, pad = 6;
    var s = sv("svg", { viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "none", class: "dg-chart", "aria-hidden": "true" });
    var id = "dgg" + (++gid);
    var defs = sv("defs", {});
    var lg = sv("linearGradient", { id: id, x1: "0", y1: "0", x2: "0", y2: "1" });
    lg.appendChild(sv("stop", { offset: "0", "stop-color": color, "stop-opacity": ".38" }));
    lg.appendChild(sv("stop", { offset: "1", "stop-color": color, "stop-opacity": "0" }));
    defs.appendChild(lg); s.appendChild(defs);
    s.appendChild(sv("line", { x1: "0", x2: String(W), y1: "8", y2: "8", class: "dg-tp" }));
    var vals = (values || []).filter(function (v) { return v != null && isFinite(v); });
    if (vals.length < 2) {
      s.appendChild(sv("line", { x1: "0", x2: String(W), y1: String(H - 14), y2: String(H - 14), class: "dg-flat", stroke: color }));
      return s;
    }
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
    var pts = vals.map(function (v, i) { return [i / (vals.length - 1) * (W - pad), H - 6 - (v - lo) / (hi - lo) * (H - 22)]; });
    var d = linePath(pts);
    s.appendChild(sv("path", { d: d + " L" + pts[pts.length - 1][0].toFixed(1) + "," + H + " L0," + H + " Z", fill: "url(#" + id + ")", class: "dg-area" }));
    var line = sv("path", { d: d, fill: "none", stroke: color, "stroke-width": "1.8", "stroke-linejoin": "round", "stroke-linecap": "round", class: "dg-line", pathLength: "100" });
    s.appendChild(line);
    var last = pts[pts.length - 1];
    s.appendChild(sv("circle", { cx: last[0].toFixed(1), cy: last[1].toFixed(1), r: "3.2", fill: color, class: "dg-end" }));
    if (opts.draw && !reduced()) { line.classList.add("draw"); }
    return s;
  }
  /* Agent activity: real feed rows per 3-minute bucket over the last hour. */
  function activitySeries(feed, id, now) {
    var B = 20, out = []; for (var i = 0; i < B; i++) out.push(0);
    var n = 0;
    (feed || []).forEach(function (e) {
      if (e.agent !== id) return;
      var t = Date.parse(e.ts || ""); if (!isFinite(t)) return;
      var age = (now - t) / 60000; if (age < 0 || age >= 60) return;
      out[B - 1 - Math.floor(age / 3)]++; n++;
    });
    /* light 3-tap smoothing so single events read as a pulse, not a spike */
    var sm = out.map(function (v, i) { return ((out[i - 1] || 0) + 2 * v + (out[i + 1] || 0)) / 4; });
    return { n: n, series: sm };
  }

  /* ---------- toasts ---------- */
  function toast(o) {
    var host = $("dg-toasts"); if (!host) return;
    var t = el("div", "dg-toast");
    var av = el("span", "dg-toast-av");
    if (o.coin) av.appendChild(coin(o.coin, o.color)); else { var im = new Image(); im.src = "icons/icon-192.png"; im.alt = ""; av.appendChild(im); }
    t.appendChild(av);
    var mid = el("div", "dg-toast-mid");
    if (o.kicker) mid.appendChild(el("small", null, o.kicker));
    mid.appendChild(el("strong", null, o.title));
    if (o.sub) mid.appendChild(el("span", null, o.sub));
    t.appendChild(mid);
    if (o.value) t.appendChild(el("b", "dg-toast-v " + (o.cls || ""), o.value));
    host.insertBefore(t, host.firstChild);
    while (host.children.length > 3) host.removeChild(host.lastChild);
    requestAnimationFrame(function () { t.classList.add("in"); });
    setTimeout(function () { t.classList.remove("in"); t.classList.add("out"); setTimeout(function () { t.remove(); }, 420); }, o.ms || 4200);
  }

  /* ---------- pager ---------- */
  var PAGES = ["wallet", "agents", "hem", "trades", "planbok"]; /* t186: Flöde page removed */
  var LABEL = { wallet: "Plånbok", agents: "Agenter", hem: "Utmaning", trades: "Trades", planbok: "Konto" };
  var ALIAS = { agenter: "agents", wallet: "wallet", planbok: "planbok" };
  function pager() { return $("dg-pager"); }
  function pageEl(name) { return document.querySelector('.dg-page[data-page="' + name + '"]'); }
  function goPage(name, smooth) {
    var p = pager(), t = pageEl(name); if (!p || !t) return;
    p.scrollTo({ left: t.offsetLeft, behavior: smooth === false || reduced() ? "auto" : "smooth" });
  }
  function currentPage() {
    var p = pager(); if (!p) return "wallet";
    var best = "wallet", bd = 1e9;
    PAGES.forEach(function (n) { var e = pageEl(n); if (!e) return; var d = Math.abs(e.offsetLeft - p.scrollLeft); if (d < bd) { bd = d; best = n; } });
    return best;
  }
  function paintDots() {
    var cur = currentPage();
    var wide = g.matchMedia && g.matchMedia("(min-width: 900px)").matches;
    document.querySelectorAll("#dg-dots button").forEach(function (b) {
      var n = b.getAttribute("data-go");
      var on = n === cur || (wide && cur === "wallet" && n === "agents");
      b.classList.toggle("on", on);
      b.setAttribute("aria-current", on ? "page" : "false");
    });
    document.body.setAttribute("data-page", cur);
  }
  function wirePager() {
    var p = pager(); if (!p || p.__wired) return; p.__wired = true;
    var dots = $("dg-dots");
    PAGES.forEach(function (n) {
      var b = el("button", "dg-dot"); b.type = "button"; b.setAttribute("data-go", n);
      b.setAttribute("aria-label", LABEL[n]); b.title = LABEL[n];
      b.appendChild(el("i")); b.appendChild(el("span", null, LABEL[n]));
      b.addEventListener("click", function () { goPage(n); });
      dots.appendChild(b);
    });
    var raf = 0;
    p.addEventListener("scroll", function () { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; paintDots(); }); }, { passive: true });
    g.addEventListener("resize", paintDots);
    paintDots();
    /* app.js tab changes (recap, legacy links) move the pager instead of hiding panels. */
    g.__nimbusShowTab = function (name) { goPage(PAGES.indexOf(name) >= 0 ? name : (ALIAS[name] || "hem")); };
    if (g.SwipeUI) {
      var orig = g.SwipeUI.onTab;
      g.SwipeUI.onTab = function (name) { try { if (orig) orig(name); } catch (e) {} if (state0) goPage(PAGES.indexOf(name) >= 0 ? name : (ALIAS[name] || "hem")); };
    }
    document.querySelectorAll("[data-dg-go]").forEach(function (b) { b.addEventListener("click", function () { goPage(b.getAttribute("data-dg-go")); }); });
  }

  /* ---------- wallet page ---------- */
  var amount = 100;
  var depositedUntil = 0;
  function wireWallet() {
    var pills = $("dg-pills"); if (!pills || pills.__wired) return; pills.__wired = true;
    var input = $("dg-amount");
    [25, 50, 100, 250].forEach(function (v) {
      var b = el("button", "dg-pill" + (v === amount ? " on" : ""), "$" + v); b.type = "button";
      b.addEventListener("click", function () { amount = v; input.value = String(v); syncAmount(); });
      pills.appendChild(b);
    });
    input.addEventListener("input", function () { var n = Number(String(input.value).replace(/[^0-9.]/g, "")); amount = isFinite(n) && n > 0 ? n : 0; syncAmount(true); });
    $("dg-deposit").addEventListener("click", function () {
      var st = g.__nimbusLastState || {};
      if (String(st.mode || "PAPER").toUpperCase() === "LIVE") { toast({ title: "Riktiga pengar är låsta", sub: "LIVE · bara PAPER", ms: 3000 }); return; }
      if (!(amount > 0)) { input.focus(); return; }
      if (!g.NimbusCash) return;
      g.NimbusCash.open("deposit");
      var ci = $("cash-amount");
      if (ci) { ci.value = String(amount); ci.dispatchEvent(new Event("input")); ci.blur(); }
    });
    var w = $("dg-withdraw"); if (w) w.addEventListener("click", function () { if (g.NimbusCash) g.NimbusCash.open("withdraw"); });
    var form = $("cash-form"), sheet = $("cash-sheet");
    if (form) form.addEventListener("submit", function (ev) {
      if (ev.defaultPrevented) return;
      if (!ev.submitter || ev.submitter.value !== "ok") return;
      if (!sheet || sheet.dataset.kind !== "deposit") return;
      var a = Number(($("cash-amount") || {}).value);
      /* app.js decides whether the write was really sent; read its verdict instead of guessing. */
      setTimeout(function () {
        var host = $("toasts"), last = host && host.lastElementChild;
        var txt = last ? last.textContent : "";
        if (/inte skickat/.test(txt) || !/skickat/.test(txt)) return;
        depositedUntil = Date.now() + 4000; paintDeposit();
        setTimeout(paintDeposit, 4100);
      }, 0);
    });
    var more = $("dg-more"); if (more) more.addEventListener("click", function () { var gear = $("btn-gear"); if (gear) gear.click(); });
    var gear2 = $("dg-gear"); if (gear2) gear2.addEventListener("click", function () { var gear = $("btn-gear"); if (gear) gear.click(); });
    var tog = $("dg-auto"); if (tog) tog.addEventListener("click", function () { toast({ title: "Auto-trade styrs av desken", sub: "PAPER · LIVE låst · ändras inte här", ms: 3200 }); });
    var sbtn = $("dg-tok-search"), sin = $("dg-tok-filter");
    if (sbtn && sin) {
      sbtn.addEventListener("click", function () { sin.hidden = !sin.hidden; if (!sin.hidden) sin.focus(); else { sin.value = ""; filterTokens(); } });
      sin.addEventListener("input", filterTokens);
    }
    syncAmount();
    /* app.js writes plain toasts into #toasts (hidden in this layout); show them as Degen toasts. */
    var legacy = $("toasts");
    if (legacy && g.MutationObserver) new MutationObserver(function (muts) {
      muts.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, function (n) {
        if (n.nodeType !== 1) return;
        var t = (n.textContent || "").trim(); if (!t) return;
        var parts = t.split(" · ");
        var bad = /inte skickat|låst|fel/i.test(t);
        toast({ title: parts[0], sub: parts.slice(1).join(" · "), cls: bad ? "down" : "", ms: 4200 });
      }); });
    }).observe(legacy, { childList: true });
  }
  function filterTokens() {
    var q = (($("dg-tok-filter") || {}).value || "").toLowerCase();
    document.querySelectorAll("#dg-tokens .dg-tok").forEach(function (t) { t.hidden = q && t.textContent.toLowerCase().indexOf(q) < 0; });
  }
  function syncAmount(typing) {
    var input = $("dg-amount");
    if (input && !typing) input.value = String(amount);
    document.querySelectorAll("#dg-pills .dg-pill").forEach(function (b) { b.classList.toggle("on", b.textContent === "$" + amount); });
    paintDeposit();
  }
  function paintDeposit() {
    var b = $("dg-deposit"); if (!b) return;
    var done = Date.now() < depositedUntil;
    var st = g.__nimbusLastState || {};
    var live = String(st.mode || "PAPER").toUpperCase() === "LIVE";
    b.classList.toggle("done", done);
    b.disabled = live;
    b.textContent = live ? "Riktiga pengar låsta 🔒" : done ? "Insatt ✓" : "Sätt in " + (amount > 0 ? usd(amount, amount % 1 ? 2 : 0) : "");
  }
  function renderWallet(state, box) {
    var eq = num(box.equity_usd != null ? box.equity_usd : box.cash_usd);
    odometer($("dg-balance"), eq == null ? "saknas" : usd(eq));
    var pnl = num(box.session_pnl_usd);
    var pill = $("dg-pnl");
    if (pill) { pill.hidden = pnl == null || !box.started_at; pill.textContent = sUsd(pnl); pill.className = "dg-pnl " + (pnl != null && pnl < 0 ? "down" : "up"); }
    var stx = $("dg-status");
    if (stx) {
      var s = box.status;
      stx.textContent = s === "running" ? "Handlar · uppdaterad " + hm(state.updated_at) : s === "finished" ? "Utmaning klar · " + (box.ends_at ? "slut " + hm(box.ends_at) : "") : s === "paused" ? "Pausad" : (box.status_sv || "Bot vilar");
    }
    var oscar = num(state.bankroll_usd);
    var from = $("dg-from-sub"); if (from) from.textContent = "USD · " + usd(oscar) + " nu · PAPER";
    paintDeposit();
    /* Tokens: real books + open PAPER positions. */
    var host = $("dg-tokens"); if (!host) return;
    host.innerHTML = "";
    var tiles = [
      { ico: "$", cls: "usd", name: "USD", sub: "utmaningskassa", v: usd(box.cash_usd), d: "—" },
      { ico: "logo", name: "Oscar", sub: "papperssaldo", v: usd(oscar), d: "—" }
    ];
    (box.open || []).forEach(function (r) {
      var size = num(r.size_usd), p = num(r.pnl_usd);
      tiles.push({ coin: r, name: sym(r).replace(/^\$/, ""), sub: (size == null ? "insats saknas" : usd(size) + " insats"), v: size == null || p == null ? "saknas" : usd(size + p), d: sUsd(p), cls2: p != null && p < 0 ? "down" : "up" });
    });
    tiles.forEach(function (t) {
      var row = el("div", "dg-tok");
      if (t.coin) row.appendChild(coin(t.coin));
      else { var ic = el("span", "dg-coin " + (t.cls || "")); if (t.ico === "logo") { var im = new Image(); im.src = "icons/icon-192.png"; im.alt = ""; ic.appendChild(im); } else ic.textContent = t.ico; row.appendChild(ic); }
      var mid = el("div", "dg-tok-mid"); mid.appendChild(el("strong", null, t.name)); mid.appendChild(el("span", null, t.sub)); row.appendChild(mid);
      var r = el("div", "dg-tok-r"); r.appendChild(el("b", null, t.v)); r.appendChild(el("span", t.cls2 || "flat", t.d)); row.appendChild(r);
      host.appendChild(row);
    });
    if (!(box.open || []).length) host.appendChild(el("p", "dg-tok-empty", "Inga öppna PAPER-positioner"));
    filterTokens();
  }

  /* ---------- agents page ---------- */
  function agentMetric(a, crew, box) {
    var st = (crew && crew.stats) || {};
    switch (a.id) {
      case "lyssnare": return { v: st.coins_per_hour, f: "int" };
      case "botjagare": return { v: st.near_watch, f: "int" };
      case "kedjekoll": return { v: st.passed_today, f: "int" };
      case "skeptiker": return { v: st.failed_today, f: "int" };
      case "storlek": return { v: box.ticket_usd, f: "usd0" };
      case "handlare": {
        var eq = num(box.equity_usd), put = num(box.put_in_usd);
        return { v: eq != null && put ? (eq - put) / put * 100 : null, f: "pct", sub: sUsd(box.session_pnl_usd) };
      }
      case "dagbok": return { v: box.closed_count != null ? box.closed_count : (box.trades || []).length, f: "int" };
    }
    return { v: null };
  }
  function fmtMetric(m) {
    var n = num(m.v); if (n == null) return "—";
    if (m.f === "pct") return sPct(n);
    if (m.f === "usd0") return usd(n, n % 1 ? 2 : 0);
    return Math.round(n).toLocaleString("sv-SE");
  }
  var drawn = {};
  function renderAgents(state, box) {
    var crew = box.crew || null;
    var host = $("dg-agents"); if (!host) return;
    var agents = (crew && crew.agents) || [];
    $("dg-ag-sub").textContent = (crew ? crew.total : "—") + " agenter · " + (box.status === "running" ? "PAPER pågår" : box.status === "finished" ? "PAPER klar" : (box.status_sv || "PAPER"));
    var m = num(box.multiplier);
    $("dg-mult").textContent = m == null ? "—" : m.toFixed(2) + "×";
    var tog = $("dg-auto");
    var on = !!(box.active && box.status === "running" && !(state.kill_switch && state.kill_switch.buys_locked));
    if (tog) { tog.classList.toggle("on", on); tog.setAttribute("aria-checked", on ? "true" : "false"); }
    var now = Date.now();
    var feed = (crew && crew.feed) || [];
    var total = 0; var acts = {};
    agents.forEach(function (a) { acts[a.id] = activitySeries(feed, a.id, now); total += acts[a.id].n; });
    host.innerHTML = "";
    if (!agents.length) { host.appendChild(el("p", "dg-empty", "Agenter saknas i desk-data")); }
    agents.forEach(function (a) {
      var meta = AG[a.id] || { c: "#FF8A1F", n: a.name, r: a.role_sv || "", k: "" };
      var card = el("article", "dg-agent" + (a.active ? " active" : ""));
      card.style.setProperty("--ag", meta.c);
      var left = el("div", "dg-ag-left");
      var ic = el("span", "dg-ag-ico"); ic.appendChild(agentIcon(a.id)); left.appendChild(ic);
      var nm = el("div", "dg-ag-name"); nm.appendChild(el("strong", null, meta.n)); nm.appendChild(el("span", null, meta.r)); left.appendChild(nm);
      var lastEv = null; for (var i = 0; i < feed.length; i++) if (feed[i].agent === a.id) { lastEv = feed[i]; break; }
      var chip = el("span", "dg-ag-chip", acts[a.id].n + " /h · " + (a.last_t || "—"));
      left.appendChild(chip);
      card.appendChild(left);
      var mid = el("div", "dg-ag-mid");
      var evl = el("div", "dg-ag-ev");
      if (lastEv && lastEv.symbol) { evl.appendChild(coin(lastEv)); }
      var line = String(a.line || "saknas");
      if (lastEv && lastEv.symbol && line.indexOf(lastEv.symbol) === 0) line = line.slice(lastEv.symbol.length).replace(/^\s*·\s*/, "");
      evl.appendChild(el("b", null, lastEv && lastEv.symbol ? "$" + lastEv.symbol : ""));
      evl.appendChild(el("span", null, (lastEv && lastEv.symbol ? " · " : "") + line));
      mid.appendChild(evl);
      var series = a.id === "handlare" ? (box.equity_points || []).map(function (p) { return num(p.v); }) : acts[a.id].series;
      var first = !drawn[a.id]; drawn[a.id] = true;
      mid.appendChild(neonChart(series, meta.c, { draw: first }));
      card.appendChild(mid);
      var right = el("div", "dg-ag-right");
      var verdict = lastEv && lastEv.verdict;
      var tag = !a.active ? "VILAR" : verdict === "veto" ? "STOPP" : a.id === "handlare" && (box.open || []).length ? "LONG" : "SKAN";
      right.appendChild(el("span", "dg-ag-tag t-" + tag.toLowerCase(), tag));
      var mt = agentMetric(a, crew, box);
      var big = el("b", "dg-ag-big" + (mt.f === "pct" ? (num(mt.v) != null && num(mt.v) < 0 ? " down" : " up") : ""), fmtMetric(mt));
      right.appendChild(big);
      right.appendChild(el("small", null, mt.sub || meta.k));
      card.appendChild(right);
      var bar = el("i", "dg-ag-bar"); bar.style.width = (total ? acts[a.id].n / total * 100 : 0).toFixed(1) + "%"; card.appendChild(bar);
      host.appendChild(card);
    });
    renderClosed(box);
    renderGoal(box);
  }
  var seenClosed = null;
  function renderClosed(box) {
    var host = $("dg-closed"); if (!host) return;
    var rows = (box.trades || []).slice().sort(function (a, b) { return Date.parse(b.closed_at || "") - Date.parse(a.closed_at || ""); });
    $("dg-closed-n").textContent = String(rows.length);
    var fresh = {};
    if (seenClosed) rows.forEach(function (t) { if (!seenClosed[t.id]) fresh[t.id] = true; });
    seenClosed = {}; rows.forEach(function (t) { seenClosed[t.id] = true; });
    host.innerHTML = "";
    if (!rows.length) {
      var e = el("p", "dg-wait"); e.appendChild(el("i")); e.appendChild(document.createTextNode(box.status === "running" ? "Första fill på väg" : "Väntar på pengar och första fill")); host.appendChild(e); return;
    }
    rows.slice(0, 20).forEach(function (t) {
      var p = num(t.pnl_usd), en = num(t.entry_price), ex = num(t.exit_price);
      var pct = en && ex != null ? (ex / en - 1) * 100 : null;
      var held = Date.parse(t.closed_at || "") - Date.parse(t.opened_at || "");
      var row = el("div", "dg-crow" + (fresh[t.id] ? " drop" : ""));
      row.appendChild(coin(t, AG.handlare.c));
      var mid = el("div", "dg-crow-mid");
      mid.appendChild(el("strong", null, sym(t) + " · Handlare"));
      mid.appendChild(el("span", null, sPct(pct) + " · höll " + (isFinite(held) && held >= 0 ? (held < 60000 ? Math.round(held / 1000) + " s" : Math.round(held / 60000) + " min") : "saknas")));
      row.appendChild(mid);
      row.appendChild(el("b", p != null && p < 0 ? "down" : "up", sUsd(p)));
      host.appendChild(row);
    });
  }
  function renderGoal(box) {
    var m = num(box.multiplier);
    var f = m == null || m <= 1 ? 0 : Math.min(1, Math.log(m) / Math.log(10));
    var fill = $("dg-goal-fill"); if (fill) fill.style.width = (f * 100).toFixed(1) + "%";
    var pct = $("dg-goal-pct"); if (pct) { pct.textContent = m == null ? "—" : m >= 10 ? "✓ 10×" : Math.round(f * 100) + "%"; pct.classList.toggle("hit", m != null && m >= 10); }
    document.querySelectorAll("#dg-goal .dg-tick").forEach(function (t) {
      var x = Number(t.getAttribute("data-x"));
      t.classList.toggle("hit", m != null && m >= x);
      t.classList.toggle("next", m != null && m < x && (x === 10 || m >= x / 2.5));
    });
  }

  /* ---------- live toasts from real events ---------- */
  var seenEv = null, seenCash = null;
  function watch(box) {
    var evs = box.events || [], cash = ((box.crew && box.crew.cash_activity) || []);
    if (seenEv == null) { seenEv = {}; evs.forEach(function (e) { seenEv[e.id] = 1; }); seenCash = {}; cash.forEach(function (c) { seenCash[c.id] = 1; }); return; }
    evs.slice().reverse().forEach(function (e) {
      if (e.id == null || seenEv[e.id]) return; seenEv[e.id] = 1;
      var buy = e.action === "Köp", p = num(e.pnl_usd);
      toast({ coin: e, color: AG.handlare.c, title: "Handlare " + (buy ? "köpte " : "sålde ") + sym(e), sub: buy ? usd(e.amount_usd) + " · PAPER" : (e.reason_sv || "sälj") + " · PAPER", value: buy ? usd(e.amount_usd) : sUsd(p), cls: buy ? "" : p != null && p < 0 ? "down" : "up" });
    });
    cash.slice().reverse().forEach(function (c) {
      if (c.id == null || seenCash[c.id]) return; seenCash[c.id] = 1;
      var out = c.kind === "uttag";
      toast({ title: out ? "Uttag klart" : "Insättning mottagen", sub: (c.subtitle || "PAPER"), value: (out ? "-" : "+") + usd(c.amount_usd), cls: out ? "down" : "up" });
    });
  }

  var state0 = null;
  function render(state) {
    if (!state) return;
    document.body.classList.add("dg");
    wirePager(); wireWallet();
    var box = state.challenge || {};
    try { renderWallet(state, box); } catch (e) { if (g.console) console.error(e); }
    try { renderAgents(state, box); } catch (e2) { if (g.console) console.error(e2); }
    watch(box);
    if (!state0) { state0 = state; goPage("wallet", false); }
    paintDots();
  }
  g.DegenUI = { render: render, go: goPage, current: currentPage, toast: toast };
  /* app.js calls SwipeUI.render after every poll; chain ours behind it. */
  function hook() {
    if (!g.SwipeUI || g.SwipeUI.__dg) return;
    var r = g.SwipeUI.render;
    g.SwipeUI.render = function (s) { try { r(s); } catch (e) { if (g.console) console.error(e); } render(s); };
    g.SwipeUI.__dg = true;
  }
  hook();
  if (g.__nimbusLastState) render(g.__nimbusLastState);
})(window);
