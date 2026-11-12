/* Premium northern-lights canvas: stars, flowing aurora curtains, grain,
   rare ambient shooting stars. ~30fps, pauses when the tab is hidden. No WebGL. */
(function (g) {
  "use strict";

  function reducedMotion() {
    return !!(g.matchMedia && g.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function mulberry32(a) {
    return function () {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function buildGrain(size) {
    var c = document.createElement("canvas");
    c.width = c.height = size;
    var x = c.getContext("2d"), img = x.createImageData(size, size), d = img.data;
    var rnd = mulberry32(0xA0E0BA);
    for (var i = 0; i < d.length; i += 4) {
      var v = 235 + Math.floor(rnd() * 20);
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 22 + Math.floor(rnd() * 18);
    }
    x.putImageData(img, 0, 0);
    return c;
  }

  function bootAurora(host, opts) {
    opts = opts || {};
    if (!host) return { stop: function () {}, pause: function () {}, resume: function () {} };

    var canvas = document.createElement("canvas");
    canvas.className = "oc-aurora";
    canvas.setAttribute("aria-hidden", "true");
    host.insertBefore(canvas, host.firstChild);
    var ctx = canvas.getContext("2d", { alpha: true });

    var buf = document.createElement("canvas");
    var bctx = buf.getContext("2d", { alpha: true });
    var grain = buildGrain(128);

    var stars = [];
    var streaks = [];
    var raf = 0, running = false, last = 0, acc = 0;
    var t0 = 0, w = 0, h = 0, bw = 0, bh = 0, dpr = 1;
    var reduce = reducedMotion();
    var nextStreakAt = 0;

    function resize() {
      var r = host.getBoundingClientRect();
      w = Math.max(1, Math.round(r.width));
      h = Math.max(1, Math.round(r.height));
      dpr = Math.min(opts.dpr || (g.devicePixelRatio || 1), 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      /* Half-res buffer for soft aurora. */
      bw = Math.max(1, Math.round(w * 0.55));
      bh = Math.max(1, Math.round(h * 0.55));
      buf.width = bw;
      buf.height = bh;
      seedStars();
    }

    function seedStars() {
      var rnd = mulberry32(0x5EED + (w * 13 + h));
      var n = Math.round(90 + w * 0.12);
      stars = [];
      for (var i = 0; i < n; i++) {
        var bright = rnd() < 0.08;
        stars.push({
          x: rnd(),
          y: rnd() * 0.72,
          r: bright ? (1.15 + rnd() * 0.7) : (0.35 + rnd() * 0.55),
          a: bright ? (0.7 + rnd() * 0.3) : (0.22 + rnd() * 0.45),
          tw: 0.4 + rnd() * 1.6,
          ph: rnd() * Math.PI * 2,
          spark: bright && rnd() < 0.55
        });
      }
    }

    function ribbonY(x, t, layer, width) {
      return layer.y * bh
        + Math.sin(x * layer.f1 + t * layer.s1 + layer.p) * layer.a1
        + Math.sin(x * layer.f2 + t * layer.s2 + layer.p * 1.7) * layer.a2
        + Math.sin(x * layer.f3 + t * layer.s3) * layer.a3;
    }

    var LAYERS = [
      /* thin upper violet fringe only */
      { y: 0.07, h: 0.16, a1: 12, a2: 7, a3: 4, f1: 0.009, f2: 0.019, f3: 0.036,
        s1: 0.16, s2: 0.20, s3: 0.12, p: 1.6, fold: 6,
        c0: "rgba(170, 120, 255, 0.00)", c1: "rgba(168, 120, 255, 0.11)", c2: "rgba(120, 80, 210, 0.02)" },
      /* vivid green core — #3DFF8F */
      { y: 0.14, h: 0.40, a1: 24, a2: 13, a3: 7, f1: 0.010, f2: 0.021, f3: 0.039,
        s1: 0.17, s2: 0.23, s3: 0.29, p: 0.2, fold: 14,
        c0: "rgba(61, 255, 143, 0.00)", c1: "rgba(61, 255, 143, 0.30)", c2: "rgba(30, 190, 110, 0.05)" },
      /* second core — #2EF5A0, slightly lower */
      { y: 0.18, h: 0.36, a1: 22, a2: 12, a3: 6, f1: 0.008, f2: 0.017, f3: 0.033,
        s1: 0.19, s2: 0.27, s3: 0.14, p: 2.4, fold: 12,
        c0: "rgba(46, 245, 160, 0.00)", c1: "rgba(46, 245, 160, 0.24)", c2: "rgba(28, 180, 120, 0.04)" },
      /* lower soft green veil, modest so typography stays crisp */
      { y: 0.26, h: 0.28, a1: 16, a2: 8, a3: 4, f1: 0.007, f2: 0.016, f3: 0.029,
        s1: 0.14, s2: 0.18, s3: 0.22, p: 3.4, fold: 8,
        c0: "rgba(80, 255, 170, 0.00)", c1: "rgba(61, 255, 143, 0.10)", c2: "rgba(30, 160, 100, 0.025)" }
    ];

    function softGlow(x, y, rx, ry, color) {
      var gdt = bctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
      gdt.addColorStop(0, color);
      gdt.addColorStop(1, "rgba(0,0,0,0)");
      bctx.fillStyle = gdt;
      bctx.save();
      bctx.translate(x, y);
      bctx.scale(rx / 100, ry / 100);
      bctx.beginPath();
      bctx.arc(0, 0, 100, 0, Math.PI * 2);
      bctx.fill();
      bctx.restore();
    }

    function drawAurora(t) {
      bctx.clearRect(0, 0, bw, bh);
      bctx.globalCompositeOperation = "lighter";
      /* Soft volumes first, so ribbons sit in a glow rather than hard bands. */
      var gx = bw * (0.42 + Math.sin(t * 0.11) * 0.06);
      var gy = bh * (0.22 + Math.cos(t * 0.09) * 0.03);
      softGlow(gx, gy, bw * 0.58, bh * 0.34, "rgba(61, 255, 143, 0.26)");
      softGlow(gx + bw * 0.16, gy - bh * 0.02, bw * 0.42, bh * 0.26, "rgba(46, 245, 160, 0.20)");
      softGlow(gx - bw * 0.12, gy + bh * 0.04, bw * 0.36, bh * 0.22, "rgba(80, 255, 170, 0.10)");
      /* thin upper violet fringe — keep small and high */
      softGlow(bw * (0.48 + Math.sin(t * 0.07) * 0.04), bh * 0.10,
        bw * 0.32, bh * 0.13, "rgba(168, 120, 255, 0.10)");
      var step = 3;
      for (var li = 0; li < LAYERS.length; li++) {
        var L = LAYERS[li];
        bctx.beginPath();
        var started = false;
        for (var x = -20; x <= bw + 20; x += step) {
          var y = ribbonY(x, t, L);
          if (!started) { bctx.moveTo(x, y); started = true; }
          else bctx.lineTo(x, y);
        }
        for (var x2 = bw + 20; x2 >= -20; x2 -= step) {
          var y2 = ribbonY(x2, t, L) + L.h * bh
            + Math.sin(x2 * 0.018 + t * 0.2 + L.p) * 10;
          bctx.lineTo(x2, y2);
        }
        bctx.closePath();
        var gdt = bctx.createLinearGradient(0, L.y * bh - 20, 0, (L.y + L.h) * bh + 30);
        gdt.addColorStop(0, L.c0);
        gdt.addColorStop(0.22, L.c1);
        gdt.addColorStop(0.72, L.c2);
        gdt.addColorStop(1, "rgba(0,0,0,0)");
        bctx.fillStyle = gdt;
        bctx.fill();

        /* curtain folds: faint vertical sheens along the ribbon */
        bctx.save();
        bctx.clip();
        for (var k = 0; k < 5; k++) {
          var fx = ((k * 0.23 + 0.08) + Math.sin(t * 0.05 + L.p + k * 1.3) * 0.06) * bw;
          var hw = 22 + (k % 3) * 10;
          var foldG = bctx.createLinearGradient(fx - hw, 0, fx + hw, 0);
          foldG.addColorStop(0, "rgba(255,255,255,0)");
          foldG.addColorStop(0.5, "rgba(255,255,255,0.028)");
          foldG.addColorStop(1, "rgba(255,255,255,0)");
          bctx.fillStyle = foldG;
          bctx.fillRect(fx - hw, 0, hw * 2, bh);
        }
        bctx.restore();
      }
      bctx.globalCompositeOperation = "source-over";
    }

    function drawStars(ctx2, time, twinkle) {
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        var a = s.a;
        if (twinkle) a *= 0.72 + 0.28 * Math.sin(time * s.tw + s.ph);
        var sx = s.x * w, sy = s.y * h;
        ctx2.fillStyle = "rgba(230, 236, 255," + a.toFixed(3) + ")";
        ctx2.beginPath();
        ctx2.arc(sx, sy, s.r, 0, Math.PI * 2);
        ctx2.fill();
        if (s.spark) {
          ctx2.strokeStyle = "rgba(230, 236, 255," + (a * 0.55).toFixed(3) + ")";
          ctx2.lineWidth = 0.6;
          ctx2.beginPath();
          var arm = s.r * 3.2;
          ctx2.moveTo(sx - arm, sy); ctx2.lineTo(sx + arm, sy);
          ctx2.moveTo(sx, sy - arm); ctx2.lineTo(sx, sy + arm);
          ctx2.stroke();
        }
      }
    }

    function maybeSpawnStreak(time) {
      if (reduce || opts.noStreaks) return;
      if (time < nextStreakAt) return;
      nextStreakAt = time + 7 + Math.random() * 9;
      var fromL = Math.random() < 0.6;
      streaks.push({
        x: fromL ? (-0.05 + Math.random() * 0.45) * w : (0.4 + Math.random() * 0.5) * w,
        y: (0.06 + Math.random() * 0.22) * h,
        vx: (fromL ? 1 : -1) * (220 + Math.random() * 160),
        vy: 90 + Math.random() * 80,
        life: 0,
        dur: 0.7 + Math.random() * 0.45,
        len: 70 + Math.random() * 50
      });
    }

    function drawStreaks(dt, time) {
      var keep = [];
      for (var i = 0; i < streaks.length; i++) {
        var s = streaks[i];
        s.life += dt;
        var p = s.life / s.dur;
        if (p >= 1) continue;
        var fade = p < 0.15 ? p / 0.15 : (1 - p);
        var x = s.x + s.vx * s.life;
        var y = s.y + s.vy * s.life;
        var ang = Math.atan2(s.vy, s.vx);
        var lx = x - Math.cos(ang) * s.len;
        var ly = y - Math.sin(ang) * s.len;
        var grd = ctx.createLinearGradient(lx, ly, x, y);
        grd.addColorStop(0, "rgba(230,255,245,0)");
        grd.addColorStop(0.65, "rgba(200,255,230," + (0.45 * fade).toFixed(3) + ")");
        grd.addColorStop(1, "rgba(255,255,255," + (0.95 * fade).toFixed(3) + ")");
        ctx.strokeStyle = grd;
        ctx.lineWidth = 1.4;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255," + (0.9 * fade).toFixed(3) + ")";
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
        keep.push(s);
      }
      streaks = keep;
    }

    function paint(time, dt) {
      ctx.clearRect(0, 0, w, h);
      var t = reduce ? 8.4 : time;
      drawAurora(t);
      /* Soft upscale of the aurora buffer. */
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.filter = "blur(10px)";
      ctx.globalAlpha = 1;
      ctx.drawImage(buf, 0, 0, w, h * 0.80);
      ctx.filter = "none";

      /* Very faint reflection in the lower third (lake will sit on top via SVG). */
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.translate(0, h * 0.86);
      ctx.scale(1, -0.36);
      ctx.filter = "blur(12px)";
      ctx.drawImage(buf, 0, 0, w, h * 0.80);
      ctx.filter = "none";
      ctx.restore();
      ctx.globalAlpha = 1;

      drawStars(ctx, t, !reduce);
      if (!reduce) {
        maybeSpawnStreak(time);
        drawStreaks(dt, time);
      }

      /* Grain to kill banding. */
      var pat = ctx.createPattern(grain, "repeat");
      if (pat) {
        ctx.globalAlpha = 0.07;
        ctx.fillStyle = pat;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
      }
    }

    function frame(now) {
      if (!running) return;
      raf = g.requestAnimationFrame(frame);
      if (!t0) t0 = now;
      var time = (now - t0) / 1000;
      if (!last) last = now;
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      acc += dt;
      if (acc < 1 / 30) return;
      acc -= 1 / 30;
      paint(time, 1 / 30);
    }

    function start() {
      if (running) return;
      running = true;
      last = 0;
      raf = g.requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      if (raf) { g.cancelAnimationFrame(raf); raf = 0; }
    }
    function pause() { stop(); }
    function resume() { if (!reduce) start(); }

    resize();
    if (reduce) {
      paint(8.4, 0);
    } else {
      start();
    }
    if (typeof ResizeObserver !== "undefined") {
      var ro = new ResizeObserver(function () {
        resize();
        if (reduce) paint(8.4, 0);
      });
      ro.observe(host);
    }
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) pause();
      else resume();
    });

    return { stop: stop, pause: pause, resume: resume, resize: resize, canvas: canvas };
  }

  g.AuroraSky = { boot: bootAurora };
})(window);

