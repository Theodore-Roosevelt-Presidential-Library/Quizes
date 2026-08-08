/* ==========================================================================
   TRPL Quiz — embeddable player
   --------------------------------------------------------------------------
   Drop this anywhere on trlibrary.com:

     <div data-trpl-quiz="badlands"></div>
     <script src="https://quiz.labs.trlibrary.com/assets/js/embed.js" async></script>

   The quiz mounts into a shadow root, so Drupal and Bootstrap styles cannot
   reach in and these styles cannot leak out. Multiple quizzes per page are
   fine. The script tag only needs to appear once.

   Optional attributes on the mount div:
     data-share-url   override the URL used in share links
                      (default: the page the embed is sitting on)
     data-base        override the asset origin (default: where this file loaded from)

   API: TRPLQuiz.scan() re-scans the document for new mount points.
   ========================================================================== */
(function (global, doc) {
  'use strict';

  var LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

  /* Where our assets live — derived from this script's own URL so the embed
     works no matter what origin the host page is on. */
  var BASE = (function () {
    var s = doc.currentScript;
    if (!s) {
      var all = doc.getElementsByTagName('script');
      for (var i = all.length - 1; i >= 0; i--) {
        if (/embed\.js(\?|$)/.test(all[i].src)) { s = all[i]; break; }
      }
    }
    if (!s || !s.src) return '';
    return s.src.replace(/assets\/js\/embed\.js.*$/, '');
  })();

  function url(path) {
    return /^https?:\/\//.test(path) ? path : BASE + String(path).replace(/^\//, '');
  }

  /* ---------------------------------------------------------------------
     Fonts. @font-face declared inside a shadow root is ignored, so the faces
     have to be registered on the host document. Guarded so repeat embeds and
     re-scans only ever inject once. Falls back to the Oswald / Source Serif 4
     / Inter ladder the brand standards prescribe if the brand files are
     unavailable cross-origin.
     --------------------------------------------------------------------- */
  function installFonts() {
    if (doc.getElementById('trpl-quiz-fonts')) return;

    var gf = doc.createElement('link');
    gf.rel = 'stylesheet';
    gf.href = 'https://fonts.googleapis.com/css2?family=Oswald:wght@500;700' +
              '&family=Source+Serif+4:ital,wght@0,400;0,500;0,700;1,400' +
              '&family=Inter:wght@400;700&display=swap';
    doc.head.appendChild(gf);

    var T = 'https://www.trlibrary.com/themes/custom/trpl/css/';
    var faces = [
      ['Clearface', 400, 'normal', 'clearfacestd-regular'],
      ['Clearface', 400, 'italic', 'clearfacestd-italic'],
      ['Clearface', 500, 'normal', 'clearfacestd-bold'],
      ['Clearface', 700, 'normal', 'clearfacestd-heavy'],
      ['Dharma Gothic E', 700, 'normal', 'dharma_type-dharmagothice-bold'],
      ['Dharma Gothic E', 800, 'normal', 'dharma_type-dharmagothice-exbold'],
      ['Frutiger', 400, 'normal', 'frutigerltstd-regular'],
      ['Frutiger', 700, 'normal', 'frutigerltstd-bold']
    ];
    var css = faces.map(function (f) {
      return '@font-face{font-family:"' + f[0] + '";font-weight:' + f[1] +
             ';font-style:' + f[2] + ';font-display:swap;src:url("' + T + f[3] +
             '.woff2") format("woff2")}';
    }).join('');

    var st = doc.createElement('style');
    st.id = 'trpl-quiz-fonts';
    st.textContent = css;
    doc.head.appendChild(st);
  }

  /* ---------------------------------------------------------------------
     Badge — 1200x1200 canvas, drawn to brand.
     --------------------------------------------------------------------- */
  var BADGE = (function () {
    var FOREST = '#1B4532', SAND = '#D1CCBD', WHITE = '#FFFFFF', YELLOW = '#F9D635';
    var DISPLAY = '"Dharma Gothic E","Oswald","Archivo Narrow",Impact,sans-serif';
    var BODY = '"Clearface","Source Serif 4",Georgia,serif';
    var CAPTION = '"Frutiger","Inter",system-ui,sans-serif';

    function wrap(ctx, text, maxWidth) {
      var words = String(text || '').split(/\s+/), lines = [], line = '';
      for (var i = 0; i < words.length; i++) {
        var test = line ? line + ' ' + words[i] : words[i];
        if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = words[i]; }
        else { line = test; }
      }
      if (line) lines.push(line);
      return lines;
    }

    function draw(o) {
      var S = 1200;
      var cv = doc.createElement('canvas');
      cv.width = S; cv.height = S;
      var ctx = cv.getContext('2d');

      ctx.fillStyle = FOREST;
      ctx.fillRect(0, 0, S, S);

      if (o.photo && o.photo.complete && o.photo.naturalWidth) {
        var iw = o.photo.naturalWidth, ih = o.photo.naturalHeight;
        var sc = Math.max(S / iw, S / ih), dw = iw * sc, dh = ih * sc;
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.drawImage(o.photo, (S - dw) / 2, (S - dh) / 2 - S * 0.06, dw, dh);
        ctx.restore();
        ctx.save();
        ctx.globalCompositeOperation = 'color';
        ctx.fillStyle = FOREST;
        ctx.fillRect(0, 0, S, S);
        ctx.restore();
        var g = ctx.createLinearGradient(0, 0, 0, S);
        g.addColorStop(0, 'rgba(27,69,50,0.62)');
        g.addColorStop(0.34, 'rgba(27,69,50,0.50)');
        g.addColorStop(0.62, 'rgba(22,55,40,0.86)');
        g.addColorStop(1, 'rgba(22,55,40,0.98)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, S, S);
      }

      ctx.strokeStyle = 'rgba(209,204,189,0.55)';
      ctx.lineWidth = 3;
      ctx.strokeRect(48, 48, S - 96, S - 96);

      ctx.textAlign = 'center';
      ctx.fillStyle = SAND;
      ctx.font = '700 30px ' + CAPTION;
      if ('letterSpacing' in ctx) ctx.letterSpacing = '8px';
      ctx.fillText('THEODORE ROOSEVELT PRESIDENTIAL LIBRARY', S / 2, 152);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

      ctx.fillStyle = WHITE;
      ctx.font = '700 62px ' + DISPLAY;
      var ty = 246;
      wrap(ctx, String(o.quizTitle || '').toUpperCase(), S - 220).slice(0, 2)
        .forEach(function (l) { ctx.fillText(l, S / 2, ty); ty += 64; });

      ctx.strokeStyle = 'rgba(209,204,189,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(S / 2 - 110, ty + 6); ctx.lineTo(S / 2 + 110, ty + 6); ctx.stroke();

      // Score, measured so the numeral pair sits optically centered
      ctx.textAlign = 'left';
      ctx.font = '700 300px ' + DISPLAY;
      var wBig = ctx.measureText(String(o.score)).width;
      ctx.font = '700 130px ' + DISPLAY;
      var wSm = ctx.measureText('/' + o.total).width;
      var x0 = (S - (wBig + 22 + wSm)) / 2;
      ctx.fillStyle = YELLOW;
      ctx.font = '700 300px ' + DISPLAY;
      ctx.fillText(String(o.score), x0, 632);
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.font = '700 130px ' + DISPLAY;
      ctx.fillText('/' + o.total, x0 + wBig + 22, 632);
      ctx.textAlign = 'center';

      ctx.fillStyle = WHITE;
      ctx.font = '700 96px ' + DISPLAY;
      var yy = 760;
      wrap(ctx, String(o.tier || '').toUpperCase(), S - 200).slice(0, 2)
        .forEach(function (l) { ctx.fillText(l, S / 2, yy); yy += 96; });

      ctx.fillStyle = 'rgba(255,255,255,0.86)';
      ctx.font = 'italic 40px ' + BODY;
      var ly = yy + 18;
      wrap(ctx, o.line || '', S - 260).slice(0, 2)
        .forEach(function (l) { ctx.fillText(l, S / 2, ly); ly += 52; });

      ctx.fillStyle = SAND;
      ctx.font = '700 30px ' + CAPTION;
      if ('letterSpacing' in ctx) ctx.letterSpacing = '5px';
      ctx.fillText('TRLIBRARY.COM', S / 2, S - 96);
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

      return cv;
    }

    function download(canvas, filename) {
      canvas.toBlob(function (blob) {
        var u = URL.createObjectURL(blob);
        var a = doc.createElement('a');
        a.href = u; a.download = filename || 'trpl-quiz-badge.png';
        doc.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(u); }, 2000);
      }, 'image/png');
    }

    return { draw: draw, download: download };
  })();

  /* ---------------------------------------------------------------------
     One quiz instance.
     --------------------------------------------------------------------- */
  function Quiz(root, quiz, shareUrl) {
    this.root = root;         // shadow root
    this.quiz = quiz;
    this.shareUrl = shareUrl;
    this.index = 0;
    this.answers = [];
    this.locked = false;
  }

  Quiz.prototype.el = function (tag, attrs, kids) {
    var n = doc.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  };

  Quiz.prototype.score = function () {
    var q = this.quiz;
    return this.answers.reduce(function (n, a, i) {
      return n + (a === q.questions[i].answer ? 1 : 0);
    }, 0);
  };

  Quiz.prototype.tier = function (score) {
    var tiers = (this.quiz.tiers || []).slice().sort(function (a, b) { return b.min - a.min; });
    for (var i = 0; i < tiers.length; i++) if (score >= tiers[i].min) return tiers[i];
    return { name: '', line: '' };
  };

  /* Scroll the embed into view without hijacking the whole host page. */
  Quiz.prototype.reveal = function () {
    var host = this.root.host;
    var top = host.getBoundingClientRect().top;
    if (top < 0 || top > global.innerHeight * 0.5) {
      host.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  Quiz.prototype.mount = function (node) {
    var stage = this.root.getElementById('stage');
    stage.innerHTML = '';
    stage.appendChild(node);
  };

  Quiz.prototype.progress = function (visible) {
    var bar = this.root.getElementById('progress');
    bar.hidden = !visible;
    if (!visible) return;
    var total = this.quiz.questions.length;
    bar.querySelector('.progress__label').textContent =
      'Question ' + Math.min(this.index + 1, total) + ' of ' + total;
    bar.querySelector('.progress__fill').style.width =
      ((this.answers.length / total) * 100) + '%';
    bar.querySelector('.progress__score').textContent = this.score() + ' correct';
  };

  /* Two-column frame: media on the left, everything else on the right. */
  Quiz.prototype.frame = function (imgSrc, imgAlt, credit, panelKids) {
    var e = this.el.bind(this);
    var media = e('figure', { class: 'media' }, [
      e('img', { src: url(imgSrc), alt: imgAlt || '' })
    ]);
    if (credit) media.appendChild(e('figcaption', { class: 'caption', text: credit }));
    var panel = e('div', { class: 'panel' }, panelKids);
    return e('div', { class: 'grid pad' }, [media, panel]);
  };

  Quiz.prototype.renderIntro = function () {
    var self = this, e = this.el.bind(this), q = this.quiz;
    this.progress(false);

    var kids = [];
    if (q.subtitle) kids.push(e('span', { class: 'overline', text: q.subtitle }));
    kids.push(e('h2', { text: q.title }));
    kids.push(e('p', { class: 'lede', text: q.intro || '' }));

    var start = e('button', { class: 'btn btn-primary', type: 'button',
      text: 'Start the quiz — ' + q.questions.length + ' questions' });
    start.addEventListener('click', function () {
      self.index = 0; self.answers = []; self.renderQuestion();
    });
    kids.push(start);
    kids.push(e('span', { class: 'intro__note',
      text: 'You will see the answer and the story behind it after each question.' }));

    var box = e('div', { class: 'intro' }, [
      this.frame(q.heroImage, q.heroAlt, q.heroCredit, kids)
    ]);
    this.mount(box);
  };

  Quiz.prototype.renderQuestion = function () {
    var self = this, e = this.el.bind(this);
    var q = this.quiz.questions[this.index];
    this.locked = false;

    var list = e('ul', { class: 'options' });
    q.options.forEach(function (opt, i) {
      var btn = e('button', { class: 'option', type: 'button' }, [
        e('span', { class: 'option__key', text: LETTERS[i] }),
        e('span', { text: opt })
      ]);
      btn.addEventListener('click', function () { self.choose(i); });
      list.appendChild(e('li', {}, [btn]));
    });

    this.mount(e('div', {}, [
      this.frame(q.image, q.imageAlt, q.credit, [
        e('h3', { class: 'q-prompt', text: q.prompt }),
        list
      ]),
      e('div', { class: 'actions', id: 'actions' })
    ]));

    this.progress(true);
    this.reveal();
  };

  Quiz.prototype.choose = function (chosen) {
    if (this.locked) return;
    this.locked = true;
    var self = this, e = this.el.bind(this);
    this.answers[this.index] = chosen;

    var q = this.quiz.questions[this.index];
    var correct = chosen === q.answer;

    this.root.querySelectorAll('.option').forEach(function (b, i) {
      b.disabled = true;
      if (i === q.answer) b.classList.add('option--correct');
      else if (i === chosen) b.classList.add('option--wrong');
      else b.classList.add('option--muted');
    });

    var fb = e('div', { class: 'feedback' + (correct ? '' : ' feedback--wrong'),
      role: 'status', 'aria-live': 'polite' });
    fb.appendChild(e('p', { class: 'feedback__verdict', text: correct ? 'Correct.' : 'Not quite.' }));
    if (!correct) {
      fb.appendChild(e('p', { class: 'feedback__answer',
        text: 'The answer is ' + LETTERS[q.answer] + '. ' + q.options[q.answer] + '.' }));
    }
    fb.appendChild(e('p', { text: q.explanation }));
    if (q.link && q.link.url) {
      fb.appendChild(e('a', { class: 'feedback__link', href: q.link.url,
        target: '_blank', rel: 'noopener noreferrer',
        text: q.link.label || 'Learn more at trlibrary.com' }));
    }
    this.root.querySelector('.panel').classList.add('is-answered');
    this.root.querySelector('.options').after(fb);

    var last = this.index === this.quiz.questions.length - 1;
    var next = e('button', { class: 'btn btn-primary', type: 'button',
      text: last ? 'See your score' : 'Next question' });
    next.addEventListener('click', function () {
      if (last) { self.renderResults(); } else { self.index++; self.renderQuestion(); }
    });
    var actions = this.root.getElementById('actions');
    actions.appendChild(e('span', { class: 'caption',
      text: (this.index + 1) + ' of ' + this.quiz.questions.length + ' answered' }));
    actions.appendChild(next);

    this.progress(true);
    next.focus({ preventScroll: true });

    // Bring the explanation into view inside the panel, not the host page
    var panel = this.root.querySelector('.panel');
    if (panel && panel.scrollHeight > panel.clientHeight) {
      panel.scrollTo({ top: fb.offsetTop - 8, behavior: 'smooth' });
    }
  };

  Quiz.prototype.renderResults = function () {
    var self = this, e = this.el.bind(this), q = this.quiz;
    var score = this.score(), total = q.questions.length, tier = this.tier(score);
    var shareUrl = this.shareUrl;
    var shareText = ((q.badge && q.badge.shareText) ||
        'I scored {score}/{total} on the Theodore Roosevelt Presidential Library quiz — {tier}.')
      .replace('{score}', score).replace('{total}', total).replace('{tier}', tier.name);

    this.progress(false);

    /* Left column is the badge itself — it is the thing worth looking at. */
    var img = e('img', { class: 'badge-preview',
      alt: 'Shareable badge: ' + score + ' out of ' + total + ', ' + tier.name });

    var dl = e('button', { class: 'btn btn-primary', type: 'button', text: 'Download badge' });
    var again = e('button', { class: 'btn btn-quiet', type: 'button', text: 'Try again' });
    again.addEventListener('click', function () {
      self.index = 0; self.answers = []; self.renderQuestion();
    });

    var enc = encodeURIComponent;
    var row = e('div', { class: 'row' });
    [
      ['X', 'https://twitter.com/intent/tweet?text=' + enc(shareText) + '&url=' + enc(shareUrl)],
      ['Facebook', 'https://www.facebook.com/sharer/sharer.php?u=' + enc(shareUrl)],
      ['LinkedIn', 'https://www.linkedin.com/sharing/share-offsite/?url=' + enc(shareUrl)],
      ['Bluesky', 'https://bsky.app/intent/compose?text=' + enc(shareText + ' ' + shareUrl)]
    ].forEach(function (l) {
      row.appendChild(e('a', { class: 'share-btn', href: l[1],
        target: '_blank', rel: 'noopener noreferrer', text: l[0] }));
    });
    if (global.navigator && navigator.share) {
      var native = e('button', { class: 'share-btn', type: 'button', text: 'Share' });
      native.addEventListener('click', function () {
        navigator.share({ title: q.title, text: shareText, url: shareUrl }).catch(function () {});
      });
      row.appendChild(native);
    }

    var panel = [
      e('span', { class: 'overline', text: q.title }),
      e('p', { class: 'results__score', html: score + '<span>/' + total + '</span>' }),
      e('h3', { class: 'results__tier', text: tier.name }),
      e('p', { class: 'results__line', text: tier.line }),
      e('div', { class: 'row' }, [dl, again]),
      row,
      e('p', { class: 'caption', style: 'margin-top:.6rem',
        text: 'Download the badge, then attach it to your post.' })
    ];
    if (q.learnMore) {
      panel.push(e('p', { style: 'margin-top:1rem' }, [
        e('a', { class: 'btn btn-outline', href: q.learnMore,
          target: '_blank', rel: 'noopener noreferrer', text: 'Go deeper at trlibrary.com' })
      ]));
    }

    var media = e('figure', { class: 'media' }, [img]);
    var box = e('div', {}, [
      e('div', { class: 'grid pad' }, [media, e('div', { class: 'panel' }, panel)])
    ]);

    /* The full answer review is collapsed so the results still fit the frame. */
    var rev = e('details', { class: 'review' });
    rev.appendChild(e('summary', { text: 'Review all ' + total + ' answers' }));
    var body = e('div', { class: 'review__body' });
    q.questions.forEach(function (item, i) {
      var ok = self.answers[i] === item.answer;
      body.appendChild(e('div', { class: 'review__item' }, [
        e('span', { class: 'review__mark ' + (ok ? 'review__mark--ok' : 'review__mark--no'),
          text: ok ? '✓' : '✗' }),
        e('div', {}, [
          e('p', { class: 'review__q', text: item.prompt }),
          e('p', { class: 'review__a', text: 'Answer: ' + item.options[item.answer] })
        ])
      ]));
    });
    rev.appendChild(body);
    box.appendChild(rev);

    this.mount(box);
    this.reveal();

    /* Badge. When the embed runs on trlibrary.com the hero photograph is
       cross-origin, so it has to be requested with CORS or it silently taints
       the canvas and the download fails. Request it anonymously only when it
       really is cross-origin, and if the export still throws, redraw without
       the photograph rather than shipping a broken button. */
    var photo = new Image();
    var isCrossOrigin = BASE && BASE.indexOf(global.location.origin + '/') !== 0;
    if (isCrossOrigin) photo.crossOrigin = 'anonymous';

    var canvas = null;
    function build() {
      var usable = photo.complete && photo.naturalWidth;
      canvas = BADGE.draw({
        score: score, total: total, tier: tier.name, line: tier.line,
        quizTitle: (q.badge && q.badge.title) || q.title,
        photo: usable ? photo : null
      });
      try {
        img.src = canvas.toDataURL('image/png');
      } catch (err) {
        // tainted — fall back to the typographic badge, which always exports
        canvas = BADGE.draw({
          score: score, total: total, tier: tier.name, line: tier.line,
          quizTitle: (q.badge && q.badge.title) || q.title, photo: null
        });
        img.src = canvas.toDataURL('image/png');
      }
    }
    dl.addEventListener('click', function () {
      if (canvas) BADGE.download(canvas, 'trpl-' + q.id + '-' + score + 'of' + total + '.png');
    });
    photo.onload = build;
    photo.onerror = build;
    if (q.heroImage) { photo.src = url(q.heroImage); } else { build(); }
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(build);
  };

  /* ---------------------------------------------------------------------
     Mounting.
     --------------------------------------------------------------------- */
  function shareUrlFor(host) {
    var explicit = host.getAttribute('data-share-url');
    if (explicit) return explicit;
    try {
      // The embed lives in the host page's own document, so this is simply
      // the page the visitor is reading — the canonical thing to share.
      var canonical = doc.querySelector('link[rel="canonical"]');
      if (canonical && canonical.href) return canonical.href;
      return global.location.origin + global.location.pathname;
    } catch (err) {
      return 'https://www.trlibrary.com';
    }
  }

  function mount(host) {
    if (host.dataset.trplQuizReady) return;
    host.dataset.trplQuizReady = '1';

    var id = (host.getAttribute('data-trpl-quiz') || '').replace(/[^a-z0-9-]/gi, '');
    if (!id) return;

    installFonts();

    var root = host.attachShadow({ mode: 'open' });

    var link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = url('assets/css/quiz-embed.css');
    root.appendChild(link);

    var shell = doc.createElement('div');
    shell.className = 'shell';
    shell.innerHTML =
      '<div class="progress" id="progress" hidden>' +
        '<span class="progress__label">Question 1</span>' +
        '<span class="progress__track"><span class="progress__fill"></span></span>' +
        '<span class="progress__score">0 correct</span>' +
      '</div>' +
      '<div id="stage"><p class="status">Loading the quiz…</p></div>';
    root.appendChild(shell);

    fetch(url('quizzes/' + id + '.json'), { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('not found'); return r.json(); })
      .then(function (data) {
        data.id = data.id || id;
        new Quiz(root, data, shareUrlFor(host)).renderIntro();
      })
      .catch(function () {
        root.getElementById('stage').innerHTML =
          '<p class="status">This quiz could not be loaded right now.</p>';
      });
  }

  function scan(scope) {
    (scope || doc).querySelectorAll('[data-trpl-quiz]').forEach(mount);
  }

  global.TRPLQuiz = { scan: scan, mount: mount, base: BASE };

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', function () { scan(); });
  } else {
    scan();
  }
})(window, document);
