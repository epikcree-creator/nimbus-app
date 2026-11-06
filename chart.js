/* Hand-drawn canvas charts */
window.NimbusChart = {
  draw: function (canvas, series) {
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext("2d");
    var w = canvas.width, h = canvas.height;
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, w, h);
    if (!series || !series.length) {
      ctx.fillStyle = "#555";
      ctx.font = "14px sans-serif";
      ctx.fillText("Ingen equity ännu", 16, h / 2);
      return;
    }
    var min = Math.min.apply(null, series);
    var max = Math.max.apply(null, series);
    var span = (max - min) || 1;
    ctx.strokeStyle = "#7b5cff";
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.beginPath();
    series.forEach(function (v, i) {
      var x = (i / Math.max(series.length - 1, 1)) * (w - 24) + 12;
      var y = h - 12 - ((v - min) / span) * (h - 24);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
};