/* t263: "djuphav" layout after Oscar's X reference video (kursormaxx). Layout and colours only.
   Every number comes from state.json; missing values read "saknas". PAPER only, no orders,
   no wallet copying. The video's simulated numbers are never shown.
   t274: decorative fish may swim; labels and badges only use real closed PAPER trades. */
(function (g) {
  "use strict";
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function num(v) { var n = Number(v); return v == null || v === "" || !isFinite(n) ? null : n; }
  function money(n) { return Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function usd(v) { var n = num(v); return n == null ? "saknas" : (n < 0 ? "-$" : "$") + money(n); }
  function sUsd(v) { var n = num(v); return n == null ? "saknas" : (n < 0 ? "-$" : "+$") + money(n); }
  function hm(iso) { var d = new Date(iso); if (!iso || isNaN(d)) return "saknas"; return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", hour: "2-digit", minute: "2-digit" }).format(d); }
  function intSv(v) { var n = num(v); return n == null ? "saknas" : Math.round(n).toLocaleString("sv-SE"); }
  function sym(s) { if (!s) return ""; return s.charAt(0) === "$" ? s : "$" + s; }

  /* Four real desk agents, in the video's card order (scan, check, trade, guard). */
  var CARDS = [
    { id: "lyssnare", n: "Lyssnare", c: "#3BA3FF" },
    { id: "kedjekoll", n: "Kedjekoll", c: "#FFD23F" },
    { id: "handlare", n: "Handlare", c: "#2EE6A0" },
    { id: "skeptiker", n: "Skeptiker", c: "#FF5C8A" }
  ];
  var NAME = { lyssnare: "Lyssnare", botjagare: "Botjägare", kedjekoll: "Kedjekoll", skeptiker: "Skeptiker", storlek: "Storlek", handlare: "Handlare", dagbok: "Dagbok" };
  var COLOR = { lyssnare: "#3BA3FF", botjagare: "#A98BFF", kedjekoll: "#FFD23F", skeptiker: "#FF5C8A", storlek: "#FFB547", handlare: "#2EE6A0", dagbok: "#8FA8FF" };

  function cardSub(id, st, box, agent) {
    switch (id) {
      case "lyssnare": return num(st.coins_per_hour) == null ? "saknas" : intSv(st.coins_per_hour) + "/h";
      case "kedjekoll": return num(st.passed_today) == null ? "saknas" : intSv(st.passed_today) + " godkända";
      case "skeptiker": return num(st.failed_today) == null ? "saknas" : intSv(st.failed_today) + " stopp";
      case "handlare": {
        var open = (box.open || []).length;
        if (open) return open + (open === 1 ? " öppen" : " öppna");
        return agent && agent.active ? "redo" : "vilar";
      }
    }
    return "saknas";
  }

  function fmtBalance(host, v) {
    var n = num(v);
    host.innerHTML = "";
    if (n == null) { host.appendChild(el("span", "oc-bal-i", "saknas")); host.classList.add("miss"); return; }
    host.classList.remove("miss");
    var s = money(n), cut = s.lastIndexOf(".");
    host.appendChild(el("span", "oc-bal-i", (n < 0 ? "-$" : "$") + s.slice(0, cut)));
    host.appendChild(el("span", "oc-bal-d", s.slice(cut)));
  }

  function feedRows(state, box) {
    var crew = box.crew || {};
    var evById = {};
    (box.events || []).forEach(function (e) { if (e && e.id != null) evById["tj:" + e.id] = e; });
    var rows = [];
    (crew.feed || []).forEach(function (f) {
      if (!f) return;
      var ev = evById[f.id];
      var r = { id: f.id, ts: f.ts, agent: f.agent, t: f.t || hm(f.ts), title: "", sub: f.text || "saknas", v: "", cls: "" };
      var who = NAME[f.agent] || f.agent || "saknas";
      if (ev && ev.action === "Köp") { r.title = "Köpte " + sym(ev.symbol || "saknas"); r.sub = who + " · PAPER · " + r.t; r.v = usd(ev.amount_usd); r.dir = "up"; }
      else if (ev && ev.action === "Sälj") { var p = num(ev.pnl_usd); r.title = "Sålde " + sym(ev.symbol || "saknas"); r.sub = who + " · " + (ev.reason_sv || "sälj") + " · " + r.t; r.v = sUsd(p); r.cls = p == null ? "" : p < 0 ? "down" : "up"; r.dir = "down"; }
      else {
        var txt = String(f.text || "saknas");
        if (f.symbol && txt.indexOf(f.symbol) === 0) txt = txt.slice(f.symbol.length).replace(/^\s*·\s*/, "");
        r.title = f.symbol ? who + " · " + sym(f.symbol) : who;
        r.sub = txt + " · " + r.t;
        r.v = f.verdict === "veto" ? "Stopp" : f.verdict === "pass" ? "Klar" : "";
        r.cls = f.verdict === "veto" ? "down" : f.verdict === "pass" ? "up" : "";
        r.dir = f.verdict === "veto" ? "down" : "up";
      }
      rows.push(r);
    });
    return rows;
  }

  var seen = null;
  function renderActivity(state, box) {
    var host = $("oc-act"); if (!host) return;
    var rows = feedRows(state, box).slice(0, 8);
    var n = num(box.closed_count != null ? box.closed_count : (box.trades || []).length);
    $("oc-act-n").textContent = n == null ? "saknas" : n + " stängda";
    var fresh = {};
    if (seen) rows.forEach(function (r) { if (!seen[r.id]) fresh[r.id] = 1; });
    seen = {}; rows.forEach(function (r) { seen[r.id] = 1; });
    host.innerHTML = "";
    if (!rows.length) { host.appendChild(el("p", "oc-empty", "Inga händelser än")); return; }
    rows.forEach(function (r) {
      var row = el("div", "oc-row" + (fresh[r.id] ? " in" : ""));
      var ic = el("span", "oc-row-ico"); ic.style.setProperty("--c", COLOR[r.agent] || "#7EC8E8");
      ic.appendChild(el("i")); row.appendChild(ic);
      var mid = el("div", "oc-row-mid"); mid.appendChild(el("strong", null, r.title)); mid.appendChild(el("span", null, r.sub)); row.appendChild(mid);
      if (r.v) row.appendChild(el("b", "oc-row-v " + r.cls, r.v));
      host.appendChild(row);
    });
  }

  function render(state) {
    if (!state || !$("oc-home")) return;
    document.body.classList.add("oc");
    var box = state.challenge || {}, crew = box.crew || {}, st = crew.stats || {};
    var ks = state.kill_switch || {};
    var locked = !!(ks.buys_locked || ks.locked);
    var live = String(state.mode || "PAPER").toUpperCase() === "LIVE";
    $("oc-sub").textContent = (live ? "LIVE låst" : "PAPER") + " · " + hm(state.updated_at);
    $("oc-mode").textContent = live ? "LIVE låst" : "PAPER";
    var pill = $("oc-live");
    var running = box.status === "running" && !locked;
    pill.className = "oc-pill oc-live" + (locked ? " lock" : running ? " on" : " done");
    pill.lastChild.textContent = locked ? "Köp låsta" : running ? "Live" : box.status === "finished" ? "Klar" : box.status === "paused" ? "Pausad" : "Vilar";

    var eq = num(box.equity_usd != null ? box.equity_usd : box.cash_usd);
    fmtBalance($("oc-bal"), eq);
    var put = num(box.put_in_usd), pnl = num(box.session_pnl_usd);
    if (pnl == null && eq != null && put != null) pnl = eq - put;
    var pct = pnl != null && put ? pnl / put * 100 : null;
    var ch = $("oc-chg");
    ch.className = "oc-chg " + (pnl != null && pnl < 0 ? "down" : "up");
    ch.textContent = pnl == null ? "saknas" : (pnl < 0 ? "▼ " : "▲ ") + sUsd(pnl) + (pct == null ? "" : " (" + (pct >= 0 ? "+" : "") + pct.toFixed(1) + "%)");
    var m = num(box.multiplier), mp = $("oc-mult");
    mp.textContent = m == null ? "saknas" : m.toFixed(2) + "×";
    mp.className = "oc-mult" + (m == null ? " miss" : m < 1 ? " down" : "");

    var max = num(box.max_open), open = box.open || [];
    var dots = $("oc-dots"); dots.innerHTML = "";
    var nd = max == null ? 0 : Math.min(10, Math.max(0, Math.round(max)));
    for (var i = 0; i < nd; i++) {
      var p = open[i], d = el("i");
      if (p) { var pp = num(p.pnl_usd); d.className = pp != null && pp < 0 ? "red" : "on"; }
      dots.appendChild(d);
    }
    $("oc-dots-n").textContent = max == null ? "saknas" : open.length + "/" + Math.round(max);

    /* Speech bubble: the kill switch first, else the newest real agent line. */
    var say = $("oc-say"), sayW = $("oc-say-w");
    var f0 = (crew.feed || [])[0];
    if (locked) { say.textContent = "Köp låsta · " + (ks.reason_sv || "kill switch"); sayW.className = "oc-say lock"; }
    else if (f0) { say.textContent = (NAME[f0.agent] || f0.agent) + ": " + String(f0.text || "saknas"); sayW.className = "oc-say"; }
    else { say.textContent = "Väntar på desken"; sayW.className = "oc-say"; }

    /* Agent cards: the most recently active of the four is lit, like the video's highlighted card. */
    var agents = {}; (crew.agents || []).forEach(function (a) { agents[a.id] = a; });
    var lastTs = {}; (crew.feed || []).forEach(function (f) { var t = Date.parse(f.ts || ""); if (isFinite(t) && !(lastTs[f.agent] > t)) lastTs[f.agent] = t; });
    var lit = null, best = 0;
    CARDS.forEach(function (c) { if (agents[c.id] && agents[c.id].active && lastTs[c.id] > best) { best = lastTs[c.id]; lit = c.id; } });
    var host = $("oc-cards"); host.innerHTML = "";
    CARDS.forEach(function (c) {
      var a = agents[c.id];
      var card = el("button", "oc-card" + (c.id === lit ? " lit" : "") + (a && !a.active ? " idle" : ""));
      card.type = "button"; card.style.setProperty("--c", c.c);
      card.addEventListener("click", function () { if (g.DegenUI) g.DegenUI.go("agents"); });
      var h = el("span", "oc-card-h"); h.appendChild(el("i")); h.appendChild(el("strong", null, c.n)); card.appendChild(h);
      var subTxt = a ? cardSub(c.id, st, box, a) : "saknas";
      var sEl = el("span", "oc-card-s", subTxt); sEl.title = subTxt + (c.id === "lyssnare" ? " (mynt per timme)" : c.id === "kedjekoll" ? " idag" : c.id === "skeptiker" ? "ade idag" : ""); card.appendChild(sEl);
      host.appendChild(card);
    });

    renderActivity(state, box);
    renderSheet(state, box);
    paintTabs();
    syncFish(box);
  }

  /* ---------- summary sheet (white, bottom) ---------- */
  function renderSheet(state, box) {
    var r = box.recap || {};
    var put = num(r.put_in_usd != null ? r.put_in_usd : box.put_in_usd);
    var now = num(r.now_worth_usd != null ? r.now_worth_usd : box.equity_usd);
    var gain = put != null && now != null ? now - put : null;
    var span = (r.started_at_stockholm && r.ends_at_stockholm) ? String(r.started_at_stockholm).slice(11, 16) + "–" + String(r.ends_at_stockholm).slice(11, 16) : "tid saknas";
    var trades = num(r.trades), coins = num(r.coins);
    $("oc-sh-sub").textContent = "Senaste utmaningen · " + span + " · " + (coins == null ? "mynt saknas" : intSv(coins) + " mynt granskade");
    var big = $("oc-sh-big");
    big.textContent = gain == null ? "saknas" : sUsd(gain);
    big.className = "oc-sh-big" + (gain == null ? " miss" : gain < 0 ? " down" : "");
    $("oc-sh-from").textContent = usd(put) + " → " + usd(now);
    var m = num(r.multiplier != null ? r.multiplier : box.multiplier);
    $("oc-sh-mult").textContent = m == null ? "saknas" : m.toFixed(2) + "×";
    var wins = num(r.wins != null ? r.wins : box.wins), losses = num(r.losses != null ? r.losses : box.losses);
    $("oc-sh-t").textContent = trades == null ? "saknas" : String(trades);
    $("oc-sh-w").textContent = wins == null ? "saknas" : String(wins);
    $("oc-sh-l").textContent = losses == null ? "saknas" : String(losses);
    var live = String(state.mode || "PAPER").toUpperCase() === "LIVE";
    var btn = $("oc-sh-btn");
    btn.disabled = live;
    btn.textContent = live ? "Riktiga pengar låsta" : "Ta ut · PAPER";
  }
  function openSheet() { var s = $("oc-sheet"); if (!s) return; s.hidden = false; requestAnimationFrame(function () { s.classList.add("open"); }); }
  function closeSheet() { var s = $("oc-sheet"); if (!s) return; s.classList.remove("open"); setTimeout(function () { s.hidden = true; }, 320); }

  /* ---------- tab bar (Hem · Agenter · Aktivitet · Plånbok) ---------- */
  var TAB_OF = { hav: "hav", agents: "agents", hem: "trades", trades: "trades", wallet: "wallet", planbok: "wallet" };
  function paintTabs() {
    var cur = g.DegenUI && g.DegenUI.current ? g.DegenUI.current() : "hav";
    var on = TAB_OF[cur] || "hav";
    document.querySelectorAll("#oc-tabs button").forEach(function (b) {
      var x = b.getAttribute("data-go") === on; b.classList.toggle("on", x); b.setAttribute("aria-current", x ? "page" : "false");
    });
  }
  function wire() {
    if (wire.done) return; wire.done = true;
    document.querySelectorAll("#oc-tabs button").forEach(function (b) {
      b.addEventListener("click", function () { if (g.DegenUI) g.DegenUI.go(b.getAttribute("data-go")); });
    });
    var p = $("dg-pager");
    if (p) { var raf = 0; p.addEventListener("scroll", function () { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; paintTabs(); }); }, { passive: true }); }
    var bal = $("oc-balwrap"); if (bal) bal.addEventListener("click", openSheet);
    var bd = $("oc-sheet-bd"); if (bd) bd.addEventListener("click", closeSheet);
    var hd = $("oc-sheet-handle"); if (hd) hd.addEventListener("click", closeSheet);
    var btn = $("oc-sh-btn");
    if (btn) btn.addEventListener("click", function () {
      var st = g.__nimbusLastState || {};
      if (String(st.mode || "PAPER").toUpperCase() === "LIVE") return;
      closeSheet();
      /* The existing PAPER withdraw sheet (slide to confirm). No real order exists here. */
      if (g.NimbusCash) g.NimbusCash.open("withdraw");
    });
    if (g.AuroraSky && $("oc-sea")) {
      try { g.AuroraSky.boot($("oc-sea")); } catch (e) { if (g.console) console.error(e); }
    }
    bootFish();
  }

  /* ---------- t274/t308 shooting stars: decorative unless a real closed PAPER trade is supplied ---------- */
  var WHALE = [
    { fill: "#7EF0D0", mid: "#3DFFB0", scale: 1, w: 132 },
    { fill: "#C8B6FF", mid: "#B090FF", scale: 1, w: 120 }
  ];
  var MAX_FISH = 2, SWIM_MS = 1400;
  var fishHost = null, liveFish = [], fishRaf = 0, spawnTimer = 0;
  var seenTrade = {}, tradeQueue = [], colorIx = 0, fishPaused = false, pauseAt = 0, fishWired = false;

  function reducedMotion() {
    return !!(g.matchMedia && g.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  var uid = 0;
  function starSvg(kind) {
    uid += 1;
    var gid = "ocstar" + uid;
    var tip, mid, core;
    if (kind === "shark") {
      tip = "#FFD0D8"; mid = "rgba(255,110,140,.75)"; core = "#FE4A4A";
    } else {
      tip = "#FFFFFF"; mid = "rgba(180,255,230,.8)"; core = "#E8FFF8";
    }
    return '<svg class="oc-critter oc-star" viewBox="0 0 160 28" overflow="visible">' +
      '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="0%" stop-color="' + mid + '" stop-opacity="0"/>' +
      '<stop offset="72%" stop-color="' + mid + '" stop-opacity=".85"/>' +
      '<stop offset="100%" stop-color="' + tip + '" stop-opacity="1"/>' +
      "</linearGradient></defs>" +
      '<path d="M4 14 L142 14" stroke="url(#' + gid + ')" stroke-width="2.2" stroke-linecap="round" fill="none"/>' +
      '<path d="M20 14 L142 14" stroke="url(#' + gid + ')" stroke-width="5" stroke-linecap="round" fill="none" opacity=".28"/>' +
      '<circle cx="148" cy="14" r="3.1" fill="' + tip + '"/>' +
      '<circle cx="148" cy="14" r="6" fill="' + core + '" opacity=".28"/>' +
      "</svg>";
  }
  function whaleSvg() { return starSvg("whale"); }
  function sharkSvg() { return starSvg("shark"); }
  function riderHtml() {
    return '<span class="oc-rider"><span class="oc-rider-av"><img src="icons/mark.png" alt="" width="28" height="28" /></span>' +
      '<span class="oc-rider-face"><i class="l"></i><i class="r"></i><b>^</b><b>^</b></span></span>';
  }
  /* Only closed challenge trades with a real symbol and a finite PnL. Nothing is invented. */
  function closedPaper(box) {
    var out = [];
    ((box && box.trades) || []).forEach(function (t) {
      if (!t) return;
      var p = num(t.pnl_usd != null ? t.pnl_usd : t.pnl);
      var s = t.symbol || t.token || "";
      if (typeof s !== "string") return;
      s = s.replace(/^\$/, "").trim();
      if (p == null || !s) return;
      var id = t.id != null ? "t:" + t.id : ("s:" + s + ":" + String(t.closed_at || t.ts || "") + ":" + p);
      out.push({ id: id, symbol: s, pnl: p, win: p >= 0 });
    });
    return out;
  }
  function syncFish(box) {
    closedPaper(box).forEach(function (r) {
      if (seenTrade[r.id]) return;
      seenTrade[r.id] = 1;
      tradeQueue.push(r);
    });
  }
  function setFishPaused(p) {
    if (p && !fishPaused) {
      pauseAt = performance.now();
      fishPaused = true;
      if (fishRaf) { cancelAnimationFrame(fishRaf); fishRaf = 0; }
    } else if (!p && fishPaused) {
      var dt = performance.now() - pauseAt;
      liveFish.forEach(function (f) { f.t0 += dt; });
      fishPaused = false;
      tickOn();
    }
  }
  function scareBot(on) {
    var bot = $("oc-bot"), eyes = $("oc-bot-eyes");
    if (bot) bot.classList.toggle("scared", !!on);
    if (eyes) eyes.hidden = !on;
  }
  function floatBadge(ev, color, x, ypx, loss) {
    if (!ev || !fishHost) return;
    var b = el("div", "oc-fbadge " + (loss ? "down" : "up"));
    if (!loss && color) b.style.setProperty("--c", color.fill);
    b.textContent = sym(ev.symbol) + " " + sUsd(ev.pnl);
    b.style.left = Math.round(x) + "px";
    b.style.top = Math.round(ypx) + "px";
    fishHost.appendChild(b);
    setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 1800);
  }
  function spawnOne(event) {
    if (reducedMotion() || !fishHost) return false;
    if (liveFish.length >= MAX_FISH) return false;
    var ev = event && event.symbol && event.pnl != null && isFinite(Number(event.pnl)) ? { symbol: String(event.symbol).replace(/^\$/, "").trim(), pnl: Number(event.pnl), win: event.win != null ? !!event.win : Number(event.pnl) >= 0, id: event.id } : null;
    if (ev && !ev.symbol) ev = null;
    if (!ev && Math.random() < 0.45) return false;
    var kind = ev ? (ev.win ? "whale" : "shark") : "whale";
    var color = WHALE[colorIx++ % WHALE.length];
    var dir = Math.random() < 0.62 ? 1 : -1;
    /* Upper/mid sky, a short diagonal streak. Badge still fires at mid-screen. */
    var y = 0.10 + Math.random() * 0.16;
    var w = ev ? 150 : 108;
    var wrap = el("div", "oc-swimmer " + kind + (ev ? " ev" : " deco"));
    wrap.style.width = w + "px";
    wrap.style.opacity = ev ? "1" : "0.72";
    var html = ev ? ('<span class="oc-flab">' + sym(ev.symbol) + "</span>") : "";
    html += kind === "whale" ? whaleSvg() : sharkSvg();
    wrap.innerHTML = html;
    var fall = 70 + Math.random() * 80;
    var travelGuess = (fishHost.clientWidth || g.innerWidth || 390) + w + 16;
    var ang = Math.atan2(fall, travelGuess) * (180 / Math.PI);
    var critter = wrap.querySelector(".oc-critter");
    if (critter) critter.style.transform = "rotate(" + (dir > 0 ? ang : 180 - ang) + "deg)";
    fishHost.appendChild(wrap);
    var startX = dir > 0 ? -w - 8 : (fishHost.clientWidth || g.innerWidth || 390) + 8;
    var rec = {
      el: wrap, ev: ev, kind: kind, dir: dir, x: startX, y: y, w: w, fall: fall,
      t0: performance.now(), mid: false, shot: false, dur: SWIM_MS + Math.round(Math.random() * 500 - 100),
      phase: 0, amp: 0, color: color
    };
    wrap.style.transform = "translate(" + rec.x.toFixed(1) + "px," + (rec.y * (fishHost.clientHeight || 844)).toFixed(1) + "px)";
    liveFish.push(rec);
    tickOn();
    return true;
  }
  function tick(now) {
    fishRaf = 0;
    if (fishPaused || reducedMotion() || !fishHost) return;
    var W = fishHost.clientWidth || g.innerWidth || 390;
    var H = fishHost.clientHeight || g.innerHeight || 844;
    var midX = W / 2, keep = [];
    for (var i = 0; i < liveFish.length; i++) {
      var f = liveFish[i], elapsed = now - f.t0, travel = W + f.w + 16;
      if (!f.shot) f.x = f.dir > 0 ? (-f.w + (elapsed / f.dur) * travel) : (W - (elapsed / f.dur) * travel);
      else f.x += f.dir * 22;
      var ypx = f.y * H + (elapsed / f.dur) * (f.fall || 0) + Math.sin(f.phase + elapsed / 340) * (f.amp || 0);
      f.el.style.transform = "translate(" + f.x.toFixed(1) + "px," + ypx.toFixed(1) + "px)";
      var cx = f.x + f.w / 2;
      if (!f.mid && ((f.dir > 0 && cx >= midX) || (f.dir < 0 && cx <= midX))) {
        f.mid = true;
        if (f.ev && f.kind === "whale") {
          f.el.classList.add("ride");
          floatBadge(f.ev, f.color, cx, ypx - 8, false);
        } else if (f.ev && f.kind === "shark") {
          f.el.classList.add("mad");
          f.shot = true;
          scareBot(true);
          setTimeout(function () { scareBot(false); }, 1200);
          floatBadge(f.ev, null, cx, ypx - 8, true);
        }
      }
      var gone = f.dir > 0 ? (f.x > W + 24) : (f.x < -f.w - 24);
      if (gone) { if (f.el.parentNode) f.el.parentNode.removeChild(f.el); }
      else keep.push(f);
    }
    liveFish = keep;
    if (liveFish.length) fishRaf = requestAnimationFrame(tick);
  }
  function tickOn() {
    if (!fishRaf && !fishPaused && !reducedMotion()) fishRaf = requestAnimationFrame(tick);
  }
  function bootFish() {
    if (fishWired) return;
    fishHost = $("oc-fish");
    if (!fishHost || reducedMotion()) return;
    fishWired = true;
    document.addEventListener("visibilitychange", function () { setFishPaused(document.hidden); });
    function loop() {
      spawnTimer = 0;
      if (!fishPaused && !document.hidden) spawnOne(tradeQueue.shift() || null);
      spawnTimer = setTimeout(loop, (tradeQueue.length ? 900 : 5000) + Math.random() * 3000);
    }
    spawnTimer = setTimeout(loop, 700);
  }

  function testReset() {
    liveFish.forEach(function (f) { if (f.el && f.el.parentNode) f.el.parentNode.removeChild(f.el); });
    liveFish = [];
    if (fishHost) fishHost.querySelectorAll(".oc-fbadge").forEach(function (b) { b.parentNode.removeChild(b); });
    scareBot(false);
    if (fishRaf) { cancelAnimationFrame(fishRaf); fishRaf = 0; }
  }

  g.OceanUI = {
    render: render, open: openSheet, close: closeSheet,
    /* Hooks for tests only. Production never calls these with invented numbers. */
    spawnFish: function (ev) { return spawnOne(ev || null); },
    _testReset: testReset
  };
  function hook() {
    if (!g.SwipeUI || g.SwipeUI.__oc) return;
    var r = g.SwipeUI.render;
    g.SwipeUI.render = function (s) { try { r(s); } catch (e) { if (g.console) console.error(e); } try { render(s); } catch (e2) { if (g.console) console.error(e2); } };
    g.SwipeUI.__oc = true;
  }
  wire();
  hook();
  if (g.__nimbusLastState) { try { render(g.__nimbusLastState); } catch (e) { if (g.console) console.error(e); } }
})(window);
