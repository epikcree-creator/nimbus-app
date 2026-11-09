/* Followed-buy cards. Reads already validated events. Does not order. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.NimbusDiscovery = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var TOKEN_RE = /^https:\/\/fomo\.family\/tokens\/solana\/[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  var PROFILE_RE = /^https:\/\/fomo\.family\/profile\/[A-Za-z0-9._]{1,32}$/;

  function allowToken(url) {
    return TOKEN_RE.test(String(url || "")) ? String(url) : null;
  }

  function allowProfile(url) {
    return PROFILE_RE.test(String(url || "")) ? String(url) : null;
  }

  function visibleEvents(events, skipped) {
    var hide = {};
    (skipped || []).forEach(function (id) { hide[String(id)] = 1; });
    var seen = {};
    var out = [];
    (events || []).forEach(function (event) {
      if (!event || hide[event.trade_id] || seen[event.profile + ":" + event.trade_id]) return;
      if (event.rug_stopped) return;
      seen[event.profile + ":" + event.trade_id] = 1;
      out.push(event);
    });
    return out;
  }

  function stoppadeEvents(feed) {
    var list = (feed && (feed.stoppade || feed.events_stopped)) || [];
    if ((!list || !list.length) && feed && feed.events_all) {
      list = (feed.events_all || []).filter(function (e) { return e && e.rug_stopped; });
    }
    var seen = {};
    var out = [];
    (list || []).forEach(function (event) {
      if (!event) return;
      var key = (event.profile || "") + ":" + (event.trade_id || event.mint || "");
      if (seen[key]) return;
      seen[key] = 1;
      out.push(event);
    });
    return out;
  }

  function reasonLines(event) {
    var rug = (event && event.rug) || {};
    var lines = rug.reasons_sv || [];
    if ((!lines || !lines.length) && rug.reasons) {
      lines = rug.reasons.slice();
    }
    return lines || [];
  }

  function reviewOf(event) {
    return {
      purchased: false,
      order: false,
      navigate: false,
      tokenUrl: allowToken(event && event.token_url),
      profileUrl: allowProfile(event && event.profile_url)
    };
  }

  function letter(event) {
    var symbol = event && event.symbol;
    if (symbol) return String(symbol).charAt(0).toUpperCase();
    var profile = event && event.profile;
    return profile ? String(profile).charAt(0).toUpperCase() : "?";
  }

  return {
    allowToken: allowToken,
    allowProfile: allowProfile,
    visibleEvents: visibleEvents,
    stoppadeEvents: stoppadeEvents,
    reasonLines: reasonLines,
    reviewOf: reviewOf,
    letter: letter
  };
});
