(function () {
  'use strict';

  var EXAMS = ['paper1', 'obgyn'];
  var LETTERS = ['A', 'B', 'C', 'D', 'E'];
  var params = new URLSearchParams(location.search);
  var examId = params.get('exam');
  var $ = function (id) { return document.getElementById(id); };

  if (EXAMS.indexOf(examId) === -1) { show('error'); return; }

  var script = document.createElement('script');
  script.src = 'data/' + examId + '.js';
  script.onload = function () { init(window.PGET_EXAM); };
  script.onerror = function () { show('error'); };
  document.head.appendChild(script);

  // ---------- helpers ----------
  function show(id) {
    ['start', 'exam', 'results', 'error'].forEach(function (s) { $(s).classList.toggle('hidden', s !== id); });
    window.scrollTo(0, 0);
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtTime(sec) {
    sec = Math.max(0, Math.round(sec));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return (h ? h + ':' : '') + String(m).padStart(h ? 2 : 1, '0') + ':' + String(s).padStart(2, '0');
  }
  function fmtDuration(sec) {
    var h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
    if (sec < 60) return sec + ' s';
    return h ? h + ' h ' + m + ' min' : m + ' min';
  }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  // ---------- storage ----------
  var KEY = 'pget-' + examId + '-v1';
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) {} }

  var exam, Q, state, tick;

  function freshState(timed) {
    return { answers: {}, flagged: {}, current: 0, elapsed: 0, timed: timed, submitted: false, startedAt: Date.now() };
  }

  // ---------- init ----------
  function init(data) {
    exam = data; Q = data.questions;
    document.title = data.short + ' — PGET Mock';
    var saved = load();
    if (saved && saved.submitted) { state = saved; renderResults(); return; }
    renderStart(saved);
  }

  // ---------- start screen ----------
  function renderStart(saved) {
    $('s-title').textContent = exam.title;
    $('s-sub').textContent = exam.subtitle;
    $('s-dur').textContent = fmtDuration(exam.durationMin * 60);

    var bySub = {}, order = [];
    Q.forEach(function (q) {
      if (!bySub[q.subject]) { bySub[q.subject] = { n: 0, topics: {} }; order.push(q.subject); }
      bySub[q.subject].n++;
      bySub[q.subject].topics[q.topic] = (bySub[q.subject].topics[q.topic] || 0) + 1;
    });
    var html = '<thead><tr><th>Subject</th><th>Topics</th><th class="num">MCQs</th></tr></thead><tbody>';
    order.forEach(function (s) {
      var t = Object.keys(bySub[s].topics).map(function (k) { return esc(k) + ' (' + bySub[s].topics[k] + ')'; }).join(', ');
      html += '<tr><td><b>' + esc(s) + '</b></td><td class="small muted">' + t + '</td><td class="num">' + bySub[s].n + '</td></tr>';
    });
    $('s-blueprint').innerHTML = html + '</tbody>';

    if (saved) {
      $('s-resume').classList.remove('hidden');
      $('s-begin').textContent = 'Start over';
      $('s-begin').classList.remove('primary');
      $('s-resume').classList.add('primary');
      var n = Object.keys(saved.answers).length;
      var note = 'You have answered ' + n + ' of ' + Q.length + ' questions';
      if (saved.timed) note += ', with ' + fmtTime(exam.durationMin * 60 - saved.elapsed) + ' left on the clock';
      $('s-resume-note').textContent = note + '. Starting over erases this attempt.';
      $('s-resume-note').classList.remove('hidden');
      $('s-timed').checked = !!saved.timed;
    }
    $('s-begin').onclick = function () {
      state = freshState($('s-timed').checked); save(); startExam();
    };
    $('s-resume').onclick = function () {
      state = saved; state.timed = $('s-timed').checked; save(); startExam();
    };
    show('start');
  }

  // ---------- exam ----------
  function startExam() {
    $('e-title').textContent = exam.short;
    buildNav();
    renderQ();
    updateTimer();
    clearInterval(tick);
    tick = setInterval(function () {
      if (document.hidden) return;
      state.elapsed++;
      if (state.elapsed % 5 === 0) save();
      updateTimer();
      if (state.timed && state.elapsed >= exam.durationMin * 60) { save(); submit(true); }
    }, 1000);
    show('exam');
  }

  function updateTimer() {
    var t = $('e-timer');
    if (state.timed) {
      var left = exam.durationMin * 60 - state.elapsed;
      t.textContent = '⏱ ' + fmtTime(left);
      t.classList.toggle('low', left <= 600);
      t.title = 'Time remaining';
    } else {
      t.textContent = '⏱ ' + fmtTime(state.elapsed);
      t.title = 'Time elapsed (untimed)';
    }
  }

  function answeredCount() { return Object.keys(state.answers).length; }

  function buildNav() {
    var g = $('nav-grid'); g.innerHTML = '';
    Q.forEach(function (q, i) {
      var b = el('button', 'nav-cell', String(i + 1));
      b.setAttribute('aria-label', 'Question ' + (i + 1));
      b.onclick = function () { go(i); if (window.innerWidth <= 820) togglePanel(true); };
      g.appendChild(b);
    });
    $('nav-toggle').onclick = function () { togglePanel(); };
  }
  function togglePanel(forceCollapse) {
    var p = $('nav-panel');
    var collapse = forceCollapse === true ? true : !p.classList.contains('collapsed');
    p.classList.toggle('collapsed', collapse);
    $('nav-toggle').textContent = collapse ? 'Show' : 'Hide';
  }
  function refreshNav() {
    var cells = $('nav-grid').children;
    for (var i = 0; i < cells.length; i++) {
      var id = Q[i].id;
      cells[i].classList.toggle('answered', state.answers[id] != null);
      cells[i].classList.toggle('flag', !!state.flagged[id]);
      cells[i].classList.toggle('current', i === state.current);
    }
    var n = answeredCount();
    $('e-count').textContent = n + ' / ' + Q.length + ' answered';
    $('e-progress').style.width = (n / Q.length * 100) + '%';
  }

  function renderQ() {
    var i = state.current, q = Q[i];
    $('q-meta').innerHTML = '<b style="color:var(--text)">Question ' + (i + 1) + ' of ' + Q.length + '</b>' +
      '<span>·</span><span>' + esc(q.subject) + '</span>';
    $('q-stem').textContent = q.question;
    var box = $('q-opts'); box.innerHTML = '';
    q.options.forEach(function (o, k) {
      var b = el('button', 'opt' + (state.answers[q.id] === k ? ' selected' : ''),
        '<span class="letter">' + LETTERS[k] + '</span><span>' + esc(o) + '</span>');
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', state.answers[q.id] === k ? 'true' : 'false');
      b.onclick = function () { choose(k); };
      box.appendChild(b);
    });
    $('q-prev').disabled = i === 0;
    $('q-next').textContent = i === Q.length - 1 ? 'Review & submit' : 'Next →';
    var f = $('q-flag');
    f.classList.toggle('flagged', !!state.flagged[q.id]);
    f.textContent = state.flagged[q.id] ? '⚑ Flagged' : '⚑ Flag for review';
    $('q-clear').classList.toggle('hidden', state.answers[q.id] == null);
    refreshNav();
  }

  function choose(k) {
    var q = Q[state.current];
    state.answers[q.id] = k;
    save(); renderQ();
  }
  function go(i) {
    if (i < 0 || i >= Q.length) return;
    state.current = i; save(); renderQ();
    $('q-card').scrollIntoView({ block: 'nearest' });
  }

  $('q-prev').onclick = function () { go(state.current - 1); };
  $('q-next').onclick = function () {
    if (state.current === Q.length - 1) openConfirm(); else go(state.current + 1);
  };
  $('q-flag').onclick = toggleFlag;
  $('q-clear').onclick = function () { delete state.answers[Q[state.current].id]; save(); renderQ(); };
  $('e-submit').onclick = openConfirm;

  function toggleFlag() {
    var id = Q[state.current].id;
    if (state.flagged[id]) delete state.flagged[id]; else state.flagged[id] = true;
    save(); renderQ();
  }

  document.addEventListener('keydown', function (e) {
    if ($('exam').classList.contains('hidden') || $('modal').classList.contains('open')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var k = e.key.toUpperCase();
    var idx = LETTERS.indexOf(k);
    if (idx === -1 && k >= '1' && k <= '5') idx = Number(k) - 1;
    if (idx !== -1) { choose(idx); e.preventDefault(); return; }
    if (e.key === 'ArrowRight') { go(state.current + 1); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { go(state.current - 1); e.preventDefault(); }
    else if (k === 'F') { toggleFlag(); e.preventDefault(); }
  });

  // ---------- confirm modal ----------
  function openConfirm() {
    var n = answeredCount(), un = Q.length - n, fl = Object.keys(state.flagged).length;
    var msg = '<p style="margin:0">You have answered <b>' + n + '</b> of ' + Q.length + ' questions.</p>';
    if (un) msg += '<p style="margin:8px 0 0">' + un + ' unanswered question' + (un > 1 ? 's' : '') + ' will be marked as unanswered.</p>';
    if (fl) msg += '<p style="margin:8px 0 0">' + fl + ' question' + (fl > 1 ? 's are' : ' is') + ' still flagged for review.</p>';
    $('m-body').innerHTML = msg;
    $('modal').classList.add('open');
    $('m-ok').focus();
  }
  function closeConfirm() { $('modal').classList.remove('open'); }
  $('m-cancel').onclick = closeConfirm;
  $('m-ok').onclick = function () { closeConfirm(); submit(false); };
  $('modal').addEventListener('click', function (e) { if (e.target === $('modal')) closeConfirm(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeConfirm(); });

  // ---------- scoring ----------
  function submit(timeUp) {
    clearInterval(tick);
    var correct = 0, wrong = 0, skipped = 0, subjects = {}, order = [];
    Q.forEach(function (q) {
      if (!subjects[q.subject]) { subjects[q.subject] = { total: 0, correct: 0 }; order.push(q.subject); }
      subjects[q.subject].total++;
      var a = state.answers[q.id];
      if (a == null) skipped++;
      else if (a === q.answer) { correct++; subjects[q.subject].correct++; }
      else wrong++;
    });
    state.submitted = true;
    state.timeUp = !!timeUp;
    state.finishedAt = Date.now();
    state.result = { correct: correct, wrong: wrong, skipped: skipped, total: Q.length, subjects: subjects, order: order };
    save();
    renderResults();
  }

  // ---------- results ----------
  var filter = 'wrong';
  function renderResults() {
    var r = state.result, pct = Math.round(r.correct / r.total * 100);
    $('r-title').textContent = exam.short;
    var when = new Date(state.finishedAt || Date.now());
    $('r-when').textContent = 'Submitted ' + when.toLocaleString() + ' · time used ' + fmtDuration(state.elapsed) +
      (state.timeUp ? ' · auto-submitted when time ran out' : '');

    var C = 2 * Math.PI * 64, dash = C * r.correct / r.total;
    $('r-ring').innerHTML =
      '<svg viewBox="0 0 150 150" aria-hidden="true"><circle cx="75" cy="75" r="64" fill="none" stroke="var(--surface-2)" stroke-width="14"/>' +
      '<circle cx="75" cy="75" r="64" fill="none" stroke="var(--accent)" stroke-width="14" stroke-linecap="round" stroke-dasharray="' + dash + ' ' + C + '"/></svg>' +
      '<div class="lbl"><div><div class="big">' + r.correct + '<span class="muted" style="font-size:1rem;font-weight:600"> / ' + r.total + '</span></div><div class="muted small">' + pct + '%</div></div></div>';

    $('r-stats').innerHTML =
      stat('good', r.correct, 'Correct') + stat('bad', r.wrong, 'Wrong') + stat('', r.skipped, 'Unanswered') +
      stat('', pct + '%', 'Score');

    var html = '<thead><tr><th>Subject</th><th class="num">Score</th><th style="width:40%">&nbsp;</th><th class="num">%</th></tr></thead><tbody>';
    r.order.forEach(function (s) {
      var x = r.subjects[s], p = Math.round(x.correct / x.total * 100);
      html += '<tr><td>' + esc(s) + '</td><td class="num">' + x.correct + ' / ' + x.total + '</td>' +
        '<td><div class="bar"><div style="width:' + p + '%"></div></div></td><td class="num">' + p + '%</td></tr>';
    });
    $('r-subjects').innerHTML = html + '</tbody>';

    var filters = [
      ['wrong', 'Wrong (' + r.wrong + ')'],
      ['skip', 'Unanswered (' + r.skipped + ')'],
      ['right', 'Correct (' + r.correct + ')'],
      ['all', 'All (' + r.total + ')']
    ];
    if (r.wrong === 0) filter = r.skipped ? 'skip' : 'all';
    var fbox = $('r-filters'); fbox.innerHTML = '';
    filters.forEach(function (f) {
      var b = el('button', 'chip' + (filter === f[0] ? ' active' : ''), esc(f[1]));
      b.onclick = function () { filter = f[0]; renderResults(); };
      fbox.appendChild(b);
    });
    renderReview();

    $('r-review-btn').textContent = r.wrong ? 'Review mistakes ↓' : 'Review answers ↓';
    $('r-review-btn').onclick = function () { $('r-review-anchor').scrollIntoView({ behavior: 'smooth' }); };
    $('r-retake').onclick = function () {
      if (!window.confirmRetake) {
        $('r-retake').textContent = 'Click again to erase this result and retake';
        window.confirmRetake = true;
        setTimeout(function () { window.confirmRetake = false; $('r-retake').textContent = 'Retake this exam'; }, 4000);
        return;
      }
      window.confirmRetake = false;
      clear(); state = null; renderStart(null);
    };
    show('results');
  }

  function stat(cls, v, k) {
    return '<div class="stat ' + cls + '"><div class="v">' + v + '</div><div class="k">' + k + '</div></div>';
  }

  function renderReview() {
    var list = $('r-list'); list.innerHTML = '';
    var shown = 0;
    Q.forEach(function (q, i) {
      var a = state.answers[q.id];
      var kind = a == null ? 'skip' : (a === q.answer ? 'right' : 'wrong');
      if (filter !== 'all' && filter !== kind) return;
      shown++;
      var card = el('article', 'card review ' + kind + ' stack');
      var verdict = { right: '✓ Correct', wrong: '✗ Wrong', skip: '— Not answered' }[kind];
      var head = '<div class="q-meta" style="margin:0"><b style="color:var(--text)">Q' + (i + 1) + '</b><span>·</span><span>' +
        esc(q.subject) + ' — ' + esc(q.topic) + '</span>' +
        (q.domain === 'attitude' ? '<span class="pill warn">Attitude</span>' : '') +
        '<span class="spacer"></span><span class="verdict ' + kind + '">' + verdict + '</span></div>';
      var opts = '<div>';
      q.options.forEach(function (o, k) {
        var c = '', tag = '';
        if (k === q.answer) { c = 'correct'; tag = a === k ? 'Your answer ✓' : 'Correct answer'; }
        else if (k === a) { c = 'picked-wrong'; tag = 'Your answer ✗'; }
        opts += '<div class="r-opt ' + c + '"><span class="letter">' + LETTERS[k] + '</span><span>' + esc(o) + '</span>' +
          (tag ? '<span class="r-tag">' + tag + '</span>' : '') + '</div>';
      });
      opts += '</div>';
      var why = '';
      if (kind === 'wrong' && q.why_wrong && q.why_wrong[String(a)]) {
        why = '<div class="expl why"><b>Why ' + LETTERS[a] + ' is wrong</b>' + esc(q.why_wrong[String(a)]) + '</div>';
      }
      var expl = '<div class="expl"><b>Explanation · correct answer ' + LETTERS[q.answer] + '</b>' + esc(q.explanation) + '</div>';
      card.innerHTML = head + '<p class="q-stem" style="margin:0">' + esc(q.question) + '</p>' + opts + why + expl;
      list.appendChild(card);
    });
    if (!shown) {
      list.appendChild(el('div', 'card muted', filter === 'wrong' ? 'No wrong answers. Well done!' : 'Nothing to show here.'));
    }
  }
})();
