/* PAWS pairing-link parser (v81f). Finds the desk data base (d) and token (t) in ANY pasted text:
   a whole Telegram message, nimbus://pair?d=..&t=.., https://…/nimbus-app/#d=..&t=.., with HTML entities
   (&amp;), line breaks or spaces inside the link, trailing punctuation, single or double URL-encoding,
   or just a raw https data base (+ optional token). Returns {d, t} or null. No network, no secrets. */
(function (root) {
  "use strict";
  var ENT = { "&amp;": "&", "&#38;": "&", "&#x26;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&nbsp;": " " };
  function clean(s) {
    s = String(s == null ? "" : s);
    s = s.replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, "");           // zero-width / soft hyphen
    s = s.replace(/\u00A0/g, " ");
    for (var k = 0; k < 2; k++) s = s.replace(/&(amp|#38|#x26|lt|gt|quot|#39|apos|nbsp);/gi, function (m) { return ENT[m.toLowerCase()] || m; });
    s = s.replace(/\\u0026/gi, "&");
    return s;
  }
  function dec(v) { var out = v; for (var i = 0; i < 3 && /%[0-9a-f]{2}/i.test(out); i++) { try { out = decodeURIComponent(out); } catch (e) { break; } } return out; }
  function trimTail(s) { return String(s || "").replace(/[)\]}>.,;:!?'"`»”’]+$/, ""); }
  function validBase(u) {
    if (typeof u !== "string") return null; u = trimTail(u.trim()).replace(/\/+$/, "");
    if (u.length < 12 || u.length > 300 || /\s/.test(u)) return null;
    var x; try { x = new URL(u); } catch (e) { return null; }
    if (x.protocol !== "https:" || x.username || x.password) return null;
    if (/(^|\.)github\.io$/i.test(x.hostname) || /(^|\.)fomo\.family$/i.test(x.hostname) || /(^|\.)t\.me$/i.test(x.hostname) || /telegram\.org$/i.test(x.hostname)) return null;
    if (x.hash || x.search && !/\.json$/i.test(x.pathname)) return null;
    // desk data paths end in a 32+ char secret segment; a shorter one means the link was cut off
    if (/supabase\.co$|vercel\.app$/i.test(x.hostname) && !/\.json$/i.test(x.pathname)) {
      var seg = x.pathname.split("/").filter(Boolean).pop() || "";
      if (seg.length < 32) return null;
    }
    return u;
  }
  function validTok(t) { t = trimTail(dec(String(t || "")).trim()); return /^[A-Za-z0-9_\-.~]{4,200}$/.test(t) ? t : ""; }
  // value after d= runs until & (raw) — but an encoded d (https%3A%2F%2F…) has no raw '&', a raw one may contain '/' ':'
  function fromParams(text) {
    var dm = /(?:^|[?#&\s])d=([^&\s<>"']+)/i.exec(text);
    if (!dm) return null;
    var d = validBase(dec(dm[1]));
    if (!d) return null;
    var tm = /(?:^|[?#&\s])t=([^&\s<>"']+)/i.exec(text.slice(dm.index));
    if (!tm) tm = /(?:^|[?#&\s])t=([^&\s<>"']+)/i.exec(text);
    return { d: d, t: tm ? validTok(tm[1]) : "" };
  }
  function linkStarts(text) {
    var out = [], re = /nimbus:\/\/pair|https?:\/\/[^\s]*?\/nimbus-app\/?#|#d=/gi, m;
    while ((m = re.exec(text))) out.push(m.index);
    return out;
  }
  function tryText(text) {
    var starts = linkStarts(text);
    for (var i = 0; i < starts.length; i++) {
      var seg = text.slice(starts[i]);
      var cut = seg.search(/\s/); var one = cut > 0 ? seg.slice(0, cut) : seg;   // the link up to the first whitespace
      var r = fromParams(one.replace(/^nimbus:\/\/pair\??/i, "?").replace(/^[^#]*#/, "#")); if (r) return r;
    }
    return fromParams(text);
  }
  function parse(raw) {
    var text = clean(raw); if (!text.trim()) return null;
    var r = tryText(text), r2 = tryText(text.replace(/\s+/g, ""));        // also try with line breaks / spaces removed
    if (!r || (r2 && r2.d.length > r.d.length && r2.d.indexOf(r.d) === 0)) r = r2 || r;
    if (!r) {
      // raw data base pasted on its own (optionally followed by a token)
      var bm = /https:\/\/[^\s<>"']+/gi, m;
      while ((m = bm.exec(text))) {
        var b = validBase(dec(m[0]));
        if (b) { var tk = /\b([A-Fa-f0-9]{32,128}|[A-Za-z0-9_-]{40,128})\b/.exec(text.slice(m.index + m[0].length)); return { d: b, t: tk ? tk[1] : "" }; }
      }
    }
    return r;
  }
  root.PawsPair = { parse: parse, validBase: validBase };
  if (typeof module !== "undefined" && module.exports) module.exports = root.PawsPair;
})(typeof window !== "undefined" ? window : this);
