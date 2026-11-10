/* Hand-drawn canvas sparklines with gradient fill */
window.NimbusChart = {
  spark: function (canvas, series, color) {
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cssW = canvas.clientWidth || 160;
    var cssH = canvas.clientHeight || 36;
    canvas.width = Math.max(1, Math.floor(cssW * dpr));
    canvas.height = Math.max(1, Math.floor(cssH * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var w = cssW, h = cssH;
    ctx.clearRect(0, 0, w, h);
    if (!series || series.length < 2) { this.idle(canvas, color); return; }
    var pts = series.slice();
    var min = Math.min.apply(null, pts);
    var max = Math.max.apply(null, pts);
    var span = (max - min) || 1;
    var col = color || "#9CFF2E";
    var pad = 2;
    var coords = pts.map(function (v, i) {
      var x = pad + (i / Math.max(pts.length - 1, 1)) * (w - pad * 2);
      var y = h - pad - ((v - min) / span) * (h - pad * 2);
      return [x, y];
    });
    // fill
    var grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, this._alpha(col, 0.45));
    grad.addColorStop(1, this._alpha(col, 0.02));
    ctx.beginPath();
    coords.forEach(function (p, i) {
      if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
    });
    ctx.lineTo(coords[coords.length - 1][0], h);
    ctx.lineTo(coords[0][0], h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    // line
    ctx.beginPath();
    coords.forEach(function (p, i) {
      if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
    });
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.8;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
    // markers
    var last = coords[coords.length - 1];
    var mid = coords[Math.floor(coords.length * 0.62)];
    [[mid, 2.2], [last, 3]].forEach(function (pair) {
      var p = pair[0], r = pair[1];
      ctx.beginPath();
      ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p[0], p[1], r * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
    });
  },

  idle: function (canvas, color) {
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cssW = canvas.clientWidth || 160;
    var cssH = canvas.clientHeight || 36;
    canvas.width = Math.max(1, Math.floor(cssW * dpr));
    canvas.height = Math.max(1, Math.floor(cssH * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var w = cssW, h = cssH;
    ctx.clearRect(0, 0, w, h);
    var y = Math.floor(h * 0.55);
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = color || "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1.2;
    ctx.moveTo(4, y);
    ctx.lineTo(w - 4, y);
    ctx.stroke();
    ctx.setLineDash([]);
  },
  draw: function (canvas, series) {
    this.spark(canvas, series, "#9b6bff");
  },

  session: function (canvas, points, baseline, opts) {
    if (!canvas || !canvas.getContext) return;
    opts = opts || {};
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cssW = canvas.clientWidth || 360;
    var cssH = canvas.clientHeight || 120;
    canvas.width = Math.max(1, Math.floor(cssW * dpr));
    canvas.height = Math.max(1, Math.floor(cssH * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var w = cssW, h = cssH;
    ctx.clearRect(0, 0, w, h);
    var col = opts.color || "#1F6FE0";
    var padL = 6, padR = 6, padT = 8, padB = 8;
    var vals = (points || []).map(function (p) { return typeof p === "number" ? p : Number(p && p.v); }).filter(function (v) { return isFinite(v); });
    var base = (baseline == null || !isFinite(Number(baseline))) ? null : Number(baseline);
    if (base != null) vals = vals.concat([base]);
    if (!vals.length) {
      this.idle(canvas, "rgba(11,37,69,0.18)");
      return;
    }
    var min = Math.min.apply(null, vals);
    var max = Math.max.apply(null, vals);
    if (max === min) { max = min + 1; min = min - 1; }
    function yOf(v) {
      return padT + (1 - (v - min) / (max - min)) * (h - padT - padB);
    }
    // dotted put-in baseline
    if (base != null) {
      var yb = yOf(base);
      ctx.beginPath();
      ctx.setLineDash([3, 5]);
      ctx.strokeStyle = "rgba(11,37,69,0.28)";
      ctx.lineWidth = 1;
      ctx.moveTo(padL, yb);
      ctx.lineTo(w - padR, yb);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    var series = (points || []).map(function (p) { return typeof p === "number" ? p : Number(p && p.v); });
    var usable = series.filter(function (v) { return isFinite(v); });
    if (usable.length >= 2) {
      var coords = [];
      var n = series.length;
      for (var i = 0; i < n; i++) {
        if (!isFinite(series[i])) continue;
        var x = padL + (i / Math.max(n - 1, 1)) * (w - padL - padR);
        coords.push([x, yOf(series[i])]);
      }
      if (coords.length >= 2) {
        var grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, this._alpha(col, 0.22));
        grad.addColorStop(1, this._alpha(col, 0.02));
        ctx.beginPath();
        coords.forEach(function (p, i) { if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); });
        ctx.lineTo(coords[coords.length - 1][0], h - padB);
        ctx.lineTo(coords[0][0], h - padB);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.beginPath();
        coords.forEach(function (p, i) { if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); });
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.stroke();
        var last = coords[coords.length - 1];
        ctx.beginPath();
        ctx.arc(last[0], last[1], 3.2, 0, Math.PI * 2);
        ctx.fillStyle = "#fff";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(last[0], last[1], 2, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.fill();
      }
    } else if (usable.length === 1 && base != null) {
      // single point: short line at current value
      var y = yOf(usable[0]);
      ctx.beginPath();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
    }
  },
  _alpha: function (hex, a) {
    var h = (hex || "#9CFF2E").replace("#", "");
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    var n = parseInt(h, 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return "rgba(" + r + "," + g + "," + b + "," + a + ")";
  },
  _noise: function (n) {
    var out = [], v = 50;
    for (var i = 0; i < n; i++) {
      v += (Math.sin(i * 0.55) * 4) + ((i % 5) - 2);
      out.push(v);
    }
    return out;
  }
};
