/* ==========================================================================
   quiz.js — the reusable TRPL quiz engine.
   Reads quizzes/<id>.json, renders one question at a time with immediate
   feedback, then a scored results screen with a shareable canvas badge.
   No dependencies, no build step.
   ========================================================================== */
(function () {
  'use strict';

  var LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
  var app = document.getElementById('app');
  var quiz = null;
  var index = 0;
  var answers = [];      // chosen option index per question
  var locked = false;

  /* ---------- utilities -------------------------------------------------- */

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }

  function param(name) {
    return new URLSearchParams(location.search).get(name);
  }

  function tierFor(score) {
    var tiers = (quiz.tiers || []).slice().sort(function (a, b) { return b.min - a.min; });
    for (var i = 0; i < tiers.length; i++) if (score >= tiers[i].min) return tiers[i];
    return { name: '', line: '' };
  }

  function scored() {
    return answers.reduce(function (n, a, i) {
      return n + (a === quiz.questions[i].answer ? 1 : 0);
    }, 0);
  }

  /* ---------- chrome ----------------------------------------------------- */

  function renderProgress() {
    var bar = document.getElementById('progress');
    if (!bar) return;
    var total = quiz.questions.length;
    var done = answers.length;
    bar.querySelector('.progress__label').textContent = 'Question ' + Math.min(index + 1, total) + ' of ' + total;
    bar.querySelector('.progress__fill').style.width = ((done / total) * 100) + '%';
    bar.querySelector('.progress__score').textContent = scored() + ' correct';
    bar.hidden = false;
  }

  /* ---------- question view ---------------------------------------------- */

  function renderQuestion() {
    locked = false;
    var q = quiz.questions[index];
    app.innerHTML = '';

    var section = el('section', { class: 'stage' });
    var wrap = el('div', { class: 'wrap wrap--narrow' });

    if (q.image) {
      var fig = el('figure', { class: 'q-figure' }, [
        el('img', { src: q.image, alt: q.imageAlt || '', loading: 'eager' })
      ]);
      if (q.credit) fig.appendChild(el('figcaption', { class: 'caption', text: q.credit }));
      wrap.appendChild(fig);
    }

    wrap.appendChild(el('h2', { class: 'q-prompt', text: q.prompt }));

    var list = el('ul', { class: 'options' });
    q.options.forEach(function (opt, i) {
      var btn = el('button', { class: 'option', type: 'button', 'data-i': String(i) }, [
        el('span', { class: 'option__key', text: LETTERS[i] }),
        el('span', { text: opt })
      ]);
      btn.addEventListener('click', function () { choose(i); });
      list.appendChild(el('li', {}, [btn]));
    });
    wrap.appendChild(list);

    wrap.appendChild(el('div', { class: 'stage__actions', id: 'actions' }));
    section.appendChild(wrap);
    app.appendChild(section);

    renderProgress();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function choose(chosen) {
    if (locked) return;
    locked = true;
    answers[index] = chosen;

    var q = quiz.questions[index];
    var correct = chosen === q.answer;
    var buttons = app.querySelectorAll('.option');

    buttons.forEach(function (b, i) {
      b.disabled = true;
      if (i === q.answer) b.classList.add('option--correct');
      else if (i === chosen) b.classList.add('option--wrong');
      else b.classList.add('option--muted');
    });

    var fb = el('div', { class: 'feedback' + (correct ? '' : ' feedback--wrong'),
      role: 'status', 'aria-live': 'polite' });
    fb.appendChild(el('p', { class: 'feedback__verdict',
      text: correct ? 'Correct.' : 'Not quite.' }));
    if (!correct) {
      fb.appendChild(el('p', { class: 'feedback__answer',
        text: 'The answer is ' + LETTERS[q.answer] + '. ' + q.options[q.answer] + '.' }));
    }
    fb.appendChild(el('p', { text: q.explanation }));
    if (q.link && q.link.url) {
      fb.appendChild(el('a', {
        class: 'feedback__link', href: q.link.url, target: '_blank', rel: 'noopener noreferrer',
        text: q.link.label || 'Learn more at trlibrary.com'
      }));
    }
    app.querySelector('.options').after(fb);

    var last = index === quiz.questions.length - 1;
    var next = el('button', { class: 'btn btn-primary', type: 'button',
      text: last ? 'See your score' : 'Next question' });
    next.addEventListener('click', function () {
      if (last) { renderResults(); } else { index++; renderQuestion(); }
    });
    var actions = document.getElementById('actions');
    actions.appendChild(next);
    actions.appendChild(el('span', { class: 'caption',
      text: (index + 1) + ' of ' + quiz.questions.length + ' answered' }));

    renderProgress();
    next.focus({ preventScroll: true });
  }

  /* ---------- results ----------------------------------------------------- */

  function renderResults() {
    var score = scored();
    var total = quiz.questions.length;
    var tier = tierFor(score);
    var shareUrl = (quiz.badge && quiz.badge.url) || location.href;
    var shareText = ((quiz.badge && quiz.badge.shareText) ||
        'I scored {score}/{total} on the Theodore Roosevelt Presidential Library quiz — {tier}.')
      .replace('{score}', score).replace('{total}', total).replace('{tier}', tier.name);

    document.getElementById('progress').hidden = true;
    app.innerHTML = '';

    var section = el('section', { class: 'results', 'data-section-theme': 'green-white' });
    var wrap = el('div', { class: 'wrap wrap--narrow results__center' });

    wrap.appendChild(el('span', { class: 'overline', text: quiz.title }));
    wrap.appendChild(el('p', { class: 'results__score',
      html: score + '<span>/' + total + '</span>' }));
    wrap.appendChild(el('h2', { class: 'results__tier', text: tier.name }));
    wrap.appendChild(el('p', { class: 'results__line', text: tier.line }));

    var img = el('img', { class: 'badge-preview', alt:
      'Shareable badge: ' + score + ' out of ' + total + ', ' + tier.name });
    wrap.appendChild(img);

    var actions = el('div', { class: 'share-row' });

    var dl = el('button', { class: 'btn btn-primary', type: 'button', text: 'Download badge' });
    actions.appendChild(dl);

    var again = el('button', { class: 'btn btn-secondary', type: 'button', text: 'Try again' });
    again.addEventListener('click', function () {
      index = 0; answers = []; renderQuestion();
    });
    actions.appendChild(again);
    wrap.appendChild(actions);

    var enc = encodeURIComponent;
    var links = [
      ['X', 'https://twitter.com/intent/tweet?text=' + enc(shareText) + '&url=' + enc(shareUrl)],
      ['Facebook', 'https://www.facebook.com/sharer/sharer.php?u=' + enc(shareUrl)],
      ['LinkedIn', 'https://www.linkedin.com/sharing/share-offsite/?url=' + enc(shareUrl)],
      ['Bluesky', 'https://bsky.app/intent/compose?text=' + enc(shareText + ' ' + shareUrl)]
    ];
    var row = el('div', { class: 'share-row' });
    links.forEach(function (l) {
      row.appendChild(el('a', { class: 'share-btn', href: l[1],
        target: '_blank', rel: 'noopener noreferrer', text: l[0] }));
    });
    if (navigator.share) {
      var native = el('button', { class: 'share-btn', type: 'button', text: 'Share' });
      native.addEventListener('click', function () {
        navigator.share({ title: quiz.title, text: shareText, url: shareUrl }).catch(function () {});
      });
      row.appendChild(native);
    }
    wrap.appendChild(row);
    wrap.appendChild(el('p', { class: 'caption',
      text: 'Download the badge, then attach it to your post.',
      style: 'margin-top:1rem;color:rgba(255,255,255,.7)' }));

    section.appendChild(wrap);
    app.appendChild(section);

    // Review list
    var rev = el('section', { class: 'review' });
    var rw = el('div', { class: 'wrap wrap--narrow' });
    rw.appendChild(el('h2', { text: 'How you did' }));
    quiz.questions.forEach(function (q, i) {
      var ok = answers[i] === q.answer;
      rw.appendChild(el('div', { class: 'review__item' }, [
        el('span', { class: 'review__mark ' + (ok ? 'review__mark--ok' : 'review__mark--no'),
          text: ok ? '✓' : '✗' }),
        el('div', {}, [
          el('p', { class: 'review__q', text: q.prompt }),
          el('p', { class: 'review__a', text: 'Answer: ' + q.options[q.answer] })
        ])
      ]));
    });
    var back = el('p', { style: 'margin-top:2rem' }, [
      el('a', { class: 'btn btn-secondary', href: quiz.learnMore || 'https://www.trlibrary.com',
        target: '_blank', rel: 'noopener noreferrer', text: 'Go deeper at trlibrary.com' })
    ]);
    rw.appendChild(back);
    rev.appendChild(rw);
    app.appendChild(rev);

    // Badge — draw once the hero photo has loaded (or immediately if it fails)
    // Same-origin image — do NOT set crossOrigin, which would force a CORS
    // preflight that a plain static host will fail, silently killing the draw.
    var photo = new Image();
    var built = false;
    function build() {
      if (built) return; built = true;
      var canvas = window.TRPLBadge.draw({
        score: score, total: total, tier: tier.name, line: tier.line,
        quizTitle: (quiz.badge && quiz.badge.title) || quiz.title,
        photo: photo.complete && photo.naturalWidth ? photo : null
      });
      img.src = canvas.toDataURL('image/png');
      dl.addEventListener('click', function () {
        window.TRPLBadge.download(canvas,
          'trpl-' + quiz.id + '-' + score + 'of' + total + '.png');
      });
    }
    photo.onload = build;
    photo.onerror = build;
    if (quiz.heroImage) { photo.src = quiz.heroImage; } else { build(); }
    // fonts may still be loading; redraw once they settle
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { built = false; build(); });
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------- intro ------------------------------------------------------- */

  function renderIntro() {
    document.title = quiz.title + ' | TRPL Quizzes';
    app.innerHTML = '';

    var head = el('section', { class: 'quiz-head', 'data-section-theme': 'green-white' });
    var hw = el('div', { class: 'wrap wrap--narrow' });
    if (quiz.subtitle) hw.appendChild(el('span', { class: 'overline', text: quiz.subtitle }));
    hw.appendChild(el('h1', { text: quiz.title }));
    hw.appendChild(el('p', { class: 'lede', text: quiz.intro || '' }));
    head.appendChild(hw);
    app.appendChild(head);

    var section = el('section', { class: 'stage' });
    var wrap = el('div', { class: 'wrap wrap--narrow' });
    if (quiz.heroImage) {
      wrap.appendChild(el('figure', { class: 'q-figure' }, [
        el('img', { src: quiz.heroImage, alt: quiz.heroAlt || '' })
      ]));
    }
    var start = el('button', { class: 'btn btn-primary', type: 'button',
      text: 'Start the quiz — ' + quiz.questions.length + ' questions' });
    start.addEventListener('click', function () { index = 0; answers = []; renderQuestion(); });
    wrap.appendChild(el('div', { class: 'stage__actions' }, [
      start,
      el('span', { class: 'caption', text: 'You will see the answer and the story behind it after each question.' })
    ]));
    section.appendChild(wrap);
    app.appendChild(section);
  }

  /* ---------- boot -------------------------------------------------------- */

  var id = (param('q') || 'badlands').replace(/[^a-z0-9-]/gi, '');
  fetch('quizzes/' + id + '.json', { cache: 'no-cache' })
    .then(function (r) {
      if (!r.ok) throw new Error('Quiz not found');
      return r.json();
    })
    .then(function (data) {
      quiz = data;
      quiz.id = quiz.id || id;
      renderIntro();
    })
    .catch(function () {
      app.innerHTML = '<div class="wrap"><p class="error">That quiz could not be loaded. ' +
        '<a href="index.html">Back to all quizzes</a>.</p></div>';
    });
})();
