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
      seen[event.profile + ":" + event.trade_id] = 1;
      out.push(event);
    });
    return out;
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
    reviewOf: reviewOf,
    letter: letter
  };
});
