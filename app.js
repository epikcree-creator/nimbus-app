/* Nimbus Android PWA — polls desk JSON from DATA_BASE in URL fragment */
(function () {
  var POLL_MS = 15000;
  var LS_BASE = "nimbus_data_base";
  var LS_TOKEN = "nimbus_app_token";

  function parseFragment() {
    var hash = (location.hash || "").replace(/^#/, "");
    if (!hash) return {};
    var out = {};
    hash.split("&").forEach(function (pair) {
      var i = pair.indexOf("=");
      if (i < 0) return;
      var k = decodeURIComponent(pair.slice(0, i));
      var v = decodeURIComponent(pair.slice(i + 1));
      out[k] = v;
    });
    return out;
  }

  function loadConfig() {
    var frag = parseFragment();
    if (frag.d) {
      try { localStorage.setItem(LS_BASE, frag.d); } catch (e) {}
    }
    if (frag.t) {
      try { localStorage.setItem(LS_TOKEN, frag.t); } catch (e) {}
    }
    if (frag.d || frag.t) {
      try {
        history.replaceState(null, "", location.pathname + location.search);
      } catch (e) {}
    }
    var base = null;
    var token = null;
    try {
      base = localStorage.getItem(LS_BASE);
      token = localStorage.getItem(LS_TOKEN);
    } catch (e) {}
    return { dataBase: base || null, appToken: token || null };
  }

  function $(id) { return document.getElementById(id); }

  function showEmpty() {
    $("empty").hidden = false;
    $("desk").hidden = true;
  }

  function showDesk() {
    $("empty").hidden = true;
    $("desk").hidden = false;
  }

  function fmtUsd(n) {
    var x = Number(n);
    if (!isFinite(x)) return "—";
    return "$" + x.toFixed(2);
  }

  function renderState(state) {
    showDesk();
    var mode = (state && state.mode) || "PAPER";
    $("mode-tag").textContent = mode;

    var equityNow = state && (state.equity_usd != null
      ? state.equity_usd
      : (Array.isArray(state.equity) && state.equity.length ? state.equity[state.equity.length - 1] : 0));
    var line = $("status-line");
    var parts = ["Equity " + fmtUsd(equityNow)];
    if (state && state.updated_at) parts.push("uppdaterad " + state.updated_at);
    line.textContent = parts.join(" · ");

    var series = (state && state.equity) || [];
    if (window.NimbusChart) {
      window.NimbusChart.draw($("chart"), series);
    }

    var hbEl = $("heartbeats");
    if (hbEl) {
      hbEl.innerHTML = "";
      var hb = (state && state.heartbeats) || {};
      var names = Object.keys(hb);
      if (!names.length) {
        var emptyHb = document.createElement("li");
        emptyHb.textContent = "Inga agent-heartbeats ännu";
        hbEl.appendChild(emptyHb);
      } else {
        names.forEach(function (name) {
          var li = document.createElement("li");
          li.textContent = name + ": " + hb[name];
          hbEl.appendChild(li);
        });
      }
    }

    var ul = $("positions");
    ul.innerHTML = "";
    var positions = (state && state.positions) || [];
    if (!positions.length) {
      var li = document.createElement("li");
      li.textContent = "Inga öppna positioner";
      ul.appendChild(li);
      return;
    }
    positions.forEach(function (p) {
      var li = document.createElement("li");
      li.textContent = (p.symbol || p.mint || "?") + " · " + (p.side || "") + " · " + (p.pnl || "");
      ul.appendChild(li);
    });
  }

  function fetchJson(url) {
    return fetch(url, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("http " + r.status);
      return r.json();
    });
  }

  function poll(cfg) {
    if (!cfg.dataBase) {
      showEmpty();
      return;
    }
    var base = cfg.dataBase.replace(/\/$/, "");
    var url = base + "/state.json";
    fetchJson(url)
      .then(function (state) { renderState(state); })
      .catch(function () { showEmpty(); });
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(function () {});
  }

  var cfg = loadConfig();
  poll(cfg);
  setInterval(function () { poll(cfg); }, POLL_MS);
})();
