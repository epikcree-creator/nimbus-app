/* Nimbus Android PWA — polls desk JSON from DATA_BASE in URL fragment */
(function () {
  var POLL_MS = 15000;
  var LS_BASE = "nimbus_data_base";
  var LS_TOKEN = "nimbus_app_token";
  var SIGNUP_URL = "https://fomo.family/r/savipww";
  var CHAIN_ID = { solana: 1399811149, robinhood: 4663, base: 8453, bnb: 56 };
  var AGENTS = [
    { id: "scanner", name: "Scanner", sub: "migrations · PumpPortal", color: "#ff7a1a", icon: "𝒮" },
    { id: "auditor", name: "Auditor", sub: "8 layers · RugCheck", color: "#9b6bff", icon: "𝒜" },
    { id: "analyst", name: "Analyst", sub: "Jev · noul", color: "#2ee6c7", icon: "𝒥" },
    { id: "executor", name: "Executor", sub: "paper fills", color: "#4da3ff", icon: "ℰ" },
    { id: "risk", name: "Risk", sub: "stops · sizing", color: "#ff5ab8", icon: "ℛ" }
  ];
  var selectedAmt = 100;
  var lastClosedSig = "";
  var goalFilter = "ALL";
  var seeded = false;

  function coinUrl(address, chain) {
    chain = chain || "solana";
    if (!address || !(chain in CHAIN_ID)) return SIGNUP_URL;
    return "https://fomo.family/coin?address=" + encodeURIComponent(address) +
      "&chainId=" + CHAIN_ID[chain] + "&r=savipww&source=share_link";
  }
  function profileUrl(handle) {
    var h = String(handle || "").replace(/^@/, "");
    return "https://fomo.family/profile/" + encodeURIComponent(h) + "?source=share_link&r=savipww";
  }
  function bankrollLink(amt) {
    return "https://t.me/NimbusMobileBot?text=" + encodeURIComponent("/bankroll " + amt);
  }

  function parseFragment() {
    var hash = (location.hash || "").replace(/^#/, "");
    if (!hash) return {};
    var out = {};
    hash.split("&").forEach(function (pair) {
      var i = pair.indexOf("=");
      if (i < 0) return;
      out[decodeURIComponent(pair.slice(0, i))] = decodeURIComponent(pair.slice(i + 1));
    });
    return out;
  }

  function loadConfig() {
    var frag = parseFragment();
    if (frag.d) { try { localStorage.setItem(LS_BASE, frag.d); } catch (e) {} }
    if (frag.t) { try { localStorage.setItem(LS_TOKEN, frag.t); } catch (e) {} }
    if (frag.d || frag.t) {
      try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
    }
    var base = null, token = null;
    try { base = localStorage.getItem(LS_BASE); token = localStorage.getItem(LS_TOKEN); } catch (e) {}
    // Dev/screenshot override
    if (window.__NIMBUS_DATA_BASE__) base = window.__NIMBUS_DATA_BASE__;
    return { dataBase: base || null, appToken: token || null };
  }

  function $(id) { return document.getElementById(id); }

  function fmtUsd(n, digits) {
    n = Number(n) || 0;
    var d = digits == null ? 2 : digits;
    var abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
    return (n < 0 ? "-$" : "$") + abs;
  }
  function fmtPct(n) {
    n = Number(n) || 0;
    var s = (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
    return s;
  }
  function shortMint(m) {
    m = String(m || "");
    if (m.length < 8) return m;
    return m.slice(0, 4) + "…" + m.slice(-4);
  }
  function icoLetter(sym) {
    sym = String(sym || "?").replace(/^\$/, "");
    return (sym.charAt(0) || "?").toUpperCase();
  }
  function hbOk(v) {
    return typeof v === "string" && /^ok\b/i.test(v);
  }
  function relTime(iso) {
    if (!iso) return "";
    var t = Date.parse(iso);
    if (!t) return String(iso);
    var s = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (s < 20) return "Updated just now";
    if (s < 60) return "Updated " + s + "s ago";
    if (s < 3600) return "Updated " + Math.floor(s / 60) + "m ago";
    return "Updated " + Math.floor(s / 3600) + "h ago";
  }

  /* ---- odometer balance ---- */
  function setBalance(el, value) {
    var target = Number(value) || 0;
    el.setAttribute("data-value", String(target));
    var text = fmtUsd(target);
    // Build digit spans for animation
    var prev = el.getAttribute("data-text") || "";
    if (prev === text) return;
    el.setAttribute("data-text", text);
    el.textContent = "";
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (/\d/.test(ch)) {
        var wrap = document.createElement("span");
        wrap.className = "digit";
        var inner = document.createElement("span");
        inner.textContent = "0\n1\n2\n3\n4\n5\n6\n7\n8\n9";
        inner.style.whiteSpace = "pre";
        inner.style.lineHeight = "1.05em";
        wrap.appendChild(inner);
        el.appendChild(wrap);
        (function (innerEl, digit) {
          requestAnimationFrame(function () {
            innerEl.style.transform = "translateY(-" + (digit * 1.05) + "em)";
          });
        })(inner, parseInt(ch, 10));
      } else {
        el.appendChild(document.createTextNode(ch));
      }
    }
  }

  /* ---- toasts ---- */
  function toast(kind, title, badge) {
    var box = $("toasts");
    if (!box) return;
    var el = document.createElement("div");
    el.className = "toast " + (kind || "win");
    el.innerHTML = "<span>" + title + "</span>" + (badge ? "<span class='badge'>" + badge + "</span>" : "");
    box.appendChild(el);
    setTimeout(function () { el.remove(); }, 4200);
  }

  /* ---- add funds / bankroll ---- */
  function syncBankrollUI(mode) {
    var btn = $("af-btn");
    var src = $("af-source-right");
    var disp = $("af-display");
    if (!btn || !disp) return;
    disp.textContent = "$" + selectedAmt;
    document.querySelectorAll("#af-pills .amt").forEach(function (b) {
      b.classList.toggle("selected", Number(b.getAttribute("data-amt")) === selectedAmt);
    });
    if (String(mode || "PAPER").toUpperCase() === "LIVE") {
      btn.className = "af-btn live";
      btn.textContent = "Insättning görs i FOMO";
      btn.href = SIGNUP_URL;
      src.textContent = "FOMO · " + SIGNUP_URL.replace("https://", "");
    } else {
      btn.className = "af-btn";
      btn.textContent = "Sätt paper-saldo $" + selectedAmt;
      btn.href = bankrollLink(selectedAmt);
      src.textContent = "via Telegram";
    }
  }

  function wireControls() {
    document.querySelectorAll("#af-pills .amt").forEach(function (b) {
      b.addEventListener("click", function () {
        selectedAmt = Number(b.getAttribute("data-amt")) || 100;
        var modePill = $("mode-pill");
        syncBankrollUI((modePill && modePill.textContent === "LIVE") ? "LIVE" : "PAPER");
      });
    });
    var gear = $("btn-gear");
    if (gear) gear.addEventListener("click", function () {
      window.open("https://t.me/NimbusMobileBot?text=" + encodeURIComponent("/settings"), "_blank", "noopener");
    });
    document.querySelectorAll("#goal-filters button").forEach(function (b) {
      b.addEventListener("click", function () {
        goalFilter = b.getAttribute("data-f") || "ALL";
        document.querySelectorAll("#goal-filters button").forEach(function (x) {
          x.classList.toggle("on", x === b);
        });
      });
    });
  }

  /* ---- agents ---- */
  function seriesFromEquity(equity, seed) {
    if (Array.isArray(equity) && equity.length > 2) return equity.map(Number);
    var base = Array.isArray(equity) && equity.length ? Number(equity[equity.length - 1]) : 0;
    var out = [];
    var v = base || (20 + (seed % 40));
    for (var i = 0; i < 20; i++) {
      v += Math.sin((i + seed) * 0.4) * (2 + (seed % 3)) + ((i % 4) - 1.5) * 0.4;
      out.push(v);
    }
    return out;
  }

  function latestCoinLine(state, agentId) {
    var coins = state.coins || [];
    var audits = state.audits || [];
    if (!coins.length && !audits.length) return null;
    var c = coins[0];
    if (agentId === "auditor" && audits.length) {
      var a = audits[0];
      return {
        symbol: a.symbol || (c && c.symbol) || "?",
        mint: a.mint || (c && c.mint),
        text: "$" + (a.symbol || "?") + " · " + (a.audit_pass ? "PASS" : "REJECT")
      };
    }
    if (agentId === "scanner" || agentId === "auditor") {
      var scan = c.scan || (c.audit_pass ? "PASS" : "REJECT");
      var reason = c.reason ? String(c.reason).split(";")[0].trim() : "";
      if (reason.length > 42) reason = reason.slice(0, 40) + "…";
      return {
        symbol: c.symbol || "?",
        mint: c.mint,
        text: "$" + (c.symbol || "?") + " · " + scan + (reason ? ": " + reason : "")
      };
    }
    // other agents: show open position if any
    var pos = (state.positions || [])[0];
    if (pos) {
      return {
        symbol: pos.symbol || "?",
        mint: pos.mint,
        text: "$" + (pos.symbol || "?") + " · " + (pos.status || pos.side || "open")
      };
    }
    return null;
  }

  function agentStats(state, agentId) {
    var closed = (state.trades || state.closed || []).filter(function (t) {
      return !t.agent || String(t.agent).toLowerCase() === agentId;
    });
    var pnl = 0;
    closed.forEach(function (t) { pnl += Number(t.pnl_usd != null ? t.pnl_usd : t.pnl) || 0; });
    var equity = Number(state.equity_usd) || 0;
    var pct = equity > 0 && closed.length ? (pnl / Math.max(equity, 1)) * 100 : null;
    return { closed: closed.length, pnl: pnl, pct: pct };
  }

  function renderAgents(state) {
    var root = $("agents-list");
    root.innerHTML = "";
    var hb = state.heartbeats || {};
    AGENTS.forEach(function (a, idx) {
      var card = document.createElement("article");
      card.className = "agent-card";
      var status = hb[a.id] != null ? hb[a.id] : "not started";
      var ok = hbOk(status);
      var line = latestCoinLine(state, a.id);
      var stats = agentStats(state, a.id);
      var mid = document.createElement("div");
      mid.className = "agent-mid";
      mid.innerHTML =
        "<div class='agent-name'>" + a.name + "</div>" +
        "<div class='agent-sub'>" + a.sub + (ok ? " · live" : " · " + String(status).slice(0, 28)) + "</div>";
      var coinEl = document.createElement("div");
      coinEl.className = "agent-coin";
      if (line) {
        var link = document.createElement("a");
        link.href = coinUrl(line.mint, "solana");
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = line.text;
        coinEl.appendChild(link);
      } else {
        coinEl.textContent = ok ? "scanning…" : "idle";
      }
      mid.appendChild(coinEl);
      var canvas = document.createElement("canvas");
      canvas.className = "spark";
      canvas.setAttribute("aria-hidden", "true");
      mid.appendChild(canvas);

      var right = document.createElement("div");
      right.className = "agent-right";
      var pctEl = document.createElement("div");
      pctEl.className = "agent-pct";
      if (stats.pct != null && stats.closed) {
        pctEl.textContent = fmtPct(stats.pct);
        pctEl.classList.add(stats.pct >= 0 ? "pos" : "neg");
      } else if (line && (a.id === "scanner" || a.id === "auditor")) {
        var pass = /PASS/i.test(line.text);
        pctEl.textContent = pass ? "PASS" : "REJ";
        pctEl.classList.add(pass ? "pos" : "neg");
        pctEl.style.fontSize = "0.95rem";
      } else {
        pctEl.textContent = ok ? "…" : "—";
        pctEl.classList.add("neu");
      }
      right.appendChild(pctEl);
      var usd = document.createElement("div");
      usd.className = "agent-usd";
      usd.textContent = stats.closed ? (fmtUsd(stats.pnl) + " · " + stats.closed + " closed") : (ok ? "watching" : "not started");
      right.appendChild(usd);
      var tags = document.createElement("div");
      tags.className = "agent-tags";
      tags.innerHTML = "<span class='tag'>" + (ok ? "OK" : "IDLE") + "</span>";
      right.appendChild(tags);

      var ico = document.createElement("div");
      ico.className = "agent-ico";
      ico.style.background = a.color;
      ico.textContent = a.icon;

      card.appendChild(ico);
      card.appendChild(mid);
      card.appendChild(right);
      root.appendChild(card);

      requestAnimationFrame(function () {
        if (window.NimbusChart) {
          window.NimbusChart.spark(canvas, seriesFromEquity(state.equity, idx * 7 + 3), a.color);
        }
      });
    });
  }

  /* ---- tokens / positions / audited coins ---- */
  function renderTokens(state) {
    var grid = $("tokens-grid");
    grid.innerHTML = "";
    var positions = state.positions || [];
    var tokens = state.tokens || [];
    var rows = positions.length ? positions : tokens;
    if (!rows.length) {
      // Fall back: show recent audited coins as "watched" tokens
      var coins = state.coins || [];
      if (!coins.length) {
        var p = document.createElement("p");
        p.className = "empty-hint";
        p.textContent = "Inga öppna positioner";
        grid.appendChild(p);
        return;
      }
      coins.slice(0, 6).forEach(function (c) {
        var a = document.createElement("a");
        a.className = "token-row";
        a.href = coinUrl(c.mint, "solana");
        a.target = "_blank";
        a.rel = "noopener";
        var pass = !!c.audit_pass || c.scan === "PASS";
        a.innerHTML =
          "<div class='token-ico'>" + icoLetter(c.symbol) + "</div>" +
          "<div><div class='token-name'>$" + (c.symbol || "?") + "</div>" +
          "<div class='token-amt'>" + shortMint(c.mint) + "</div></div>" +
          "<div><div class='token-val'>" + (c.scan || (pass ? "PASS" : "REJECT")) + "</div>" +
          "<div class='token-chg " + (pass ? "pos" : "neg") + "'>" + (pass ? "PASS" : "REJECT") + "</div></div>";
        grid.appendChild(a);
      });
      return;
    }
    rows.slice(0, 8).forEach(function (t) {
      var a = document.createElement("a");
      a.className = "token-row";
      a.href = coinUrl(t.mint || t.address, t.chain || "solana");
      a.target = "_blank";
      a.rel = "noopener";
      var chg = Number(t.pnl_usd != null ? t.pnl_usd : t.change_usd) || 0;
      a.innerHTML =
        "<div class='token-ico'>" + icoLetter(t.symbol || t.name) + "</div>" +
        "<div><div class='token-name'>" + (t.name || t.symbol || "?") + "</div>" +
        "<div class='token-amt'>" + (t.amount != null ? t.amount : (t.symbol || "")) + "</div></div>" +
        "<div><div class='token-val'>" + fmtUsd(t.value_usd != null ? t.value_usd : t.usd || 0) + "</div>" +
        "<div class='token-chg " + (chg >= 0 ? "pos" : "neg") + "'></div></div>";
      a.querySelector(".token-chg").textContent = (chg >= 0 ? "+" : "") + fmtUsd(chg);
      grid.appendChild(a);
    });
  }

  function layerDots(layers) {
    var names = ["mint", "freeze", "dev_wallet", "top10", "liquidity", "pool_age", "bundles", "delegations"];
    var map = {};
    (layers || []).forEach(function (L) {
      if (!L || typeof L !== "object") return;
      var key = String(L.layer != null ? L.layer : (L.name != null ? L.name : "")).toLowerCase().replace(/\s+/g, "_");
      map[key] = !!L.pass;
      if (L.name != null) map[String(L.name).toLowerCase().replace(/\s+/g, "_")] = !!L.pass;
    });
    var html = "<span class='layer-dots'>";
    names.forEach(function (n, i) {
      var ok = map[n];
      if (ok == null && layers && layers[i]) ok = !!layers[i].pass;
      html += "<i class='" + (ok ? "y" : "n") + "' title='" + n + "'></i>";
    });
    html += "</span>";
    return html;
  }

  function renderAudited(state) {
    // Inject or reuse a Granskade coins block under tokens
    var wrap = document.getElementById("audited-wrap");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.id = "audited-wrap";
      wrap.className = "audited-wrap";
      var tokensWrap = document.querySelector(".tokens-wrap");
      if (tokensWrap && tokensWrap.parentNode) {
        tokensWrap.parentNode.insertBefore(wrap, tokensWrap.nextSibling);
      }
    }
    var coins = state.coins || [];
    var audits = state.audits || [];
    // Prefer coins (have scan+reason); merge layers from audits by mint
    var byMint = {};
    audits.forEach(function (a) { if (a.mint) byMint[a.mint] = a; });
    var list = coins.length ? coins : audits.map(function (a) {
      return { mint: a.mint, symbol: a.symbol, scan: a.audit_pass ? "PASS" : "REJECT", audit_pass: a.audit_pass, layers: a.layers };
    });
    if (!list.length) {
      wrap.innerHTML = "";
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;
    var html = "<h2 class='sec-title'>Granskade coins</h2><div class='audit-list'>";
    list.slice(0, 12).forEach(function (c) {
      var layers = c.layers || (byMint[c.mint] && byMint[c.mint].layers) || [];
      var pass = !!c.audit_pass || c.scan === "PASS";
      var pill = pass ? "PASS" : "REJECT";
      html += "<a class='audit-row' href='" + coinUrl(c.mint, "solana") + "' target='_blank' rel='noopener'>" +
        "<div class='audit-sym'>$" + (c.symbol || "?") + "</div>" +
        "<span class='scan-pill " + (pass ? "pass" : "rej") + "'>" + pill + "</span>" +
        layerDots(layers) +
        "</a>";
    });
    html += "</div>";
    wrap.innerHTML = html;
  }

  function renderClosed(state) {
    var list = $("closed-list");
    var trades = state.trades || state.closed || [];
    $("closed-count").textContent = String(trades.length);
    list.innerHTML = "";
    if (!trades.length) {
      var p = document.createElement("p");
      p.className = "empty-hint";
      p.textContent = "Inga stängda trades än";
      list.appendChild(p);
      return;
    }
    trades.slice(0, 12).forEach(function (t) {
      var row = document.createElement("div");
      row.className = "closed-row";
      var pnl = Number(t.pnl_usd != null ? t.pnl_usd : t.pnl) || 0;
      var agent = t.agent || "Executor";
      var held = t.held || t.held_s != null ? ("held " + (t.held || (t.held_s + "s"))) : "";
      row.innerHTML =
        "<div class='closed-ico'>" + icoLetter(t.symbol) + "</div>" +
        "<div><div class='closed-main'><a href='" + coinUrl(t.mint, "solana") + "' target='_blank' rel='noopener'>$" +
        (t.symbol || "?") + " · " + agent + "</a></div>" +
        "<div class='closed-sub'>" + held + "</div></div>" +
        "<div class='closed-pnl " + (pnl >= 0 ? "pos" : "neg") + "'></div>";
      row.querySelector(".closed-pnl").textContent = (pnl >= 0 ? "+" : "") + fmtUsd(pnl);
      list.appendChild(row);
    });
    // toast on new closed wins
    var sig = trades.map(function (t) { return (t.symbol || "") + (t.pnl_usd || t.pnl || ""); }).join("|");
    if (seeded && sig && sig !== lastClosedSig && trades[0]) {
      var t0 = trades[0];
      var p0 = Number(t0.pnl_usd != null ? t0.pnl_usd : t0.pnl) || 0;
      toast(p0 >= 0 ? "win" : "loss",
        (t0.agent || "Agent") + " closed $" + (t0.symbol || "?"),
        (p0 >= 0 ? "+" : "") + fmtUsd(p0));
    }
    lastClosedSig = sig;
    seeded = true;
  }

  function renderGoal(state) {
    var equity = Number(state.equity_usd) || 0;
    var deposit = Number(state.deposit_usd || state.bankroll_usd || 0);
    if (!deposit && equity > 0) deposit = equity; // at rest 1.00x
    if (!deposit) deposit = 100; // display scale only when empty paper
    var mult = deposit > 0 ? (equity / deposit) : 1;
    if (!equity && !Number(state.deposit_usd || state.bankroll_usd || 0)) mult = 1;
    $("multi-pill").innerHTML = "since deposit <b>" + mult.toFixed(2) + "x</b>";
    var pct = Math.max(0, Math.min(100, (mult / 10) * 100));
    $("goal-fill").style.width = pct + "%";
    $("goal-pct").textContent = Math.round(pct) + "%";
    document.querySelectorAll("#goal-track .dot").forEach(function (d) {
      var m = Number(d.getAttribute("data-m"));
      d.classList.toggle("hit", mult >= m);
      d.classList.toggle("current", mult >= m * 0.85 && mult < m * 1.15);
    });
    if (mult >= 10 && !window.__nimbusGoalToast) {
      window.__nimbusGoalToast = true;
      toast("goal", "Goal reached: 10x", "keep going");
    }
  }

  function renderHeader(state) {
    var mode = String((state && state.mode) || "PAPER").toUpperCase();
    $("mode-pill").textContent = mode === "LIVE" ? "LIVE" : "SIM";
    $("agents-sub").textContent = "5 agents · " + (mode === "LIVE" ? "live run" : "paper run");
    var on = mode === "LIVE" || mode === "PAPER"; // auto-trade reflects desk running
    var hb = (state && state.heartbeats) || {};
    var anyOk = Object.keys(hb).some(function (k) { return hbOk(hb[k]); });
    $("auto-toggle").classList.toggle("on", anyOk || mode === "LIVE");
    syncBankrollUI(mode);

    var equity = Number(state.equity_usd) || 0;
    setBalance($("balance"), equity);

    var pill = $("status-pill");
    var deposit = Number(state.deposit_usd || state.bankroll_usd || 0);
    var delta = equity - (deposit || 0);
    if (!anyOk && equity === 0) {
      pill.className = "status-pill";
      pill.textContent = "Bot idle";
    } else {
      pill.className = "status-pill good";
      var deltaHtml = (delta >= 0 ? "+$" : "-$") + Math.abs(delta).toFixed(2);
      pill.innerHTML = "<span class='delta'>" + deltaHtml + "</span> " + relTime(state.updated_at);
    }
    var path = (loadConfig().dataBase || "");
    var wm = path.slice(-4) || "····";
    $("wm").textContent = "···· " + wm;
  }

  function showBootEmpty(show) {
    var el = $("boot-empty");
    if (el) el.hidden = !show;
    var app = $("app");
    if (app) app.hidden = !!show;
  }

  function renderState(state) {
    if (!state) { showBootEmpty(true); return; }
    showBootEmpty(false);
    renderHeader(state);
    renderAgents(state);
    renderTokens(state);
    renderAudited(state);
    renderClosed(state);
    renderGoal(state);
  }

  function fetchJson(url) {
    return fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("http " + r.status);
      return r.json();
    });
  }

  function poll(cfg) {
    if (window.__NIMBUS_MOCK_STATE__) {
      renderState(window.__NIMBUS_MOCK_STATE__);
      return;
    }
    if (!cfg.dataBase) {
      showBootEmpty(true);
      return;
    }
    var base = cfg.dataBase.replace(/\/$/, "");
    fetchJson(base + "/state.json")
      .then(function (state) { renderState(state); })
      .catch(function () { showBootEmpty(true); });
  }

  // Extra CSS for audit rows (injected once)
  (function injectAuditCss() {
    var s = document.createElement("style");
    s.textContent =
      ".audited-wrap{display:flex;flex-direction:column;gap:8px}" +
      ".audit-list{display:flex;flex-direction:column;gap:6px}" +
      ".audit-row{display:grid;grid-template-columns:72px 64px 1fr;gap:8px;align-items:center;" +
      "padding:8px 10px;border-radius:12px;background:var(--card);border:1px solid var(--border);font-size:0.78rem}" +
      ".audit-sym{font-weight:720;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".scan-pill{text-align:center;font-weight:800;font-size:0.65rem;padding:3px 0;border-radius:999px}" +
      ".scan-pill.pass{background:rgba(61,255,106,0.15);color:var(--green)}" +
      ".scan-pill.rej{background:rgba(255,77,106,0.15);color:var(--red)}" +
      ".layer-dots{display:flex;gap:3px;justify-content:flex-end;flex-wrap:wrap}" +
      ".layer-dots i{width:8px;height:8px;border-radius:50%;display:inline-block}" +
      ".layer-dots i.y{background:var(--green)}" +
      ".layer-dots i.n{background:#4a4058}";
    document.head.appendChild(s);
  })();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(function () {});
  }

  wireControls();
  var cfg = loadConfig();
  poll(cfg);
  setInterval(function () { poll(cfg); }, POLL_MS);
})();
