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
     Challenge links.

     Everything a challenge needs travels in the URL — nothing is stored on a
     server, so there is no user data to hold, breach, or purge. The payload
     carries the challenger's name, their score, and the exact deck they
     played, so the friend faces the identical questions in the identical
     order with the identical answer positions. Without that, "beat my score"
     would be meaningless.
     --------------------------------------------------------------------- */
  var PARAM = 'trplq';

  /* The 24 orderings of four options, lexicographic, so encoder and decoder
     agree on what index 17 means. */
  var PERMS = (function () {
    var out = [];
    function walk(left, acc) {
      if (!left.length) { out.push(acc); return; }
      for (var i = 0; i < left.length; i++) {
        walk(left.slice(0, i).concat(left.slice(i + 1)), acc.concat([left[i]]));
      }
    }
    walk([0, 1, 2, 3], []);
    return out;
  })();

  function permIndex(perm) {
    for (var i = 0; i < PERMS.length; i++) {
      if (PERMS[i].join() === perm.join()) return i;
    }
    return 0;
  }

  // UTF-8 safe base64url, so names with accents survive the round trip
  function b64encode(str) {
    var bytes = new TextEncoder().encode(str), bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64decode(s) {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = atob(s), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  /* A short check value over the payload. This stops someone casually editing
     their friend's score down in the address bar. It is NOT security — anyone
     who reads this file can forge a link. Nothing of value rides on it. */
  function checksum(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
    return h.toString(36).slice(0, 6);
  }

  function encodeChallenge(o) {
    // deck: two base36 chars per question — source index, then permutation index
    var deck = o.deck.map(function (d) {
      return d.src.toString(36) + permIndex(d.perm).toString(36);
    }).join('');
    var body = ['1', o.quiz, o.score, o.total, deck, o.name].join('~');
    return b64encode(body + '~' + checksum(body));
  }

  function decodeChallenge(token) {
    try {
      var raw = b64decode(token);
      var parts = raw.split('~');
      if (parts.length < 7 || parts[0] !== '1') return null;
      var sum = parts.pop();
      if (checksum(parts.join('~')) !== sum) return null;
      var deck = [], s = parts[4];
      for (var i = 0; i + 1 < s.length; i += 2) {
        deck.push({ src: parseInt(s[i], 36), perm: PERMS[parseInt(s[i + 1], 36)] || PERMS[0] });
      }
      return {
        quiz: parts[1],
        score: parseInt(parts[2], 10),
        total: parseInt(parts[3], 10),
        deck: deck,
        name: parts.slice(5).join('~')
      };
    } catch (err) { return null; }
  }

  /* Names never leave the browser, but they do end up in shared links, so they
     get cleaned before they go anywhere. */
  var BLOCKED = ['fuck', 'shit', 'cunt', 'bitch', 'bastard', 'dick', 'cock',
    'pussy', 'whore', 'slut', 'nigger', 'nigga', 'faggot', 'fag', 'rape',
    'nazi', 'hitler', 'kike', 'spic', 'chink', 'retard', 'anus', 'penis',
    'vagina', 'wank', 'twat', 'bollock', 'arsehole', 'asshole'];

  function cleanName(input) {
    var n = String(input || '')
      .replace(/<[^>]*>/g, ' ')         // drop whole tags, not just the brackets,
                                        // so "<script>x</script>" doesn't leave "scriptx/script"
      /* Strip markup characters but keep apostrophes and hyphens — O'Keefe and
         Anne-Marie are names, not attacks. Everything downstream sets text
         nodes and attributes, never innerHTML, so these are safe to keep. */
      .replace(/[<>&"`\\]/g, '')
      .replace(/https?:\/\/\S+/gi, '')  // no links smuggled in
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 24);
    var flat = n.toLowerCase().replace(/[^a-z]/g, '');
    for (var i = 0; i < BLOCKED.length; i++) {
      if (flat.indexOf(BLOCKED[i]) > -1) return '';
    }
    return n;
  }

  /* Read a challenge off the host page's own URL. */
  function readChallenge() {
    try {
      var token = new URLSearchParams(global.location.search).get(PARAM);
      if (!token) {
        var m = global.location.hash.match(new RegExp(PARAM + '=([^&]+)'));
        token = m && m[1];
      }
      return token ? decodeChallenge(token) : null;
    } catch (err) { return null; }
  }

  /* The embed is usually partway down a long page, so the link carries a
     fragment pointing at the quiz. The mount div is given this id when it
     mounts, and the player is scrolled to it on arrival — a challenged friend
     should land on the quiz, not on the top of the page hunting for it. */
  function anchorFor(id) { return 'trpl-quiz-' + id; }

  function challengeUrl(base, token, anchor) {
    var u = String(base).split('#')[0];
    u = u.replace(new RegExp('([?&])' + PARAM + '=[^&]*'), '$1').replace(/[?&]$/, '');
    u = u + (u.indexOf('?') > -1 ? '&' : '?') + PARAM + '=' + token;
    return anchor ? u + '#' + anchor : u;
  }

  /* ---------------------------------------------------------------------
     Live head-to-head.

     GitHub Pages is static file hosting, so there is nothing here that can
     introduce two browsers to each other. The game runs peer-to-peer over
     WebRTC, using PeerJS's free public broker purely to exchange connection
     details — no account, no cost, and no game data passes through it.

     PeerJS is ~100KB and is loaded ONLY when someone actually starts a live
     game, so it never lands on a trlibrary.com page that nobody plays.

     Known limit: the public broker is rate-limited and occasionally down, and
     a minority of restrictive networks block direct peer connections outright.
     Both cases are handled by falling back to the async challenge rather than
     leaving anyone staring at a spinner.
     --------------------------------------------------------------------- */
  var LIVE_PARAM = 'trpllive';
  var PEERJS_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js';
  var PEER_PREFIX = 'trplq-';
  /* Two very different waits.

     The host is waiting on a human: they have to copy a link, send it, and the
     friend has to notice and open it. Ten minutes, not fifteen seconds.

     The guest is dialling a code that either exists or doesn't, so their wait
     is short — but retried a few times, because the host's peer may be
     momentarily reconnecting to the broker when they arrive. */
  var HOST_WAIT = 10 * 60 * 1000;
  var GUEST_WAIT = 20000;
  var DIAL_RETRIES = 3;
  var DIAL_RETRY_GAP = 4000;

  var peerLoading = null;
  function loadPeerJS() {
    if (global.Peer) return Promise.resolve(global.Peer);
    if (peerLoading) return peerLoading;
    peerLoading = new Promise(function (resolve, reject) {
      var s = doc.createElement('script');
      s.src = PEERJS_SRC;
      s.async = true;
      s.onload = function () {
        global.Peer ? resolve(global.Peer) : reject(new Error('peerjs missing'));
      };
      s.onerror = function () { reject(new Error('peerjs blocked')); };
      doc.head.appendChild(s);
    });
    return peerLoading;
  }

  /* Room codes avoid 0/O and 1/I/L so they can be read aloud over a phone. */
  var CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  function roomCode() {
    var out = '', i;
    var buf = new Uint8Array(6);
    if (global.crypto && crypto.getRandomValues) crypto.getRandomValues(buf);
    else for (i = 0; i < 6; i++) buf[i] = Math.floor(Math.random() * 256);
    for (i = 0; i < 6; i++) out += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length];
    return out;
  }

  function readLive() {
    try {
      var v = new URLSearchParams(global.location.search).get(LIVE_PARAM);
      if (!v) return null;
      var bits = String(v).split('.');
      if (bits.length !== 2) return null;
      return { quiz: bits[0].replace(/[^a-z0-9-]/gi, ''),
               code: bits[1].replace(/[^0-9A-Z]/gi, '').toUpperCase() };
    } catch (err) { return null; }
  }

  function liveUrl(base, quizId, code, anchor) {
    var u = String(base).split('#')[0];
    u = u.replace(new RegExp('([?&])' + LIVE_PARAM + '=[^&]*'), '$1')
         .replace(new RegExp('([?&])' + PARAM + '=[^&]*'), '$1')
         .replace(/[?&]$/, '');
    u = u + (u.indexOf('?') > -1 ? '&' : '?') + LIVE_PARAM + '=' + quizId + '.' + code;
    return anchor ? u + '#' + anchor : u;
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
        /* Fit, never fill. A cover-crop chops the top of Roosevelt's head off
           a portrait plate, which is not a thing a presidential library ships. */
        var iw = o.photo.naturalWidth, ih = o.photo.naturalHeight;
        var sc = Math.min(S / iw, S / ih), dw = iw * sc, dh = ih * sc;
        ctx.save();
        ctx.globalAlpha = 0.42;   // a ghosted plate behind the type, not a portrait
        ctx.drawImage(o.photo, (S - dw) / 2, (S - dh) / 2, dw, dh);
        ctx.restore();
        ctx.save();
        ctx.globalCompositeOperation = 'color';
        ctx.fillStyle = FOREST;
        ctx.fillRect(0, 0, S, S);
        ctx.restore();
        var g = ctx.createLinearGradient(0, 0, 0, S);
        g.addColorStop(0, 'rgba(22,55,40,0.72)');
        g.addColorStop(0.30, 'rgba(27,69,50,0.42)');
        g.addColorStop(0.62, 'rgba(27,69,50,0.46)');
        g.addColorStop(1, 'rgba(22,55,40,0.82)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, S, S);
        // dissolve the scanned plate's own edges into the field
        var h = ctx.createLinearGradient(0, 0, S, 0);
        h.addColorStop(0, 'rgba(27,69,50,0.95)');
        h.addColorStop(0.16, 'rgba(27,69,50,0)');
        h.addColorStop(0.84, 'rgba(27,69,50,0)');
        h.addColorStop(1, 'rgba(27,69,50,0.95)');
        ctx.fillStyle = h;
        ctx.fillRect(0, 0, S, S);
      }

      ctx.strokeStyle = 'rgba(209,204,189,0.55)';
      ctx.lineWidth = 3;
      ctx.strokeRect(48, 48, S - 96, S - 96);

      ctx.textAlign = 'center';

      /* The wordmark, reversed to white. Falls back to letterspaced type if the
         mark hasn't loaded, so the badge is never wordless. */
      var headBottom;
      if (o.logo && o.logo.complete && o.logo.naturalWidth) {
        var lw = 470, lh = lw * (o.logo.naturalHeight / o.logo.naturalWidth);
        ctx.drawImage(o.logo, (S - lw) / 2, 104, lw, lh);
        headBottom = 104 + lh;
      } else {
        ctx.fillStyle = SAND;
        ctx.font = '700 30px ' + CAPTION;
        if ('letterSpacing' in ctx) ctx.letterSpacing = '8px';
        ctx.fillText('THEODORE ROOSEVELT PRESIDENTIAL LIBRARY', S / 2, 150);
        if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
        headBottom = 170;
      }

      ctx.fillStyle = WHITE;
      ctx.font = '700 58px ' + DISPLAY;
      var ty = headBottom + 82;
      wrap(ctx, String(o.quizTitle || '').toUpperCase(), S - 220).slice(0, 2)
        .forEach(function (l) { ctx.fillText(l, S / 2, ty); ty += 60; });

      ctx.strokeStyle = 'rgba(209,204,189,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(S / 2 - 100, ty + 6); ctx.lineTo(S / 2 + 100, ty + 6); ctx.stroke();

      // Score, measured so the numeral pair sits optically centered
      ctx.textAlign = 'left';
      ctx.font = '700 320px ' + DISPLAY;
      var wBig = ctx.measureText(String(o.score)).width;
      ctx.font = '700 138px ' + DISPLAY;
      var wSm = ctx.measureText('/' + o.total).width;
      var x0 = (S - (wBig + 22 + wSm)) / 2;
      var scoreBaseline = ty + 288;
      ctx.fillStyle = YELLOW;
      ctx.font = '700 320px ' + DISPLAY;
      ctx.fillText(String(o.score), x0, scoreBaseline);
      ctx.fillStyle = 'rgba(255,255,255,0.72)';
      ctx.font = '700 138px ' + DISPLAY;
      ctx.fillText('/' + o.total, x0 + wBig + 22, scoreBaseline);
      ctx.textAlign = 'center';

      ctx.fillStyle = WHITE;
      ctx.font = '700 96px ' + DISPLAY;
      var yy = scoreBaseline + 132;
      wrap(ctx, String(o.tier || '').toUpperCase(), S - 200).slice(0, 2)
        .forEach(function (l) { ctx.fillText(l, S / 2, yy); yy += 92; });

      var ly = yy + 30;
      if (o.versus) {
        ctx.fillStyle = SAND;
        ctx.font = '700 44px ' + DISPLAY;
        wrap(ctx, String(o.versus).toUpperCase(), S - 240).slice(0, 2)
          .forEach(function (l) { ctx.fillText(l, S / 2, ly); ly += 50; });
        ly += 8;
      }
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = 'italic 40px ' + BODY;
      wrap(ctx, o.line || '', S - 300).slice(0, o.versus ? 1 : 2)
        .forEach(function (l) { ctx.fillText(l, S / 2, ly); ly += 50; });

      ctx.fillStyle = SAND;
      ctx.font = '700 28px ' + CAPTION;
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
    this.deck = [];           // the shuffled run — see deal()
    this.challenge = null;    // set by mount() when the URL carries one
    this.playerName = '';
    this.live = null;         // live-game state, when playing head-to-head
    this.peer = null; this.conn = null;
    this.timerId = null; this.revealId = null;
    this.playing = false; this.finished = false; this.counting = false;
  }

  /* Fisher-Yates on a copy. */
  function shuffled(arr) {
    var a = arr.slice(), i, j, t;
    for (i = a.length - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1));
      t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* Build a fresh run: questions in random order, options within each question in
     random order, correct index remapped to follow its option. Re-dealt on every
     start and every retry, so a list of "question 7 is B" is worth nothing.

     Either half can be switched off per quiz:
       "shuffle": { "questions": false, "options": true }
     Turn questions off when a quiz is built as a narrative and the order carries
     meaning. */
  /* Apply an option order to a question, remapping the correct index to follow
     its option, and remember where it came from so the run can be replayed. */
  function lay(q, src, order) {
    var copy = {}, k;
    for (k in q) if (Object.prototype.hasOwnProperty.call(q, k)) copy[k] = q[k];
    copy.options = order.map(function (i) { return q.options[i]; });
    copy.answer = order.indexOf(q.answer);
    copy.src = src;
    copy.perm = order;
    return copy;
  }

  Quiz.prototype.deal = function () {
    var all = this.quiz.questions;

    /* Replaying a challenge: rebuild the challenger's exact run so both players
       answer the same questions with the answers in the same places. */
    if (this.challenge && this.challenge.deck && this.challenge.deck.length) {
      this.deck = this.challenge.deck
        .filter(function (d) { return all[d.src]; })
        .map(function (d) { return lay(all[d.src], d.src, d.perm); });
      if (this.deck.length) { this.index = 0; this.answers = []; return; }
      // deck didn't survive (quiz edited since the link was made) — fall through
    }

    var cfg = this.quiz.shuffle || {};
    var order = all.map(function (_, i) { return i; });
    if (cfg.questions !== false) order = shuffled(order);

    this.deck = order.map(function (src) {
      var q = all[src];
      var opts = q.options.map(function (_, i) { return i; });
      return lay(q, src, cfg.options === false ? opts : shuffled(opts));
    });

    this.index = 0;
    this.answers = [];
  };

  /* ---------------------------------------------------------------------
     Live game — connection
     --------------------------------------------------------------------- */

  Quiz.prototype.liveSend = function (msg) {
    try { if (this.conn && this.conn.open) this.conn.send(msg); } catch (err) {}
  };

  Quiz.prototype.liveTeardown = function () {
    if (this.timerId) { clearInterval(this.timerId); this.timerId = null; }
    if (this.waitTick) { clearInterval(this.waitTick); this.waitTick = null; }
    if (this.revealId) { clearTimeout(this.revealId); this.revealId = null; }
    try { if (this.conn) this.conn.close(); } catch (err) {}
    try { if (this.peer) this.peer.destroy(); } catch (err) {}
    this.conn = null; this.peer = null;
  };

  /* Host: open a room and wait. Guest: dial the code. Either way we end up
     with one data channel and both names known. */
  Quiz.prototype.liveStart = function (role, code) {
    var self = this;
    var cfg = this.quiz.live || {};
    var hostWait = (cfg.waitMinutes ? cfg.waitMinutes * 60 * 1000 : HOST_WAIT);
    this.live = { role: role, code: code, opponent: '', oppScore: 0, oppAt: 0,
                  oppDone: false, until: Date.now() + (role === 'host' ? hostWait : GUEST_WAIT) };
    this.renderLobby('Setting up…');

    loadPeerJS().then(function (Peer) {
      var id = role === 'host' ? PEER_PREFIX + code : undefined;
      var peer = new Peer(id, { debug: 0 });
      self.peer = peer;

      var settled = false;
      var dials = 0;

      function fail(msg) {
        if (settled) return;
        settled = true;
        clearTimeout(giveUp);
        if (self.waitTick) { clearInterval(self.waitTick); self.waitTick = null; }
        self.liveFailed(msg);
      }

      var giveUp = setTimeout(function () {
        fail(role === 'host'
          ? 'Nobody joined in ten minutes, so the game was closed.'
          : 'Could not reach that game. It may have ended, or your network is blocking the connection.');
      }, role === 'host' ? hostWait : GUEST_WAIT);

      /* Keep the lobby honest about how long is left, and — more importantly —
         keep the room alive. The public broker hangs up on idle peers, which
         over a ten-minute wait would silently kill the game while the host sat
         there believing it was open. */
      if (self.waitTick) clearInterval(self.waitTick);
      self.waitTick = setInterval(function () {
        if (settled || !self.live) { clearInterval(self.waitTick); self.waitTick = null; return; }
        if (peer.disconnected && !peer.destroyed) {
          try { peer.reconnect(); } catch (err) {}
        }
        if (role === 'host' && !self.live.opponent) self.renderLobby(null);
      }, 5000);

      function wire(conn) {
        if (settled) return;
        settled = true;
        clearTimeout(giveUp);
        if (self.waitTick) { clearInterval(self.waitTick); self.waitTick = null; }
        self.conn = conn;
        conn.on('data', function (m) { self.liveMessage(m); });
        conn.on('close', function () { self.liveDropped(); });
        conn.on('error', function () { self.liveDropped(); });
        self.liveSend({ t: 'hello', name: self.playerName });

        if (role === 'host') {
          /* The host deals, so both players get the identical run. */
          self.deal();
          self.liveSend({ t: 'deck', token: self.deckToken(self.playerName, 0) });
          self.liveReady();
        }
        self.renderLobby('Connected. Waiting for your opponent to be ready…');
      }

      function dial() {
        dials++;
        var conn = peer.connect(PEER_PREFIX + code, { reliable: true });
        conn.on('open', function () { wire(conn); });
        conn.on('error', function () {});
      }

      peer.on('error', function (e) {
        var kind = String((e && e.type) || '');

        /* The host might be mid-reconnect. Try again before giving up. */
        if (kind === 'peer-unavailable' && role === 'guest' && dials < DIAL_RETRIES && !settled) {
          self.renderLobby('Still looking for that game…');
          setTimeout(function () { if (!settled) dial(); }, DIAL_RETRY_GAP);
          return;
        }
        /* A dropped broker socket is recoverable — reconnect rather than fail. */
        if (kind === 'disconnected' && !settled && !peer.destroyed) {
          try { peer.reconnect(); return; } catch (err) {}
        }

        fail(
          kind === 'unavailable-id' ? 'That game code is already in use. Start a new game.' :
          kind === 'peer-unavailable' ? 'That game is not open. It may have finished, or the host closed the page.' :
          kind === 'browser-incompatible' ? 'This browser cannot run the live game.' :
          kind === 'network' || kind === 'server-error' ? 'The matchmaking service is not responding right now.' :
          kind === 'webrtc' ? 'Your network is blocking the direct connection between browsers.' :
          'The connection could not be made.');
      });

      peer.on('disconnected', function () {
        if (settled || peer.destroyed) return;
        try { peer.reconnect(); } catch (err) {}
      });

      if (role === 'host') {
        peer.on('open', function () { self.renderLobby(null); });
        peer.on('connection', function (conn) {
          conn.on('open', function () { wire(conn); });
        });
      } else {
        peer.on('open', dial);
      }
    }, function () {
      self.liveFailed('The connection library could not load. Your network may be blocking it.');
    });
  };

  Quiz.prototype.liveMessage = function (m) {
    if (!m || !m.t) return;
    var self = this;
    if (m.t === 'hello') {
      this.live.opponent = cleanName(m.name) || 'Your opponent';
      if (this.live.role === 'host') this.renderLobby(null);
    } else if (m.t === 'deck') {
      var c = decodeChallenge(m.token);
      if (c) { this.challenge = { deck: c.deck }; this.deal(); this.challenge = null; }
      this.liveReady();
    } else if (m.t === 'ready') {
      this.live.theirReady = true;
      this.maybeStart();
    } else if (m.t === 'progress') {
      this.live.oppScore = m.score; this.live.oppAt = m.i;
      this.progress(true);
    } else if (m.t === 'done') {
      this.live.oppScore = m.score;
      this.live.oppDone = true;
      if (this.finished) this.renderLiveResults();
      else this.progress(true);
    }
  };

  /* Announce that this side has a deck and is good to go, then start if the
     other side has already said the same. Both peers must announce — an
     earlier version had only the guest doing it, which left the guest sitting
     on the lobby screen while the host played alone. */
  Quiz.prototype.liveReady = function () {
    if (!this.live || this.live.ready) return;
    this.live.ready = true;
    this.liveSend({ t: 'ready' });
    this.maybeStart();
  };

  Quiz.prototype.maybeStart = function () {
    if (this.live && this.live.ready && this.live.theirReady) this.liveCountdown();
  };

  Quiz.prototype.liveDropped = function () {
    if (this.finished || !this.live) return;
    this.live.dropped = true;
    if (this.playing) {
      /* Mid-game: don't throw away their run. Let them finish alone. */
      this.progress(true);
    } else {
      this.liveFailed('Your opponent disconnected.');
    }
  };

  Quiz.prototype.deckToken = function (name, score) {
    return encodeChallenge({
      quiz: this.quiz.id,
      score: score,
      total: this.deck.length,
      name: name,
      deck: this.deck.map(function (d) { return { src: d.src, perm: d.perm }; })
    });
  };

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
    var deck = this.deck;
    return this.answers.reduce(function (n, a, i) {
      return n + (a === deck[i].answer ? 1 : 0);
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
    var total = this.deck.length;
    bar.querySelector('.progress__label').textContent =
      'Question ' + Math.min(this.index + 1, total) + ' of ' + total;
    bar.querySelector('.progress__fill').style.width =
      ((this.answers.length / total) * 100) + '%';

    var L = this.live;
    if (L) {
      var them = L.dropped ? 'opponent left'
        : L.oppDone ? L.opponent + ' finished on ' + L.oppScore
        : (L.opponent || 'Opponent') + ' ' + L.oppScore + ' (Q' + Math.min(L.oppAt + 1, total) + ')';
      bar.querySelector('.progress__score').textContent =
        'You ' + this.score() + ' · ' + them;
    } else {
      bar.querySelector('.progress__score').textContent = this.score() + ' correct';
    }
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

  /* A small name field. Solo play never sees this — it only appears when a name
     is actually needed, either to answer a challenge or to issue one. */
  Quiz.prototype.nameField = function (label, onSubmit) {
    var e = this.el.bind(this);
    var input = e('input', { class: 'namefield__input', type: 'text',
      maxlength: '24', placeholder: 'Your name', 'aria-label': label,
      autocomplete: 'off', spellcheck: 'false' });
    var err = e('p', { class: 'namefield__err', role: 'alert', hidden: 'hidden' });
    var go = e('button', { class: 'btn btn-primary', type: 'button', text: 'Continue' });

    function submit() {
      var name = cleanName(input.value);
      if (!name) {
        err.textContent = input.value.trim()
          ? 'Please choose a different name.'
          : 'Enter a name to continue.';
        err.hidden = false;
        input.focus();
        return;
      }
      err.hidden = true;
      onSubmit(name);
    }
    go.addEventListener('click', submit);
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); submit(); }
    });

    var wrap = e('div', { class: 'namefield' }, [
      e('label', { class: 'namefield__label', text: label }),
      e('div', { class: 'namefield__row' }, [input, go]),
      err,
      e('p', { class: 'caption', text: 'Your name is only used on this page and in the link you share. It is not stored anywhere.' })
    ]);
    setTimeout(function () { input.focus({ preventScroll: true }); }, 60);
    return wrap;
  };

  Quiz.prototype.renderIntro = function () {
    var self = this, e = this.el.bind(this), q = this.quiz;
    this.progress(false);
    var c = this.challenge;

    var kids = [];

    if (this.liveInvite) {
      var inv = this.liveInvite;
      kids.push(e('span', { class: 'overline', text: 'Live head-to-head' }));
      kids.push(e('h2', { text: 'You have been invited to a race' }));
      kids.push(e('p', { class: 'lede',
        text: 'Fifteen questions, twenty seconds each, both of you at the same time.' }));
      kids.push(this.nameField('Who is playing?', function (name) {
        self.playerName = name;
        self.liveStart('guest', inv.code);
      }));
    } else if (c) {
      kids.push(e('span', { class: 'overline', text: 'You have been challenged' }));
      kids.push(e('h2', { text: c.name + ' scored ' + c.score + '/' + c.total }));
      kids.push(e('p', { class: 'lede',
        text: 'Same questions, same order, same answer positions. Beat it if you can.' }));
      kids.push(this.nameField('First, who is playing?', function (name) {
        self.playerName = name;
        self.deal();
        self.renderQuestion();
      }));
    } else {
      if (q.subtitle) kids.push(e('span', { class: 'overline', text: q.subtitle }));
      kids.push(e('h2', { text: q.title }));
      kids.push(e('p', { class: 'lede', text: q.intro || '' }));

      var start = e('button', { class: 'btn btn-primary', type: 'button',
        text: 'Start the quiz — ' + q.questions.length + ' questions' });
      start.addEventListener('click', function () {
        self.deal(); self.renderQuestion();
      });
      var liveBtn = e('button', { class: 'btn btn-quiet', type: 'button',
        text: 'Play head-to-head' });
      liveBtn.addEventListener('click', function () {
        self.mount(e('div', { class: 'intro' }, [
          self.frame(q.heroImage, q.heroAlt, q.heroCredit, [
            e('span', { class: 'overline', text: 'Live head-to-head' }),
            e('h2', { text: 'Race a friend' }),
            e('p', { class: 'lede',
              text: 'Fifteen questions, twenty seconds each, both of you at the same time. You will get a link to send them.' }),
            self.nameField('Who is playing?', function (name) {
              self.playerName = name;
              self.liveStart('host', roomCode());
            })
          ])
        ]));
      });
      kids.push(e('div', { class: 'row' }, [start, liveBtn]));
      kids.push(e('span', { class: 'intro__note',
        text: 'You will see the answer and the story behind it after each question.' }));
    }

    this.mount(e('div', { class: 'intro' }, [
      this.frame(q.heroImage, q.heroAlt, q.heroCredit, kids)
    ]));
  };

  /* ---------------------------------------------------------------------
     Live game — screens
     --------------------------------------------------------------------- */

  Quiz.prototype.renderLobby = function (status) {
    var self = this, e = this.el.bind(this), q = this.quiz;
    this.progress(false);
    var L = this.live;
    var kids = [e('span', { class: 'overline', text: 'Live head-to-head' })];

    if (L.role === 'host') {
      kids.push(e('h2', { text: 'Your game is open' }));
      var link = liveUrl(this.shareUrl, q.id, L.code, this.anchor);
      kids.push(e('p', { class: 'lede',
        text: 'Send this to your opponent. You will both answer the same fifteen questions at the same time, twenty seconds each.' }));

      kids.push(e('div', { class: 'roomcode' }, [
        e('span', { class: 'roomcode__label', text: 'Game code' }),
        e('span', { class: 'roomcode__value', text: L.code })
      ]));

      var box = e('input', { class: 'linkbox', type: 'text', readonly: 'readonly',
        'aria-label': 'Live game link', value: link });
      var copy = e('button', { class: 'btn btn-primary', type: 'button', text: 'Copy link' });
      copy.addEventListener('click', function () {
        box.select();
        var done = function () {
          copy.textContent = 'Copied';
          setTimeout(function () { copy.textContent = 'Copy link'; }, 1600);
        };
        if (global.navigator && navigator.clipboard) {
          navigator.clipboard.writeText(link).then(done, done);
        } else { try { doc.execCommand('copy'); done(); } catch (err) {} }
      });
      kids.push(e('div', { class: 'linkrow' }, [box, copy]));
    } else {
      kids.push(e('h2', { text: 'Joining the game' }));
      kids.push(e('p', { class: 'lede',
        text: 'Fifteen questions, twenty seconds each, both of you at once.' }));
      kids.push(e('div', { class: 'roomcode' }, [
        e('span', { class: 'roomcode__label', text: 'Game code' }),
        e('span', { class: 'roomcode__value', text: L.code })
      ]));
    }

    /* Say how long the room stays open. Someone who has just texted a link
       needs to know whether they can put the phone down. */
    var waiting = status || (L.opponent
      ? L.opponent + ' is here. Starting…'
      : 'Waiting for your opponent to join…');
    var left = '';
    if (!L.opponent && !status && L.until) {
      var secs = Math.max(0, Math.round((L.until - Date.now()) / 1000));
      var mins = Math.floor(secs / 60);
      left = mins > 0
        ? ' Open for another ' + mins + ' minute' + (mins === 1 ? '' : 's') + '.'
        : ' Closing in under a minute.';
    }
    kids.push(e('p', { class: 'livestatus' }, [
      e('span', { class: 'livestatus__dot' }),
      e('span', { text: waiting + left })
    ]));

    var bail = e('button', { class: 'btn btn-quiet', type: 'button', text: 'Play on my own instead' });
    bail.addEventListener('click', function () {
      self.liveTeardown(); self.live = null; self.deal(); self.renderQuestion();
    });
    kids.push(e('div', { class: 'row' }, [bail]));

    this.mount(e('div', { class: 'intro' }, [
      this.frame(q.heroImage, q.heroAlt, q.heroCredit, kids)
    ]));
  };

  Quiz.prototype.liveFailed = function (why) {
    var self = this, e = this.el.bind(this), q = this.quiz;
    this.liveTeardown();
    this.progress(false);

    var solo = e('button', { class: 'btn btn-primary', type: 'button', text: 'Play on your own' });
    solo.addEventListener('click', function () {
      self.live = null; self.deal(); self.renderQuestion();
    });

    this.mount(e('div', { class: 'intro' }, [
      this.frame(q.heroImage, q.heroAlt, q.heroCredit, [
        e('span', { class: 'overline', text: 'Live game' }),
        e('h2', { text: 'That did not connect' }),
        e('p', { class: 'lede', text: why }),
        e('p', { class: 'caption',
          text: 'Some networks block direct connections between browsers. You can still play now and send your score as a challenge at the end — the questions are the same.' }),
        e('div', { class: 'row' }, [solo])
      ])
    ]));
  };

  Quiz.prototype.liveCountdown = function () {
    if (this.counting) return;
    this.counting = true;
    var self = this, e = this.el.bind(this);
    var n = 3;
    this.progress(false);

    function tick() {
      self.mount(e('div', { class: 'countdown' }, [
        e('span', { class: 'countdown__num', text: n > 0 ? String(n) : 'Go' }),
        e('span', { class: 'countdown__vs',
          text: (self.playerName || 'You') + '  vs  ' + (self.live.opponent || 'Opponent') })
      ]));
      if (n <= 0) {
        setTimeout(function () { self.playing = true; self.renderQuestion(); }, 600);
        return;
      }
      n--;
      setTimeout(tick, 900);
    }
    tick();
  };

  /* Twenty seconds a question. Running out scores it wrong and moves on —
     otherwise one player wandering off stalls the other indefinitely. */
  Quiz.prototype.startTimer = function () {
    var self = this;
    var cfg = this.quiz.live || {};
    var span = (cfg.seconds || 20) * 1000;
    var bar = this.root.getElementById('timerfill');
    var num = this.root.getElementById('timernum');
    var started = Date.now();

    if (this.timerId) clearInterval(this.timerId);
    this.timerId = setInterval(function () {
      var left = Math.max(0, span - (Date.now() - started));
      if (bar) bar.style.width = (left / span * 100) + '%';
      if (num) num.textContent = Math.ceil(left / 1000) + 's';
      if (bar) bar.className = 'timer__fill' + (left < 5000 ? ' is-urgent' : '');
      if (left <= 0) {
        clearInterval(self.timerId); self.timerId = null;
        if (!self.locked) self.choose(-1);   // -1 is never the right index
      }
    }, 100);
  };

  Quiz.prototype.renderQuestion = function () {
    var self = this, e = this.el.bind(this);
    var q = this.deck[this.index];
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

    var panelKids = [e('h3', { class: 'q-prompt', text: q.prompt }), list];
    if (this.live) {
      panelKids.unshift(e('div', { class: 'timer' }, [
        e('span', { class: 'timer__track' }, [
          e('span', { class: 'timer__fill', id: 'timerfill' })
        ]),
        e('span', { class: 'timer__num', id: 'timernum' })
      ]));
    }

    this.mount(e('div', {}, [
      this.frame(q.image, q.imageAlt, q.credit, panelKids),
      e('div', { class: 'actions', id: 'actions' })
    ]));

    this.progress(true);
    this.reveal();
    if (this.live) this.startTimer();
  };

  Quiz.prototype.choose = function (chosen) {
    if (this.locked) return;
    this.locked = true;
    if (this.timerId) { clearInterval(this.timerId); this.timerId = null; }
    var self = this, e = this.el.bind(this);
    this.answers[this.index] = chosen;

    var q = this.deck[this.index];
    var correct = chosen === q.answer;
    var timedOut = chosen === -1;

    this.root.querySelectorAll('.option').forEach(function (b, i) {
      b.disabled = true;
      if (i === q.answer) b.classList.add('option--correct');
      else if (i === chosen) b.classList.add('option--wrong');
      else b.classList.add('option--muted');
    });

    var fb = e('div', { class: 'feedback' + (correct ? '' : ' feedback--wrong'),
      role: 'status', 'aria-live': 'polite' });
    fb.appendChild(e('p', { class: 'feedback__verdict',
      text: correct ? 'Correct.' : timedOut ? "Time's up." : 'Not quite.' }));
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

    var last = this.index === this.deck.length - 1;
    var next = e('button', { class: 'btn btn-primary', type: 'button',
      text: last ? 'See your score' : 'Next question' });
    next.addEventListener('click', function () {
      if (self.revealId) { clearTimeout(self.revealId); self.revealId = null; }
      if (last) { self.live ? self.renderLiveResults() : self.renderResults(); }
      else { self.index++; self.renderQuestion(); }
    });
    var actions = this.root.getElementById('actions');
    actions.appendChild(e('span', { class: 'caption',
      text: (this.index + 1) + ' of ' + this.deck.length + ' answered' }));
    actions.appendChild(next);

    this.progress(true);
    next.focus({ preventScroll: true });

    if (this.live) {
      this.liveSend({ t: 'progress', i: this.index + 1, score: this.score() });
      /* Auto-advance so a distracted player cannot stall the race. The button
         is still there for anyone who wants to move on sooner. */
      var wait = ((this.quiz.live && this.quiz.live.revealSeconds) || 4) * 1000;
      if (this.revealId) clearTimeout(this.revealId);
      this.revealId = setTimeout(function () {
        if (last) { self.renderLiveResults(); }
        else { self.index++; self.renderQuestion(); }
      }, wait);
    }


  };

  /* Live results. Both players report their final score; whoever finishes
     second sees the comparison immediately, whoever finishes first sees a
     holding state until the other lands. */
  Quiz.prototype.renderLiveResults = function () {
    var self = this, e = this.el.bind(this), q = this.quiz;
    this.finished = true;
    this.playing = false;
    if (this.timerId) { clearInterval(this.timerId); this.timerId = null; }
    this.liveSend({ t: 'done', score: this.score(), name: this.playerName });

    var L = this.live;
    var score = this.score(), total = this.deck.length, tier = this.tier(score);

    if (!L.oppDone && !L.dropped) {
      this.progress(false);
      this.mount(e('div', { class: 'intro' }, [
        this.frame(q.heroImage, q.heroAlt, q.heroCredit, [
          e('span', { class: 'overline', text: 'Live head-to-head' }),
          e('h2', { text: 'You finished on ' + score + '/' + total }),
          e('p', { class: 'lede',
            text: 'Waiting for ' + (L.opponent || 'your opponent') + ' to finish…' }),
          e('p', { class: 'livestatus' }, [
            e('span', { class: 'livestatus__dot' }),
            e('span', { text: 'Still playing' })
          ])
        ])
      ]));
      return;
    }

    /* Hand the live outcome to the normal results screen by presenting the
       opponent as a challenge — same comparison UI, same badge. */
    this.challenge = {
      name: L.opponent || 'Your opponent',
      score: L.oppScore,
      total: total,
      deck: null
    };
    if (L.dropped) this.challenge.name = (L.opponent || 'Your opponent') + ' (left)';
    this.liveTeardown();
    this.renderResults();
  };

  Quiz.prototype.renderResults = function () {
    var self = this, e = this.el.bind(this), q = this.quiz;
    var score = this.score(), total = this.deck.length, tier = this.tier(score);
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
      self.deal(); self.renderQuestion();
    });

    /* No X / Facebook / LinkedIn intent links here. Those URLs can only carry
       text and a link — they cannot attach the badge image, so the visitor
       would post a bare link and wonder where their badge went. Instead:
       download it, or use the OS share sheet where it can carry the file. */
    var row = e('div', { class: 'row' });
    var shareBtn = null;
    if (global.navigator && navigator.share && navigator.canShare) {
      shareBtn = e('button', { class: 'share-btn', type: 'button', text: 'Share badge' });
      row.appendChild(shareBtn);
    }

    var c = this.challenge;
    var versus = null, verdict = '';
    if (c) {
      var me = this.playerName || 'You';
      verdict = score > c.score ? 'You win.'
              : score < c.score ? c.name + ' wins.'
              : 'A dead heat.';
      versus = me + ' ' + score + ' — ' + c.name + ' ' + c.score;
    }

    var panel = [];
    panel.push(e('span', { class: 'overline', text: q.title }));

    if (c) {
      panel.push(e('div', { class: 'versus' }, [
        e('div', { class: 'versus__side' + (score >= c.score ? ' is-win' : '') }, [
          e('span', { class: 'versus__name', text: this.playerName || 'You' }),
          e('span', { class: 'versus__score', text: String(score) })
        ]),
        e('span', { class: 'versus__v', text: 'vs' }),
        e('div', { class: 'versus__side' + (c.score >= score ? ' is-win' : '') }, [
          e('span', { class: 'versus__name', text: c.name }),
          e('span', { class: 'versus__score', text: String(c.score) })
        ])
      ]));
      panel.push(e('h3', { class: 'results__tier', text: verdict }));
      panel.push(e('p', { class: 'results__line',
        text: tier.name + ' — ' + tier.line }));
    } else {
      panel.push(e('p', { class: 'results__score',
        html: score + '<span>/' + total + '</span>' }));
      panel.push(e('h3', { class: 'results__tier', text: tier.name }));
      panel.push(e('p', { class: 'results__line', text: tier.line }));
    }

    panel.push(e('div', { class: 'row' }, [dl, again]));
    panel.push(row);

    /* Challenge builder — collapsed until asked for, so the results screen
       stays a results screen. */
    var chal = e('details', { class: 'challenge' });
    chal.appendChild(e('summary', {
      text: c ? 'Challenge someone back' : 'Challenge a friend' }));
    var cbody = e('div', { class: 'challenge__body' });
    cbody.appendChild(this.nameField('Your name, for the challenge', function (name) {
      cbody.innerHTML = '';
      var token = self.deckToken(name, score);
      var link = challengeUrl(self.shareUrl, token, self.anchor);

      var box = e('input', { class: 'linkbox', type: 'text', readonly: 'readonly',
        'aria-label': 'Challenge link', value: link });
      var copy = e('button', { class: 'btn btn-primary', type: 'button', text: 'Copy link' });
      copy.addEventListener('click', function () {
        box.select();
        var done = function () {
          copy.textContent = 'Copied';
          setTimeout(function () { copy.textContent = 'Copy link'; }, 1600);
        };
        if (global.navigator && navigator.clipboard) {
          navigator.clipboard.writeText(link).then(done, function () { done(); });
        } else { try { doc.execCommand('copy'); done(); } catch (err) {} }
      });
      cbody.appendChild(e('p', { class: 'caption',
        text: 'Send this to a friend. They get the same fifteen questions in the same order, and their result is measured against your ' + score + '/' + total + '.' }));
      cbody.appendChild(e('div', { class: 'linkrow' }, [box, copy]));
      if (global.navigator && navigator.share) {
        var sh = e('button', { class: 'share-btn', type: 'button', text: 'Send' });
        sh.addEventListener('click', function () {
          navigator.share({
            title: q.title,
            text: name + ' scored ' + score + '/' + total + ' on the ' + q.title +
                  ' quiz. Can you beat it?',
            url: link
          }).catch(function () {});
        });
        cbody.appendChild(e('div', { class: 'row' }, [sh]));
      }
    }));
    chal.appendChild(cbody);
    panel.push(chal);

    panel.push(e('p', { class: 'caption', style: 'margin-top:.6rem',
      text: 'Save the badge, then post it wherever you like.' }));

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
    self.deck.forEach(function (item, i) {
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
    var isCrossOrigin = BASE && BASE.indexOf(global.location.origin + '/') !== 0;
    function loadImg(src) {
      var im = new Image();
      if (isCrossOrigin) im.crossOrigin = 'anonymous';
      im.src = src;
      return im;
    }
    var photo = q.heroImage ? loadImg(url(q.heroImage)) : null;
    var logo = loadImg(url('assets/img/brand/trpl-wordmark-white.png'));

    var canvas = null;
    var filename = 'trpl-' + q.id + '-' + score + 'of' + total + '.png';
    function opts(withPhoto) {
      return {
        score: score, total: total, tier: tier.name, line: tier.line,
        quizTitle: (q.badge && q.badge.title) || q.title,
        versus: versus,
        photo: withPhoto && photo && photo.complete && photo.naturalWidth ? photo : null,
        logo: logo.complete && logo.naturalWidth ? logo : null
      };
    }
    function build() {
      canvas = BADGE.draw(opts(true));
      try {
        img.src = canvas.toDataURL('image/png');
      } catch (err) {
        // tainted — fall back to the typographic badge, which always exports
        canvas = BADGE.draw(opts(false));
        img.src = canvas.toDataURL('image/png');
      }
    }
    dl.addEventListener('click', function () {
      if (canvas) BADGE.download(canvas, filename);
    });
    if (shareBtn) {
      shareBtn.addEventListener('click', function () {
        if (!canvas) return;
        canvas.toBlob(function (blob) {
          var file = new File([blob], filename, { type: 'image/png' });
          if (navigator.canShare({ files: [file] })) {
            navigator.share({ files: [file], text: shareText + ' ' + shareUrl })
              .catch(function () {});
          } else {
            // the platform will not carry the image — give them the file instead
            BADGE.download(canvas, filename);
          }
        }, 'image/png');
      });
    }
    [photo, logo].forEach(function (im) {
      if (!im) return;
      im.addEventListener('load', build);
      im.addEventListener('error', build);
    });
    build();
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
    if (!host.id) host.id = anchorFor(id);

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
        var quiz = new Quiz(root, data, shareUrlFor(host));
        quiz.anchor = host.id;
        /* Only honour a challenge aimed at this quiz — a page can carry more
           than one embed, and the link names which quiz it belongs to. */
        var c = readChallenge();
        if (c && c.quiz === data.id) quiz.challenge = c;
        var inv = readLive();
        if (inv && inv.quiz === data.id && inv.code) quiz.liveInvite = inv;
        quiz.renderIntro();
        /* Arrived on a challenge link: the embed is usually well down the page,
           so put it in front of them rather than making them hunt for it. */
        if (quiz.challenge || quiz.liveInvite) {
          setTimeout(function () {
            host.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 120);
        }
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
