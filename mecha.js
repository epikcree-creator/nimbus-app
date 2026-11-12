/* PAWS mecha operator controller. 3D figure (mecha3d.js, three.js) that hovers between the app sections, idles,
   and points at a new PAPER trade. No WebGL -> static layered-SVG figure in the hero (same pointing logic).
   Pauses when the app is in the background; prefers-reduced-motion: no roaming/idle loops, pointing without flight. */
(function () {
  "use strict";
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (id) { return document.getElementById(id); };
  var mode = "init", stage = null, canvas = null, fig = null, slotSvg = null;
  var pos = { x: -300, y: 300, s: 1 }, vel = { x: 0, y: 0, s: 0 };
  var anchor = null, roamAt = 0, point = null, queue = [], raf = 0, lastT = 0, acc = 0, dirty = true, T0 = performance.now(), placed = false;
  var HERO_S = 0.96, SEC_S = 0.58;

  /* ---------- anchors ---------- */
  function visible(el) { return el && el.isConnected && el.offsetParent !== null; }
  function anchors() {
    var list = [], slot = $("mx-hero-slot");
    if (visible(slot)) list.push({ el: slot, hero: true });
    document.querySelectorAll(".page:not([hidden]) .sec-head[data-mx]").forEach(function (h) { if (visible(h)) list.push({ el: h }); });
    return list;
  }
  function onscreen(a) {
    var r = a.el.getBoundingClientRect(), H = window.innerHeight;
    return a.hero ? (r.bottom > 90 && r.top < H - 110) : (r.top >= 58 && r.bottom <= H - 84);
  }
  function aPoint(a) {
    var r = a.el.getBoundingClientRect();
    if (a.hero) return { x: r.left + r.width / 2 + 4, y: r.top + r.height / 2 + 6, s: HERO_S };
    return { x: Math.min(r.right - 46, window.innerWidth - 56), y: r.top + r.height / 2 - 2, s: SEC_S };
  }
  function nearest(list, y) {
    var best = null, bd = 1e9;
    list.forEach(function (a) { var d = Math.abs(a.el.getBoundingClientRect().top - y); if (d < bd) { bd = d; best = a; } });
    return best;
  }

  /* ---------- fallback (SVG) ---------- */
  function fallback() {
    if (mode === "svg") return;
    if (fig && fig.dispose) fig.dispose();
    fig = null; mode = "svg";
    if (stage) stage.style.display = "none";
    var slot = $("mx-hero-slot");
    if (!slot || !window.MechaArt) return;
    slot.innerHTML = MechaArt.svg(); slotSvg = slot.firstChild;
    start();
  }
  function svgFrame(aim) {
    if (!slotSvg) return { ok: false };
    var sh = slotSvg.querySelector(".mx-shoulder").getBoundingClientRect(), tip = slotSvg.querySelector(".mx-tip").getBoundingClientRect();
    var sx = sh.left + sh.width / 2, sy = sh.top + sh.height / 2;
    if (aim) {
      var th = Math.atan2(-(aim.x - sx), aim.y - sy) * 180 / Math.PI;
      th = Math.max(-40, Math.min(120, th));
      slotSvg.style.setProperty("--u", th.toFixed(1) + "deg"); slotSvg.style.setProperty("--f", "0deg"); slotSvg.style.setProperty("--fing", "1");
      slotSvg.style.setProperty("--ix", Math.max(-2, Math.min(2, (aim.x - sx) / 80)) + "px"); slotSvg.style.setProperty("--iy", "1.2px");
    } else {
      slotSvg.style.setProperty("--u", "3deg"); slotSvg.style.setProperty("--f", "-10deg"); slotSvg.style.setProperty("--fing", ".001");
      slotSvg.style.setProperty("--ix", "0px"); slotSvg.style.setProperty("--iy", "0px");
    }
    return { x: tip.left + tip.width / 2, y: tip.top + tip.height / 2, ok: !!aim };
  }

  /* ---------- 3D ---------- */
  function boot3d() {
    if (mode !== "init") return;
    try {
      stage = document.createElement("div"); stage.id = "mx-stage"; stage.setAttribute("aria-hidden", "true");
      canvas = document.createElement("canvas"); stage.appendChild(canvas); document.body.appendChild(stage);
      fig = PawsMecha3D.create({ canvas: canvas });
      fig.onLost(function () { fallback(); });
      mode = "3d"; start();
    } catch (e) {
      if (window.console) console.warn("mecha 3D unavailable, using static figure", e);
      if (stage && stage.parentNode) stage.parentNode.removeChild(stage);
      stage = null; fallback();
    }
  }

  /* ---------- FX overlay ---------- */
  function fx(on, tip, tx, ty, row, a) {
    var laser = $("mx-laser"), ret = $("mx-ret"), cal = $("mx-callout");
    if (!on) { laser.style.opacity = 0; ret.style.opacity = 0; cal.classList.remove("on"); return; }
    if (tip && tip.ok) {
      var dx = tx - tip.x, dy = ty - tip.y, L = Math.hypot(dx, dy) || 1, k = Math.max(0, (L - 6) / L);
      laser.setAttribute("x1", tip.x); laser.setAttribute("y1", tip.y); laser.setAttribute("x2", tip.x + dx * k); laser.setAttribute("y2", tip.y + dy * k);
      laser.style.opacity = a;
    }
    var r = row.getBoundingClientRect(), rr = ret.firstChild;
    rr.setAttribute("x", r.left - 4); rr.setAttribute("y", r.top - 4); rr.setAttribute("width", r.width + 8); rr.setAttribute("height", r.height + 8);
    ret.style.opacity = a * 0.0 + (reduce ? 0 : 0);
    cal.style.transform = "translate(" + Math.round(r.left + 10) + "px," + Math.round(r.top - 25) + "px)";
    cal.classList.add("on");
  }

  /* ---------- pointing jobs ---------- */
  function findRow(tr) {
    var r = null;
    if (tr.mint) r = document.querySelector('#open-list .row[data-mint="' + String(tr.mint).replace(/"/g, "") + '"]');
    if (!r && tr.id != null) r = document.querySelector('#recent-list .row[data-ev="' + tr.id + '"]');
    if (!r) r = document.querySelector("#open-list .row") || document.querySelector("#recent-list .row");
    return r;
  }
  function enqueue(trades) {
    trades.forEach(function (tr) { queue.push(tr); });
    if (!point) next();
  }
  function next() {
    if (point || !queue.length) return;
    if (document.hidden) { setTimeout(next, 1000); return; }
    var tr = queue.shift();
    if (window.Paws && Paws.currentTab() !== "home") Paws.showTab("home");
    setTimeout(function () {
      var row = findRow(tr); if (!row) { next(); return; }
      var r = row.getBoundingClientRect(), wait = 80;
      if (r.top < 70 || r.bottom > window.innerHeight - 96) { window.scrollTo({ top: Math.max(0, window.scrollY + r.top - 250), behavior: reduce ? "auto" : "smooth" }); wait = reduce ? 80 : 650; }
      setTimeout(function () {
        point = { tr: tr, row: row, phase: "fly", t0: now(), tAim: 0, label: sym(tr.symbol) + (tr.amount_usd != null ? " · $" + Number(tr.amount_usd).toFixed(2) : "") };
        $("mx-callout-t").textContent = point.label;
        row.classList.add("mx-hit");
        if (!raf) start();
      }, wait);
    }, 60);
  }
  function sym(s) { return s ? (String(s).charAt(0) === "$" ? s : "$" + s) : "ny trade"; }
  function endPoint() {
    if (!point) return;
    point.row.classList.remove("mx-hit"); fx(false); point = null; roamAt = now() + 5; dirty = true;
    setTimeout(next, 400);
  }
  function now() { return (performance.now() - T0) / 1000; }

  /* ---------- main loop ---------- */
  function tick(ts) {
    raf = requestAnimationFrame(tick);
    var dt = (ts - lastT) / 1000; lastT = ts; if (!(dt > 0)) return; if (dt > 0.1) dt = 0.1;
    var t = now(), busy = !!point || Math.hypot(vel.x, vel.y) > 6;
    if (!busy && !reduce) { acc += dt; if (acc < 1 / 30) return; dt = acc; acc = 0; }
    if (reduce && !busy && !dirty) return;
    dirty = false;

    /* choose / keep an anchor */
    var list = anchors(), vis = list.filter(onscreen);
    if (!anchor || !visible(anchor.el)) { anchor = vis[0] || list[0] || null; if (roamAt < t) roamAt = t + 5; }
    if (anchor && !reduce && !point) {
      var a = anchor, same = vis.filter(function (v) { return v.el === a.el; })[0];
      if (!same && vis.length) anchor = nearest(vis, pos.y);
      else if (same) {
        anchor = same;
        if (t > roamAt) {
          var others = vis.filter(function (v) { return v.el !== a.el; });
          if (others.length) anchor = others[Math.floor(Math.random() * others.length)];
          roamAt = t + 7 + Math.random() * 7;
        }
      }
    }
    if (point && point.phase === "fly") {
      var sec = point.row.closest(".sec"), head = sec && sec.querySelector(".sec-head[data-mx]");
      if (head) anchor = { el: head };
    }
    if (!anchor) return;
    var ap = aPoint(anchor);
    var wx = reduce ? 0 : Math.sin(t * 0.9) * 6, wy = reduce ? 0 : Math.cos(t * 1.3) * 4;
    if (reduce || !placed) { pos.x = ap.x; pos.y = ap.y; pos.s = ap.s; vel.x = vel.y = vel.s = 0; placed = true; }
    else {
      var k = 24, c = 2 * Math.sqrt(k) * 0.92;
      vel.x += (k * (ap.x + wx - pos.x) - c * vel.x) * dt; pos.x += vel.x * dt;
      vel.y += (k * (ap.y + wy - pos.y) - c * vel.y) * dt; pos.y += vel.y * dt;
      vel.s += (k * (ap.s - pos.s) - c * vel.s) * dt; pos.s += vel.s * dt;
    }

    /* pointing state machine */
    var aim = null, tx = 0, ty = 0;
    if (point) {
      if (!point.row.isConnected) { var nr = findRow(point.tr); if (nr) { point.row = nr; nr.classList.add("mx-hit"); } }
      var rr = point.row.getBoundingClientRect(); tx = rr.left + 40; ty = rr.top + rr.height / 2;
      var dist = Math.hypot(ap.x - pos.x, ap.y - pos.y), sp = Math.hypot(vel.x, vel.y);
      if (point.phase === "fly" && ((dist < 16 && sp < 70) || t - point.t0 > 1.8 || reduce)) { point.phase = "aim"; point.tAim = t; }
      if (point.phase === "aim") { aim = { x: tx, y: ty }; if (t - point.tAim > 3.6) { endPoint(); aim = null; } }
    }

    var tip;
    if (mode === "3d" && fig) {
      stage.style.transform = "translate3d(" + (pos.x - 120).toFixed(1) + "px," + (pos.y - 120).toFixed(1) + "px,0) scale(" + pos.s.toFixed(3) + ")";
      stage.classList.add("ready");
      tip = fig.frame({ t: t, dt: dt, vx: vel.x, vy: vel.y, scale: pos.s, aim: aim, still: reduce });
    } else if (mode === "svg") { tip = svgFrame(aim); }
    if (point && point.phase === "aim") {
      var el = t - point.tAim, a2 = Math.min(1, Math.max(0, (el - 0.3) / 0.25));
      fx(true, tip, tx, ty, point.row, a2);
      if (tip && tip.ok === false) fx(true, null, tx, ty, point.row, 0);
    } else if (!point) { /* ensure overlay is cleared */ }
  }
  function start() { if (raf) return; lastT = performance.now(); raf = requestAnimationFrame(tick); }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

  document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else if (mode === "3d" || mode === "svg") { acc = 0; start(); } });
  window.addEventListener("scroll", function () { dirty = true; }, { passive: true });
  window.addEventListener("resize", function () { dirty = true; });
  document.addEventListener("paws:tab", function () { dirty = true; anchor = null; placed = false; });

  window.PawsMecha = {
    boot3d: boot3d, fallback: fallback,
    point: function (trades) { enqueue(trades); },
    debug: function () { return { render: fig && fig.info ? fig.info() : null, mode: mode, pos: pos, vel: vel, anchor: anchor && (anchor.hero ? "hero" : anchor.el.textContent), pointing: point && point.phase, reduce: reduce }; }
  };
  var tries = 0;
  (function wire() {
    if (window.Paws) { Paws.onNewTrade(function (tr) { enqueue(tr); }); return; }
    if (tries++ < 50) setTimeout(wire, 100);
  })();
  /* If the 3D bundle is missing or slow, draw the static figure after 6 s so the hero is never empty. */
  setTimeout(function () { if (mode === "init") fallback(); }, 6000);
})();
