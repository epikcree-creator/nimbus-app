/* Degen PWA — polls desk JSON from DATA_BASE in URL fragment */
(function () {
  var POLL_MS = 15000;
  var LS_BASE = "nimbus_data_base";
  var LS_TOKEN = "nimbus_app_token";
  var SIGNUP_URL = "https://fomo.family";
  var CHAIN_ID = { solana: 1399811149, robinhood: 4663, base: 8453, bnb: 56 };
  var AGENTS = [
    { id: "scanner", name: "Scanner", sub: "Graduationer · PumpPortal", color: "#64d2ff", icon: "𝒮" },
    { id: "auditor", name: "Auditor", sub: "8 lager · RugCheck", color: "#9b6bff", icon: "𝒜" },
    { id: "analyst", name: "Analyst", sub: "Jev · noul-frågor", color: "#ffd60a", icon: "𝒥" },
    { id: "executor", name: "Executor", sub: "Paper-fyllningar", color: "#00d35a", icon: "ℰ" },
    { id: "risk", name: "Risk", sub: "Stopp · trailing", color: "#ff6b9a", icon: "ℛ" }
  ];
  function applyBrand() {
    var name = window.NimbusBrand && window.NimbusBrand.name;
    if (!name) return;
    document.title = name;
    var apple = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (apple) apple.setAttribute("content", name);
    document.querySelectorAll("[data-app-name]").forEach(function (el) {
      el.textContent = name;
    });
    document.querySelectorAll("[data-app-name-suffix]").forEach(function (el) {
      el.textContent = name + el.getAttribute("data-app-name-suffix");
    });
    document.querySelectorAll("[data-app-name-alt]").forEach(function (el) {
      el.setAttribute("alt", name);
    });
  }
  applyBrand();

  var selectedAmt = 100;
  var lastClosedSig = "";
  var goalFilter = "ALL";
  var seeded = false;


  function svReason(raw) {
    if (raw == null || raw === "") return "";
    var r = String(raw);
    // Python None / null / undefined strings
    r = r.replace(/\bNone\b/g, "ingen data");
    r = r.replace(/\bnull\b/gi, "ingen data");
    r = r.replace(/\bundefined\b/gi, "ingen data");
    r = r.replace(/^REJECT\s*[:·-]?\s*/i, "");
    r = r.replace(/^PASS\s*[:·-]?\s*/i, "");
    r = r.replace(/^KILL\s*[:·-]?\s*/i, "");
    r = r.replace(/liquidity\s+ingen data\s*<\s*[\d.]+/gi, "likviditet: ingen data");
    r = r.replace(/liquidity\s+ingen data/gi, "likviditet: ingen data");
    r = r.replace(/liq\s+unknown/gi, "likviditet: ingen data");
    r = r.replace(/\btop\s*10\s*hold\b/gi, "topp 10 äger");
    r = r.replace(/\btop10\s+/gi, "topp 10 ");
    r = r.replace(/topp\s*10\s+([\d.]+)\s*%\s*>\s*[\d.]+/gi, function(_, p) {
      return "topp 10 äger " + Math.round(parseFloat(p)) + "%";
    });
    r = r.replace(/likviditet\s+\$?([\d.]+)\s*<\s*\$?[\d.]+/gi, function(_, v) {
      var n = parseFloat(v);
      return n >= 1000 ? ("likviditet $" + (n/1000).toFixed(1) + "K") : ("likviditet $" + Math.round(n));
    });
    r = r.replace(/\bliquidity\b/gi, "likviditet");
    r = r.replace(/liq\s*\$/gi, "likviditet $");
    r = r.replace(/\bin 1h\b/gi, "på 1h");
    r = r.replace(/never qualified/gi, "kvalificerades aldrig");
    r = r.replace(/copycat of/gi, "kopia av");
    r = r.replace(/proof\s*inject/gi, "TESTDATA");
    r = r.replace(/likviditet:\s*ingen data\s*[·:<]?\s*[\d.]*/gi, "likviditet: ingen data");
    return r.replace(/^\s*[;·]+|[;·]+\s*$/g, "").trim();
  }

  function coinUrl(address, chain) {
    chain = chain || "solana";
    if (!address || !(chain in CHAIN_ID)) return SIGNUP_URL;
    return "https://fomo.family/coin?address=" + encodeURIComponent(address) +
      "&chainId=" + CHAIN_ID[chain];
  }
  function profileUrl(handle) {
    var h = String(handle || "").replace(/^@/, "");
    return "https://fomo.family/profile/" + encodeURIComponent(h);
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
  /* t170: product is Degen. Desk strings published before the 21:40 restart
     still say "Swipe Mode"; rename them on the client so every screen matches. */
  function brandName() { return (window.NimbusBrand && NimbusBrand.name) || "Degen"; }
  function brandText(v) {
    if (typeof v !== "string") return v;
    return v.replace(/Swipe Mode/g, brandName()).replace(/Swipe-kärnan/g, brandName() + "-kärnan").replace(/SWIPE-KÄRNAN/g, brandName().toUpperCase() + "-KÄRNAN");
  }
  function brandDeep(o, depth) {
    if (depth > 12 || o == null) return o;
    if (typeof o === "string") return brandText(o);
    if (Array.isArray(o)) { for (var i = 0; i < o.length; i++) o[i] = brandDeep(o[i], depth + 1); return o; }
    if (typeof o === "object") { for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) o[k] = brandDeep(o[k], depth + 1); }
    return o;
  }
  window.NimbusBrandText = brandText;

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
    if (s < 20) return "Uppdaterad nyss";
    if (s < 60) return "Uppdaterad " + s + "s sedan";
    if (s < 3600) return "Uppdaterad " + Math.floor(s / 60) + "m sedan";
    return "Uppdaterad " + Math.floor(s / 3600) + "h sedan";
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
      src.textContent = "simulering";
    }
  }

  var accountBuilt = false;
  var accountDirty = {};
  var accountCatalog = null;
  var shownState = null;
  var moneyReasonsOpen = false;

  function openPositionCount(state) {
    var rows = state && state.positions;
    return Array.isArray(rows) ? rows.length : 0;
  }

  function currentMoney(state, action) {
    var stored = "";
    try { stored = localStorage.getItem("nimbus_money_choice") || ""; } catch (e) { stored = ""; }
    var result = window.NimbusSettings.moneyChoice({
      publishedMode: String((state && state.mode) || "PAPER"),
      stored: stored,
      action: action || "show",
      openPositions: openPositionCount(state)
    });
    try { localStorage.setItem("nimbus_money_choice", result.persist); } catch (e2) {}
    return result;
  }

  function paintMoney(result) {
    var published = result.publishedMode;
    var pill = $("mode-pill");
    if (pill) {
      pill.textContent = published === "LIVE" ? "LIVE" : "SIM";
      pill.setAttribute("title", result.message);
    }
    var sub = $("agents-sub");
    if (sub) {
      sub.textContent = published === "LIVE"
        ? "Desken visar LIVE · appen handlar inte"
        : "PAPER · papperspengar";
    }
    var status = $("money-status");
    if (status) status.textContent = published === "LIVE" ? "Appen: papperspengar" : "Papperspengar";
    var paperBtn = $("money-paper");
    var liveBtn = $("money-live");
    if (paperBtn) {
      paperBtn.classList.add("on");
      paperBtn.setAttribute("aria-pressed", "true");
    }
    if (liveBtn) {
      liveBtn.classList.remove("on");
      liveBtn.setAttribute("aria-pressed", "false");
    }
    var desk = $("money-desk");
    if (desk) desk.textContent = published === "LIVE" ? "Desken: LIVE" : "Desken: papperspengar";
    var note = $("money-note");
    var list = $("money-reasons");
    if (result.status === "unavailable") {
      moneyReasonsOpen = true;
      if (note) note.textContent = result.message;
      if (list) {
        list.hidden = false;
        list.textContent = "";
        result.reasons.forEach(function (reason) {
          var item = document.createElement("li");
          item.textContent = reason;
          list.appendChild(item);
        });
      }
      return;
    }
    if (!moneyReasonsOpen && note) note.textContent = result.message;
    if (!moneyReasonsOpen && list) {
      list.hidden = true;
      list.textContent = "";
    }
  }

  function chooseMoney(action) {
    if (action === "select-paper") moneyReasonsOpen = false;
    paintMoney(currentMoney(shownState, action));
  }

  function isLocalPreview() {
    var host = location.hostname;
    var local = host === "127.0.0.1" || host === "localhost";
    return local && location.search.indexOf("preview=1") !== -1;
  }

  function previewState() {
    return {
      mode: "PAPER",
      updated_at: new Date().toISOString(),
      equity: [200, 200],
      equity_usd: 200,
      deposit_usd: 200,
      bankroll_usd: 200,
      paper_start_stack: 200,
      live_stack: 200,
      positions: [],
      coins: [],
      heartbeats: { scanner: "ok", auditor: "ok", analyst: "ok", executor: "ok", risk: "ok" },
      activity: [],
      audits: [],
      agents: {},
      account: { mode: "PAPER", stack: 200, fomo_handle: "exempel", signup_url: SIGNUP_URL },
      settings: {
        mode: "PAPER",
        paper_start_stack: 200,
        live_stack: 200,
        stack_pct: 8,
        min_ticket_usd: 47.5,
        below_min: "bump",
        analyst_mode: "jev",
        fomo_handle: "exempel",
        stop_pct: 6,
        notifier: "telegram",
        report_time: "08:00",
        auditor_enabled: true,
        push_rejects: false,
        rpc_published: false
      },
      change_log: [],
      settings_write: { direct: false },
      kill_switch: { locked: false, reason_sv: null },
      risk_limits: { max_buy_usd: 50, max_open_positions: 5, capital_usd: 200, open_positions: 0 },
      journal: { active: true, count: 0, entries: [] },
      intel: {
        active: true,
        generated_at: new Date().toISOString(),
        timezone: "Europe/Stockholm",
        guide_habits_sv: [
          "Varje påstående har källa och datum.",
          "Saknad data visas som saknas.",
          "Tyst när inget ändrats.",
          "Oscar bekräftar varje köp själv (PAPER)."
        ],
        briefing: {
          active: true,
          quiet: false,
          items: [
            { id: "kapital", title_sv: "Kapital", body_sv: "$200.00", source: "desk.balance", dated: "2026-11-09" },
            { id: "oppna", title_sv: "Öppna positioner", body_sv: "saknas", source: "desk.positions", dated: "2026-11-09" },
            { id: "natt", title_sv: "Kort över natten", body_sv: "2", source: "desk.trade_journal", dated: "2026-11-08" },
            { id: "kill", title_sv: "Kill switch", body_sv: "öppen", source: "desk.kill_switch", dated: "2026-11-09 20:30" },
            { id: "risk", title_sv: "Risklås", body_sv: "max $50.00 per köp · max 5 öppna", source: "desk.risk_limits", dated: "2026-11-09" }
          ],
          note_sv: "TEST — fixture brief"
        },
        changes: {
          active: true,
          quiet: false,
          changes: [
            {
              profile: "prevaile",
              kind: "new",
              title_sv: "prevaile · 1 nya mint",
              body_sv: "TEST $12.00",
              buys_24h: 1,
              new_mints: [{ mint: "TestMint1111111111111111111111111111111", symbol: "TEST", amount_usd: 12 }],
              source: "desk.fomo_observations",
              dated: "2026-11-09 20:30"
            }
          ]
        },
        watchlist: {
          active: true,
          quiet: true,
          quiet_sv: "Inget nytt på bevakade mint.",
          cards: [],
          empty_sv: "Inga mint på bevakning."
        },
        sentiment: {
          active: true,
          cards: [
            {
              mint: "TestMint1111111111111111111111111111111",
              symbol: "TEST",
              rating: "Medel",
              narrative_sv: "TEST — kort narrativ om en coin.",
              mentions_1h: 4,
              unique_accounts_1h: 3,
              bot_suspect: "nej",
              notes_sv: "fixture",
              dated: "2026-11-09T12:00:00+00:00",
              source: "desk.narrative_ratings"
            }
          ]
        },
        research: {
          active: true,
          packs: [
            {
              mint: "TestMint1111111111111111111111111111111",
              symbol: "TEST",
              title_sv: "Fakta · TEST",
              note_sv: "TEST — varje rad har källa.",
              claims: [
                { claim_sv: "Narrativ: TEST — kort narrativ om en coin.", value: "Medel", source: "desk.narrative_ratings", dated: "2026-11-09T12:00:00+00:00" },
                { claim_sv: "Omnämnanden senaste timmen (fri X-koll)", value: 4, source: "desk.narrative_ratings.mentions_1h", dated: "2026-11-09T12:00:00+00:00" },
                { claim_sv: "Likviditet", value: "saknas", source: "desk.intel", dated: "saknas" }
              ]
            }
          ]
        }
      }
    };
  }

  function loadCatalog(cb) {
    if (accountCatalog) { cb(accountCatalog); return; }
    if (window.__NIMBUS_CATALOG__) {
      accountCatalog = window.__NIMBUS_CATALOG__;
      cb(accountCatalog);
      return;
    }
    fetch("./settings_catalog.json", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("catalog"); return r.json(); })
      .then(function (j) { accountCatalog = j; cb(j); })
      .catch(function () { cb(null); });
  }

  function fieldValueFromState(field, state) {
    var settings = (state && state.settings) || {};
    if (Object.prototype.hasOwnProperty.call(settings, field.key) && settings[field.key] != null) {
      return settings[field.key];
    }
    return field.default;
  }

  function readControl(field) {
    var root = document.querySelector('[data-setting="' + field.key + '"]');
    if (!root) return field.default;
    if (field.kind === "number") {
      var num = root.querySelector("input.exact");
      return num ? num.value : field.default;
    }
    if (field.kind === "bool") {
      var on = root.querySelector(".bool-btn.on");
      return on ? on.getAttribute("data-value") === "true" : field.default;
    }
    if (field.kind === "enum") {
      var choice = root.querySelector(".choice.on");
      return choice ? choice.getAttribute("data-value") : field.default;
    }
    if (field.kind === "time" || field.kind === "text") {
      var text = root.querySelector("input");
      return text ? text.value : field.default;
    }
    return fieldValueFromState(field, window.__nimbusLastState);
  }

  function setFieldError(field, message) {
    var root = document.querySelector('[data-setting="' + field.key + '"]');
    if (!root) return;
    var err = root.querySelector(".setting-error");
    if (err) err.textContent = message || "";
    var input = root.querySelector("input.exact, input[type='text']");
    if (input) {
      if (message) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
    }
  }

  function collectDraft() {
    var values = {};
    var errors = [];
    var focusKey = null;
    (accountCatalog.fields || []).forEach(function (field) {
      if (field.kind === "secret") return;
      var raw = accountDirty[field.key] ? readControl(field) : fieldValueFromState(field, window.__nimbusLastState);
      if (field.kind === "readonly") {
        values[field.key] = fieldValueFromState(field, window.__nimbusLastState);
        return;
      }
      var checked = window.NimbusSettings.validateField(field, raw);
      if (!checked.ok) {
        errors.push(checked.message);
        setFieldError(field, checked.message);
        values[field.key] = fieldValueFromState(field, window.__nimbusLastState);
        return;
      }
      setFieldError(field, "");
      values[field.key] = checked.value == null ? raw : checked.value;
      if (accountDirty[field.key]) focusKey = field.key;
    });
    return { values: values, errors: errors, focusKey: focusKey };
  }

  function renderTicketBanner() {
    var box = $("ticket-banner");
    if (!box || !accountCatalog || !window.NimbusSettings) return;
    var pack = collectDraft();
    var mode = String(pack.values.mode || "PAPER").toUpperCase();
    var stack = mode === "LIVE" ? Number(pack.values.live_stack) : Number(pack.values.paper_start_stack);
    var check = window.NimbusSettings.ticketCheck(
      stack, pack.values.stack_pct, pack.values.min_ticket_usd, pack.values.below_min
    );
    box.className = "ticket-banner " + (check.level || "ok");
    var formula = "Minsta stack = $" + Number(pack.values.min_ticket_usd).toFixed(2) +
      " / (" + pack.values.stack_pct + " / 100) = $" + Number(check.min_stack).toFixed(2);
    var msg = check.message_sv || "Stacken räcker för en vanlig biljett.";
    if (accountDirty.live_stack && mode !== "LIVE") {
      var live = window.NimbusSettings.ticketCheck(
        pack.values.live_stack, pack.values.stack_pct, pack.values.min_ticket_usd, pack.values.below_min
      );
      if (live.message_sv) msg += " Sparad LIVE-siffra: " + live.message_sv;
    }
    box.innerHTML = "";
    var strong = document.createElement("div");
    strong.textContent = msg;
    var sub = document.createElement("span");
    sub.className = "ticket-formula";
    sub.textContent = formula;
    box.appendChild(strong);
    box.appendChild(sub);
  }

  function renderChangeLog(state) {
    var root = $("account-log");
    if (!root) return;
    var rows = (state && state.change_log) || [];
    root.innerHTML = "";
    if (!rows.length) {
      var empty = document.createElement("p");
      empty.className = "empty-hint";
      empty.textContent = "Inga ändringar publicerade än.";
      root.appendChild(empty);
      return;
    }
    rows.slice(0, 20).forEach(function (row) {
      if (!row || row.key === "rpc_url") return;
      var el = document.createElement("div");
      el.className = "log-row";
      var title = document.createElement("div");
      var b = document.createElement("b");
      b.textContent = row.key || "";
      title.appendChild(b);
      title.appendChild(document.createTextNode(" " + (row.old == null ? "—" : row.old) + " → " + (row.new == null ? "—" : row.new)));
      var meta = document.createElement("div");
      meta.className = "log-meta";
      meta.textContent = (row.ts || "") + (row.who ? " · " + row.who : "");
      el.appendChild(title);
      el.appendChild(meta);
      root.appendChild(el);
    });
  }

  function applyControlValue(field, value) {
    var root = document.querySelector('[data-setting="' + field.key + '"]');
    if (!root || accountDirty[field.key]) return;
    if (field.kind === "number") {
      var num = root.querySelector("input.exact");
      var slider = root.querySelector('input[type="range"]');
      if (num && document.activeElement !== num) num.value = value;
      if (slider && value != null && value !== "" && !isNaN(Number(value))) {
        var n = Number(value);
        if (n >= Number(field.min) && n <= Number(field.max)) slider.value = String(n);
      }
      return;
    }
    if (field.kind === "bool") {
      var on = value === true || value === "true" || value === 1 || value === "1";
      root.querySelectorAll(".bool-btn").forEach(function (btn) {
        btn.classList.toggle("on", (btn.getAttribute("data-value") === "true") === on);
      });
      return;
    }
    if (field.kind === "enum") {
      root.querySelectorAll(".choice").forEach(function (btn) {
        btn.classList.toggle("on", btn.getAttribute("data-value") === String(value));
      });
      return;
    }
    if (field.kind === "readonly") {
      var pill = root.querySelector(".readonly-pill");
      if (pill) pill.textContent = String(value || "PAPER");
      return;
    }
    var input = root.querySelector("input");
    if (input && document.activeElement !== input) input.value = value == null ? "" : value;
  }

  function buildAccountForm() {
    var host = $("account-fields");
    if (!host || !accountCatalog || accountBuilt) return;
    host.innerHTML = "";
    var byGroup = {};
    (accountCatalog.groups || []).forEach(function (g) { byGroup[g.id] = g; });
    var current = null;
    (accountCatalog.fields || []).forEach(function (field) {
      if (!current || current.id !== field.group) {
        current = byGroup[field.group] || { id: field.group, label: field.group };
        var section = document.createElement("section");
        section.className = "set-group";
        var h = document.createElement("h3");
        h.textContent = current.label;
        section.appendChild(h);
        host.appendChild(section);
        current.el = section;
      }
      var card = document.createElement("div");
      card.className = "setting";
      card.setAttribute("data-setting", field.key);
      var label = document.createElement("div");
      label.className = "setting-label";
      var name = document.createElement("span");
      name.textContent = field.label;
      label.appendChild(name);
      if (field.unit) {
        var unit = document.createElement("span");
        unit.className = "setting-unit";
        unit.textContent = field.unit;
        label.appendChild(unit);
      }
      card.appendChild(label);
      if (field.kind === "secret") {
        var secret = document.createElement("p");
        secret.className = "secret-note";
        secret.textContent = field.note || "Publiceras inte.";
        card.appendChild(secret);
        current.el.appendChild(card);
        return;
      }
      if (field.kind === "readonly") {
        var pill = document.createElement("div");
        pill.className = "readonly-pill";
        pill.textContent = "PAPER";
        card.appendChild(pill);
      } else if (field.kind === "number") {
        var controls = document.createElement("div");
        controls.className = "setting-controls";
        var slider = document.createElement("input");
        slider.type = "range";
        slider.min = String(field.min);
        slider.max = String(field.max);
        slider.step = String(field.step || 1);
        slider.setAttribute("aria-label", field.label);
        var num = document.createElement("input");
        num.type = "text";
        num.className = "exact";
        num.inputMode = "decimal";
        num.setAttribute("aria-label", field.label + " exakt");
        slider.addEventListener("input", function () {
          accountDirty[field.key] = true;
          num.value = slider.value;
          setFieldError(field, "");
          renderTicketBanner();
        });
        num.addEventListener("input", function () {
          accountDirty[field.key] = true;
          var checked = window.NimbusSettings.validateField(field, num.value);
          setFieldError(field, checked.ok ? "" : checked.message);
          if (checked.ok) slider.value = String(checked.value);
          renderTicketBanner();
        });
        controls.appendChild(slider);
        controls.appendChild(num);
        card.appendChild(controls);
        var hint = document.createElement("p");
        hint.className = "setting-hint";
        hint.textContent = "Tillåtet " + window.NimbusSettings.fmtBound(field.min) + "–" + window.NimbusSettings.fmtBound(field.max);
        card.appendChild(hint);
      } else if (field.kind === "bool") {
        var bools = document.createElement("div");
        bools.className = "bool-row";
        [["true", "På"], ["false", "Av"]].forEach(function (pair) {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "bool-btn";
          btn.setAttribute("data-value", pair[0]);
          btn.textContent = pair[1];
          btn.addEventListener("click", function () {
            accountDirty[field.key] = true;
            bools.querySelectorAll(".bool-btn").forEach(function (b) { b.classList.toggle("on", b === btn); });
            setFieldError(field, "");
            renderTicketBanner();
          });
          bools.appendChild(btn);
        });
        card.appendChild(bools);
      } else if (field.kind === "enum") {
        var choices = document.createElement("div");
        choices.className = "choice-row";
        (field.options || []).forEach(function (opt) {
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "choice";
          btn.setAttribute("data-value", opt.value);
          btn.textContent = opt.label;
          btn.addEventListener("click", function () {
            accountDirty[field.key] = true;
            choices.querySelectorAll(".choice").forEach(function (b) { b.classList.toggle("on", b === btn); });
            setFieldError(field, "");
            renderTicketBanner();
          });
          choices.appendChild(btn);
        });
        card.appendChild(choices);
      } else {
        var text = document.createElement("input");
        text.type = field.kind === "time" ? "text" : "text";
        text.inputMode = field.kind === "time" ? "numeric" : "text";
        text.placeholder = field.kind === "time" ? "08:00" : "";
        text.setAttribute("aria-label", field.label);
        text.addEventListener("input", function () {
          accountDirty[field.key] = true;
          var checked = window.NimbusSettings.validateField(field, text.value);
          setFieldError(field, checked.ok ? "" : checked.message);
          renderTicketBanner();
        });
        card.appendChild(text);
      }
      if (field.note && field.kind !== "secret") {
        var note = document.createElement("p");
        note.className = "setting-note";
        note.textContent = field.note;
        card.appendChild(note);
      }
      var err = document.createElement("p");
      err.className = "setting-error";
      card.appendChild(err);
      current.el.appendChild(card);
    });
    var note = $("account-write-note");
    if (note) {
      note.textContent = (accountCatalog.write && accountCatalog.write.reason_sv) || window.NimbusSettings.WRITE_REASON_SV;
    }
    accountBuilt = true;
  }

  function renderAccount(state) {
    var source = $("account-source");
    if (source) {
      var published = state && state.settings && state.settings.paper_start_stack != null;
      source.textContent = published
        ? "Värden från desken. RPC publiceras inte."
        : "Visar standardvärden tills desken publicerar inställningar. Inget skrivs över.";
    }
    loadCatalog(function (cat) {
      if (!cat) return;
      buildAccountForm();
      (cat.fields || []).forEach(function (field) {
        if (field.kind === "secret") return;
        applyControlValue(field, fieldValueFromState(field, state));
      });
      renderTicketBanner();
      renderChangeLog(state);
      syncOwnerForm(state);
      applySettingsAcks(state);
    });
  }

  function readOwnerSession() {
    try {
      var raw = sessionStorage.getItem("nimbus_owner_session");
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.access_token || !parsed.user_id) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function writeOwnerSession(session) {
    try { sessionStorage.setItem("nimbus_owner_session", JSON.stringify(session)); } catch (e) {}
  }

  function clearOwnerSession() {
    try { sessionStorage.removeItem("nimbus_owner_session"); } catch (e) {}
  }

  function transportOf(state) {
    return (state && state.settings_transport) || { ready: false, auth: "supabase_user" };
  }

  function syncOwnerForm(state) {
    var form = $("owner-auth");
    if (!form) return;
    var transport = transportOf(state || window.__nimbusLastState);
    form.hidden = !(transport.ready && !readOwnerSession());
  }

  var pendingAcks = {};

  function applySettingsAcks(state) {
    var rows = (state && state.settings_acks) || [];
    var box = $("account-save-result");
    rows.forEach(function (row) {
      if (!row || !pendingAcks[row.id]) return;
      var key = pendingAcks[row.id];
      if (row.status === "applied") {
        delete accountDirty[key];
        delete pendingAcks[row.id];
        if (box) {
          box.dataset.state = "applied";
          box.textContent = row.message_sv || "Sparat på desken.";
        }
      } else if (row.status === "rejected") {
        delete pendingAcks[row.id];
        if (box) {
          box.dataset.state = "rejected";
          box.textContent = row.message_sv || "Nekad.";
        }
      }
    });
  }

  function dirtyEntries() {
    var out = [];
    (accountCatalog.fields || []).forEach(function (field) {
      if (!accountDirty[field.key] || field.kind === "secret" || field.kind === "readonly") return;
      var checked = window.NimbusSettings.validateField(field, readControl(field));
      if (!checked.ok) return;
      var value = checked.value;
      if (field.kind === "bool") value = value ? "true" : "false";
      else value = String(value);
      out.push({ key: field.key, value: value });
    });
    return out;
  }

  function submitEntries(transport, session, entries, box) {
    var url = window.NimbusSettings.settingsRequestUrl(transport.supabase_url);
    if (!url || !window.NimbusSettings.publishableKeyAllowed(transport.publishable_key)) {
      box.dataset.state = "blocked";
      box.textContent = "Kanalen är inte säker att använda.";
      return;
    }
    var chain = Promise.resolve();
    entries.forEach(function (entry) {
      chain = chain.then(function () {
        var built = window.NimbusSettings.buildSettingsRequest({
          key: entry.key,
          value: entry.value,
          accessToken: session.access_token,
          userId: session.user_id,
          id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : "",
          nonce: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : ""
        });
        if (!built.ok) {
          box.dataset.state = "blocked";
          box.textContent = built.message;
          throw new Error("local");
        }
        pendingAcks[built.row.id] = entry.key;
        return fetch(url, {
          method: "POST",
          headers: {
            "apikey": transport.publishable_key,
            "Authorization": "Bearer " + session.access_token,
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
          },
          body: JSON.stringify(built.row)
        }).then(function (response) {
          if (response.status === 401) {
            clearOwnerSession();
            syncOwnerForm(window.__nimbusLastState);
            box.dataset.state = "auth";
            box.textContent = "Ägarinloggning krävs.";
            return;
          }
          if (!response.ok) {
            delete pendingAcks[built.row.id];
            box.dataset.state = "rejected";
            box.textContent = "Inte sparat. Åtkomst nekad.";
          }
        });
      });
    });
    chain.catch(function () {});
  }

  function loginOwner(event) {
    event.preventDefault();
    var box = $("account-save-result");
    var transport = transportOf(window.__nimbusLastState);
    var url = window.NimbusSettings.authTokenUrl(transport.supabase_url);
    var emailEl = $("owner-email");
    var passwordEl = $("owner-password");
    var email = emailEl ? emailEl.value : "";
    var password = passwordEl ? passwordEl.value : "";
    if (passwordEl) passwordEl.value = "";
    if (!url || !transport.publishable_key) {
      if (box) {
        box.dataset.state = "blocked";
        box.textContent = window.NimbusSettings.WRITE_REASON_SV;
      }
      return;
    }
    fetch(url + "?grant_type=password", {
      method: "POST",
      headers: { "apikey": transport.publishable_key, "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, password: password })
    }).then(function (response) {
      return response.json().then(function (body) {
        return { ok: response.ok, body: body || {} };
      });
    }).then(function (result) {
      var user = result.body.user || {};
      if (!result.ok || !result.body.access_token || !user.id) {
        if (box) {
          box.dataset.state = "auth";
          box.textContent = "Inloggningen misslyckades.";
        }
        return;
      }
      writeOwnerSession({
        access_token: result.body.access_token,
        refresh_token: result.body.refresh_token || "",
        user_id: user.id
      });
      syncOwnerForm(window.__nimbusLastState);
      if (box) {
        box.dataset.state = "auth";
        box.textContent = "Inloggad. Spara skickar ändringen till desken.";
      }
    }).catch(function () {
      if (box) {
        box.dataset.state = "auth";
        box.textContent = "Inloggningen misslyckades.";
      }
    });
  }

  function openAccount() {
    var sheet = $("account-sheet");
    if (!sheet) return;
    sheet.hidden = false;
    document.body.classList.add("account-open");
    renderAccount(window.__nimbusLastState || null);
    var close = $("account-close");
    if (close) close.focus();
  }

  function closeAccount() {
    var sheet = $("account-sheet");
    if (sheet) sheet.hidden = true;
    document.body.classList.remove("account-open");
  }

  function attemptAccountSave() {
    var box = $("account-save-result");
    if (!box || !window.NimbusSettings) return;
    var pack = accountCatalog ? collectDraft() : { errors: [] };
    if (pack.errors && pack.errors.length) {
      box.dataset.state = "invalid";
      box.textContent = pack.errors[0];
      return;
    }
    var reason = (accountCatalog && accountCatalog.write && accountCatalog.write.reason_sv) || window.NimbusSettings.WRITE_REASON_SV;
    var transport = transportOf(window.__nimbusLastState);
    if (!transport.ready) {
      box.dataset.state = "blocked";
      box.textContent = reason;
      return;
    }
    if (!readOwnerSession()) {
      syncOwnerForm(window.__nimbusLastState);
      box.dataset.state = "auth";
      box.textContent = "Ägarinloggning krävs.";
      return;
    }
    var entries = dirtyEntries();
    if (!entries.length) {
      box.dataset.state = "blocked";
      box.textContent = "Ingen ändring att spara.";
      return;
    }
    if (entries.length > 20) {
      box.dataset.state = "blocked";
      box.textContent = "Högst 20 ändringar åt gången.";
      return;
    }
    box.dataset.state = "pending";
    box.textContent = "Skickat. Väntar på desken.";
    submitEntries(transport, readOwnerSession(), entries, box);
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
    if (gear) gear.addEventListener("click", function () { openAccount(); });
    var closeBtn = $("account-close");
    if (closeBtn) closeBtn.addEventListener("click", closeAccount);
    var backdrop = $("account-backdrop");
    if (backdrop) backdrop.addEventListener("click", closeAccount);
    var saveBtn = $("account-save");
    if (saveBtn) saveBtn.addEventListener("click", attemptAccountSave);
    var sellCancel = $("sell-cancel");
    if (sellCancel) sellCancel.addEventListener("click", function () {
      var box = $("sell-confirm");
      if (box) box.hidden = true;
      pendingSell = null;
    });
    var sellOk = $("sell-ok");
    if (sellOk) sellOk.addEventListener("click", confirmSell);
    var moneyPaper = $("money-paper");
    if (moneyPaper) moneyPaper.addEventListener("click", function () { chooseMoney("select-paper"); });
    var moneyLive = $("money-live");
    if (moneyLive) moneyLive.addEventListener("click", function () { chooseMoney("select-live"); });
    var discoveryBack = $("discovery-back");
    if (discoveryBack) discoveryBack.addEventListener("click", function () {
      var panel = $("discovery-review");
      if (panel) panel.hidden = true;
    });
    var discoveryReset = $("discovery-reset");
    if (discoveryReset) discoveryReset.addEventListener("click", function () {
      try { localStorage.removeItem("nimbus_discovery_skips"); } catch (e) {}
      renderDiscovery(window.__nimbusLastState);
    });
    var authForm = $("owner-auth");
    if (authForm) authForm.addEventListener("submit", loginOwner);
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") closeAccount();
    });
    document.querySelectorAll(".desk-tab").forEach(function (button) {
      button.addEventListener("click", function () { showDeskTab(button.getAttribute("data-tab")); });
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
  function realSeriesForAgent(state, agentId) {
    // Prefer per-agent series if desk publishes them; never invent curves.
    var agents = state.agents;
    if (agents && typeof agents === "object") {
      var a = agents[agentId] || agents[agentId.toLowerCase()] || null;
      if (a && Array.isArray(a.equity) && a.equity.length >= 2) return a.equity.map(Number);
      if (a && Array.isArray(a.pnl) && a.pnl.length >= 2) return a.pnl.map(Number);
      if (a && Array.isArray(a.series) && a.series.length >= 2) return a.series.map(Number);
    }
    if (state.agent_equity && Array.isArray(state.agent_equity[agentId]) && state.agent_equity[agentId].length >= 2) {
      return state.agent_equity[agentId].map(Number);
    }
    if (state.agent_pnl && Array.isArray(state.agent_pnl[agentId]) && state.agent_pnl[agentId].length >= 2) {
      return state.agent_pnl[agentId].map(Number);
    }
    // Shared desk equity only when it has a real history (2+ distinct samples meaningfully)
    if (Array.isArray(state.equity) && state.equity.length >= 2) {
      var nums = state.equity.map(Number);
      var min = Math.min.apply(null, nums);
      var max = Math.max.apply(null, nums);
      if (max !== min) return nums;
    }
    return null;
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
      var reason = c.reason ? svReason(String(c.reason).split(";")[0].trim()) : "";
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
      card.style.borderColor = a.color;
      var status = hb[a.id] != null ? hb[a.id] : "not started";
      var ok = hbOk(status);
      var ag = (state.agents && (state.agents[a.id] || state.agents[a.id.toLowerCase()])) || null;
      var line = latestCoinLine(state, a.id);
      if (!line && ag && ag.decisions && ag.decisions[0]) {
        var d0 = ag.decisions[0];
        line = { symbol: d0.title || "?", mint: d0.mint, text: (d0.title || "?") + " · " + svReason(d0.reason || d0.verdict || "") };
      }
      var stats = agentStats(state, a.id);
      if (ag && ag.today_count != null && !stats.closed) stats.closed = ag.today_count;
      var mid = document.createElement("div");
      mid.className = "agent-mid";
      var statusSv = ok ? "igång" : (status === "not started" ? "ej startad" : String(status).slice(0, 28));
      mid.innerHTML =
        "<div class='agent-name'>" + a.name + "</div>" +
        "<div class='agent-sub'>" + a.sub + " · " + statusSv + "</div>";
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
        coinEl.textContent = ok ? "lyssnar…" : "vilande";
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
        pctEl.textContent = "—";
        pctEl.classList.add("neu");
      }
      right.appendChild(pctEl);
      var usd = document.createElement("div");
      usd.className = "agent-usd";
      usd.textContent = stats.closed ? (fmtUsd(stats.pnl) + " · " + stats.closed + " st") : (ok ? "övervakar" : "ej startad");
      right.appendChild(usd);
      var tags = document.createElement("div");
      tags.className = "agent-tags";
      tags.innerHTML = "<span class='tag'>" + (ok ? "OK" : "VILA") + "</span>";
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
        if (!window.NimbusChart) return;
        var series = realSeriesForAgent(state, a.id);
        if (series) window.NimbusChart.spark(canvas, series, a.color);
        else window.NimbusChart.idle(canvas, "rgba(255,255,255,0.18)");
      });
    });
  }

  /* ---- tokens / positions / audited coins ---- */
  var sellLock = false;
  var pendingSell = null;

  function sessionSells() {
    try {
      var raw = JSON.parse(sessionStorage.getItem("nimbus_paper_sells") || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch (e) {
      return [];
    }
  }

  function freshMark(row) {
    var price = Number(row && (row.mark_price != null ? row.mark_price : row.price));
    var at = row && (row.mark_price_at || row.price_at);
    if (!isFinite(price) || price <= 0 || !at) return null;
    var seen = new Date(at);
    if (isNaN(seen.getTime()) || Date.now() - seen.getTime() > 15 * 60 * 1000) return null;
    return { price: price, at: at };
  }

  function quoteSlice(size, entry, price, fraction) {
    var sold = fraction === 1 ? size : Math.round(size * fraction * 100) / 100;
    if (size - sold < 0.01) sold = size;
    var remaining = Math.round((size - sold) * 100) / 100;
    if (remaining < 0.01) {
      sold = size;
      remaining = 0;
    }
    var realized = Math.round(sold * (price / entry - 1) * 100) / 100;
    return { sold: sold, remaining: remaining, realized: realized, closed: remaining === 0 };
  }

  function openSell(row, fraction) {
    if (sellLock) return;
    var box = $("sell-confirm");
    var body = $("sell-confirm-body");
    var title = $("sell-confirm-title");
    if (!box || !body) return;
    var mark = freshMark(row);
    var entry = Number(row.entry);
    title.textContent = "Bekräfta sälj";
    if (!mark || !isFinite(entry) || entry <= 0) {
      body.textContent = (row.symbol || "Token") + ": ingen färsk kurs. Försäljningen stoppas. Ingen kurs hittas på.";
      pendingSell = null;
      $("sell-ok").disabled = true;
    } else {
      var quote = quoteSlice(Number(row.remaining_usd), entry, mark.price, fraction);
      pendingSell = { row: row, fraction: fraction, quote: quote, price: mark.price, at: mark.at };
      body.textContent = (row.symbol || "Token") + " · " + Math.round(fraction * 100) + "% · säljer $" +
        quote.sold.toFixed(2) + " · kvar $" + quote.remaining.toFixed(2) + " · kurs $" + mark.price + ".";
      $("sell-ok").disabled = false;
    }
    box.hidden = false;
  }

  function confirmSell() {
    if (sellLock) return;
    sellLock = true;
    var box = $("sell-confirm");
    var body = $("sell-confirm-body");
    var mode = String((window.__nimbusLastState && window.__nimbusLastState.mode) || "PAPER").toUpperCase();
    if (!pendingSell) {
      if (box) box.hidden = true;
      sellLock = false;
      return;
    }
    if (mode === "LIVE") {
      body.textContent = "Riktiga pengar är avstängda. Ingen försäljning är bokförd. En senare riktig försäljning skulle använda " +
        Math.round(pendingSell.fraction * 100) + "%.";
      pendingSell = null;
      sellLock = false;
      return;
    }
    var saleId = pendingSell.row.key + ":" + pendingSell.fraction + ":" + pendingSell.row.remaining_usd;
    var seen = sessionSells();
    if (seen.some(function (row) { return row.id === saleId; })) {
      if (box) box.hidden = true;
      pendingSell = null;
      sellLock = false;
      return;
    }
    var quote = pendingSell.quote;
    seen.push({
      id: saleId,
      action: "sell",
      symbol: pendingSell.row.symbol,
      fraction: pendingSell.fraction,
      sold_usd: quote.sold,
      remaining_usd: quote.remaining,
      realized_usd: quote.realized,
      order: false,
      future_sell_fraction: pendingSell.fraction
    });
    try { sessionStorage.setItem("nimbus_paper_sells", JSON.stringify(seen)); } catch (e) {}
    if (pendingSell.row.kind === "note") {
      var notes = sessionPaperBuys().map(function (row) {
        if (row.trade_id === pendingSell.row.trade_id) {
          row.remaining_usd = quote.remaining;
          row.realized_usd = Math.round(((Number(row.realized_usd) || 0) + quote.realized) * 100) / 100;
          if (quote.closed) row.closed = true;
        }
        return row;
      });
      try { sessionStorage.setItem("nimbus_paper_buys", JSON.stringify(notes)); } catch (e2) {}
    } else {
      var overlays = {};
      try { overlays = JSON.parse(sessionStorage.getItem("nimbus_position_overlays") || "{}"); } catch (e3) {}
      var previous = overlays[pendingSell.row.key] || {};
      overlays[pendingSell.row.key] = {
        remaining_usd: quote.remaining,
        realized_usd: Math.round(((Number(previous.realized_usd) || 0) + quote.realized) * 100) / 100,
        closed: quote.closed
      };
      try { sessionStorage.setItem("nimbus_position_overlays", JSON.stringify(overlays)); } catch (e4) {}
    }
    if (box) box.hidden = true;
    pendingSell = null;
    sellLock = false;
    renderState(window.__nimbusLastState);
  }

  function renderTokens(state) { /* tokens tab removed */ }

  function appendHold(grid, row) {
    var card = document.createElement("article");
    card.className = "hold-card";
    var title = document.createElement("strong");
    title.textContent = (row.symbol || "Token") + " · $" + Number(row.remaining_usd || 0).toFixed(2);
    card.appendChild(title);
    var realized = document.createElement("div");
    realized.textContent = "Realiserat " + ((Number(row.realized_usd) || 0) >= 0 ? "+" : "") + "$" + Number(row.realized_usd || 0).toFixed(2);
    card.appendChild(realized);
    var chips = document.createElement("div");
    chips.className = "sell-row";
    var picked = 1;
    [0.25, 0.5, 0.75, 1].forEach(function (fraction) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "sell-chip" + (fraction === 1 ? " on" : "");
      chip.textContent = Math.round(fraction * 100) + "%";
      chip.addEventListener("click", function () {
        picked = fraction;
        chips.querySelectorAll(".sell-chip").forEach(function (el) { el.classList.remove("on"); });
        chip.classList.add("on");
        go.textContent = "Sälj " + Math.round(fraction * 100) + "%";
      });
      chips.appendChild(chip);
    });
    card.appendChild(chips);
    var go = document.createElement("button");
    go.type = "button";
    go.className = "sell-go";
    go.textContent = "Sälj 100%";
    go.addEventListener("click", function () { openSell(row, picked); });
    card.appendChild(go);
    if (!freshMark(row) || !isFinite(Number(row.entry)) || Number(row.entry) <= 0) {
      var block = document.createElement("p");
      block.className = "amt-error";
      block.textContent = "Ingen färsk kurs. Försäljningen stoppas.";
      card.appendChild(block);
    }
    grid.appendChild(card);
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
      if (tokensWrap) tokensWrap.appendChild(wrap);
    }
    var coins = state.coins || [];
    var audits = state.audits || [];
    // Prefer coins (have scan+reason); merge layers from audits by mint
    var byMint = {};
    audits.forEach(function (a) { if (a.mint) byMint[a.mint] = a; });
    var list = coins.length ? coins.slice() : audits.map(function (a) {
      return { mint: a.mint, symbol: a.symbol, scan: a.audit_pass ? "PASS" : "REJECT", audit_pass: a.audit_pass, layers: a.layers };
    });
    list.sort(function (a, b) {
      var al = (a.layers && a.layers.length) ? 0 : 1;
      var bl = (b.layers && b.layers.length) ? 0 : 1;
      return al - bl;
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
      var reason = c.reason ? svReason(String(c.reason).split(";")[0].trim()) : "";
      if (reason.length > 36) reason = reason.slice(0, 34) + "…";
      html += "<a class='audit-row' href='" + coinUrl(c.mint, "solana") + "' target='_blank' rel='noopener'>" +
        "<div class='audit-sym'>$" + (c.symbol || "?") +
        (reason ? "<div class='audit-reason'>" + reason + "</div>" : "") + "</div>" +
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
    // Challenge-era Journal: only real sells/stops. Never inflate with scanner rejects.
    if (!trades.length && Array.isArray(state.activity)) {
      trades = state.activity.filter(function (a) {
        return a && (a.kind === "sold" || a.kind === "stopped" || a.kind === "challenge_sell");
      }).map(function (a) {
        return {
          symbol: a.title,
          mint: a.mint,
          agent: a.agent,
          pnl_usd: null,
          held: (a.subtitle || "") + (a.value ? " · " + a.value : ""),
          kind: a.kind
        };
      });
    }
    var sells = sessionSells();
    $("closed-count").textContent = String(trades.length + sells.length);
    list.innerHTML = "";
    if (!trades.length && !sells.length) {
      var p = document.createElement("p");
      p.className = "empty-hint";
      p.textContent = "Inga stängda utmaningstrades än";
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
    sells.slice().reverse().forEach(function (row) {
      var line = document.createElement("div");
      line.className = "closed-row";
      line.innerHTML = "<div class='closed-ico'>S</div><div><div class='closed-main'>" +
        (row.symbol || "Token") + "</div><div class='sell-badge'>SÄLJ " + Math.round(row.fraction * 100) +
        "%</div></div><div class='closed-pnl'></div>";
      line.querySelector(".closed-pnl").textContent = (row.realized_usd >= 0 ? "+" : "") + "$" + Number(row.realized_usd).toFixed(2);
      list.insertBefore(line, list.firstChild);
    });
  }

  function renderGoal(state) {
    var equity = Number(state.equity_usd) || 0;
    var deposit = Number(state.deposit_usd || state.bankroll_usd || 0);
    if (!deposit && Array.isArray(state.equity) && state.equity.length) deposit = Number(state.equity[0]) || 0;
    if (!deposit && equity > 0) deposit = equity;
    var mult = (deposit > 0 && equity > 0) ? (equity / deposit) : 1;
    $("multi-pill").innerHTML = "since deposit <b>" + (deposit > 0 ? mult.toFixed(2) + "x" : "—") + "</b>";
    var pct = Math.max(0, Math.min(100, (mult / 10) * 100));
    $("goal-fill").style.width = pct + "%";
    $("goal-pct").textContent = Math.round(pct) + "%";
    document.querySelectorAll("#goal-track .dot").forEach(function (d) {
      var m = Number(d.getAttribute("data-m"));
      d.classList.toggle("hit", mult >= m);
      d.classList.toggle("current", mult >= m * 0.85 && mult < m * 1.15);
    });
  }

  function renderHeader(state) {
    var mode = String((state && state.mode) || "PAPER").toUpperCase();
    paintMoney(currentMoney(state, "show"));
    var hb = (state && state.heartbeats) || {};
    var anyOk = Object.keys(hb).some(function (k) { return hbOk(hb[k]); });
    var toggle = $("auto-toggle");
    if (toggle) toggle.classList.remove("on");
    syncBankrollUI(mode);

    var equity = Number(state.equity_usd) || 0;
    var extra = sessionSells().reduce(function (sum, row) { return sum + (Number(row.realized_usd) || 0); }, 0);
    setBalance($("balance"), equity + extra);

    var pill = $("status-pill");
    var deposit = Number(state.deposit_usd || state.bankroll_usd || 0);
    var delta = equity + extra - (deposit || 0);
    if (!anyOk && equity === 0) {
      pill.className = "status-pill";
      pill.textContent = "Bot vilande";
    } else {
      pill.className = "status-pill good";
      var deltaHtml = (delta >= 0 ? "+$" : "-$") + Math.abs(delta).toFixed(2);
      pill.innerHTML = "<span class='delta'>" + deltaHtml + "</span> " + relTime(state.updated_at);
    }
    var path = (loadConfig().dataBase || "");
    var wm = path.slice(-4) || "····";
    $("wm").textContent = "···· " + wm;
    var scanned = $("stat-scanned");
    var opened = $("stat-open");
    var win = $("stat-win");
    var pnl = $("stat-pnl");
    if (scanned) scanned.textContent = String(((state && state.coins) || []).length);
    if (opened) opened.textContent = String(((state && state.positions) || []).length);
    var closed = ((state && (state.trades || state.closed)) || []).filter(function (row) {
      return row && row.pnl_usd != null && !isNaN(Number(row.pnl_usd));
    });
    if (win) win.textContent = closed.length ? String(closed.filter(function (row) { return Number(row.pnl_usd) > 0; }).length) + "/" + closed.length : "saknas";
    if (pnl) {
      if (!closed.length) pnl.textContent = "saknas";
      else {
        var sum = closed.reduce(function (acc, row) { return acc + Number(row.pnl_usd); }, 0);
        pnl.textContent = (sum >= 0 ? "+" : "") + sum.toFixed(2);
      }
    }
    var demo = $("demo-banner");
    if (demo) demo.hidden = !(isLocalPreview() || (state && state.demo_fixture));
  }

  function showBootEmpty(show) {
    var el = $("boot-empty");
    if (el) el.hidden = !show;
    var app = $("app");
    if (app) app.hidden = !!show;
  }

  function discoverySkips() {
    try {
      var raw = JSON.parse(localStorage.getItem("nimbus_discovery_skips") || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch (e) {
      return [];
    }
  }

  function stockholmLine(iso) {
    var when = new Date(iso);
    if (!iso || isNaN(when.getTime())) return String(iso || "");
    var local = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Stockholm",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    }).format(when);
    return local + " · " + iso;
  }

  function sourceLine(event) {
    if (event && event.source_at_tz === "unknown") {
      var text = String(event.source_at || "").replace("T", " ").slice(0, 16);
      var age = event.source_age_label ? " · " + event.source_age_label + " sedan vid kontroll" : "";
      return "FOMO " + text + " (tidszon ej angiven)" + age;
    }
    return stockholmLine(event && event.source_at);
  }

  var TRADER_NAMES = []; /* trader-copy removed t137u */

  function followedTraders() { return []; }

  function setFollowed(name, on) { /* no-op */ }


  function sessionPaperBuys() {
    try {
      var raw = JSON.parse(sessionStorage.getItem("nimbus_paper_buys") || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch (e) {
      return [];
    }
  }

  function buyLimits(state) {
    var settings = (state && state.settings) || {};
    var risk = (state && state.risk_limits) || {};
    var equity = Number(state && (state.equity_usd != null ? state.equity_usd : state.bankroll_usd)) || 0;
    var pct = Number(risk.max_buy_pct_of_capital != null ? risk.max_buy_pct_of_capital : settings.max_buy_pct_of_capital);
    if (!isFinite(pct) || pct <= 0) pct = 25;
    var maxTrade = Number(risk.max_buy_usd);
    if (!isFinite(maxTrade) || maxTrade <= 0) maxTrade = equity * (pct / 100);
    if (!isFinite(maxTrade) || maxTrade <= 0) maxTrade = 50;
    var maxOpen = Number(risk.max_open_positions != null ? risk.max_open_positions : settings.max_open_positions);
    if (!isFinite(maxOpen) || maxOpen <= 0) maxOpen = 5;
    var openN = Number(risk.open_positions);
    if (!isFinite(openN)) openN = ((state && state.positions) || []).filter(function (row) { return !row.closed_at; }).length;
    var overlays = {};
    try { overlays = JSON.parse(sessionStorage.getItem("nimbus_position_overlays") || "{}"); } catch (e) {}
    var reserved = 0;
    ((state && state.positions) || []).forEach(function (row) {
      var over = overlays["pos:" + (row.id || row.mint)];
      if (over && over.closed) return;
      if (over && over.remaining_usd != null) reserved += Number(over.remaining_usd) || 0;
      else reserved += Number(row.size_usd != null ? row.size_usd : row.value_usd) || 0;
    });
    sessionPaperBuys().forEach(function (row) {
      if (row.closed) return;
      reserved += row.remaining_usd != null ? Number(row.remaining_usd) : (Number(row.amount_usd) || 0);
    });
    var realized = sessionSells().reduce(function (sum, row) { return sum + (Number(row.realized_usd) || 0); }, 0);
    var available = Math.max(0, equity + realized - reserved);
    return {
      maxTrade: maxTrade,
      available: available,
      cap: Math.min(maxTrade, available),
      maxOpen: maxOpen,
      openN: openN,
      pct: pct
    };
  }

  function killLocked(state) {
    var kill = (state && state.kill_switch) || {};
    return !!(kill.locked || kill.buys_locked);
  }

  function chosenBuyAmount(state) {
    var limits = buyLimits(state);
    var stored = NaN;
    try { stored = Number(sessionStorage.getItem("nimbus_buy_amount")); } catch (e) {}
    var fallback = Number(state && state.settings && state.settings.default_trade_usd);
    if (!isFinite(fallback) || fallback <= 0) fallback = Math.min(25, limits.maxTrade || 25);
    var amount = isFinite(stored) && stored > 0 ? stored : fallback;
    var error = "";
    if (killLocked(state)) error = ((state.kill_switch && state.kill_switch.reason_sv) || "Köp är låsta av kill switch.");
    else if (limits.openN >= limits.maxOpen) error = "Max " + limits.maxOpen + " öppna positioner. Stäng en innan nytt köp.";
    else if (!isFinite(amount) || amount < 1) error = "Ange minst $1.";
    else if (amount > limits.maxTrade) error = "Max " + limits.pct + "% av kapitalet per köp ($" + limits.maxTrade.toFixed(2) + ").";
    else if (amount > limits.available) error = "Tillgängligt kapital är $" + limits.available.toFixed(2) + ".";
    return { amount: amount, error: error, limits: limits };
  }


  function paperCashAvailable(state) {
    var equity = Number(state && (state.equity_usd != null ? state.equity_usd : state.bankroll_usd));
    if (!isFinite(equity)) equity = Number(state && state.deposit_usd) || 0;
    return Math.max(0, equity);
  }

  function syncCashActions(state) {
    var mode = String((state && state.mode) || "PAPER").toUpperCase();
    var live = mode === "LIVE";
    var lock = $("cash-live-lock");
    var dep = $("btn-deposit");
    var wit = $("btn-withdraw");
    if (lock) lock.hidden = !live;
    [dep, wit].forEach(function (btn) {
      if (!btn) return;
      btn.disabled = live;
      btn.setAttribute("aria-disabled", live ? "true" : "false");
      btn.title = live ? "Riktiga pengar är låsta" : (btn.dataset.cash === "deposit" ? "Insättning · papperspengar" : "Uttag · papperspengar");
    });
  }

  function openCashSheet(kind) {
    var state = window.__nimbusLastState || {};
    if (String(state.mode || "PAPER").toUpperCase() === "LIVE") return;
    var sheet = $("cash-sheet");
    var title = $("cash-sheet-title");
    var note = $("cash-sheet-note");
    var input = $("cash-amount");
    var err = $("cash-sheet-error");
    var confirm = $("cash-confirm");
    if (!sheet) return;
    sheet.dataset.kind = kind;
    if (title) title.textContent = kind === "withdraw" ? "Uttag" : "Insättning";
    if (note) {
      var avail = paperCashAvailable(state);
      note.textContent = kind === "withdraw"
        ? ("PAPER · papperspengar · tillgängligt $" + avail.toFixed(2) + " (inte utmaningskassan)")
        : "PAPER · papperspengar · Oscars manuella saldo (inte utmaningen)";
    }
    if (input) { input.value = ""; input.focus(); }
    if (err) { err.hidden = true; err.textContent = ""; }
    if (confirm) confirm.textContent = "Bekräfta";
    if (typeof sheet.showModal === "function") sheet.showModal();
    else sheet.setAttribute("open", "open");
  }

  function bindCashActions() {
    var dep = $("btn-deposit");
    var wit = $("btn-withdraw");
    var form = $("cash-form");
    var sheet = $("cash-sheet");
    if (dep && !dep.__bound) {
      dep.__bound = true;
      dep.addEventListener("click", function () { openCashSheet("deposit"); });
    }
    if (wit && !wit.__bound) {
      wit.__bound = true;
      wit.addEventListener("click", function () { openCashSheet("withdraw"); });
    }
    if (form && !form.__bound) {
      form.__bound = true;
      form.addEventListener("submit", function (ev) {
        var val = (ev.submitter && ev.submitter.value) || "cancel";
        if (val !== "ok") return;
        var state = window.__nimbusLastState || {};
        var err = $("cash-sheet-error");
        var input = $("cash-amount");
        var kind = (sheet && sheet.dataset.kind) || "deposit";
        if (String(state.mode || "PAPER").toUpperCase() === "LIVE") {
          if (err) { err.hidden = false; err.textContent = "Riktiga pengar är låsta"; }
          ev.preventDefault();
          return;
        }
        var amount = Number(input && input.value);
        var msg = "";
        if (!isFinite(amount) || amount <= 0) msg = "Ange ett belopp större än 0.";
        else if (amount > 100000) msg = "Max $100000 per gång.";
        else if (kind === "withdraw" && amount > paperCashAvailable(state) + 1e-9) {
          msg = "Kan inte ta ut mer än $" + paperCashAvailable(state).toFixed(2) + ".";
        }
        if (msg) {
          if (err) { err.hidden = false; err.textContent = msg; }
          ev.preventDefault();
          return;
        }
        var key = kind === "withdraw" ? "paper_withdraw" : "paper_deposit";
        var sent = queueDeskWrite(key, String(amount));
        // Optimistic local paint; desk publish is source of truth.
        try {
          var cur = paperCashAvailable(state);
          var next = kind === "withdraw" ? (cur - amount) : (cur + amount);
          state.bankroll_usd = next;
          state.equity_usd = next;
          state.deposit_usd = next;
          if (!state.change_log) state.change_log = [];
          state.change_log.unshift({
            key: key,
            old: String(cur),
            new: String(next),
            who: "owner",
            at: new Date().toISOString()
          });
          renderHeader(state);
          var toastHost = $("toasts");
          if (toastHost) {
            var n = document.createElement("div");
            n.className = "toast";
            n.textContent = (kind === "withdraw" ? "Uttag" : "Insättning") + " $" + amount.toFixed(2) + " · PAPER · " + (sent ? "skickat, väntar på desk" : "inte skickat: logga in under Konto ⚙");
            toastHost.appendChild(n);
            setTimeout(function () { n.remove(); }, 3500);
          }
        } catch (e) {}
      });
    }
  }

  function queueDeskWrite(key, value) {
    try {
      var transport = transportOf(window.__nimbusLastState || {});
      var session = null;
      try { session = JSON.parse(localStorage.getItem("nimbus_owner_session") || "null"); } catch (e) {}
      if (!transport || !transport.ready || !session || !session.access_token) return false;
      var box = { dataset: {}, textContent: "" };
      submitEntries(transport, session, [{ key: key, value: value }], box);
      return true;
    } catch (e) { return false; }
  }
  window.NimbusCash = {
    open: function (kind) { openCashSheet(kind); },
    available: function () { return paperCashAvailable(window.__nimbusLastState || {}); }
  };

  function logJournalAction(action, event, amount, reason) {
    var payload = {
      a: action === "Köp" ? "kop" : (action === "Avstå" ? "avsta" : action),
      m: event && event.mint,
      s: event && event.symbol,
      p: event && event.profile,
      r: reason || "",
      u: amount || null,
      src: "app"
    };
    try {
      var raw = JSON.stringify(payload);
      if (raw.length > 200) raw = JSON.stringify({ a: payload.a, m: payload.m, s: payload.s, u: payload.u, src: "app" });
      queueDeskWrite("journal_event", raw);
    } catch (e) {}
  }

  function rememberAmount(amount) {
    try { sessionStorage.setItem("nimbus_buy_amount", String(amount)); } catch (e) {}
  }

  function recordPaperBuy(state, event, amount) {
    var published = String((state && state.mode) || "PAPER").toUpperCase();
    var intent = {
      amount_usd: amount,
      future_order_amount_usd: amount,
      mint: event.mint,
      symbol: event.symbol,
      profile: event.profile,
      trade_id: event.trade_id,
      order: false,
      purchased: false,
      live_enabled: false,
      remaining_usd: amount,
      mode: published === "LIVE" ? "LIVE_LOCKED" : "PAPER"
    };
    if (published === "LIVE") return intent;
    var rows = sessionPaperBuys();
    rows.push(intent);
    try { sessionStorage.setItem("nimbus_paper_buys", JSON.stringify(rows)); } catch (e) {}
    return intent;
  }

  function latencyLabel(event) {
    if (!event || event.source_at_tz !== "explicit") return "";
    var source = new Date(event.source_at);
    var observed = new Date(event.observed_at);
    if (isNaN(source.getTime()) || isNaN(observed.getTime())) return "";
    var seconds = Math.max(0, Math.round((observed - source) / 1000));
    return seconds + "s efter köpet";
  }

  function clientConfluence(events, selected) {
    var windowMin = 60;
    var groups = {};
    (events || []).forEach(function (event) {
      if (selected.indexOf(event.profile) < 0 || event.source_at_tz !== "explicit") return;
      var when = new Date(event.source_at);
      if (isNaN(when.getTime())) return;
      (groups[event.mint] = groups[event.mint] || []).push({ event: event, when: when });
    });
    var cards = [];
    Object.keys(groups).forEach(function (mint) {
      var rows = groups[mint].sort(function (a, b) { return a.when - b.when; });
      var best = null;
      rows.forEach(function (start) {
        var bucket = rows.filter(function (row) {
          return row.when >= start.when && row.when - start.when <= windowMin * 60000;
        });
        var names = [];
        bucket.forEach(function (row) {
          if (names.indexOf(row.event.profile) < 0) names.push(row.event.profile);
        });
        if (names.length >= 2 && (!best || names.length > best.names.length)) best = { names: names, symbol: start.event.symbol };
      });
      if (best) {
        cards.push({
          mint: mint,
          symbol: best.symbol,
          profiles: best.names,
          note_sv: best.names.length + " följda handlare köpte " + (best.symbol || mint.slice(0, 4)) + " inom 60 min. Ingen order skickas."
        });
      }
    });
    return cards;
  }

  function showDeskTab(name) {
    name = name || "hem";
    var legacyTab = { utmaning: "hem", live: "hem", forslag: "trades", traders: "trades", board: "trades", tokens: "trades", journal: "trades", insikt: "agenter", wallet: "planbok" };
    if (legacyTab[name]) name = legacyTab[name];
    document.querySelectorAll(".desk-tab").forEach(function (button) {
      button.classList.toggle("on", button.getAttribute("data-tab") === name);
    });
    document.querySelectorAll(".tab-panel").forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-panel") !== name;
    });
    var wallet = $("wallet-card");
    if (wallet) wallet.hidden = true;
    try { window.scrollTo(0, 0); } catch (eTop) {}
    try { if (window.SwipeUI && SwipeUI.onTab) SwipeUI.onTab(name); } catch (eTab) {}
  }
  window.__nimbusShowTab = function (name) { showDeskTab(name); };
  function showTraderTab(name) { showDeskTab(name); }


  function renderTraders(state) {
    /* Handlare / Topplista borttagna (t137u). */
  }

  function renderDiscovery(state) {
    /* Följda-köp UI borttaget (t137u). */
  }

  function strictFilterActive(state) {
    var settings = (state && state.settings) || {};
    var rug = (state && state.rugdesk) || {};
    var disc = (state && state.discovery && state.discovery.rug_filter) || {};
    if (disc.active === true || disc.active === false) return !!disc.active;
    if (settings.rug_limits_approved === true || settings.rug_limits_approved === "true") return true;
    if (rug.approved === true) return true;
    return false;
  }

  function renderStoppade(state) {
    var host = $("stoppade-list");
    var count = $("stoppade-count");
    var note = $("stoppade-note");
    var pill = $("stoppade-strict-pill");
    if (!host) return;
    var feed = (state && state.discovery) || {};
    var items = (window.NimbusDiscovery && window.NimbusDiscovery.stoppadeEvents)
      ? window.NimbusDiscovery.stoppadeEvents(feed)
      : [];
    var active = strictFilterActive(state);
    if (count) count.textContent = String(items.length);
    if (pill) {
      pill.textContent = active ? "STRICT på" : "STRICT av";
      pill.classList.toggle("off", !active);
    }
    if (note) {
      note.textContent = active
        ? "STRICT är på. Kort som filtret dolde visas här — du kan öppna dem manuellt."
        : "STRICT-gränser saknas i state. Inga kort stoppas här.";
    }
    host.innerHTML = "";
    if (!items.length) {
      var empty = document.createElement("p");
      empty.className = "empty-hint";
      empty.textContent = active ? "Inga stoppade kort just nu." : "Inget att visa.";
      host.appendChild(empty);
      return;
    }
    items.forEach(function (event) {
      var card = document.createElement("article");
      card.className = "stoppade-card";
      card.setAttribute("data-trade", event.trade_id || "");
      var face = document.createElement("div");
      face.className = "stoppade-face";
      face.textContent = window.NimbusDiscovery.letter(event);
      var body = document.createElement("div");
      var title = document.createElement("strong");
      title.textContent = event.symbol || (event.mint || "").slice(0, 6) || "saknas";
      var reasons = document.createElement("ul");
      reasons.className = "stoppade-reasons";
      window.NimbusDiscovery.reasonLines(event).forEach(function (line) {
        var li = document.createElement("li");
        li.textContent = line;
        reasons.appendChild(li);
      });
      body.appendChild(title);
      body.appendChild(reasons);
      card.appendChild(face);
      card.appendChild(body);
      host.appendChild(card);
    });
  }

  /* t170: readable score chips ($ with thin spaces, % with one decimal, Swedish momentum codes) */
  var MOMENTUM_SV = { vol_m5_low: "volym 5m låg", buys_le_sells: "fler sälj än köp", vertical_pump: "vertikal pump", no_pullback: "ingen rekyl", ok: "ok", saknas: "saknas" };
  function scoreValue(key, val) {
    var n = Number(val);
    if ((key === "liquidity_usd" || key === "volume_h1_usd") && isFinite(n)) return "$" + Math.round(n).toLocaleString("sv-SE");
    if (/_pct$/.test(String(key)) && isFinite(n)) return n.toFixed(1).replace(".", ",") + " %";
    if (key === "momentum") return MOMENTUM_SV[val] || String(val).replace(/_/g, " ");
    return String(val);
  }
  /* dexscreener serves a 64 px thumbnail; the card shows it full width, so ask for 256 px (the CDN only accepts some sizes; 200/300/400 return 422) */
  function sharpImage(url) {
    url = String(url || "");
    if (/^https:\/\/cdn\.dexscreener\.com\//.test(url)) return url.replace(/([?&])width=\d+/, "$1width=256").replace(/([?&])height=\d+/, "$1height=256");
    return url;
  }

  /* restored t164: suggestion cards and challenge rows call this */
  function coinArt(card, className) {
    var wrap = document.createElement("div");
    wrap.className = className || "coin-art";
    var url = card && (card.image_url || card.image);
    if (url && /^https:\/\/[^\s]+$/.test(String(url))) {
      var img = document.createElement("img");
      img.src = className && className.indexOf("large") !== -1 ? sharpImage(url) : String(url);
      img.alt = (card.symbol || card.name || "coin") + " logo";
      img.loading = "lazy";
      img.referrerPolicy = "no-referrer";
      img.addEventListener("error", function () {
        if (img.src !== String(url)) { img.src = String(url); return; }
        wrap.classList.add("placeholder");
        wrap.textContent = (card.initials || (card.symbol || "?").slice(0, 2) || "??").toUpperCase();
        img.remove();
      });
      wrap.appendChild(img);
    } else {
      wrap.classList.add("placeholder");
      wrap.textContent = (card.initials || (card.symbol || "?").slice(0, 2) || "??").toUpperCase();
    }
    return wrap;
  }

  function renderSuggestions(state) {
    var host = $("suggestion-cards");
    var note = $("suggestions-note");
    if (!host) return;
    var box = (state && state.suggestions) || { cards: [], note_sv: "Inga färskt bedömda förslag just nu." };
    if (note) note.textContent = box.note_sv || "Inga färskt bedömda förslag just nu.";
    host.innerHTML = "";
    var cards = box.cards || [];
    if (!cards.length) {
      var empty = document.createElement("p");
      empty.className = "empty-hint";
      empty.textContent = "Väntar på mynt som klarar alla filter";
      host.appendChild(empty);
      return;
    }
    cards.forEach(function (card) {
      var el = document.createElement("article");
      el.className = "suggestion-card discovery-card";
      el.setAttribute("data-mint", card.mint || "");
      var badge = document.createElement("span");
      badge.className = "suggestion-badge";
      badge.textContent = brandText(card.badge_sv) || (brandName() + " föreslår");
      var title = document.createElement("strong");
      title.textContent = card.symbol || (card.mint || "").slice(0, 6) || "—";
      var rating = document.createElement("div");
      rating.className = "suggestion-rating" + (String(card.rating || "").toLowerCase() === "medel" ? " medel" : "");
      rating.textContent = card.rating ? ("Betyg: " + card.rating) : "Betyg saknas";
      var narrative = document.createElement("p");
      narrative.className = "suggestion-narrative";
      if (card.narrative_missing || card.narrative == null || card.narrative === "") {
        narrative.className += " missing";
        narrative.textContent = "Narrativ saknas";
      } else {
        narrative.textContent = card.narrative;
      }
      var meta = document.createElement("div");
      meta.className = "suggestion-meta";
      function metaChip(label, value, missing) {
        var span = document.createElement("span");
        if (missing || value == null) {
          span.className = "missing";
          span.textContent = label + " saknas";
        } else {
          span.textContent = label + " " + value;
        }
        meta.appendChild(span);
      }
      metaChip("X 1h", card.mentions_1h, card.mentions_1h_missing);
      metaChip("konton", card.unique_accounts_1h, card.unique_accounts_1h_missing);
      if (card.bot_suspect_missing) {
        metaChip("bot-risk", null, true);
      } else if (card.bot_suspect) {
        metaChip("bot-risk", "ja", false);
      } else {
        metaChip("bot-risk", "nej", false);
      }
      var osakert = document.createElement("p");
      osakert.className = "suggestion-osakert";
      if (card.notes_missing || card.notes == null || card.notes === "") {
        osakert.textContent = "Osäkert: anteckning saknas";
      } else {
        osakert.textContent = "Osäkert: " + card.notes;
      }
      var choice = chosenBuyAmount(state);
      var picker = document.createElement("div");
      picker.className = "amt-row";
      [5, 10, 25, 50].forEach(function (dollars) {
        var chip = document.createElement("button");
        chip.type = "button";
        chip.className = "amt-chip" + (choice.amount === dollars ? " on" : "");
        chip.textContent = "$" + dollars;
        chip.addEventListener("click", function () {
          rememberAmount(dollars);
          renderSuggestions(window.__nimbusLastState);
        });
        picker.appendChild(chip);
      });
      var custom = document.createElement("input");
      custom.className = "amt-custom";
      custom.inputMode = "decimal";
      custom.setAttribute("aria-label", "Eget belopp i USD");
      custom.value = String(choice.amount);
      custom.addEventListener("change", function () {
        var next = Number(String(custom.value).replace(",", "."));
        if (isFinite(next) && next > 0) rememberAmount(next);
        renderSuggestions(window.__nimbusLastState);
      });
      picker.appendChild(custom);
      var actions = document.createElement("div");
      actions.className = "discovery-actions";
      var skip = document.createElement("button");
      skip.type = "button";
      skip.className = "discovery-skip";
      skip.textContent = "Avstå";
      skip.addEventListener("click", function () {
        logJournalAction("Avstå", { mint: card.mint, symbol: card.symbol, profile: brandName() }, null, "Avstå suggestion");
        el.remove();
      });
      var buy = document.createElement("button");
      buy.type = "button";
      buy.className = "discovery-buy";
      buy.textContent = choice.error ? "Köp" : "Köp $" + choice.amount.toFixed(0);
      buy.disabled = !!choice.error;
      buy.addEventListener("click", function () {
        var fresh = chosenBuyAmount(window.__nimbusLastState);
        if (fresh.error) return;
        var event = {
          trade_id: "suggest:" + (card.mint || ""),
          mint: card.mint,
          symbol: card.symbol,
          profile: brandName(),
          amount_usd: fresh.amount,
          token_url: card.token_url,
          source_at: card.rated_at,
          image_url: card.image_url || card.image || null,
          image: card.image_url || card.image || null,
          initials: card.initials || null
        };
        logJournalAction("Köp", event, fresh.amount, brandName() + " föreslår (paper)");
        recordPaperBuy(window.__nimbusLastState, event, fresh.amount);
        renderTokens(window.__nimbusLastState);
        var review = $("discovery-review");
        var titleEl = $("discovery-review-title");
        var copy = $("discovery-review-copy");
        var link = $("discovery-link");
        if (titleEl) titleEl.textContent = "Förslag · " + (card.symbol || (card.mint || "").slice(0, 4));
        var reviewImg = $("discovery-review-image");
        if (reviewImg) {
          reviewImg.hidden = false;
          reviewImg.innerHTML = "";
          reviewImg.appendChild(coinArt(card, "coin-art review"));
        }
        if (copy) copy.textContent = brandName() + " föreslår · $" + fresh.amount.toFixed(2) + " · ingen order skickas. Riktiga pengar är avstängda.";
        if (link) {
          link.textContent = "";
          if (card.token_url) {
            var a = document.createElement("a");
            a.href = card.token_url;
            a.target = "_blank";
            a.rel = "noopener";
            a.textContent = card.token_url;
            link.appendChild(a);
          }
        }
        if (review) {
          review.hidden = false;
          review.scrollIntoView({ block: "start" });
        }
      });
      actions.appendChild(skip);
      actions.appendChild(buy);
      el.appendChild(coinArt(card, "coin-art large"));
      el.appendChild(badge);
      el.appendChild(title);
      el.appendChild(rating);
      var scoreRow = document.createElement("div");
      scoreRow.className = "suggestion-score";
      (card.score || []).forEach(function (part) {
        var chip = document.createElement("span");
        var val = part.value;
        if (val == null || val === "saknas") {
          chip.className = "missing";
          chip.textContent = (part.label_sv || part.key) + " saknas";
        } else {
          chip.textContent = (part.label_sv || part.key) + " " + scoreValue(part.key, val);
          if (part.ok === false) chip.className = "warn";
        }
        chip.title = part.detail_sv || part.source || "";
        scoreRow.appendChild(chip);
      });
      if ((card.score || []).length) el.appendChild(scoreRow);
      el.appendChild(narrative);
      el.appendChild(meta);
      el.appendChild(osakert);
      el.appendChild(picker);
      if (choice.error) {
        var problem = document.createElement("p");
        problem.className = "amt-error";
        problem.textContent = choice.error;
        el.appendChild(problem);
      }
      el.appendChild(actions);
      if (card.gates && window.NimbusLive && NimbusLive.renderGates) {
        var gwrap = document.createElement("div");
        gwrap.className = "suggestion-gates";
        NimbusLive.renderGates(gwrap, card.gates);
        el.appendChild(gwrap);
      }
      host.appendChild(el);
    });
  }


  function renderKillBanner(state) {
    var banner = $("kill-banner");
    var reason = $("kill-banner-reason");
    if (!banner) return;
    var kill = (state && state.kill_switch) || {};
    var on = !!(kill.locked || kill.buys_locked);
    banner.hidden = !on;
    if (reason) reason.textContent = kill.reason_sv || (on ? "Köp är låsta." : "");
  }

  function renderJournal(state) {
    var host = $("journal-list");
    var note = $("journal-note");
    if (!host) return;
    var box = (state && state.journal) || {};
    var rows = box.entries || [];
    host.innerHTML = "";
    // #journal-note is an .empty-hint card — hide it when there is no summary,
    // otherwise an empty white bar shows under the Journal heading.
    if (!rows.length) {
      if (note) {
        note.textContent = "";
        note.hidden = true;
      }
      var empty = document.createElement("p");
      empty.className = "empty-hint journal-empty";
      empty.textContent = box.note_sv || "Utmaningens trades hamnar här";
      host.appendChild(empty);
      return;
    }
    if (note) {
      note.hidden = false;
      note.textContent = rows.length + " rader";
    }
    rows.forEach(function (row) {
      var el = document.createElement("article");
      el.className = "journal-card";
      var top = document.createElement("div");
      top.className = "j-top";
      var act = document.createElement("span");
      act.className = "j-action";
      var a = row.action || "saknas";
      if (a === "Köp") act.className += " kop";
      else if (a === "Avstå") act.className += " avsta";
      else if (a === "Stoppad") act.className += " stoppad";
      else if (a === "Sälj") act.className += " salj";
      act.textContent = a;
      var when = document.createElement("span");
      when.className = "j-meta";
      when.textContent = row.ts || "tid saknas";
      top.appendChild(act);
      top.appendChild(when);
      el.appendChild(top);
      var metaObj = row.meta || {};
      var imgUrl = metaObj.image_url || null;
      if (imgUrl) {
        var img = document.createElement("img");
        img.className = "j-thumb";
        img.src = imgUrl;
        img.alt = "";
        img.width = 36; img.height = 36;
        el.appendChild(img);
      }
      var title = document.createElement("strong");
      title.textContent = (row.symbol || (row.mint ? row.mint.slice(0, 6) : "symbol saknas"));
      el.appendChild(title);
      var meta = document.createElement("div");
      meta.className = "j-meta";
      var label = (metaObj.label_sv || row.source || row.profile || "");
      var isChallenge = !!(metaObj.challenge) || (String(label).indexOf("Utmaning") === 0) || label === "Utmaning · PAPER";
      meta.textContent = [
        isChallenge ? "Utmaning · PAPER" : (row.profile ? ("@" + row.profile) : "profil saknas"),
        row.amount_usd != null ? ("$" + Number(row.amount_usd).toFixed(2)) : "belopp saknas",
        row.entry_price != null ? ("in $" + Number(row.entry_price).toPrecision(4)) : null,
        row.exit_price != null ? ("ut $" + Number(row.exit_price).toPrecision(4)) : null,
        row.pnl_usd != null ? ("PnL $" + Number(row.pnl_usd).toFixed(2)) : null,
        (metaObj.pnl_pct != null ? (Number(metaObj.pnl_pct) >= 0 ? "+" : "") + Number(metaObj.pnl_pct).toFixed(1) + "%" : null)
      ].filter(Boolean).join(" · ");
      el.appendChild(meta);
      var reason = document.createElement("p");
      reason.className = "j-reason";
      reason.textContent = row.reason_sv || "orsak saknas";
      el.appendChild(reason);
      var lesson = document.createElement("input");
      lesson.className = "j-lesson";
      lesson.type = "text";
      lesson.placeholder = "Lektion (valfritt)";
      lesson.value = row.lesson || "";
      lesson.addEventListener("change", function () {
        queueDeskWrite("journal_lesson", String(row.id) + "|" + lesson.value.slice(0, 180));
      });
      el.appendChild(lesson);
      host.appendChild(el);
    });
  }

  function bindKillUnlock() {
    var btn = $("kill-unlock");
    var dialog = $("kill-unlock-dialog");
    var form = $("kill-unlock-form");
    var input = $("kill-unlock-input");
    if (!btn || !dialog || btn.__bound) return;
    btn.__bound = true;
    btn.addEventListener("click", function () {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "open");
      if (input) { input.value = ""; input.focus(); }
    });
    if (form) form.addEventListener("submit", function (ev) {
      var val = (ev.submitter && ev.submitter.value) || "cancel";
      if (val === "ok") {
        var phrase = input ? String(input.value || "").trim() : "";
        queueDeskWrite("kill_switch_unlock", phrase);
        var st = window.__nimbusLastState || {};
        if (!st.kill_switch) st.kill_switch = {};
        // optimistic only when phrase matches; desk is source of truth
        if (phrase.toLowerCase() === "låsa upp") {
          st.kill_switch.locked = false;
          st.kill_switch.buys_locked = false;
          st.kill_switch.reason_sv = "";
          renderKillBanner(st);
          renderSuggestions(st);
        }
      }
    });
  }


  var WATCH_KEY = "sniper_grok_watchlist_v1";

  function loadLocalWatch() {
    try {
      var raw = localStorage.getItem(WATCH_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  }

  function saveLocalWatch(items) {
    try { localStorage.setItem(WATCH_KEY, JSON.stringify(items.slice(0, 40))); } catch (e) {}
  }

  function addLocalWatch(mint, symbol) {
    mint = String(mint || "").trim();
    if (mint.length < 32 || mint.length > 44) return false;
    var items = loadLocalWatch();
    if (items.some(function (i) { return i.mint === mint; })) return true;
    items.unshift({
      mint: mint,
      symbol: symbol || "saknas",
      note_sv: "Tillagd manuellt",
      added_at: new Date().toISOString()
    });
    saveLocalWatch(items);
    return true;
  }

  function removeLocalWatch(mint) {
    saveLocalWatch(loadLocalWatch().filter(function (i) { return i.mint !== mint; }));
  }

  function elCard(title, body, meta, changed) {
    var card = document.createElement("article");
    card.className = "insikt-card" + (changed ? " changed" : "");
    var h = document.createElement("h3");
    h.textContent = title;
    card.appendChild(h);
    if (body) {
      var p = document.createElement("p");
      p.className = "insikt-body";
      p.textContent = body;
      card.appendChild(p);
    }
    if (meta) {
      var m = document.createElement("div");
      m.className = "insikt-meta";
      m.textContent = meta;
      card.appendChild(m);
    }
    return card;
  }

  function renderIntel(state) {
    var intel = (state && state.intel) || null;
    var note = $("insikt-note");
    if (note) {
      note.textContent = intel && intel.active
        ? "Insikt · PAPER · varje påstående har källa. Oscar bekräftar varje köp."
        : "Insikt väntar på desken.";
    }
    var habits = $("insikt-habits");
    if (habits) {
      habits.innerHTML = "";
      ((intel && intel.guide_habits_sv) || []).forEach(function (line) {
        var s = document.createElement("span");
        s.textContent = line;
        habits.appendChild(s);
      });
    }

    // Briefing
    var briefing = (intel && intel.briefing) || {};
    var bq = $("briefing-quiet");
    var bl = $("briefing-list");
    if (bl) {
      bl.innerHTML = "";
      if (briefing.quiet && bq) {
        bq.hidden = false;
        bq.textContent = briefing.quiet_sv || "Inget nytt sedan igår.";
      } else if (bq) {
        bq.hidden = true;
      }
      (briefing.items || []).forEach(function (item) {
        bl.appendChild(elCard(
          item.title_sv || "Punkt",
          String(item.body_sv == null ? "saknas" : item.body_sv),
          (item.source || "saknas") + " · " + (item.dated || "saknas")
        ));
      });
      if (!(briefing.items || []).length) {
        bl.appendChild(elCard("Morgonbrief", "saknas", "desk.intel"));
      }
    }

    // Changes
    var changes = (intel && intel.changes) || {};
    var cq = $("changes-quiet");
    var cl = $("changes-list");
    if (cl) {
      cl.innerHTML = "";
      if (changes.quiet && cq) {
        cq.hidden = false;
        cq.textContent = changes.quiet_sv || "Inget nytt.";
      } else if (cq) {
        cq.hidden = true;
      }
      (changes.changes || []).forEach(function (row) {
        cl.appendChild(elCard(
          row.title_sv || row.profile || "Ändring",
          row.body_sv || "saknas",
          (row.source || "saknas") + " · " + (row.dated || "saknas"),
          row.kind === "new"
        ));
      });
      if (!(changes.changes || []).length) {
        cl.appendChild(elCard("Marknadsförändringar", "Inga observationer ännu.", "desk.intel"));
      }
    }

    // Watchlist: merge desk + local
    var watch = (intel && intel.watchlist) || {};
    var wq = $("watch-quiet");
    var wl = $("watch-list");
    var local = loadLocalWatch();
    var deskCards = watch.cards || [];
    var seen = {};
    var merged = [];
    deskCards.forEach(function (c) { seen[c.mint] = true; merged.push(c); });
    local.forEach(function (item) {
      if (seen[item.mint]) return;
      merged.push({
        mint: item.mint,
        symbol: item.symbol || "saknas",
        note_sv: item.note_sv || "Lokal bevakning",
        changed: false,
        change_sv: "Väntar på desk-fakta",
        claims_preview: [],
        source: "localStorage",
        dated: item.added_at || "saknas",
        local: true
      });
    });
    if (wl) {
      wl.innerHTML = "";
      if (watch.quiet && !local.length && wq) {
        wq.hidden = false;
        wq.textContent = watch.quiet_sv || "Inget nytt på bevakning.";
      } else if (wq) {
        wq.hidden = true;
      }
      if (!merged.length) {
        wl.appendChild(elCard("Bevakning", watch.empty_sv || "Inga mint på bevakning.", "desk.intel.watchlist"));

    // t147: Källor / Backtest / Bevakning (near-miss) / Lärdomar
    var kallor = (intel && intel.kallor) || {};
    if (kallor && (kallor.rows || []).length) {
      var kLines = (kallor.rows || []).slice(0, 6).map(function (r) {
        return (r.source || "?") + ": in=" + r.candidates + " mom=" + r.passed_momentum +
          " trade=" + r.traded + " win=" + r.wins + " pnl=$" + r.pnl_usd;
      }).join(" · ");
      wl.appendChild(elCard("Källor", kLines || kallor.empty_sv || "saknas", "desk.source_stats"));
    } else if (kallor) {
      wl.appendChild(elCard("Källor", kallor.empty_sv || kallor.rule_sv || "Ingen källdata ännu.", "desk.source_stats"));
    }
    var bt = (intel && intel.backtest) || {};
    if (bt) {
      wl.appendChild(elCard(
        "Backtest",
        (bt.summary_sv || bt.empty_sv || "saknas") + (bt.disclaimer_sv ? " — " + bt.disclaimer_sv : ""),
        "desk.backtest"
      ));
    }
    var near = (intel && intel.bevakning_near) || {};
    if (near) {
      var nItems = near.items || [];
      var nTxt = nItems.length
        ? nItems.slice(0, 8).map(function (i) {
            return (i.symbol || i.mint || "?").toString().slice(0, 12) + " (" + (i.reason || "?") + ")";
          }).join(" · ")
        : (near.empty_sv || "Inga near-miss på bevakning.");
      wl.appendChild(elCard("Bevakning", nTxt, "desk.near_watch"));
    }
    var lar = (intel && intel.laridomar) || {};
    if (lar && lar.title_sv) {
      var lTxt = "Vinster: " + ((lar.wins || []).join("; ") || "saknas") +
        " · Förluster: " + ((lar.losses || []).join("; ") || "saknas");
      if ((lar.suggestions || []).length) {
        lTxt += " · " + lar.suggestions.slice(0, 3).join(" · ");
      }
      wl.appendChild(elCard("Lärdomar", lTxt, "desk.lessons"));
    }
    var ga = (intel && intel.gate_audit) || {};
    if (ga) {
      function gateLines(rows, empty) {
        rows = rows || [];
        if (!rows.length) return empty;
        return rows.slice(0, 8).map(function (r) {
          var chg = r.later_chg_pct;
          var chgTxt = (chg == null || !isFinite(Number(chg))) ? "saknas" : ((Number(chg) >= 0 ? "+" : "") + Number(chg).toFixed(1) + "%");
          return (r.symbol || (r.mint || "").slice(0, 6) || "saknas") + " · " + chgTxt;
        }).join(" · ");
      }
      wl.appendChild(elCard(
        "Avvisad som sedan sprang",
        gateLines(ga.rejected_then_ran, ga.empty_sv || "Ingen ännu."),
        "desk.gate_audit"
      ));
      wl.appendChild(elCard(
        "Passerade som sedan ruggade",
        gateLines(ga.passed_then_rugged, ga.empty_sv || "Ingen ännu."),
        "desk.gate_audit"
      ));
    }

      }
      merged.forEach(function (card) {
        var art = elCard(
          (card.symbol || "saknas") + (card.changed ? " · ändrat" : ""),
          card.change_sv || card.note_sv || "saknas",
          (card.source || "saknas") + " · " + (card.dated || "saknas"),
          !!card.changed
        );
        var mintLine = document.createElement("div");
        mintLine.className = "insikt-meta";
        mintLine.textContent = String(card.mint || "").slice(0, 12) + "…" + String(card.mint || "").slice(-6);
        art.appendChild(mintLine);
        (card.claims_preview || []).slice(0, 3).forEach(function (claim) {
          var row = document.createElement("div");
          row.className = "claim-row";
          var a = document.createElement("span");
          a.textContent = claim.claim_sv || "saknas";
          var b = document.createElement("strong");
          b.textContent = String(claim.value == null ? "saknas" : claim.value);
          var src = document.createElement("div");
          src.className = "claim-src";
          src.textContent = (claim.source || "saknas") + " · " + (claim.dated || "saknas");
          row.appendChild(a);
          row.appendChild(b);
          row.appendChild(src);
          art.appendChild(row);
        });
        if (card.local) {
          var rm = document.createElement("button");
          rm.type = "button";
          rm.className = "follow-btn";
          rm.textContent = "Ta bort";
          rm.addEventListener("click", function () {
            removeLocalWatch(card.mint);
            renderIntel(shownState || state);
          });
          art.appendChild(rm);
        }
        wl.appendChild(art);
      });
    }

    // Sentiment
    var sentiment = (intel && intel.sentiment) || {};
    var se = $("sentiment-empty");
    var sl = $("sentiment-list");
    if (sl) {
      sl.innerHTML = "";
      var cards = sentiment.cards || [];
      if (!cards.length && se) {
        se.hidden = false;
        se.textContent = sentiment.empty_sv || "Inga narrativbetyg ännu.";
      } else if (se) {
        se.hidden = true;
      }
      cards.forEach(function (card) {
        var art = elCard(
          (card.symbol || "saknas") + " · narrativ",
          card.narrative_sv || "saknas",
          (card.source || "saknas") + " · " + (card.dated || "saknas")
        );
        var pill = document.createElement("span");
        pill.className = "rating-pill " + String(card.rating || "").toLowerCase();
        pill.textContent = card.rating || "saknas";
        art.insertBefore(pill, art.firstChild.nextSibling);
        var meta2 = document.createElement("div");
        meta2.className = "insikt-meta";
        meta2.textContent = "Omnämnanden 1h: " + (card.mentions_1h == null ? "saknas" : card.mentions_1h)
          + " · Unika: " + (card.unique_accounts_1h == null ? "saknas" : card.unique_accounts_1h)
          + " · Bot: " + (card.bot_suspect == null ? "saknas" : card.bot_suspect);
        art.appendChild(meta2);
        var add = document.createElement("button");
        add.type = "button";
        add.className = "follow-btn";
        add.textContent = "Bevaka";
        add.addEventListener("click", function () {
          addLocalWatch(card.mint, card.symbol);
          renderIntel(shownState || state);
        });
        art.appendChild(add);
        sl.appendChild(art);
      });
    }

    // Research
    var research = (intel && intel.research) || {};
    var re = $("research-empty");
    var rl = $("research-list");
    if (rl) {
      rl.innerHTML = "";
      var packs = research.packs || [];
      if (!packs.length && re) {
        re.hidden = false;
        re.textContent = research.empty_sv || "Inga mint att forska på.";
      } else if (re) {
        re.hidden = true;
      }
      packs.forEach(function (pack) {
        var art = elCard(pack.title_sv || "Fakta", pack.note_sv || "", pack.mint ? (String(pack.mint).slice(0, 8) + "…") : "saknas");
        (pack.claims || []).forEach(function (claim) {
          var row = document.createElement("div");
          row.className = "claim-row";
          var a = document.createElement("span");
          a.textContent = claim.claim_sv || "saknas";
          var b = document.createElement("strong");
          b.textContent = String(claim.value == null ? "saknas" : claim.value);
          var src = document.createElement("div");
          src.className = "claim-src";
          src.textContent = (claim.source || "saknas") + " · " + (claim.dated || "saknas");
          row.appendChild(a);
          row.appendChild(b);
          row.appendChild(src);
          art.appendChild(row);
        });
        var add = document.createElement("button");
        add.type = "button";
        add.className = "follow-btn";
        add.textContent = "Bevaka";
        add.addEventListener("click", function () {
          addLocalWatch(pack.mint, pack.symbol);
          renderIntel(shownState || state);
        });
        art.appendChild(add);
        rl.appendChild(art);
      });
    }
  }

  function bindWatchAdd() {
    var btn = $("watch-add-btn");
    if (!btn || btn.__bound) return;
    btn.__bound = true;
    btn.addEventListener("click", function () {
      var mint = ($("watch-mint") && $("watch-mint").value) || "";
      var symbol = ($("watch-symbol") && $("watch-symbol").value) || "";
      if (!addLocalWatch(mint, symbol)) {
        if ($("watch-note")) $("watch-note").textContent = "Ogiltig mint (32–44 tecken).";
        return;
      }
      if ($("watch-mint")) $("watch-mint").value = "";
      if ($("watch-symbol")) $("watch-symbol").value = "";
      if ($("watch-note")) $("watch-note").textContent = "Tillagd lokalt. Desken fyller fakta när mint syns.";
      renderIntel(shownState || window.__nimbusLastState || {});
    });
  }


  function formatCountdown(sec) {
    if (sec == null || !isFinite(sec) || sec < 0) return "—";
    var s = Math.floor(sec);
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var r = s % 60;
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":" + String(r).padStart(2, "0");
  }

  function renderChallenge(state) {
    var box = (state && state.challenge) || {};
    if (window.NimbusLive && typeof NimbusLive.render === "function") {
      window.formatCountdownLive = formatCountdown;
      NimbusLive.render(state);
    }

    var note = $("challenge-note");
    var cd = $("challenge-countdown");
    var wins = $("challenge-wins");
    var pnl = $("challenge-pnl");
    var cash = $("challenge-cash");
    var oscar = $("challenge-oscar");
    var rules = $("challenge-rules");
    var host = $("challenge-trades");
    var openHost = $("challenge-open");
    var eventsHost = $("challenge-events");
    var statusSv = $("challenge-status-sv");
    var statusPill = $("challenge-status-pill");
    var paperTag = $("challenge-paper-tag");
    if (!host && !openHost) return;

    var status = box.status || "idle";
    var label = box.status_sv || status;
    if (note) note.textContent = box.note_sv || "Ingen PAPER-utmaning körs.";
    if (paperTag) paperTag.textContent = box.paper_label_sv || "PAPER · simulerat · inga riktiga pengar";
    if (statusSv) statusSv.textContent = label;
    if (statusPill) {
      statusPill.textContent = label;
      statusPill.className = "challenge-status-pill" + (
        status === "paused" ? " paused" : status === "running" || status === "aborting" ? " running" : status === "finished" || status === "aborted" ? " done" : ""
      );
    }
    if (cd) {
      var showCd = status === "running" || status === "paused" || status === "aborting";
      var done = status === "finished" || status === "aborted";
      cd.textContent = showCd ? formatCountdown(box.countdown_seconds) : (done ? "Avslutad" : "—");
      cd.dataset.endsAt = showCd && box.ends_at ? box.ends_at : "";
      var cdLab = $("challenge-cd-lab");
      if (cdLab) cdLab.textContent = showCd ? "slut om" : (done ? "utmaning" : "slut om");
    }
    if (wins) {
      if (box.wins_label_sv) {
        // Strip leading "Vinster " — the HTML span already says Vinster.
        wins.textContent = String(box.wins_label_sv).replace(/^Vinster\s+/i, "");
      } else {
        wins.textContent = String(box.wins || 0);
      }
    }
    if (pnl) {
      var v = Number(box.realized_pnl_usd);
      pnl.textContent = isFinite(v) ? ((v >= 0 ? "+$" : "-$") + Math.abs(v).toFixed(2)) : "saknas";
    }
    if (cash) {
      var c = Number(box.cash_usd);
      var cap = Number(box.capital_usd);
      cash.textContent = (isFinite(c) ? ("$" + c.toFixed(0)) : "saknas") + (isFinite(cap) ? (" / $" + cap.toFixed(0)) : "");
    }
    if (oscar) {
      var o = Number(box.oscar_manual_paper_usd);
      oscar.textContent = (isFinite(o) ? ("$" + o.toFixed(0)) : "$200") + " orörd";
    }
    if (rules) {
      rules.innerHTML = "";
      (box.rules_sv || []).forEach(function (line) {
        var li = document.createElement("li");
        li.textContent = line;
        rules.appendChild(li);
      });
    }

    if (openHost) {
      openHost.innerHTML = "";
      var opens = box.open || [];
      if (!opens.length) {
        var emptyO = document.createElement("p");
        emptyO.className = "empty-hint";
        emptyO.textContent = status === "paused" ? "Inga öppna positioner (pausad)." : "Inga öppna positioner.";
        openHost.appendChild(emptyO);
      }
      opens.forEach(function (row) {
        var el = document.createElement("article");
        el.className = "challenge-open-card";
        el.appendChild(coinArt(row, "coin-art"));
        var body = document.createElement("div");
        var title = document.createElement("strong");
        title.textContent = row.symbol || (row.mint || "").slice(0, 6) || "—";
        var meta = document.createElement("div");
        meta.className = "challenge-metrics";
        function chip(label, value) {
          var span = document.createElement("span");
          span.innerHTML = label + " <b>" + (value == null || value === "" ? "saknas" : value) + "</b>";
          meta.appendChild(span);
        }
        chip("Entry", row.entry_price != null ? row.entry_price : null);
        chip("Nu", row.current_price_missing || row.current_price == null ? null : row.current_price);
        var pnlU = row.pnl_usd;
        var pnlP = row.pnl_pct;
        chip("PnL $", pnlU == null ? null : ((pnlU >= 0 ? "+$" : "-$") + Math.abs(Number(pnlU)).toFixed(2)));
        chip("PnL %", pnlP == null ? null : ((pnlP >= 0 ? "+" : "") + Number(pnlP).toFixed(2) + "%"));
        chip("2×", row.stake_out_price != null ? row.stake_out_price : row.take_profit_price);
        if (row.stake_out_done) {
          chip("5×", row.ladder_5x_price != null ? row.ladder_5x_price : null);
          chip("20×", row.ladder_20x_price != null ? row.ladder_20x_price : null);
        }
        chip("SL", row.stop_price != null ? row.stop_price : null);
        var reason = document.createElement("div");
        reason.className = "meta";
        reason.style.marginTop = "6px";
        reason.textContent = row.entry_reason_sv || "saknas";
        body.appendChild(title);
        body.appendChild(meta);
        body.appendChild(reason);
        el.appendChild(body);
        openHost.appendChild(el);
      });
    }

    if (eventsHost) {
      eventsHost.innerHTML = "";
      var events = box.events || [];
      if (!events.length) {
        var emptyE = document.createElement("p");
        emptyE.className = "empty-hint";
        emptyE.textContent = "Inga challenge-händelser ännu.";
        eventsHost.appendChild(emptyE);
      }
      events.forEach(function (ev) {
        var el = document.createElement("article");
        el.className = "challenge-event";
        var kind = document.createElement("div");
        kind.className = "kind " + String(ev.kind || "").replace("sälj", "salj");
        kind.textContent = ev.kind || "saknas";
        var body = document.createElement("div");
        var line = document.createElement("div");
        line.textContent = (ev.symbol || (ev.mint || "").slice(0, 6) || "—") + " · " + (ev.reason_sv || "saknas");
        var when = document.createElement("div");
        when.className = "meta";
        when.textContent = ev.ts_stockholm || "saknas";
        body.appendChild(line);
        body.appendChild(when);
        el.appendChild(kind);
        el.appendChild(body);
        eventsHost.appendChild(el);
      });
    }

    if (host) {
      host.innerHTML = "";
      var trades = box.trades || [];
      if (!trades.length) {
        var empty = document.createElement("p");
        empty.className = "empty-hint";
        empty.textContent = "Inga stängda challenge-trades.";
        host.appendChild(empty);
      }
      trades.forEach(function (row) {
        var el = document.createElement("article");
        el.className = "challenge-trade";
        el.appendChild(coinArt(row, "coin-art"));
        var body = document.createElement("div");
        var title = document.createElement("strong");
        title.textContent = row.symbol || (row.mint || "").slice(0, 6) || "—";
        var pnlEl = document.createElement("span");
        var pv = Number(row.pnl_usd);
        if (isFinite(pv)) {
          pnlEl.className = pv >= 0 ? "pnl-pos" : "pnl-neg";
          pnlEl.textContent = " " + (pv >= 0 ? "+$" : "-$") + Math.abs(pv).toFixed(2);
        } else {
          pnlEl.textContent = " saknas";
        }
        title.appendChild(pnlEl);
        var meta = document.createElement("div");
        meta.className = "meta";
        meta.textContent = "Entry " + (row.entry_price != null ? row.entry_price : "saknas")
          + " → Exit " + (row.exit_price != null ? row.exit_price : "saknas")
          + " · " + (row.exit_reason || "saknas");
        body.appendChild(title);
        body.appendChild(meta);
        el.appendChild(body);
        host.appendChild(el);
      });
    }

    maybeChallengeTradeToast(box);
  }

  var __challengeSeenEventIds = null;
  function maybeChallengeTradeToast(box) {
    var events = (box && box.events) || [];
    var ids = events.map(function (e) { return e.id; }).filter(function (id) { return id != null; });
    if (__challengeSeenEventIds == null) {
      try {
        __challengeSeenEventIds = JSON.parse(sessionStorage.getItem("nimbus_challenge_seen_events") || "[]");
      } catch (e) {
        __challengeSeenEventIds = [];
      }
      // Seed without toasting historical events on first load.
      if (!__challengeSeenEventIds.length && ids.length) {
        __challengeSeenEventIds = ids.slice();
        try { sessionStorage.setItem("nimbus_challenge_seen_events", JSON.stringify(__challengeSeenEventIds)); } catch (e2) {}
        return;
      }
    }
    var known = {};
    __challengeSeenEventIds.forEach(function (id) { known[id] = true; });
    var fresh = events.filter(function (e) { return e.id != null && !known[e.id] && (e.kind === "köp" || e.kind === "sälj" || e.kind === "TP" || e.kind === "SL"); });
    if (!fresh.length) return;
    fresh.forEach(function (ev) {
      __challengeSeenEventIds.push(ev.id);
      showChallengeToast(ev);
      try {
        if (navigator.vibrate) navigator.vibrate([40, 30, 40]);
      } catch (e3) {}
    });
    try { sessionStorage.setItem("nimbus_challenge_seen_events", JSON.stringify(__challengeSeenEventIds.slice(-80))); } catch (e4) {}
  }

  function showChallengeToast(ev) {
    var node = $("challenge-toast");
    if (!node) {
      node = document.createElement("div");
      node.id = "challenge-toast";
      node.className = "challenge-toast";
      document.body.appendChild(node);
    }
    var kind = ev.kind || "trade";
    node.hidden = false;
    node.textContent = "Utmaning LIVE · " + kind.toUpperCase() + " · " + (ev.symbol || "saknas") + " · PAPER";
    clearTimeout(node.__hide);
    node.__hide = setTimeout(function () { node.hidden = true; }, 4500);
  }

  function renderState(state) {
    if (!state) { showBootEmpty(true); return; }
    brandDeep(state, 0);
    shownState = state;
    showBootEmpty(false);
    renderHeader(state);
    bindCashActions();
    syncCashActions(state);
    renderKillBanner(state);
    bindKillUnlock();
    renderSuggestions(state);
    renderChallenge(state);
    renderStoppade(state);
    renderJournal(state);
    renderIntel(state);
    renderClosed(state);
    if (!window.__deskTabInit) {
      window.__deskTabInit = true;
      showDeskTab("hem");
    }
    window.__nimbusLastState = state;
    renderAccount(state);
    renderGrok(state);
    try { if (window.SwipeUI) SwipeUI.render(state); } catch (eSw) { if (window.console) console.error(eSw); }
  }

  function renderGrok(state) {
    var node = $("grok-budget-status");
    if (!node) return;
    var box = (state && state.grok) || {};
    node.textContent = box.note_sv || "Av. Tak 5,00 USD per månad. En nyckel slår inte på anrop.";
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
      .then(function (state) { renderState(state);
      try {
        var ch = (state && state.challenge) || {};
        var want = Number(ch.publish_interval_ms);
        if (!isFinite(want) || want < 3000) want = (ch.live_view || ch.status === "paused" || ch.status === "running") ? 5000 : POLL_MS;
        if (want !== __currentPollMs) schedulePoll(cfg, want);
      } catch (ePoll) {} })
      .catch(function (err) {
        window.__nimbusLastError = String((err && err.stack) || err);
        if (window.console) console.error(err);
        if (!shownState) showBootEmpty(true);
      });
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
      ".layer-dots i.n{background:#C5D9EE}.audit-reason{font-size:0.62rem;font-weight:500;color:#3A6488;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}";
    document.head.appendChild(s);
  })();

  if ("serviceWorker" in navigator && !isLocalPreview()) {
    navigator.serviceWorker.register("./sw.js").catch(function () {});
  }

  if (isLocalPreview()) {
    window.__NIMBUS_MOCK_STATE__ = previewState();
    window.__nimbusApplyState = renderState;
  }
  wireControls();
  var cfg = loadConfig();
  var __pollTimer = null;
  var __currentPollMs = POLL_MS;
  function schedulePoll(cfg, ms) {
    if (__pollTimer) clearInterval(__pollTimer);
    __currentPollMs = ms || POLL_MS;
    __pollTimer = setInterval(function () { poll(cfg); }, __currentPollMs);
  }
  poll(cfg);
  schedulePoll(cfg, POLL_MS);
  if (isLocalPreview() && location.search.indexOf("account=1") !== -1) openAccount();
})();

  (function challengeCountdownTick() {
    setInterval(function () {
      var cd = document.getElementById("challenge-countdown");
      if (!cd || !cd.dataset.endsAt) return;
      var ends = Date.parse(cd.dataset.endsAt);
      if (!isFinite(ends)) return;
      var sec = Math.max(0, Math.floor((ends - Date.now()) / 1000));
      var h = Math.floor(sec / 3600);
      var m = Math.floor((sec % 3600) / 60);
      var r = sec % 60;
      cd.textContent = String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":" + String(r).padStart(2, "0");
    }, 1000);
  })();
