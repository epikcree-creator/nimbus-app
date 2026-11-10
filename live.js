/* Live dashboard: Corki-like chrome, real desk data only, PAPER. */
(function (global) {
  function $(id) { return document.getElementById(id); }

  function fmtUsd(n, digits) {
    if (n == null || !isFinite(Number(n))) return "saknas";
    var v = Number(n);
    var d = digits == null ? 2 : digits;
    return (v < 0 ? "-$" : "$") + Math.abs(v).toFixed(d);
  }

  function fmtSignedUsd(n) {
    if (n == null || !isFinite(Number(n))) return "saknas";
    var v = Number(n);
    return (v >= 0 ? "+$" : "-$") + Math.abs(v).toFixed(2);
  }

  function clockHHMM(label) {
    if (!label) return "saknas";
    var m = String(label).match(/(\d{1,2}:\d{2})/);
    return m ? m[1] : "saknas";
  }

  function shortTime(tsStockholm) {
    if (!tsStockholm) return "saknas";
    var m = String(tsStockholm).match(/(\d{2}:\d{2})(?::\d{2})?/);
    return m ? m[1] : "saknas";
  }

  function sideLabel(kind, action) {
    var k = String(kind || action || "").toLowerCase();
    if (k === "köp" || k === "buy" || k === "k\u00f6p") return { txt: "BUY", cls: "buy" };
    if (k) return { txt: "SELL", cls: "sell" };
    return { txt: "saknas", cls: "miss" };
  }

  /* ---- ticking hero number ---- */
  var __tick = { from: null, to: null, start: 0, el: null, raf: 0 };

  function paintBalance(el, value) {
    if (!el) return;
    if (value == null || !isFinite(Number(value))) {
      el.textContent = "saknas";
      el.removeAttribute("data-value");
      return;
    }
    var v = Number(value);
    el.dataset.value = String(v);
    el.textContent = "$" + v.toFixed(2);
  }

  function tickBalance(el, value) {
    if (!el) return;
    if (value == null || !isFinite(Number(value))) {
      paintBalance(el, null);
      return;
    }
    var to = Number(value);
    var from = Number(el.dataset.value);
    if (!isFinite(from) || Math.abs(from - to) < 0.005) {
      paintBalance(el, to);
      return;
    }
    if (__tick.raf) cancelAnimationFrame(__tick.raf);
    __tick.from = from;
    __tick.to = to;
    __tick.start = performance.now();
    __tick.el = el;
    var dur = 700;
    function step(now) {
      var t = Math.min(1, (now - __tick.start) / dur);
      var eased = 1 - Math.pow(1 - t, 3);
      paintBalance(el, __tick.from + (__tick.to - __tick.from) * eased);
      if (t < 1) __tick.raf = requestAnimationFrame(step);
    }
    __tick.raf = requestAnimationFrame(step);
  }

  /* ---- gates checklist ---- */
  function renderGates(host, checklist) {
    if (!host) return;
    host.innerHTML = "";
    host.classList.add("gates-list");
    var box = checklist || {};
    var gates = box.gates || [];
    if (!gates.length) {
      var p = document.createElement("p");
      p.className = "empty-hint";
      p.textContent = "7-grindars checklista saknas";
      host.appendChild(p);
      return;
    }
    var head = document.createElement("div");
    head.className = "gates-head";
    head.textContent = box.passed ? "7 grindar · pass" : (box.failed && box.failed.length ? "7 grindar · fail" : "7 grindar");
    host.appendChild(head);
    gates.forEach(function (g) {
      var row = document.createElement("div");
      var st = g.status || "saknas";
      row.className = "gate-row " + (st === "pass" || (g.ok && st !== "saknas") ? "pass" : st === "fail" ? "fail" : "saknas");
      var mark = document.createElement("span");
      mark.className = "gate-mark";
      mark.textContent = st === "pass" || (g.ok && st !== "saknas") ? "●" : st === "fail" ? "✕" : "–";
      var lab = document.createElement("span");
      lab.className = "gate-lab";
      lab.textContent = g.label_sv || g.code || "saknas";
      var det = document.createElement("span");
      det.className = "gate-det";
      det.textContent = g.detail_sv || st || "saknas";
      row.appendChild(mark);
      row.appendChild(lab);
      row.appendChild(det);
      host.appendChild(row);
    });
    if (box.half_ticket) {
      var half = document.createElement("p");
      half.className = "gates-half";
      var eff = box.effective_ticket_usd;
      half.textContent = "Halv ticket" + (eff != null ? " · " + fmtUsd(eff, 0) : " · saknas");
      host.appendChild(half);
    }
  }

  function renderTicker(items) {
    var wrap = $("ticker-wrap");
    var host = $("ticker");
    if (!wrap || !host) return;
    var rows = items || [];
    if (!rows.length) {
      wrap.hidden = true;
      host.innerHTML = "";
      return;
    }
    wrap.hidden = false;
    function chip(item) {
      var span = document.createElement("span");
      span.className = "ticker-chip";
      var sym = document.createElement("b");
      sym.textContent = item.symbol || (item.mint || "").slice(0, 6) || "saknas";
      span.appendChild(sym);
      if (!(item.change_missing || item.change_pct == null)) {
        var ch = document.createElement("em");
        var v = Number(item.change_pct);
        ch.className = v >= 0 ? "up" : "down";
        ch.textContent = (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
        span.appendChild(ch);
      }
      return span;
    }
    host.innerHTML = "";
    var track = document.createElement("div");
    track.className = "ticker-track";
    var a = document.createElement("div");
    a.className = "ticker-seq";
    rows.forEach(function (r) { a.appendChild(chip(r)); });
    var b = a.cloneNode(true);
    track.appendChild(a);
    track.appendChild(b);
    host.appendChild(track);
  }

  function renderHero(box) {
    var el = $("live-balance");
    var eq = box.equity_usd != null ? Number(box.equity_usd) : (box.cash_usd != null ? Number(box.cash_usd) : null);
    tickBalance(el, isFinite(eq) ? eq : null);

    var pill = $("session-pnl-pill");
    if (pill) {
      var pnl = box.session_pnl_usd;
      if (pnl == null || !isFinite(Number(pnl))) {
        pill.textContent = "saknas";
        pill.className = "session-pill miss";
      } else {
        var v = Number(pnl);
        pill.textContent = fmtSignedUsd(v);
        pill.className = "session-pill " + (v > 0 ? "up" : v < 0 ? "down" : "flat");
      }
    }
    var put = $("hero-put-in");
    if (put) {
      var cap = box.put_in_usd != null ? box.put_in_usd : box.capital_usd;
      var nTrades = box.closed_count != null ? box.closed_count : ((box.trades || []).length);
      var putTxt = (cap == null || !isFinite(Number(cap))) ? "insatt saknas" : ("insatt " + fmtUsd(cap, 0));
      var trTxt = nTrades == null ? "trades saknas" : (nTrades + " trades");
      put.textContent = putTxt + " · " + trTxt;
    }
    var mult = $("hero-mult");
    if (mult) {
      if (box.multiplier == null || !isFinite(Number(box.multiplier))) {
        mult.textContent = "saknas";
        mult.className = "mult-badge miss";
      } else {
        mult.textContent = Number(box.multiplier).toFixed(2) + "×";
        mult.className = "mult-badge";
      }
    }
    var line = $("hero-wl");
    if (line) {
      var sp = box.session_pnl_usd;
      var w = box.wins_raw != null ? box.wins_raw : box.wins;
      var l = box.losses;
      var left = (sp == null || !isFinite(Number(sp))) ? "saknas" : fmtSignedUsd(sp);
      var right = (w == null || l == null) ? "W/L saknas" : (w + "/" + l);
      line.innerHTML = "";
      var a = document.createElement("span");
      a.className = (sp != null && Number(sp) > 0) ? "up" : (sp != null && Number(sp) < 0) ? "down" : "";
      a.textContent = left;
      var b = document.createElement("span");
      b.textContent = " · " + right;
      line.appendChild(a);
      line.appendChild(b);
    }
    var liveDot = $("live-dot");
    if (liveDot) {
      var on = box.status === "running" || box.status === "aborting";
      liveDot.hidden = !on;
    }
    var badge = $("mode-badge");
    if (badge) badge.textContent = box.mode_paper === false ? "PAPER" : "PAPER";
    var cd = $("challenge-countdown");
    if (cd) {
      var showCd = box.status === "running" || box.status === "paused" || box.status === "aborting";
      // leave existing formatCountdown from app.js if present
      if (typeof global.formatCountdownLive === "function") {
        cd.textContent = showCd ? global.formatCountdownLive(box.countdown_seconds) : (box.status === "finished" || box.status === "aborted" ? "Avslutad" : "—");
        var cdLab = document.getElementById("challenge-cd-lab");
        if (cdLab) cdLab.textContent = showCd ? "slut om" : ((box.status === "finished" || box.status === "aborted") ? "utmaning" : "slut om");
      }
      cd.dataset.endsAt = showCd && box.ends_at ? box.ends_at : "";
    }
  }

  function renderChart(box) {
    var canvas = $("session-chart");
    if (!canvas || !global.NimbusChart || !NimbusChart.session) return;
    var points = box.equity_points || [];
    var baseline = box.put_in_usd != null ? Number(box.put_in_usd) : Number(box.capital_usd);
    var startL = clockHHMM(box.started_at_stockholm);
    var endL;
    var finished = box.status === "finished" || box.status === "aborted";
    if (finished) {
      endL = clockHHMM(box.ends_at_stockholm);
    } else {
      var nowL = box.now_stockholm;
      if (!nowL && points.length && points[points.length - 1].t) {
        nowL = String(points[points.length - 1].t).slice(0, 5);
      }
      endL = nowL ? ("nu " + nowL) : "nu";
    }
    var startEl = $("chart-start");
    var endEl = $("chart-end");
    if (startEl) startEl.textContent = startL;
    if (endEl) endEl.textContent = endL;
    NimbusChart.session(canvas, points, isFinite(baseline) ? baseline : null, {
      color: "#1F6FE0",
      startLabel: startL,
      endLabel: endL
    });
  }

  function renderRecent(box) {
    var host = $("recent-trades");
    if (!host) return;
    host.innerHTML = "";
    var events = box.events || [];
    var rows = events.filter(function (e) {
      return e && (e.action === "Köp" || e.action === "Sälj" || e.kind === "köp" || e.kind === "sälj" || e.kind === "TP" || e.kind === "SL" || e.kind === "2×" || e.kind === "5×" || e.kind === "20×" || e.kind === "trail");
    }).slice(0, 3);
    if (!rows.length) {
      var empty = document.createElement("p");
      empty.className = "empty-hint";
      empty.textContent = "Inga trades ännu.";
      host.appendChild(empty);
      return;
    }
    rows.forEach(function (ev) {
      var row = document.createElement("div");
      row.className = "trade-row";
      var t = document.createElement("span");
      t.className = "t-time";
      t.textContent = shortTime(ev.ts_stockholm);
      var side = sideLabel(ev.kind, ev.action);
      var s = document.createElement("span");
      s.className = "t-side " + side.cls;
      s.textContent = side.txt;
      var tok = document.createElement("span");
      tok.className = "t-tok";
      tok.textContent = ev.symbol || (ev.mint || "").slice(0, 6) || "saknas";
      var pnl = document.createElement("span");
      if (ev.pnl_usd == null || !isFinite(Number(ev.pnl_usd))) {
        pnl.className = "t-pnl miss";
        pnl.textContent = ev.action === "Köp" ? "—" : "saknas";
      } else {
        var pv = Number(ev.pnl_usd);
        pnl.className = "t-pnl " + (pv >= 0 ? "up" : "down");
        pnl.textContent = fmtSignedUsd(pv);
      }
      var why = document.createElement("span");
      why.className = "t-why";
      why.textContent = ev.reason_sv || "saknas";
      row.appendChild(t);
      row.appendChild(s);
      row.appendChild(tok);
      row.appendChild(pnl);
      row.appendChild(why);
      host.appendChild(row);
    });
  }


  var ICONS = {
    eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle fill="none" stroke="#fff" stroke-width="2" cx="12" cy="12" r="3"/></svg>',
    shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 3l8 4v6c0 5-3.5 7.5-8 10-4.5-2.5-8-5-8-10V7l8-4z"/></svg>',
    trend: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M4 16l6-6 4 3 6-7"/><path fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M14 6h6v6"/></svg>',
    bubble: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M5 6h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M13 2L4 14h7l-1 8 10-12h-7z"/></svg>'
  };

  function reducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  var __typed = {};
  var __typeRaf = 0;

  function typeStatus(el, id, full, active) {
    if (!el) return;
    full = full || "väntar";
    var st = __typed[id] || { full: "", shown: "" };
    if (reducedMotion() || !active) {
      st.full = full;
      st.shown = full;
      st.anim = false;
      __typed[id] = st;
      el.textContent = full;
      return;
    }
    if (st.full === full && !st.anim) {
      el.textContent = st.shown || full;
      return;
    }
    // Only type a real new status string. Never invent streaming text.
    st.full = full;
    st.shown = "";
    st.anim = true;
    st.t0 = performance.now();
    st.dur = Math.min(600, Math.max(120, (full.length / 30) * 1000));
    __typed[id] = st;
    if (!__typeRaf) __typeRaf = requestAnimationFrame(tickTypes);
  }

  function tickTypes(now) {
    __typeRaf = 0;
    var going = false;
    Object.keys(__typed).forEach(function (id) {
      var st = __typed[id];
      if (!st.anim) return;
      var t = Math.min(1, (now - st.t0) / st.dur);
      var n = Math.max(0, Math.min(st.full.length, Math.round(st.full.length * t)));
      st.shown = st.full.slice(0, n);
      var el = document.querySelector('.agent-card[data-id="' + id + '"] .agent-line');
      if (el) el.textContent = st.shown;
      if (t < 1) going = true;
      else st.anim = false;
    });
    if (going) __typeRaf = requestAnimationFrame(tickTypes);
  }

  function renderAgents(box) {
    var host = $("agents-list");
    var title = $("agents-title");
    var run = $("agents-running");
    var agentsBox = box.agents || {};
    if (title) title.textContent = agentsBox.title_sv || "Agenter – arbetar ihop";
    if (run) {
      var n = agentsBox.running;
      var tot = agentsBox.total || 5;
      run.innerHTML = "";
      var dot = document.createElement("i");
      dot.className = "aktif-dot" + (n > 0 ? " on" : "");
      var lab = document.createElement("span");
      lab.textContent = (n == null ? "saknas" : (n + " aktiva"));
      run.appendChild(dot);
      run.appendChild(lab);
    }
    if (!host) return;
    var list = agentsBox.agents || [];
    if (!host.dataset.built || host.children.length !== list.length) {
      host.innerHTML = "";
      host.dataset.built = "1";
      list.forEach(function (a) {
        var card = document.createElement("article");
        card.className = "agent-card";
        card.setAttribute("data-id", a.id);
        card.style.setProperty("--agent", a.color || "#2563EB");
        var ico = document.createElement("div");
        ico.className = "agent-ico";
        ico.innerHTML = ICONS[a.icon] || ICONS.eye;
        var mid = document.createElement("div");
        mid.className = "agent-mid";
        var name = document.createElement("strong");
        name.className = "agent-name";
        name.textContent = a.name || a.id || "saknas";
        var line = document.createElement("code");
        line.className = "agent-line";
        var row = document.createElement("div");
        row.className = "agent-status";
        row.appendChild(line);
        mid.appendChild(name);
        mid.appendChild(row);
        var src = document.createElement("span");
        src.className = "agent-src";
        src.textContent = a.source || "";
        card.appendChild(ico);
        card.appendChild(mid);
        card.appendChild(src);
        host.appendChild(card);
      });
    }
    list.forEach(function (a) {
      var card = host.querySelector('.agent-card[data-id="' + a.id + '"]');
      if (!card) return;
      card.style.setProperty("--agent", a.color || "#2563EB");
      card.classList.toggle("on", !!a.running);
      var name = card.querySelector(".agent-name");
      if (name) name.textContent = a.name || a.id || "saknas";
      var src = card.querySelector(".agent-src");
      if (src) src.textContent = a.source || "";
      var line = card.querySelector(".agent-line");
      var text = a.line || "väntar";
      typeStatus(line, a.id, text, !!a.running);
      var cur = card.querySelector(".agent-cursor");
      if (a.running) {
        if (!cur) {
          cur = document.createElement("span");
          cur.className = "agent-cursor";
          cur.textContent = "█";
          var row = card.querySelector(".agent-status");
          if (row) row.appendChild(cur);
          else card.querySelector(".agent-mid").appendChild(cur);
        }
        cur.hidden = false;
      } else if (cur) {
        cur.hidden = true;
      }
    });
    renderCore(agentsBox);
  }

  var __coreBuilt = false;
  function renderCore(agentsBox) {
    var host = $("swipe-core");
    if (!host) return;
    var list = (agentsBox && agentsBox.agents) || [];
    var coreName = (agentsBox && agentsBox.core_sv) || "Chairman-kärnan";
    var title = (agentsBox && agentsBox.core_title_sv) || "5 agenter → Chairman-kärnan";
    var cap = $("core-title");
    if (cap) cap.textContent = title;
    if (__coreBuilt && host.querySelector("svg.core-svg")) {
      // Update colours/names in place so EXEC actions never jump the layout.
      list.slice(0, 5).forEach(function (a, i) {
        var node = host.querySelector('.core-node[data-i="' + i + '"]');
        if (node) {
          node.style.setProperty("--agent", a.color || "#2563EB");
          var lab = node.querySelector(".core-node-name");
          if (lab) lab.textContent = a.name || "";
        }
        var dot = host.querySelector('.core-particle[data-i="' + i + '"]');
        if (dot) dot.setAttribute("fill", a.color || "#2563EB");
      });
      syncCoreMotion();
      return;
    }
    host.innerHTML = "";
    var count = document.createElement("div");
    count.className = "core-count";
    count.textContent = "5 → 1";
    host.appendChild(count);
    var svgNS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 320 210");
    svg.setAttribute("class", "core-svg");
    var cx = 160, cy = 168;
    // Arc of 5 nodes
    var pos = [
      [36, 58], [88, 32], [160, 22], [232, 32], [284, 58]
    ];
    list.slice(0, 5).forEach(function (a, i) {
      var p = pos[i] || [40, 40];
      var path = document.createElementNS(svgNS, "path");
      var id = "core-path-" + i;
      // Light-grey curve down into the core
      var d = "M " + p[0] + " " + p[1] + " Q " + p[0] + " " + ((p[1] + cy) / 2 + 10) + " " + cx + " " + (cy - 28);
      path.setAttribute("d", d);
      path.setAttribute("id", id);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "rgba(11,37,69,0.16)");
      path.setAttribute("stroke-width", "1.2");
      path.setAttribute("class", "core-path");
      svg.appendChild(path);
      var particle = document.createElementNS(svgNS, "circle");
      particle.setAttribute("r", "2.4");
      particle.setAttribute("fill", a.color || "#2563EB");
      particle.setAttribute("class", "core-particle");
      particle.setAttribute("data-i", String(i));
      // Parked at SVG (0,0) until animateMotion starts — keep invisible
      // so a stray bead does not flash at the top-left of the arc.
      particle.setAttribute("opacity", "0");
      var begin = (i * 0.4) + "s";
      var dur = (2.4 + i * 0.35) + "s";
      var show = document.createElementNS(svgNS, "set");
      show.setAttribute("attributeName", "opacity");
      show.setAttribute("to", "1");
      show.setAttribute("begin", begin);
      show.setAttribute("fill", "freeze");
      var mot = document.createElementNS(svgNS, "animateMotion");
      mot.setAttribute("dur", dur);
      mot.setAttribute("repeatCount", "indefinite");
      mot.setAttribute("begin", begin);
      var mpath = document.createElementNS(svgNS, "mpath");
      mpath.setAttributeNS("http://www.w3.org/1999/xlink", "href", "#" + id);
      mpath.setAttribute("href", "#" + id);
      mot.appendChild(mpath);
      particle.appendChild(show);
      particle.appendChild(mot);
      svg.appendChild(particle);
    });
    host.appendChild(svg);
    // HTML nodes overlaid on the arc (names + dots)
    var arc = document.createElement("div");
    arc.className = "core-arc";
    list.slice(0, 5).forEach(function (a, i) {
      var p = pos[i];
      var node = document.createElement("div");
      node.className = "core-node" + (a.running ? " on" : "");
      node.setAttribute("data-i", String(i));
      node.style.setProperty("--agent", a.color || "#2563EB");
      node.style.left = (p[0] / 320 * 100) + "%";
      node.style.top = (p[1] / 210 * 100) + "%";
      var lab = document.createElement("span");
      lab.className = "core-node-name";
      lab.textContent = a.name || "";
      var bead = document.createElement("i");
      bead.className = "core-bead";
      node.appendChild(lab);
      node.appendChild(bead);
      arc.appendChild(node);
    });
    host.appendChild(arc);
    var core = document.createElement("div");
    core.className = "core-hub";
    var logo = document.createElement("img");
    logo.src = "icons/icon-192.png";
    logo.alt = "";
    logo.width = 36;
    logo.height = 36;
    var name = document.createElement("div");
    name.className = "core-hub-name";
    name.textContent = "CHAIRMAN-KÄRNAN";
    core.appendChild(logo);
    core.appendChild(name);
    host.appendChild(core);
    __coreBuilt = true;
    syncCoreMotion();
  }

  function syncCoreMotion() {
    var host = $("swipe-core");
    if (!host) return;
    var off = reducedMotion() || document.hidden;
    host.classList.toggle("paused", off);
    var svg = host.querySelector("svg.core-svg");
    if (svg) {
      try {
        if (off) svg.pauseAnimations();
        else svg.unpauseAnimations();
      } catch (e) {}
    }
  }

  if (!window.__coreVisHook) {
    window.__coreVisHook = true;
    document.addEventListener("visibilitychange", syncCoreMotion);
  }

  function fillRecap(box) {
    var rec = box.recap || {};
    function set(id, txt) {
      var n = $(id);
      if (n) n.textContent = txt;
    }
    set("recap-put", rec.put_in_usd == null ? "saknas" : fmtUsd(rec.put_in_usd, 0));
    set("recap-now", rec.now_worth_usd == null ? "saknas" : fmtUsd(rec.now_worth_usd, 2));
    set("recap-mult", rec.multiplier == null ? "saknas" : Number(rec.multiplier).toFixed(2) + "×");
    set("recap-trades", rec.trades == null ? "saknas" : String(rec.trades));
    set("recap-coins", rec.coins == null ? "saknas" : String(rec.coins));
    set("recap-sources", rec.sources == null ? "saknas" : String(rec.sources));
    set("recap-agents", rec.agents == null ? "5" : String(rec.agents));
    var best = rec.best;
    set("recap-best", best ? ((best.symbol || "saknas") + " · " + fmtSignedUsd(best.pnl_usd)) : "saknas");
    var worst = rec.worst;
    set("recap-worst", worst ? ((worst.symbol || "saknas") + " · " + fmtSignedUsd(worst.pnl_usd)) : "saknas");
    set("recap-winrate", rec.win_rate_pct == null ? "saknas" : Number(rec.win_rate_pct).toFixed(1) + "%");
  }

  function openRecap() {
    var sheet = $("recap-sheet");
    if (!sheet) return;
    if (typeof sheet.showModal === "function") {
      if (!sheet.open) sheet.showModal();
    } else {
      sheet.setAttribute("open", "open");
    }
  }

  function closeRecap() {
    var sheet = $("recap-sheet");
    if (!sheet) return;
    if (typeof sheet.close === "function" && sheet.open) sheet.close();
    else sheet.removeAttribute("open");
  }

  function maybeAutoRecap(box) {
    if (box.status !== "finished" && box.status !== "aborted") return;
    var key = "nimbus_recap_shown_" + (box.ends_at || box.started_at || "x");
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch (e) {}
    openRecap();
  }

  function renderLastGates(box) {
    var host = $("last-gates");
    if (!host) return;
    var lg = box.last_gates;
    if (!lg || !lg.checklist) {
      host.innerHTML = "";
      var p = document.createElement("p");
      p.className = "empty-hint";
      p.textContent = "Ingen kandidat granskad ännu.";
      host.appendChild(p);
      return;
    }
    var cap = document.createElement("div");
    cap.className = "last-gates-cap";
    cap.textContent = "Senaste kandidat · " + (lg.symbol || (lg.mint || "").slice(0, 6) || "saknas");
    host.innerHTML = "";
    host.appendChild(cap);
    var list = document.createElement("div");
    host.appendChild(list);
    renderGates(list, lg.checklist);
  }

  function bindOnce() {
    if (bindOnce.done) return;
    bindOnce.done = true;
    var hero = $("live-hero");
    if (hero) {
      hero.addEventListener("click", function () { openRecap(); });
      hero.setAttribute("role", "button");
      hero.setAttribute("title", "Öppna recap");
    }
    var recapBtn = $("btn-recap");
    if (recapBtn) recapBtn.addEventListener("click", function () { openRecap(); });
    var closeBtn = $("recap-close");
    if (closeBtn) closeBtn.addEventListener("click", function (ev) {
      ev.preventDefault();
      closeRecap();
    });
    var sheet = $("recap-sheet");
    if (sheet) {
      sheet.addEventListener("click", function (ev) {
        if (ev.target === sheet) closeRecap();
      });
    }
  }

  function render(state) {
    bindOnce();
    var box = (state && state.challenge) || {};
    renderTicker(box.ticker);
    renderHero(box);
    renderChart(box);
    renderRecent(box);
    renderAgents(box);
    renderLastGates(box);
    fillRecap(box);
    maybeAutoRecap(box);

    var note = $("challenge-note");
    if (note) note.textContent = box.note_sv || "Ingen PAPER-utmaning körs.";
    var paperTag = $("challenge-paper-tag");
    if (paperTag) paperTag.textContent = box.paper_label_sv || "PAPER · simulerat · inga riktiga pengar";
    var statusPill = $("challenge-status-pill");
    if (statusPill) {
      var status = box.status || "idle";
      statusPill.textContent = box.status_sv || status;
      statusPill.className = "challenge-status-pill" + (
        status === "paused" ? " paused" : status === "running" || status === "aborting" ? " running" : status === "finished" || status === "aborted" ? " done" : ""
      );
    }
    var rules = $("challenge-rules");
    if (rules) {
      rules.innerHTML = "";
      (box.rules_sv || []).forEach(function (line) {
        var li = document.createElement("li");
        li.textContent = line;
        rules.appendChild(li);
      });
    }
    var openHost = $("challenge-open");
    if (openHost) {
      openHost.innerHTML = "";
      var opens = box.open || [];
      if (!opens.length) {
        var emptyO = document.createElement("p");
        emptyO.className = "empty-hint";
        emptyO.textContent = box.status === "paused" ? "Inga öppna positioner (pausad)." : "Inga öppna positioner.";
        openHost.appendChild(emptyO);
      } else if (typeof global.__nimbusRenderOpen === "function") {
        global.__nimbusRenderOpen(openHost, opens, box);
      }
    }
  }

  global.NimbusLive = {
    render: render,
    renderGates: renderGates,
    openRecap: openRecap,
    closeRecap: closeRecap
  };
})(window);
