(function () {
  'use strict';

  var C = window.Candlepin;
  var KEYS = {
    current: 'candlepin.current.v1',
    history: 'candlepin.history.v1',
    names: 'candlepin.names.v1'
  };
  var MAX_PLAYERS = 8;

  // ---------- Storage ----------

  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      alert('Could not save to this device: ' + e.message);
    }
  }

  // Ask the browser not to evict our data when storage runs low.
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});

  var state = {
    game: load(KEYS.current, null),
    history: load(KEYS.history, []),
    names: load(KEYS.names, ['']),
    view: 'game'
  };

  function persistGame() { save(KEYS.current, state.game); }
  function persistHistory() { save(KEYS.history, state.history); }

  // ---------- Game logic ----------

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function startGame(names) {
    state.game = {
      id: newId(),
      startedAt: new Date().toISOString(),
      finishedAt: null,
      players: names.map(function (n) { return { name: n, balls: [] }; }),
      log: [] // player index for each ball thrown, used for undo
    };
    persistGame();
  }

  /* Whose turn it is: everyone bowls frame N before anyone bowls frame N+1. */
  function currentTurn(game) {
    var best = null;
    for (var p = 0; p < game.players.length; p++) {
      var balls = game.players[p].balls;
      var next = C.nextBall(balls);
      if (!next) continue;
      if (next.ball > 0) return { player: p, next: next }; // mid-frame
      if (!best || next.frame < best.next.frame) best = { player: p, next: next };
    }
    return best; // null when the game is over
  }

  function throwBall(pins, foul) {
    var game = state.game;
    var turn = currentTurn(game);
    if (!turn) return;
    var ball = { pins: foul ? 0 : pins };
    if (foul) ball.foul = true;
    game.players[turn.player].balls.push(ball);
    game.log.push(turn.player);
    if (!currentTurn(game)) finishGame();
    persistGame();
    if (navigator.vibrate) navigator.vibrate(15);
    render();
  }

  function undo() {
    var game = state.game;
    if (!game || !game.log.length) return;
    var p = game.log.pop();
    game.players[p].balls.pop();
    if (game.finishedAt) {
      game.finishedAt = null;
      state.history = state.history.filter(function (g) { return g.id !== game.id; });
      persistHistory();
    }
    persistGame();
    render();
  }

  function finishGame() {
    var game = state.game;
    game.finishedAt = new Date().toISOString();
    state.history = state.history.filter(function (g) { return g.id !== game.id; });
    state.history.unshift(JSON.parse(JSON.stringify(game)));
    persistHistory();
  }

  // ---------- Rendering helpers ----------

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (k === 'text') node.textContent = attrs[k];
        else if (k === 'className') node.className = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else node.setAttribute(k, attrs[k]);
      }
    }
    (children || []).forEach(function (c) {
      if (c != null) node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function $(id) { return document.getElementById(id); }

  function playerLabel(player, index) {
    return player.name || 'Bowler ' + (index + 1);
  }

  function formatDate(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) +
      ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  function markClass(mark) {
    if (mark === 'X') return 'X';
    if (mark === '/') return 'slash';
    if (mark === 'F') return 'F';
    return '';
  }

  function scorecard(player, index, opts) {
    opts = opts || {};
    var frames = C.buildFrames(player.balls);
    var s = C.stats(player.balls);
    var grid = el('div', { className: 'frames' });

    frames.forEach(function (fr, f) {
      var balls = el('div', { className: 'frame-balls' });
      for (var b = 0; b < 3; b++) {
        var m = fr.marks[b] || '';
        balls.appendChild(el('span', { className: markClass(m), text: m }));
      }
      var cls = 'frame';
      if (opts.currentFrame === f) cls += ' current';
      if (fr.type === 'tenbox') cls += ' tenbox';
      grid.appendChild(el('div', { className: cls, title: fr.type === 'tenbox' ? 'Ten-box' : '' }, [
        el('div', { className: 'frame-num', text: String(f + 1) }),
        balls,
        el('div', { className: 'frame-total', text: fr.total !== null ? String(fr.total) : '' })
      ]));
    });

    var meta = [
      'Throws: ' + s.throws,
      'Strikes: ' + s.strikes,
      'Spares: ' + s.spares,
      'Ten-boxes: ' + s.tenBoxes
    ];
    if (s.fouls) meta.push('Fouls: ' + s.fouls);
    if (!s.complete && s.throws) meta.push('Max possible: ' + C.maxPossible(player.balls));

    return el('div', { className: 'card' + (opts.active ? ' active' : '') }, [
      el('div', { className: 'card-head' }, [
        el('div', { className: 'card-name', text: playerLabel(player, index) }),
        el('div', { className: 'card-total', text: String(s.score) })
      ]),
      grid,
      el('div', { className: 'card-meta' }, meta.map(function (t) { return el('span', { text: t }); }))
    ]);
  }

  function summaryTable(game) {
    var rows = game.players.map(function (p, i) { return { p: p, i: i, s: C.stats(p.balls) }; });
    var top = Math.max.apply(null, rows.map(function (r) { return r.s.score; }));
    var head = el('tr', null, ['Bowler', 'Score', 'Throws', 'X', '/', '10-box', '1st avg'].map(function (h) {
      return el('th', { text: h });
    }));
    var body = rows.map(function (r) {
      var win = game.players.length > 1 && r.s.score === top;
      return el('tr', null, [
        el('td', { className: win ? 'winner' : '', text: (win ? '★ ' : '') + playerLabel(r.p, r.i) }),
        el('td', { className: 'score', text: String(r.s.score) }),
        el('td', { text: String(r.s.throws) }),
        el('td', { text: String(r.s.strikes) }),
        el('td', { text: String(r.s.spares) }),
        el('td', { text: String(r.s.tenBoxes) }),
        el('td', { text: r.s.firstBallAverage.toFixed(1) })
      ]);
    });
    return el('div', { className: 'table-wrap' }, [
      el('table', { className: 'summary-table' }, [el('thead', null, [head]), el('tbody', null, body)])
    ]);
  }

  // ---------- Views ----------

  function renderSetup() {
    var list = $('player-list');
    list.innerHTML = '';
    state.names.forEach(function (name, i) {
      var input = el('input', {
        type: 'text',
        value: name,
        placeholder: 'Bowler ' + (i + 1),
        autocomplete: 'off',
        maxlength: '24',
        'aria-label': 'Bowler ' + (i + 1) + ' name'
      });
      input.addEventListener('input', function () {
        state.names[i] = input.value;
        save(KEYS.names, state.names);
      });
      var remove = el('button', {
        className: 'btn secondary remove',
        'aria-label': 'Remove bowler',
        text: '×',
        onclick: function () {
          state.names.splice(i, 1);
          if (!state.names.length) state.names.push('');
          save(KEYS.names, state.names);
          renderSetup();
        }
      });
      list.appendChild(el('li', null, [input, state.names.length > 1 ? remove : null]));
    });
    $('add-player').disabled = state.names.length >= MAX_PLAYERS;
  }

  function renderGame() {
    var game = state.game;
    var turn = currentTurn(game);
    var cards = $('scorecards');
    cards.innerHTML = '';
    game.players.forEach(function (p, i) {
      var active = turn && turn.player === i;
      cards.appendChild(scorecard(p, i, { active: active, currentFrame: active ? turn.next.frame : -1 }));
    });

    $('input-panel').hidden = !turn;
    $('game-over').hidden = !!turn;
    $('btn-abandon').hidden = !turn;

    if (turn) {
      var player = game.players[turn.player];
      var standing = turn.next.standing;
      $('turn-player').textContent = playerLabel(player, turn.player);
      var detail = 'Frame ' + (turn.next.frame + 1) + ' · Ball ' + (turn.next.ball + 1);
      if (turn.next.frame === 9 && turn.next.ball > 0 && standing === 10) detail += ' · pins reset';
      $('turn-detail').textContent = detail;
      $('standing-count').textContent = String(standing);

      var pad = $('pin-pad');
      pad.innerHTML = '';
      for (var n = 0; n < 10; n++) {
        (function (n) {
          var btn = el('button', { className: 'btn', text: String(n), onclick: function () { throwBall(n); } });
          btn.disabled = n > standing;
          pad.appendChild(btn);
        })(n);
      }
      var allLabel;
      var rackBall = rackBallIndex(player.balls, turn.next);
      if (rackBall === 0) allLabel = 'Strike (10)';
      else if (rackBall === 1) allLabel = 'Spare (' + standing + ')';
      else allLabel = 'All ' + standing;
      pad.appendChild(el('button', { className: 'btn all', text: allLabel, onclick: function () { throwBall(standing); } }));
      $('btn-undo').disabled = !game.log.length;
    } else {
      var summary = $('summary');
      summary.innerHTML = '';
      summary.appendChild(summaryTable(game));
    }
  }

  /* Which ball of the current rack is next (0, 1 or 2); differs from ball-in-frame in the 10th. */
  function rackBallIndex(balls, next) {
    var frame = C.buildFrames(balls)[next.frame];
    var idx = 0;
    var rack = 10;
    frame.balls.forEach(function (b) {
      rack -= b.foul ? 0 : b.pins;
      idx++;
      if (rack === 0) { rack = 10; idx = 0; }
    });
    return idx;
  }

  function renderHistory() {
    var list = $('history-list');
    list.innerHTML = '';
    if (!state.history.length) {
      list.appendChild(el('div', { className: 'empty', text: 'Finished games will appear here.' }));
    }
    state.history.forEach(function (game) {
      var scores = game.players.map(function (p, i) {
        return playerLabel(p, i) + ' ' + C.totalScore(p.balls);
      }).join(' · ');
      var body = el('div', { className: 'body' });
      var details = el('details', { className: 'history-item' }, [
        el('summary', null, [
          el('div', null, [
            el('div', { className: 'scores', text: scores }),
            el('div', { className: 'date', text: formatDate(game.finishedAt || game.startedAt) })
          ]),
          el('div', { className: 'muted', text: '▾' })
        ]),
        body
      ]);
      // Build the scorecards only when the game is opened.
      details.addEventListener('toggle', function () {
        if (!details.open || body.childNodes.length) return;
        game.players.forEach(function (p, i) { body.appendChild(scorecard(p, i)); });
        body.appendChild(summaryTable(game));
        body.appendChild(el('button', {
          className: 'btn link danger',
          text: 'Delete this game',
          onclick: function () {
            if (!confirm('Delete this game from history?')) return;
            state.history = state.history.filter(function (g) { return g.id !== game.id; });
            persistHistory();
            renderHistory();
          }
        }));
      });
      list.appendChild(details);
    });
    renderPlayerStats();
  }

  function renderPlayerStats() {
    var byName = {};
    state.history.forEach(function (game) {
      game.players.forEach(function (p, i) {
        var name = playerLabel(p, i);
        var key = name.trim().toLowerCase();
        var s = C.stats(p.balls);
        var r = byName[key] || (byName[key] = { name: name, games: 0, total: 0, high: 0, throws: 0, strikes: 0, spares: 0 });
        r.games++;
        r.total += s.score;
        r.high = Math.max(r.high, s.score);
        r.throws += s.throws;
        r.strikes += s.strikes;
        r.spares += s.spares;
      });
    });
    var rows = Object.keys(byName).map(function (k) { return byName[k]; });
    rows.sort(function (a, b) { return b.total / b.games - a.total / a.games; });

    var box = $('player-stats');
    box.innerHTML = '';
    if (!rows.length) {
      box.appendChild(el('div', { className: 'empty', text: 'No games yet.' }));
      return;
    }
    var head = el('tr', null, ['Bowler', 'Games', 'Avg', 'High', 'Throws/gm', 'X', '/'].map(function (h) {
      return el('th', { text: h });
    }));
    var body = rows.map(function (r) {
      return el('tr', null, [
        el('td', { text: r.name }),
        el('td', { text: String(r.games) }),
        el('td', { className: 'score', text: (r.total / r.games).toFixed(1) }),
        el('td', { text: String(r.high) }),
        el('td', { text: (r.throws / r.games).toFixed(1) }),
        el('td', { text: String(r.strikes) }),
        el('td', { text: String(r.spares) })
      ]);
    });
    box.appendChild(el('div', { className: 'table-wrap card' }, [
      el('table', { className: 'summary-table' }, [el('thead', null, [head]), el('tbody', null, body)])
    ]));
  }

  function render() {
    var view = state.view === 'history' ? 'history' : state.game ? 'game' : 'setup';
    $('view-setup').hidden = view !== 'setup';
    $('view-game').hidden = view !== 'game';
    $('view-history').hidden = view !== 'history';
    document.querySelectorAll('.tab').forEach(function (t) {
      t.setAttribute('aria-selected', String(t.dataset.view === state.view));
    });
    if (view === 'setup') renderSetup();
    if (view === 'game') renderGame();
    if (view === 'history') renderHistory();
  }

  // ---------- Events ----------

  document.querySelectorAll('.tab').forEach(function (t) {
    t.addEventListener('click', function () {
      state.view = t.dataset.view;
      render();
      window.scrollTo(0, 0);
    });
  });

  $('add-player').addEventListener('click', function () {
    if (state.names.length >= MAX_PLAYERS) return;
    state.names.push('');
    save(KEYS.names, state.names);
    renderSetup();
    var inputs = document.querySelectorAll('#player-list input');
    inputs[inputs.length - 1].focus();
  });

  $('start-game').addEventListener('click', function () {
    startGame(state.names.map(function (n) { return n.trim(); }));
    render();
  });

  $('btn-foul').addEventListener('click', function () { throwBall(0, true); });
  $('btn-undo').addEventListener('click', undo);
  $('btn-undo-final').addEventListener('click', undo);

  $('btn-rematch').addEventListener('click', function () {
    startGame(state.game.players.map(function (p) { return p.name; }));
    render();
    window.scrollTo(0, 0);
  });

  $('btn-new-players').addEventListener('click', function () {
    state.game = null;
    persistGame();
    render();
  });

  $('btn-abandon').addEventListener('click', function () {
    if (!confirm('Abandon this game? It will not be saved to history.')) return;
    state.game = null;
    persistGame();
    render();
  });

  $('btn-export').addEventListener('click', function () {
    var data = JSON.stringify({ app: 'candlepin-scoreboard', version: 1, history: state.history }, null, 2);
    var url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    var a = el('a', { href: url, download: 'candlepin-history-' + new Date().toISOString().slice(0, 10) + '.json' });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });

  $('import-file').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) return;
    file.text().then(function (text) {
      var data = JSON.parse(text);
      var games = Array.isArray(data) ? data : data.history;
      if (!Array.isArray(games)) throw new Error('No games found in file.');
      var ids = {};
      state.history.forEach(function (g) { ids[g.id] = true; });
      var added = games.filter(function (g) { return g && g.id && Array.isArray(g.players) && !ids[g.id]; });
      state.history = state.history.concat(added).sort(function (a, b) {
        return (b.finishedAt || b.startedAt).localeCompare(a.finishedAt || a.startedAt);
      });
      persistHistory();
      renderHistory();
      alert('Imported ' + added.length + ' game' + (added.length === 1 ? '' : 's') + '.');
    }).catch(function (err) {
      alert('Could not import: ' + err.message);
    });
    e.target.value = '';
  });

  $('btn-clear-history').addEventListener('click', function () {
    if (!confirm('Delete ALL past games? This cannot be undone.')) return;
    state.history = [];
    persistHistory();
    renderHistory();
  });

  // Pick up changes made in another tab.
  window.addEventListener('storage', function () {
    state.game = load(KEYS.current, null);
    state.history = load(KEYS.history, []);
    render();
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }

  render();
})();
