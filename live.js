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
      var ch = document.createElement("em");
      if (item.change_missing || item.change_pct == null) {
        ch.className = "miss";
        ch.textContent = "saknas";
      } else {
        var v = Number(item.change_pct);
        ch.className = v >= 0 ? "up" : "down";
        ch.textContent = (v >= 0 ? "+" : "") + v.toFixed(2) + "%";
      }
      span.appendChild(sym);
      span.appendChild(ch);
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
      var putTxt = (cap == null || !isFinite(Number(cap))) ? "in saknas" : ("in " + fmtUsd(cap, 0));
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
        cd.textContent = showCd ? global.formatCountdownLive(box.countdown_seconds) : (box.status === "finished" || box.status === "aborted" ? "Klar" : "—");
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
    var endL = clockHHMM(box.ends_at_stockholm);
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

  function renderAgents(box) {
    var host = $("agents-list");
    var title = $("agents-title");
    var run = $("agents-running");
    var agentsBox = box.agents || {};
    if (title) title.textContent = agentsBox.title_sv || "agents – working together";
    if (run) {
      var n = agentsBox.running;
      var tot = agentsBox.total || 5;
      run.textContent = (n == null ? "saknas" : (n + " running"));
    }
    if (!host) return;
    host.innerHTML = "";
    var list = agentsBox.agents || [];
    list.forEach(function (a) {
      var row = document.createElement("div");
      row.className = "agent-row" + (a.running ? " on" : "");
      var dot = document.createElement("i");
      dot.className = "agent-dot";
      dot.style.background = a.color || "#1F6FE0";
      var name = document.createElement("strong");
      name.textContent = a.name || a.id || "saknas";
      var line = document.createElement("code");
      line.textContent = a.line || "saknas";
      row.appendChild(dot);
      row.appendChild(name);
      row.appendChild(line);
      host.appendChild(row);
    });
    renderCore(agentsBox);
  }

  function renderCore(agentsBox) {
    var host = $("swipe-core");
    if (!host) return;
    var list = (agentsBox && agentsBox.agents) || [];
    var coreName = (agentsBox && agentsBox.core_sv) || "Swipe-kärnan";
    host.innerHTML = "";
    var svgNS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 320 160");
    svg.setAttribute("class", "core-svg");
    var cx = 160, cy = 80;
    // positions: 5 around the core
    var pos = [
      [40, 40], [40, 120], [160, 18], [280, 40], [280, 120]
    ];
    list.slice(0, 5).forEach(function (a, i) {
      var p = pos[i] || [40, 40];
      var line = document.createElementNS(svgNS, "line");
      line.setAttribute("x1", p[0]);
      line.setAttribute("y1", p[1]);
      line.setAttribute("x2", cx);
      line.setAttribute("y2", cy);
      line.setAttribute("stroke", a.color || "#1F6FE0");
      line.setAttribute("stroke-width", "1.6");
      line.setAttribute("stroke-dasharray", "4 6");
      line.setAttribute("class", "core-pulse");
      line.style.setProperty("--delay", (i * 0.35) + "s");
      svg.appendChild(line);
      var c = document.createElementNS(svgNS, "circle");
      c.setAttribute("cx", p[0]);
      c.setAttribute("cy", p[1]);
      c.setAttribute("r", "8");
      c.setAttribute("fill", a.color || "#1F6FE0");
      svg.appendChild(c);
    });
    var core = document.createElementNS(svgNS, "circle");
    core.setAttribute("cx", cx);
    core.setAttribute("cy", cy);
    core.setAttribute("r", "28");
    core.setAttribute("fill", "#F3F8FF");
    core.setAttribute("stroke", "#1F6FE0");
    core.setAttribute("stroke-width", "2");
    svg.appendChild(core);
    host.appendChild(svg);
    var lab = document.createElement("div");
    lab.className = "core-label";
    lab.textContent = coreName;
    host.appendChild(lab);
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
