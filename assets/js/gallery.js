/* ==========================================================================
   gallery.js — the quiz listing widget for /quiz.

   Paste one div and one script tag into a Drupal Full HTML field:

     <div data-trpl-quiz-gallery></div>
     <script src="https://quiz.labs.trlibrary.com/assets/js/gallery.js" async></script>

   It reads quizzes/index.json, shuffles the cards into an order that is the
   same for everybody all day and different tomorrow, and offers search plus
   difficulty and topic filters. Cards link to the Drupal node at
   /quiz/<id>, so the listing is a front door to real pages rather than a
   parallel universe of its own.

   Mounts into a shadow root, like the quiz embed, so Drupal's CSS cannot
   reach in and this cannot leak out.

   Optional attributes on the mount div:
     data-base        override the asset origin (defaults to wherever this
                      script loaded from)
     data-node-base   override the link target base (defaults to the
                      nodeBase in index.json)
     data-limit       show only the first N after shuffling — for a "three
                      quizzes you might like" block on some other page
     data-topic       preset a topic filter, e.g. data-topic="Conservation"
   ========================================================================== */
(function () {
  'use strict';

  var ATTR = 'data-trpl-quiz-gallery';
  // Same element id the quiz embed uses, deliberately: on /quiz both scripts
  // may be present, and whichever runs first should install the faces once.
  var FONT_ID = 'trpl-quiz-fonts';

  /* ---------- where did we load from ---------------------------------- */

  function scriptBase() {
    var s = document.currentScript;
    if (!s) {
      var all = document.getElementsByTagName('script');
      for (var i = all.length - 1; i >= 0; i--) {
        if (/gallery\.js/.test(all[i].src)) { s = all[i]; break; }
      }
    }
    if (!s || !s.src) return '';
    return s.src.replace(/\/assets\/js\/gallery\.js.*$/, '');
  }
  var BASE = scriptBase();

  /* ---------- fonts ---------------------------------------------------
     @font-face inside a shadow root is ignored by every browser, so the
     faces have to go on the host document. The quiz embed does the same
     thing and guards with the same flag, so whichever loads first wins and
     the second one is a no-op. */

  function injectFonts() {
    if (document.getElementById(FONT_ID)) return;

    var gf = document.createElement('link');
    gf.rel = 'stylesheet';
    gf.href = 'https://fonts.googleapis.com/css2?family=Oswald:wght@500;700' +
              '&family=Source+Serif+4:ital,wght@0,400;0,500;0,700;1,400' +
              '&family=Inter:wght@400;700&display=swap';
    document.head.appendChild(gf);

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

    var st = document.createElement('style');
    st.id = FONT_ID;
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* ---------- the daily shuffle ---------------------------------------
     Requirements that pull against each other: the order must look random,
     it must be the SAME for every visitor on a given day (so that a link
     someone sends you shows what they saw, and so screenshots in a meeting
     match), and it must change at midnight without anything server-side.

     So: seed a small PRNG with the local calendar date and Fisher-Yates
     with it. Local date, not UTC — the audience is overwhelmingly North
     American and "today" should turn over at their midnight, not at 6pm.

     mulberry32 is used rather than a bare hash because a hash makes a poor
     RNG: successive values correlate, and with 29 items you can see it —
     the same few quizzes keep landing near the top. */

  function dayKey(d) {
    d = d || new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function shuffleForDay(list, key) {
    var rnd = mulberry32(key >>> 0), out = list.slice(), i, j, t;
    for (i = out.length - 1; i > 0; i--) {
      j = Math.floor(rnd() * (i + 1));
      t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }

  /* ---------- text helpers -------------------------------------------- */

  function fold(s) {
    // Strip accents and punctuation so "Rondon" finds "Rondón" and
    // "roosevelts at war" finds "Roosevelts at War".
    return String(s || '')
      .normalize ? String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
      : String(s || '').toLowerCase();
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;   // textContent, never innerHTML
    return n;
  }

  // Highlight matches without ever building HTML from data: split the string
  // and append text nodes and <mark> elements.
  function highlight(target, text, needle) {
    target.textContent = '';
    if (!needle) { target.textContent = text; return; }
    var hay = fold(text), pos = hay.indexOf(needle);
    if (pos < 0) { target.textContent = text; return; }
    // fold() can change length (accents, punctuation runs), so only highlight
    // when the folded string is the same length as the source. Otherwise the
    // offsets lie and we would mark the wrong characters.
    if (hay.length !== text.length) { target.textContent = text; return; }
    target.appendChild(document.createTextNode(text.slice(0, pos)));
    target.appendChild(el('mark', null, text.slice(pos, pos + needle.length)));
    target.appendChild(document.createTextNode(text.slice(pos + needle.length)));
  }

  /* ---------- the widget ---------------------------------------------- */

  function mount(host, data) {
    var base = host.getAttribute('data-base') || BASE;
    var nodeBase = (host.getAttribute('data-node-base') ||
                    data.nodeBase || '/quiz').replace(/\/$/, '');
    var limit = parseInt(host.getAttribute('data-limit'), 10) || 0;

    /* A quiz can be finished, verified and deployed here while its Drupal node
       is still a draft — that is the normal state for anything waiting on an
       editorial decision. Every card links to /quiz/<id> on trlibrary.com, so
       listing one whose node is unpublished sends the visitor to a 403. An
       entry marked `"unlisted": true` stays out of the gallery until somebody
       publishes the node and clears the flag. */
    var listed = (data.quizzes || []).filter(function (q) { return !q.unlisted; });
    var all = shuffleForDay(listed, dayKey());
    if (limit > 0) all = all.slice(0, limit);

    var facets = data.facets || {};
    var state = {
      q: '',
      difficulty: null,
      topics: {},
      preset: host.getAttribute('data-topic') || null
    };
    if (state.preset) state.topics[state.preset] = true;

    var root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;

    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = base + '/assets/css/gallery.css';
    root.appendChild(link);

    var wrap = el('div', 'wrap');
    root.appendChild(wrap);

    /* --- controls --- */
    var controls = el('div', 'controls');
    wrap.appendChild(controls);

    // Three columns on desktop: search | difficulty | topic. The search column
    // and the facets are separate DOM subtrees rather than three siblings,
    // because the mobile disclosure has to hide difficulty and topic together
    // while leaving the search box out in the open.
    var grid = el('div', 'controls__grid');
    var searchCol = el('div', 'col col--search');
    searchCol.appendChild(el('p', 'facet__label', 'Search'));

    var search = el('div', 'search');
    search.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
    var input = document.createElement('input');
    input.type = 'search';
    input.placeholder = 'Search quizzes';
    input.setAttribute('aria-label', 'Search quizzes');
    search.appendChild(input);
    var clearBtn = null;
    searchCol.appendChild(search);

    // Disclosure for the facets. Only visible under 640px (see gallery.css);
    // on desktop the button is display:none and the collapse class is ignored,
    // so there is nothing to keep in sync when a window is resized.
    var toggle = el('button', 'facets__toggle');
    toggle.type = 'button';
    var toggleLabel = el('span', null, 'Filter by difficulty or topic');
    var toggleCount = el('span', 'facets__n', '');
    toggle.appendChild(toggleLabel);
    toggle.appendChild(toggleCount);
    var caret = document.createElement('span');
    caret.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="3" aria-hidden="true"><path d="M5 9l7 7 7-7"/></svg>';
    toggleCount.appendChild(caret);
    toggle.setAttribute('aria-expanded', 'false');
    searchCol.appendChild(toggle);
    grid.appendChild(searchCol);

    var facetWrap = el('div', 'facets is-collapsed');
    toggle.setAttribute('aria-controls', 'trplq-facets');
    facetWrap.id = 'trplq-facets';
    toggle.addEventListener('click', function () {
      var open = facetWrap.classList.toggle('is-collapsed') === false;
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    grid.appendChild(facetWrap);
    controls.appendChild(grid);

    var chipEls = [];

    function addFacet(label, values, kind) {
      if (!values || !values.length) return;
      var f = el('div', 'facet facet--' + kind);
      f.appendChild(el('p', 'facet__label', label));
      var ul = el('ul', 'chips');
      f.setAttribute('role', 'group');
      f.setAttribute('aria-label', label);
      values.forEach(function (v) {
        var li = document.createElement('li');
        var b = el('button', 'chip', v);
        b.type = 'button';
        b.setAttribute('aria-pressed', 'false');
        b.addEventListener('click', function () {
          if (kind === 'difficulty') {
            state.difficulty = state.difficulty === v ? null : v;
          } else {
            if (state.topics[v]) delete state.topics[v];
            else state.topics[v] = true;
          }
          render();
        });
        chipEls.push({ btn: b, value: v, kind: kind });
        li.appendChild(b);
        ul.appendChild(li);
      });
      f.appendChild(ul);
      facetWrap.appendChild(f);
    }

    addFacet('Difficulty', facets.difficulty, 'difficulty');
    addFacet('Topic', facets.topics, 'topic');

    var status = el('div', 'status');
    var count = el('span', 'status__count', '');
    status.appendChild(count);
    var reset = el('button', null, 'Clear filters');
    reset.type = 'button';
    reset.addEventListener('click', function () {
      state.q = ''; state.difficulty = null; state.topics = {};
      input.value = '';
      render();
      input.focus();
    });
    status.appendChild(reset);
    controls.appendChild(status);

    var grid = el('ul', 'grid');
    grid.setAttribute('aria-live', 'polite');
    wrap.appendChild(grid);

    /* --- filtering --- */

    function matches(q, needle) {
      if (state.difficulty && q.difficulty !== state.difficulty) return false;
      var want = Object.keys(state.topics);
      if (want.length) {
        // OR within the topic facet: picking Conservation and Family shows
        // both, which is what people expect from a tag list. AND would show
        // almost nothing and read as broken.
        var hit = false, i;
        for (i = 0; i < want.length; i++) {
          if ((q.topics || []).indexOf(want[i]) > -1) { hit = true; break; }
        }
        if (!hit) return false;
      }
      if (!needle) return true;
      return q._hay.indexOf(needle) > -1;
    }

    // The searchable text. `keywords` is baked into index.json by
    // tools/reindex.py from the questions themselves — without it, searching
    // "Rondon" or "Gorgas" or "1912" finds nothing, because none of those
    // words appear in a title or a blurb.
    all.forEach(function (q) {
      q._hay = fold([q.title, q.blurb, q.difficulty,
                     (q.topics || []).join(' '),
                     (q.keywords || []).join(' ')].join(' '));
    });

    function render() {
      var needle = fold(state.q);
      var shown = all.filter(function (q) { return matches(q, needle); });

      grid.textContent = '';

      shown.forEach(function (q) {
        var li = document.createElement('li');
        var card = el('article', 'card');

        if (q.image) {
          var media = el('div', 'card__media');
          var img = document.createElement('img');
          img.src = base + '/' + String(q.image).replace(/^\//, '');
          img.alt = q.imageAlt || '';
          img.loading = 'lazy';
          img.decoding = 'async';
          media.appendChild(img);
          card.appendChild(media);
        }

        var body = el('div', 'card__body');

        var h = el('h3', 'card__title');
        var a = document.createElement('a');
        a.href = nodeBase + '/' + q.id;
        highlight(a, q.title || q.id, needle);
        h.appendChild(a);
        body.appendChild(h);

        var blurb = el('p', 'card__blurb');
        highlight(blurb, q.blurb || '', needle);
        body.appendChild(blurb);

        var meta = el('div', 'card__meta');
        if (q.difficulty) meta.appendChild(el('span', 'tag tag--diff', q.difficulty));
        (q.topics || []).forEach(function (t) {
          meta.appendChild(el('span', 'tag', t));
        });
        if (q.questions) {
          meta.appendChild(el('span', 'tag tag--count', q.questions + ' questions'));
        }
        body.appendChild(meta);

        card.appendChild(body);
        li.appendChild(card);
        grid.appendChild(li);
      });

      if (!shown.length) {
        var e = el('div', 'empty');
        e.appendChild(el('p', null, 'No quizzes match that.'));
        var b = el('button', null, 'Show all ' + all.length);
        b.type = 'button';
        b.addEventListener('click', function () { reset.click(); });
        e.appendChild(b);
        var li2 = document.createElement('li');
        li2.style.gridColumn = '1 / -1';
        li2.appendChild(e);
        grid.appendChild(li2);
      }

      // Chip states, and dim the ones that would return nothing from here.
      chipEls.forEach(function (c) {
        var on = c.kind === 'difficulty'
          ? state.difficulty === c.value
          : !!state.topics[c.value];
        c.btn.setAttribute('aria-pressed', on ? 'true' : 'false');

        var probe = { difficulty: state.difficulty, topics: state.topics };
        var saved = { d: state.difficulty, t: state.topics };
        if (!on) {
          if (c.kind === 'difficulty') state.difficulty = c.value;
          else { state.topics = Object.assign({}, state.topics); state.topics[c.value] = true; }
          var any = all.some(function (q) { return matches(q, needle); });
          state.difficulty = saved.d; state.topics = saved.t;
          c.btn.setAttribute('data-empty', any ? '0' : '1');
        } else {
          c.btn.setAttribute('data-empty', '0');
        }
        void probe;
      });

      // The status row only exists once the visitor has narrowed something.
      // Announcing "29 quizzes, in a new order each day" to someone who has
      // done nothing is the widget talking about itself.
      var filtered = state.q || state.difficulty || Object.keys(state.topics).length;
      count.textContent = shown.length === all.length
        ? 'All ' + all.length + ' quizzes'
        : shown.length + ' of ' + all.length + ' quizzes';
      status.hidden = !filtered;

      // On a phone the facets are collapsed, so say how many are active —
      // otherwise a filtered list looks like a broken one.
      var active = (state.difficulty ? 1 : 0) + Object.keys(state.topics).length;
      toggleLabel.textContent = active
        ? (active === 1 ? '1 filter' : active + ' filters') + ' applied'
        : 'Filter by difficulty or topic';

      // The clear-search button exists only while there is text to clear.
      if (state.q && !clearBtn) {
        clearBtn = el('button', null, '');
        clearBtn.type = 'button';
        clearBtn.setAttribute('aria-label', 'Clear search');
        clearBtn.innerHTML =
          '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" ' +
          'stroke="currentColor" stroke-width="2" aria-hidden="true">' +
          '<path d="M6 6l12 12M18 6L6 18"/></svg>';
        clearBtn.addEventListener('click', function () {
          state.q = ''; input.value = ''; render(); input.focus();
        });
        search.appendChild(clearBtn);
      } else if (!state.q && clearBtn) {
        search.removeChild(clearBtn);
        clearBtn = null;
      }
    }

    var t = null;
    input.addEventListener('input', function () {
      // Debounced: retyping a search term should not re-render 29 cards on
      // every keystroke on a phone.
      clearTimeout(t);
      t = setTimeout(function () { state.q = input.value; render(); }, 120);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && input.value) {
        e.stopPropagation();
        state.q = ''; input.value = ''; render();
      }
    });

    render();
  }

  /* ---------- boot ----------------------------------------------------- */

  function fail(host, msg) {
    var p = el('p', null, msg);
    p.style.cssText = 'font:14px/1.5 system-ui,sans-serif;color:#25282A;opacity:.7';
    host.appendChild(p);
  }

  function boot() {
    var hosts = document.querySelectorAll('[' + ATTR + ']');
    if (!hosts.length) return;
    injectFonts();

    fetch(BASE + '/quizzes/index.json', { credentials: 'omit' })
      .then(function (r) {
        if (!r.ok) throw new Error('index.json ' + r.status);
        return r.json();
      })
      .then(function (data) {
        Array.prototype.forEach.call(hosts, function (h) {
          if (h.getAttribute('data-mounted')) return;
          h.setAttribute('data-mounted', '1');
          try { mount(h, data); }
          catch (e) { fail(h, 'The quiz list could not be displayed.'); }
        });
      })
      .catch(function () {
        Array.prototype.forEach.call(hosts, function (h) {
          fail(h, 'The quiz list could not be loaded. Please try again later.');
        });
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
