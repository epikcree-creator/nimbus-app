/* STEP 10 settings math + validation. Shared by the Account tab and node tests. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.NimbusSettings = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var WRITE_REASON_SV = (
    "Sparning kräver en inloggad Supabase-ägare. Desken läser begäran, validerar den " +
    "mot schemat och skriver i den lokala databasen. Den publika lagringen tar inte " +
    "emot skrivningar från besökare. Länkens hemliga token är inte inloggning."
  );
  var SECRET_KEYS = { rpc_url: 1, tg_token: 1, typesafe_api_key: 1 };
  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function cents(n) {
    return Math.round((Number(n) + 1e-9) * 100) / 100;
  }

  function ticketCheck(stack, stackPct, minTicket, belowMin) {
    var pct = Number(stackPct);
    var ticket = Number(minTicket);
    var below = String(belowMin || "bump").toLowerCase();
    var minStack = pct <= 0 ? Infinity : cents(ticket / (pct / 100));
    var stackC = cents(stack);
    var out = {
      min_stack: minStack,
      stack: stackC,
      stack_pct: pct,
      min_ticket_usd: ticket,
      below_min: below,
      level: "ok",
      message_sv: ""
    };
    if (stackC >= minStack) return out;
    if (below === "bump") {
      var share = stackC ? (ticket / stackC) * 100 : 0;
      out.level = "bump";
      out.message_sv = "Tickets bumpas till $" + ticket.toFixed(2) + " = " + share.toFixed(2) + "% av stack.";
      return out;
    }
    out.level = "skip";
    out.message_sv = "Varning: varje coin hoppas över, stack under $" + minStack.toFixed(2) + ". Byt till bump eller höj stacken.";
    return out;
  }

  function previewTicket(values, focusKey) {
    var mode = String((values && values.mode) || "PAPER").toUpperCase();
    var stack;
    if (focusKey === "live_stack") stack = Number(values.live_stack);
    else if (focusKey === "paper_start_stack") stack = Number(values.paper_start_stack);
    else stack = mode === "LIVE" ? Number(values.live_stack) : Number(values.paper_start_stack);
    return ticketCheck(stack, values.stack_pct, values.min_ticket_usd, values.below_min);
  }

  function fmtBound(n) {
    n = Number(n);
    if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
    return n.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  }

  function validateField(field, raw) {
    if (!field || field.kind === "secret" || field.kind === "readonly") {
      return { ok: true, message: "", value: null };
    }
    if (field.kind === "bool") {
      var low = String(raw).toLowerCase();
      if (["1", "true", "yes", "on", "på", "pa"].indexOf(low) >= 0) {
        return { ok: true, message: "", value: true };
      }
      if (["0", "false", "no", "off", "av"].indexOf(low) >= 0) {
        return { ok: true, message: "", value: false };
      }
      return { ok: false, message: field.label + ": tillåtet på eller av", value: null };
    }
    if (field.kind === "enum") {
      var ev = String(raw == null ? "" : raw).trim();
      if (field.key === "analyst_mode" || field.key === "notifier" || field.key === "below_min") {
        ev = ev.toLowerCase();
      }
      var opts = (field.options || []).map(function (o) { return o.value; });
      if (opts.indexOf(ev) < 0) {
        return { ok: false, message: field.label + ": tillåtet " + opts.join(" eller "), value: null };
      }
      return { ok: true, message: "", value: ev };
    }
    if (field.kind === "time") {
      var tv = String(raw == null ? "" : raw).trim();
      var tm = /^(\d{1,2}):(\d{2})$/.exec(tv);
      if (!tm) return { ok: false, message: "Rapporttid: ange HH:MM (00:00–23:59)", value: null };
      var hh = parseInt(tm[1], 10);
      var mm = parseInt(tm[2], 10);
      if (hh > 23 || mm > 59) {
        return { ok: false, message: "Rapporttid: ange HH:MM (00:00–23:59)", value: null };
      }
      var canon = (hh < 10 ? "0" : "") + hh + ":" + tm[2];
      return { ok: true, message: "", value: canon };
    }
    if (field.kind === "text") {
      var text = String(raw == null ? "" : raw).trim();
      if (field.key === "fomo_handle") {
        if (text === "") return { ok: true, message: "", value: "" };
        if (!/^@?[A-Za-z0-9._]{1,32}$/.test(text)) {
          return {
            ok: false,
            message: "FOMO-handtag: bara bokstäver, siffror, punkt och understreck (max 32)",
            value: null
          };
        }
      }
      return { ok: true, message: "", value: text };
    }
    var cleaned = String(raw == null ? "" : raw).trim().replace(/%/g, "").replace(/\$/g, "").replace(",", ".");
    if (cleaned.charAt(0) === "+") cleaned = cleaned.slice(1);
    var num = Number(cleaned);
    if (!isFinite(num)) return { ok: false, message: field.label + ": ogiltigt tal", value: null };
    if ((field.key && /_pct$/.test(field.key)) || field.key === "stop_pct" || field.key === "stack_pct") {
      num = Math.abs(num);
    }
    if (num < Number(field.min) || num > Number(field.max)) {
      return {
        ok: false,
        message: field.label + ": tillåtet " + fmtBound(field.min) + "–" + fmtBound(field.max),
        value: null
      };
    }
    if (field.integer && Math.abs(num - Math.round(num)) > 1e-9) {
      return { ok: false, message: field.label + ": heltal", value: null };
    }
    return { ok: true, message: "", value: num };
  }

  function publishableKeyAllowed(key) {
    var text = String(key || "");
    if (!text) return false;
    if (text.indexOf("service_") !== -1) return false;
    if (text.indexOf("sb_") === 0 && text.indexOf("publishable_") === -1) return false;
    return true;
  }

  function settingsRequestUrl(base) {
    var b = String(base || "").replace(/\/$/, "");
    if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/i.test(b)) return null;
    return b + "/rest/v1/nimbus_settings_requests";
  }

  function authTokenUrl(base) {
    var b = String(base || "").replace(/\/$/, "");
    if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/i.test(b)) return null;
    return b + "/auth/v1/token";
  }

  function buildSettingsRequest(spec) {
    spec = spec || {};
    if (!spec.accessToken || !spec.userId) {
      return { ok: false, message: "Ägarinloggning krävs." };
    }
    if (SECRET_KEYS[spec.key]) {
      return { ok: false, message: "RPC och hemliga nycklar skickas inte." };
    }
    var value = spec.value == null ? "" : String(spec.value);
    if (spec.key === "mode") {
      return { ok: false, message: "Mode ändras inte via inställningskön." };
    }
    if (value.length > 200 || String(spec.key || "").length > 64) {
      return { ok: false, message: "Värdet är för långt." };
    }
    var id = String(spec.id || "");
    var nonce = String(spec.nonce || "");
    if (!UUID_RE.test(id) || !UUID_RE.test(nonce) || id === nonce) {
      return { ok: false, message: "Ogiltig begäran." };
    }
    var now = spec.nowMs == null ? Date.now() : Number(spec.nowMs);
    var expires = new Date(now + 5 * 60 * 1000).toISOString();
    var row = { id: id, nonce: nonce, key: String(spec.key), value: value, expires_at: expires };
    var encoded = JSON.stringify(row);
    if (encoded.indexOf(String(spec.accessToken)) !== -1) {
      return { ok: false, message: "Begäran stoppades." };
    }
    return { ok: true, message: "", row: row };
  }

  var LIVE_REASONS = [
    "Riktiga pengar är inte aktiverade.",
    "Ingen verifierad handelsanslutning finns. En FOMO-länk öppnar en extern sida och lägger ingen order här.",
    "Inget överenskommet kapital- eller risktak för riktiga pengar är satt.",
    "Den vanliga inställningskön tar inte emot mode, så appen kan inte byta desken till LIVE."
  ];

  function moneyChoice(spec) {
    spec = spec || {};
    var published = String(spec.publishedMode || "PAPER").toUpperCase() === "LIVE" ? "LIVE" : "PAPER";
    var open = Number(spec.openPositions);
    if (!isFinite(open) || open < 0) open = 0;
    var base = {
      choice: "paper",
      persist: "paper",
      liveAvailable: false,
      request: null,
      ordersSent: false,
      positionsClosed: false,
      publishedMode: published,
      openPositions: open
    };
    if (spec.action === "select-live") {
      base.activated = false;
      base.status = "unavailable";
      base.message = "Riktiga pengar är inte aktiverade. Inga order skickas och inga positioner stängs.";
      base.reasons = LIVE_REASONS.slice();
      return base;
    }
    base.activated = published === "PAPER";
    base.status = "paper";
    base.reasons = [];
    if (published === "PAPER") {
      base.message = open
        ? "Papperspengar är på. Öppna papperspositioner stängs inte av det här valet."
        : "Papperspengar är på. Inga positioner stängs av det här valet.";
    } else {
      base.message = "Appen står kvar på papperspengar. Desken visar LIVE, men det här valet aktiverar inte riktiga pengar och stänger inga positioner.";
    }
    return base;
  }

  return {
    WRITE_REASON_SV: WRITE_REASON_SV,
    moneyChoice: moneyChoice,
    settingsRequestUrl: settingsRequestUrl,
    authTokenUrl: authTokenUrl,
    buildSettingsRequest: buildSettingsRequest,
    publishableKeyAllowed: publishableKeyAllowed,
    cents: cents,
    ticketCheck: ticketCheck,
    previewTicket: previewTicket,
    fmtBound: fmtBound,
    validateField: validateField
  };
});
