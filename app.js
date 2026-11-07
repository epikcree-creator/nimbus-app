/* Nimbus Android PWA — polls desk JSON from DATA_BASE in URL fragment */
(function () {
  var POLL_MS = 15000;
  var LS_BASE = "nimbus_data_base";
  var LS_TOKEN = "nimbus_app_token";
  var SIGNUP_URL = "https://fomo.family/r/savipww";
  var CHAIN_ID = { solana: 1399811149, robinhood: 4663, base: 8453, bnb: 56 };
  var AGENTS = [
    { id: "scanner", name: "Scanner", sub: "Graduationer · PumpPortal", color: "#64d2ff", icon: "𝒮" },
    { id: "auditor", name: "Auditor", sub: "8 lager · RugCheck", color: "#9b6bff", icon: "𝒜" },
    { id: "analyst", name: "Analyst", sub: "Jev · noul-frågor", color: "#ffd60a", icon: "𝒥" },
    { id: "executor", name: "Executor", sub: "Paper-fyllningar", color: "#00d35a", icon: "ℰ" },
    { id: "risk", name: "Risk", sub: "Stopp · trailing", color: "#ff6b9a", icon: "ℛ" }
  ];
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
      src.textContent = "via Telegram";
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
      pill.textContent = published === "LIVE" ? "LIVE" : "PAPPER";
      pill.setAttribute("title", result.message);
    }
    var sub = $("agents-sub");
    if (sub) {
      sub.textContent = published === "LIVE"
        ? "5 agenter · desken visar LIVE · appen handlar inte live"
        : "5 agenter · papperspengar";
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
      settings_write: { direct: false }
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
    var moneyPaper = $("money-paper");
    if (moneyPaper) moneyPaper.addEventListener("click", function () { chooseMoney("select-paper"); });
    var moneyLive = $("money-live");
    if (moneyLive) moneyLive.addEventListener("click", function () { chooseMoney("select-live"); });
    var authForm = $("owner-auth");
    if (authForm) authForm.addEventListener("submit", loginOwner);
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") closeAccount();
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
      var statusSv = ok ? "live" : (status === "not started" ? "ej startad" : String(status).slice(0, 28));
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
        pctEl.textContent = ok ? "…" : "—";
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
  function renderTokens(state) {
    var grid = $("tokens-grid");
    grid.innerHTML = "";
    var rows = state.positions || [];
    if (!rows.length) {
      var p = document.createElement("p");
      p.className = "empty-hint";
      p.textContent = "Inga innehav än";
      grid.appendChild(p);
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
    if (!trades.length && Array.isArray(state.activity)) {
      trades = state.activity.filter(function (a) {
        return a && (a.kind === "sold" || a.kind === "stopped" || a.kind === "bought" || a.kind === "rejected");
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
    $("closed-count").textContent = String(trades.length);
    list.innerHTML = "";
    if (!trades.length) {
      var p = document.createElement("p");
      p.className = "empty-hint";
      p.textContent = "Ingen aktivitet än i natt";
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
    if (!deposit && Array.isArray(state.equity) && state.equity.length) deposit = Number(state.equity[0]) || 0;
    if (!deposit && equity > 0) deposit = equity;
    var mult = (deposit > 0 && equity > 0) ? (equity / deposit) : 1;
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
    paintMoney(currentMoney(state, "show"));
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
      pill.textContent = "Bot vilande";
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
    shownState = state;
    showBootEmpty(false);
    renderHeader(state);
    renderAgents(state);
    renderTokens(state);
    renderAudited(state);
    renderClosed(state);
    renderGoal(state);
    window.__nimbusLastState = state;
    renderAccount(state);
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
      ".layer-dots i.n{background:#4a4058}.audit-reason{font-size:0.62rem;font-weight:500;color:rgba(235,235,245,0.55);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}";
    document.head.appendChild(s);
  })();

  if ("serviceWorker" in navigator && !isLocalPreview()) {
    navigator.serviceWorker.register("./sw.js").catch(function () {});
  }

  if (isLocalPreview()) window.__NIMBUS_MOCK_STATE__ = previewState();
  wireControls();
  var cfg = loadConfig();
  poll(cfg);
  setInterval(function () { poll(cfg); }, POLL_MS);
  if (isLocalPreview() && location.search.indexOf("account=1") !== -1) openAccount();
})();
