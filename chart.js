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
    var pts = (series && series.length) ? series.slice() : this._noise(24);
    var min = Math.min.apply(null, pts);
    var max = Math.max.apply(null, pts);
    var span = (max - min) || 1;
    var col = color || "#ff7a1a";
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
  draw: function (canvas, series) {
    this.spark(canvas, series, "#9b6bff");
  },
  _alpha: function (hex, a) {
    var h = (hex || "#ff7a1a").replace("#", "");
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
