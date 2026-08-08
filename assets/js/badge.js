/* ==========================================================================
   badge.js — draws a shareable 1200x1200 achievement badge on a canvas.
   Brand rules applied: Dark Forest field, Sunset Yellow accent numeral
   (accent colors are headline text only), Sand rule lines, no Deep Orange
   (action color stays reserved for interactive elements).
   ========================================================================== */
(function (global) {
  'use strict';

  var C = {
    forest: '#1B4532',
    darkerForest: '#163728',
    sand: '#D1CCBD',
    white: '#FFFFFF',
    yellow: '#F9D635',
    darkGray: '#25282A'
  };

  var DISPLAY = '"Dharma Gothic E","Oswald","Archivo Narrow",Impact,sans-serif';
  var BODY = '"Clearface","Source Serif 4",Georgia,serif';
  var CAPTION = '"Frutiger","Inter",system-ui,sans-serif';

  function wrapText(ctx, text, maxWidth) {
    var words = String(text).split(/\s+/), lines = [], line = '';
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line); line = words[i];
      } else { line = test; }
    }
    if (line) lines.push(line);
    return lines;
  }

  /**
   * @param {Object} o {score, total, tier, line, quizTitle, photo (HTMLImageElement|null)}
   * @returns {HTMLCanvasElement}
   */
  function drawBadge(o) {
    var S = 1200;
    var cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    var ctx = cv.getContext('2d');

    // Field
    ctx.fillStyle = C.forest;
    ctx.fillRect(0, 0, S, S);

    // Optional archival photograph, duotoned into the field
    if (o.photo && o.photo.complete && o.photo.naturalWidth) {
      var iw = o.photo.naturalWidth, ih = o.photo.naturalHeight;
      var scale = Math.max(S / iw, S / ih);
      var dw = iw * scale, dh = ih * scale;
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.drawImage(o.photo, (S - dw) / 2, (S - dh) / 2 - S * 0.06, dw, dh);
      ctx.restore();
      // duotone the photograph into the brand green
      ctx.save();
      ctx.globalCompositeOperation = 'color';
      ctx.fillStyle = C.forest;
      ctx.fillRect(0, 0, S, S);
      ctx.restore();
      // wash back so type stays legible
      var g = ctx.createLinearGradient(0, 0, 0, S);
      g.addColorStop(0, 'rgba(27,69,50,0.62)');
      g.addColorStop(0.34, 'rgba(27,69,50,0.50)');
      g.addColorStop(0.62, 'rgba(22,55,40,0.86)');
      g.addColorStop(1, 'rgba(22,55,40,0.98)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
    }

    // Inset keyline
    ctx.strokeStyle = 'rgba(209,204,189,0.55)';
    ctx.lineWidth = 3;
    ctx.strokeRect(48, 48, S - 96, S - 96);

    ctx.textAlign = 'center';

    // Overline
    ctx.fillStyle = C.sand;
    ctx.font = '700 30px ' + CAPTION;
    ctx.letterSpacing = '8px';
    ctx.fillText('THEODORE ROOSEVELT PRESIDENTIAL LIBRARY', S / 2, 152);
    ctx.letterSpacing = '0px';

    // Quiz title
    ctx.fillStyle = C.white;
    ctx.font = '700 62px ' + DISPLAY;
    var titleLines = wrapText(ctx, String(o.quizTitle || '').toUpperCase(), S - 220);
    var ty = 246;
    titleLines.slice(0, 2).forEach(function (l) { ctx.fillText(l, S / 2, ty); ty += 64; });

    // Rule
    ctx.strokeStyle = 'rgba(209,204,189,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(S / 2 - 110, ty + 6); ctx.lineTo(S / 2 + 110, ty + 6); ctx.stroke();

    // Score — measured so the numeral pair sits optically centered
    ctx.textAlign = 'left';
    ctx.font = '700 300px ' + DISPLAY;
    var wBig = ctx.measureText(String(o.score)).width;
    ctx.font = '700 130px ' + DISPLAY;
    var wSm = ctx.measureText('/' + o.total).width;
    var x0 = (S - (wBig + 22 + wSm)) / 2;
    ctx.fillStyle = C.yellow;
    ctx.font = '700 300px ' + DISPLAY;
    ctx.fillText(String(o.score), x0, 632);
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.font = '700 130px ' + DISPLAY;
    ctx.fillText('/' + o.total, x0 + wBig + 22, 632);
    ctx.textAlign = 'center';

    // Tier
    ctx.fillStyle = C.white;
    ctx.font = '700 96px ' + DISPLAY;
    var tierLines = wrapText(ctx, String(o.tier || '').toUpperCase(), S - 200);
    var yy = 760;
    tierLines.slice(0, 2).forEach(function (l) { ctx.fillText(l, S / 2, yy); yy += 96; });

    // Tier line
    ctx.fillStyle = 'rgba(255,255,255,0.86)';
    ctx.font = 'italic 40px ' + BODY;
    var lineLines = wrapText(ctx, o.line || '', S - 260);
    var ly = yy + 18;
    lineLines.slice(0, 2).forEach(function (l) { ctx.fillText(l, S / 2, ly); ly += 52; });

    // Footer
    ctx.fillStyle = C.sand;
    ctx.font = '700 30px ' + CAPTION;
    ctx.letterSpacing = '5px';
    ctx.fillText('QUIZ.LABS.TRLIBRARY.COM', S / 2, S - 96);
    ctx.letterSpacing = '0px';

    return cv;
  }

  function download(canvas, filename) {
    canvas.toBlob(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = filename || 'trpl-quiz-badge.png';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    }, 'image/png');
  }

  global.TRPLBadge = { draw: drawBadge, download: download };
})(window);
