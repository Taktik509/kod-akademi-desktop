/* Kòd Akademi — renderer (vanilla JS, offline nèt).
   Done yo soti nan window.kodapi.getData() (preload.js li data/*.json ak fs). */
(function () {
  'use strict';

  const api = window.kodapi || null;
  const DATA = api ? api.getData() : { lessons: [], exercises: [], ui: { ht: {} }, languages: [] };
  const LESSONS = DATA.lessons || [];
  const EXERCISES = DATA.exercises || [];
  const UI = DATA.ui || { ht: {} };
  const LANGS = DATA.languages || [];
  const MODULES = DATA.modules || [];
  const GUIDE = DATA.guide || null;
  const RESOURCES = DATA.resources || null;

  /* ---------- Gid: èd navigasyon ---------- */
  function guideEtape(id) {
    return GUIDE && GUIDE.etapes ? GUIDE.etapes.find(function (e) { return e.id === id; }) : null;
  }
  function guideModule(eid, mid) {
    const e = guideEtape(eid);
    if (!e) return null;
    const m = (e.modules || []).find(function (x) { return x.id === mid; });
    return m ? { etape: e, module: m } : null;
  }
  function guideLesson(eid, mid, lid) {
    const f = guideModule(eid, mid);
    if (!f) return null;
    const l = (f.module.lessons || []).find(function (x) { return x.id === lid; });
    return l ? { etape: f.etape, module: f.module, lesson: l } : null;
  }
  function guideProject(eid, mid, pid) {
    const f = guideModule(eid, mid);
    if (!f) return null;
    const p = (f.module.projects || []).find(function (x) { return x.id === pid; });
    return p ? { etape: f.etape, module: f.module, project: p } : null;
  }
  function guideExerciseById(id) {
    if (!GUIDE || !GUIDE.etapes) return null;
    for (const e of GUIDE.etapes) {
      for (const m of (e.modules || [])) {
        for (const l of (m.lessons || [])) {
          const x = (l.exercises || []).find(function (ex) { return ex.id === id; });
          if (x) return { etape: e, module: m, lesson: l, exercise: x };
        }
      }
    }
    return null;
  }
  function countGuide() {
    let lessons = 0, exercises = 0;
    if (GUIDE && GUIDE.etapes) {
      GUIDE.etapes.forEach(function (e) {
        (e.modules || []).forEach(function (m) {
          lessons += (m.lessons || []).length;
          (m.lessons || []).forEach(function (l) { exercises += (l.exercises || []).length; });
        });
      });
    }
    return { lessons, exercises };
  }

  /* ---------- Checkpoint (règ 3): èd ---------- */
  /** Retire makè [[CHECK:...]] (vwa a pa dwe li yo). */
  function stripChecks(s) {
    return String(s).replace(/\s*\[\[CHECK:[^\]]+\]\]/g, '');
  }
  /** Lis repons akseptab: accepted[] + lèt qcm/vrai-faux. */
  function acceptedList(e) {
    return (e.accepted || []).map(normalize);
  }
  function isCorrect(e, ans) {
    const accepted = acceptedList(e);
    if (accepted.indexOf(ans) >= 0) return true;
    if ((e.type === 'qcm' || e.type === 'vrai-faux') && /^[a-d]\)?$/.test(ans)) {
      return accepted.indexOf(ans.replace(/\)$/, '')) >= 0;
    }
    return false;
  }
  /**
   * Lojik koreksyon pataje (3 tantativ). jere pwogrè.
   * opts: {doneKey, xp}
   */
  function gradeAnswer(e, id, ans, opts) {
    const pp = store.progress;
    if (isCorrect(e, ans)) {
      const arr = pp[opts.doneKey] || (pp[opts.doneKey] = []);
      if (arr.indexOf(id) < 0) {
        arr.push(id);
        store.progress = pp;
        addXp(opts.xp);
      }
      updateHeader();
      return { kind: 'correct' };
    }
    const attempts = pp.attempts || {};
    const next = (attempts[id] || 0) + 1;
    attempts[id] = next;
    pp.attempts = attempts;
    store.progress = pp;
    if (next < 3) return { kind: 'retry', left: 3 - next };
    const rev = pp.revealed || (pp.revealed = []);
    if (rev.indexOf(id) < 0) rev.push(id);
    store.progress = pp;
    updateHeader();
    return { kind: 'revealed' };
  }
  /** HTML fidbak + tèks pou vwa a li. */
  function feedbackHtml(kind, e, left) {
    if (kind === 'correct') {
      return '<div class="feedback good">🎉 <strong>' + esc(t('correct')) + '</strong><br><br>' +
        '<strong>' + esc(t('explanation')) + '</strong><br>' + esc(e.explanation_ht) + '</div>';
    }
    if (kind === 'retry') {
      return '<div class="feedback retry">' + esc(t('wrongRetry')) + '<br>' +
        esc(t('attemptsLeft').replace('{n}', String(left))) + '</div>';
    }
    return '<div class="feedback reveal">💡 <strong>' + esc(t('revealTitle')) + '</strong><br><br>' +
      esc(e.correct_ht) + '<br><br><strong>' + esc(t('explanation')) + '</strong><br>' +
      esc(e.explanation_ht) + '</div>';
  }
  function feedbackSpeechText(kind, e, left) {
    if (kind === 'correct') return t('correct') + ' ' + t('explanation') + ' ' + e.explanation_ht;
    if (kind === 'retry') return t('wrongRetry') + ' ' + t('attemptsLeft').replace('{n}', String(left));
    return t('revealTitle') + ' ' + e.correct_ht + '. ' + t('explanation') + ' ' + e.explanation_ht;
  }
  /** Règ 3: bouton 🔊 sou chak fidbak koreksyon pou vwa a li l. */
  function addFeedbackVoice(fbEl, text) {
    const b = document.createElement('button');
    b.className = 'btn btn-secondary';
    b.style.marginTop = '8px';
    b.textContent = '🔊 Koute fidbak la';
    let on = false;
    b.addEventListener('click', function () {
      if (on) { window.speechSynthesis.cancel(); on = false; b.textContent = '🔊 Koute fidbak la'; }
      else { speak(text); on = true; b.textContent = '⏹ 🔊'; }
    });
    fbEl.appendChild(b);
  }
  /** Kat checkpoint: kesyon rapid apre konsèp kle a. */
  function checkpointCardHtml(cp) {
    const p = store.progress;
    const done = (p.checkpointsDone || []).indexOf(cp.id) >= 0;
    let html = '<div class="card checkpoint" id="cp-' + esc(cp.id) + '">' +
      '<div class="body-text"><strong>⚡ ' + esc(cp.prompt_ht) + '</strong>' + (done ? ' ✅' : '') + '</div>';
    if (cp.choices && cp.choices.length) {
      html += '<ul class="choices">';
      cp.choices.forEach(function (c) { html += '<li>' + esc(c) + '</li>'; });
      html += '</ul>';
    }
    if (cp.code) {
      html += '<pre class="code-block">' + highlight(cp.code) + '</pre>';
    }
    html += '<label><strong>' + esc(t('yourAnswer')) + ':</strong></label>' +
      '<textarea id="cp-ans-' + esc(cp.id) + '" placeholder="..."></textarea>' +
      '<button class="btn btn-primary" id="cp-btn-' + esc(cp.id) + '">' + esc(t('submitAnswer')) + '</button>' +
      '<div id="cp-fb-' + esc(cp.id) + '"></div></div>';
    return html;
  }
  /** Koupe kò leson an sou [[CHECK:id]] epi mete kat checkpoint yo antremele. */
  function lessonBodyHtml(lesson) {
    const cps = {};
    (lesson.checkpoints || []).forEach(function (c) { cps[c.id] = c; });
    const parts = String(loc(lesson, 'body')).split(/\[\[CHECK:([^\]]+)\]\]/);
    let html = '';
    for (let i = 0; i < parts.length; i += 2) {
      const txt = parts[i].trim();
      if (txt) html += '<div class="card"><div class="body-text">' + esc(txt) + '</div></div>';
      const cid = parts[i + 1];
      if (cid && cps[cid]) html += checkpointCardHtml(cps[cid]);
    }
    return html;
  }
  /** Kole lojik 3-tantativ sou chak kat checkpoint nan paj la. */
  function bindCheckpoints() {
    (view.querySelectorAll('[id^="cp-btn-"]') || []).forEach(function (btn) {
      const id = btn.id.slice('cp-btn-'.length);
      const card = document.getElementById('cp-' + id);
      const ansEl = document.getElementById('cp-ans-' + id);
      const fb = document.getElementById('cp-fb-' + id);
      // jwenn checkpoint la nan leson aktyèl la
      let cp = null;
      const all = [];
      LESSONS.forEach(function (l) { (l.checkpoints || []).forEach(function (c) { all.push(c); }); });
      if (GUIDE && GUIDE.etapes) {
        GUIDE.etapes.forEach(function (e) {
          (e.modules || []).forEach(function (m) {
            (m.lessons || []).forEach(function (l) { (l.checkpoints || []).forEach(function (c) { all.push(c); }); });
          });
        });
      }
      cp = all.find(function (c) { return c.id === id; });
      if (!cp || !ansEl || !fb) return;
      btn.addEventListener('click', function () {
        const ans = normalize(ansEl.value);
        if (!ans) { fb.innerHTML = '<div class="feedback retry">✏️ ...</div>'; return; }
        const r = gradeAnswer(cp, id, ans, { doneKey: 'checkpointsDone', xp: 2 });
        const speech = feedbackSpeechText(r.kind, cp, r.left);
        if (r.kind === 'correct') {
          fb.innerHTML = feedbackHtml('correct', cp) + '<div style="margin-top:6px">+2 ⚡</div>';
          btn.disabled = true;
        } else {
          fb.innerHTML = feedbackHtml(r.kind, cp, r.left);
          if (r.kind === 'revealed') btn.disabled = true;
        }
        addFeedbackVoice(fb, speech);
      });
    });
  }

  /* ---------- Modil langaj (16 modil: nivo → leson → egzèsis) ---------- */
  function normName(s) { return String(s).toLowerCase().replace(/[^a-z]/g, ''); }
  const MOD_BY_NAME = {};
  MODULES.forEach(function (m) {
    if (!m) return;
    MOD_BY_NAME[normName(m.id)] = m;
    MOD_BY_NAME[normName(m.name)] = m;
  });
  function getModule(id) { return MODULES.find(function (m) { return m && m.id === id; }); }
  function moduleForName(name) { return MOD_BY_NAME[normName(name)]; }
  function getModuleLevel(mid, lid) {
    const m = getModule(mid);
    if (!m) return null;
    const lv = (m.levels || []).find(function (l) { return l.id === lid; });
    return lv ? { module: m, level: lv } : null;
  }
  function getModuleLesson(mid, lid, lessonId) {
    const f = getModuleLevel(mid, lid);
    if (!f) return null;
    const l = (f.level.lessons || []).find(function (x) { return x.id === lessonId; });
    return l ? { module: f.module, level: f.level, lesson: l } : null;
  }

  const view = document.getElementById('view');

  /* ---------- Eta lokal (localStorage) ---------- */
  let lang = localStorage.getItem('ka_lang') || 'ht';
  if (!UI[lang]) lang = 'ht';

  const store = {
    get progress() {
      try { return JSON.parse(localStorage.getItem('ka_progress')) || { lessonsDone: [], exercisesDone: [], xp: 0, attempts: {}, revealed: [] }; }
      catch (e) { return { lessonsDone: [], exercisesDone: [], xp: 0, attempts: {}, revealed: [] }; }
    },
    set progress(p) { localStorage.setItem('ka_progress', JSON.stringify(p)); }
  };

  /* ---------- I18n ---------- */
  function t(key) {
    const d = UI[lang] || {};
    return d[key] !== undefined ? d[key] : (UI.ht[key] !== undefined ? UI.ht[key] : key);
  }
  // Chan leson yo gen vèsyon pa lang (title_ht, body_fr...). Egzèsis yo se kreyòl sèlman.
  function loc(obj, base) {
    return obj[base + '_' + lang] || obj[base + '_ht'] || '';
  }

  /* ---------- Util ---------- */
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function normalize(s) {
    return String(s).trim().toLowerCase().replace(/\s+/g, ' ');
  }
  function toast(msg) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  // Koulè senp pou kòd: mo kle, chèn, kòmantè, nimewo
  function highlight(code) {
    let html = esc(code);
    html = html.replace(/(&quot;.*?&quot;|&#x27;.*?&#x27;|"[^"\n]*"|'[^'\n]*')/g, '<span class="str">$1</span>');
    html = html.replace(/(\/\/[^\n]*|&lt;!--[\s\S]*?--&gt;|#[^\n]*)/g, '<span class="com">$1</span>');
    html = html.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="num">$1</span>');
    const kws = ['const','let','var','function','return','if','else','for','while','print','def','class','import','from','true','false','null','new','document','window','alert','prompt','console','log','querySelector','addEventListener'];
    kws.forEach(k => {
      const re = new RegExp('\\b' + k + '\\b', 'g');
      html = html.replace(re, '<span class="kw">' + k + '</span>');
    });
    return html;
  }

  /* ---------- Vwa (speechSynthesis natif) ---------- */
  function speak(text) {
    if (!('speechSynthesis' in window)) { toast('Navigatè a pa sipòte vwa.'); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    // Kreyòl pale byen ak vwa fransè (fr) sou pifò sistèm
    u.lang = 'fr-FR';
    const voices = window.speechSynthesis.getVoices();
    const fr = voices.find(v => v.lang && v.lang.toLowerCase().indexOf('fr') === 0);
    if (fr) u.voice = fr;
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  }

  /* ---------- XP / pwogrè ---------- */
  function addXp(n) {
    const p = store.progress;
    p.xp = (p.xp || 0) + n;
    store.progress = p;
    updateHeader();
  }
  function updateHeader() {
    const p = store.progress;
    document.getElementById('xp-value').textContent = p.xp || 0;
    const gc = countGuide();
    const total = LESSONS.length + EXERCISES.length + gc.lessons + gc.exercises;
    const done = (p.lessonsDone || []).length + (p.exercisesDone || []).length +
      (p.revealed || []).length + (p.checkpointsDone || []).length;
    const pct = total ? Math.round(done / total * 100) : 0;
    document.getElementById('progress-text').textContent = pct + '%';
    document.getElementById('progress-fill').style.width = pct + '%';
  }
  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
  }

  /* ---------- Navigasyon ---------- */
  let currentTab = 'home';
  function setTab(name) {
    currentTab = name;
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  }
  // tab click handler via delegation (senp epi solid)
  document.getElementById('tabs').addEventListener('click', e => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    const v = btn.dataset.view;
    if (v === 'program') renderProgram();
    else if (v === 'home') renderHome();
    else if (v === 'languages') renderLanguages();
    else if (v === 'resources') renderResources();
    else if (v === 'news') renderNews();
    else if (v === 'settings') renderSettings();
  });

  function backLink(html) {
    return '<span class="back-link">← ' + esc(t('back')) + '</span>' + html;
  }

  /* ---------- VUE: Kay (12 mwa) ---------- */
  function renderHome() {
    setTab('home');
    let cards = '';
    for (let m = 1; m <= 12; m++) {
      const list = LESSONS.filter(l => l.month === m);
      const p = store.progress;
      const doneCount = list.filter(l => p.lessonsDone.indexOf(l.id) >= 0).length;
      cards += '<button class="month-btn" data-month="' + m + '">🗓️ ' +
        esc(t('month')) + ' ' + m +
        '<span class="count">' + doneCount + '/' + list.length + ' ' + esc(t('lesson')) + '</span></button>';
    }
    view.innerHTML = '<h1>💻 ' + esc(t('appName')) + '</h1>' +
      '<p style="color:var(--text-dim)">' + esc(t('tagline')) + '</p>' +
      '<div class="month-grid">' + cards + '</div>';
    view.querySelectorAll('.month-btn').forEach(b => {
      b.addEventListener('click', () => renderMonth(parseInt(b.dataset.month, 10)));
    });
  }

  /* ---------- VUE: Lis leson yon mwa ---------- */
  function renderMonth(m) {
    setTab('home');
    const p = store.progress;
    const list = LESSONS.filter(l => l.month === m);
    let rows = '';
    list.forEach(l => {
      const done = p.lessonsDone.indexOf(l.id) >= 0;
      rows += '<div class="lesson-row" data-lesson="' + esc(l.id) + '">' +
        '<div><strong>' + esc(l.id) + ' — ' + esc(loc(l, 'title')) + '</strong><br>' +
        '<small style="color:var(--text-dim)">' + esc(l.domain || '') + '</small></div>' +
        '<div class="status">' + (done ? '✅' : '⭕') + '</div></div>';
    });
    view.innerHTML = '<span class="back-link" id="back-home">← ' + esc(t('back')) + '</span>' +
      '<h1>🗓️ ' + esc(t('month')) + ' ' + m + '</h1>' + rows;
    document.getElementById('back-home').addEventListener('click', renderHome);
    view.querySelectorAll('.lesson-row').forEach(r => {
      r.addEventListener('click', () => renderLesson(r.dataset.lesson));
    });
  }

  /* ---------- VUE: Detay leson ---------- */
  function renderLesson(id) {
    setTab('home');
    const p = store.progress;
    const l = LESSONS.find(x => x.id === id);
    if (!l) { renderHome(); return; }
    const done = p.lessonsDone.indexOf(id) >= 0;
    const exs = EXERCISES.filter(e => e.lessonId === id);

    let html = '<span class="back-link" id="back-month">← ' + esc(t('back')) + '</span>' +
      '<h1>' + esc(l.id) + ' — ' + esc(loc(l, 'title')) + '</h1>' +
      lessonBodyHtml(l);

    if (l.code && l.code.code) {
      html += '<div class="card"><h2>💻 ' + esc(t('codeExample')) + ' (' + esc(l.code.lang || '') + ')</h2>' +
        '<pre class="code-block">' + highlight(l.code.code) + '</pre></div>';
    }

    html += '<div class="expert-note"><strong>🎓 ' + esc(t('expertNote')) + ':</strong><br>' +
      esc(loc(l, 'expert_note')) + '</div>';

    html += '<button class="btn btn-secondary" id="btn-listen">🔊 ' + esc(t('listen')) + '</button>' +
      (done
        ? '<button class="btn btn-done" disabled>✅ ' + esc(t('lessonDone')) + '</button>'
        : '<button class="btn btn-primary" id="btn-done">' + esc(t('markDone')) + '</button>');

    if (exs.length) {
      html += '<h2 style="margin-top:20px">📝 ' + esc(t('exercise')) + 's</h2>';
      exs.forEach(e => {
        const edone = p.exercisesDone.indexOf(e.id) >= 0;
        const erev = (p.revealed || []).indexOf(e.id) >= 0;
        html += '<div class="lesson-row" data-ex="' + esc(e.id) + '">' +
          '<div><strong>' + esc(e.id) + '</strong> — ' + esc(e.prompt_ht) + '</div>' +
          '<div class="status">' + (edone ? '✅' : (erev ? '💡' : '⭕')) + '</div></div>';
      });
    }

    view.innerHTML = html;
    document.getElementById('back-month').addEventListener('click', () => renderMonth(l.month));
    document.getElementById('btn-listen').addEventListener('click', () => {
      // Règ 1: vwa a li TOUT leson an, san makè [[CHECK]]
      speak(loc(l, 'title') + '. ' + stripChecks(loc(l, 'body')));
    });
    const bd = document.getElementById('btn-done');
    if (bd) bd.addEventListener('click', () => {
      const pp = store.progress;
      if (pp.lessonsDone.indexOf(id) < 0) {
        pp.lessonsDone.push(id);
        store.progress = pp;
        addXp(5);
        toast('🎉 ' + t('lessonDone'));
      }
      updateHeader();
      renderLesson(id);
    });
    view.querySelectorAll('[data-ex]').forEach(r => {
      r.addEventListener('click', () => renderExercise(r.dataset.ex));
    });
    bindCheckpoints();
  }

  /* ---------- VUE: Egzèsis (pataje: rapid + gid) ---------- */
  // RÈG OBLIGATWA: chak egzèsis DWE gen chan tèks + bouton soumèt.
  // Normalize: trim().toLowerCase().replace(/\s+/g,' '). 3 tantativ max.
  // Règ 3: bouton 🔊 sou fidbak la pou vwa a li l.
  function renderExerciseView(e, backLabel, onBack, opts) {
    const p = store.progress;
    const done = (p[opts.doneKey] || []).indexOf(e.id) >= 0;
    const revealed = (p.revealed || []).indexOf(e.id) >= 0;

    let html = '<span class="back-link" id="back-lesson">← ' + esc(t('back')) + '</span>' +
      '<h1>📝 ' + esc(e.id) + ' — ' + esc(t('exercise')) + '</h1>' +
      '<div class="card"><div class="body-text">' + esc(e.prompt_ht) + '</div>';

    if ((e.type === 'qcm' || e.type === 'vrai-faux') && e.choices && e.choices.length) {
      html += '<ul class="choices">';
      e.choices.forEach(c => { html += '<li>' + esc(c) + '</li>'; });
      html += '</ul>';
    }
    if (e.code) {
      html += '<pre class="code-block">' + highlight(e.code) + '</pre>';
    }

    html += '</div>';

    if (!done && !revealed) {
      html += '<div class="card"><label for="answer"><strong>' + esc(t('yourAnswer')) + ':</strong></label>' +
        '<textarea id="answer" placeholder="..."></textarea>' +
        '<button class="btn btn-primary" id="btn-submit">' + esc(t('submitAnswer')) + '</button>' +
        '<div id="feedback"></div></div>';
    } else if (revealed) {
      html += '<div class="card"><div class="feedback reveal">💡 <strong>' + esc(t('revealTitle')) + '</strong><br><br>' +
        esc(e.correct_ht) + '<br><br><strong>' + esc(t('explanation')) + '</strong><br>' + esc(e.explanation_ht) + '</div></div>';
    } else {
      html += '<div class="card"><div class="feedback good">✅ ' + esc(t('correct')) + '<br><br>' +
        '<strong>' + esc(t('explanation')) + '</strong><br>' + esc(e.explanation_ht) + '</div></div>';
    }

    view.innerHTML = html;
    document.getElementById('back-lesson').addEventListener('click', onBack);

    const btn = document.getElementById('btn-submit');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const raw = document.getElementById('answer').value;
      const ans = normalize(raw);
      const fb = document.getElementById('feedback');

      if (!ans) { fb.innerHTML = '<div class="feedback retry">✏️ ...</div>'; return; }

      const r = gradeAnswer(e, e.id, ans, opts);
      const speech = feedbackSpeechText(r.kind, e, r.left);
      if (r.kind === 'correct') {
        fb.innerHTML = feedbackHtml('correct', e) + '<div style="margin-top:6px">+' + opts.xp + ' ⭐</div>';
        btn.disabled = true;
      } else {
        fb.innerHTML = feedbackHtml(r.kind, e, r.left);
        if (r.kind === 'revealed') btn.disabled = true;
      }
      addFeedbackVoice(fb, speech);
    });
  }

  function renderExercise(id) {
    setTab('home');
    const e = EXERCISES.find(x => x.id === id);
    if (!e) { renderHome(); return; }
    renderExerciseView(e, t('lesson'), () => renderLesson(e.lessonId),
      { doneKey: 'exercisesDone', xp: 10 });
  }

  function renderGuideExercise(id) {
    setTab('program');
    const f = guideExerciseById(id);
    if (!f) { renderProgram(); return; }
    renderExerciseView(f.exercise, t('lesson'),
      () => renderGuideLesson(f.etape.id, f.module.id, f.lesson.id),
      { doneKey: 'exercisesDone', xp: 10 });
  }

  /* ---------- VUE: Katalòg langaj ---------- */
  function renderLanguages() {
    setTab('languages');
    let html = '<h1>🌐 ' + esc(t('tabLanguages')) + '</h1>';
    LANGS.forEach(cat => {
      html += '<div class="card cat"><h2>' + esc(cat.category_ht) + '</h2>';
      (cat.items || []).forEach(it => {
        html += '<div class="lang-item"><div class="name">' + esc(it.name) + '</div>' +
          ((it.alternatives && it.alternatives.length)
            ? '<div class="alt">' + esc(t('alternatives')) + ': ' + esc(it.alternatives.join(', ')) + '</div>' : '') +
          '<div class="desc">' + esc(it.description_ht) + '</div></div>';
      });
      html += '</div>';
    });
    view.innerHTML = html;
  }

  /* ---------- VUE: Pwogram (Gid = kolòn vetebral) ---------- */
  function renderProgram() {
    setTab('program');
    if (!GUIDE) {
      view.innerHTML = '<h1>🗺️ ' + esc(t('tabProgram')) + '</h1><div class="card">Gid la pa chaje.</div>';
      return;
    }
    const p = store.progress;
    let cards = '';
    GUIDE.etapes.forEach(function (etape) {
      const lessonIds = [];
      (etape.modules || []).forEach(function (m) {
        (m.lessons || []).forEach(function (l) { lessonIds.push(l.id); });
      });
      const doneCount = lessonIds.filter(function (id) { return (p.lessonsDone || []).indexOf(id) >= 0; }).length;
      cards += '<div class="lesson-row" data-etape="' + esc(etape.id) + '">' +
        '<div><strong>' + esc(etape.icon) + ' ' + esc(t('etape')) + ' ' + etape.numero + ' — ' + esc(etape.title_ht) + '</strong><br>' +
        '<small style="color:var(--text-dim)">' + esc(etape.description_ht) + '</small><br>' +
        '<small style="color:var(--text-dim)">' + (etape.modules || []).length + ' modil • ' +
        doneCount + '/' + lessonIds.length + ' leson fini</small></div>' +
        '<div class="status">›</div></div>';
    });
    view.innerHTML = '<h1>🗺️ ' + esc(t('tabProgram')) + '</h1>' +
      '<p style="color:var(--text-dim)">' + esc(t('programSubtitle')) + '</p>' +
      '<div class="card"><div class="body-text">' + esc(GUIDE.description_ht) + '</div></div>' + cards;
    view.querySelectorAll('[data-etape]').forEach(function (r) {
      r.addEventListener('click', function () { renderEtape(r.dataset.etape); });
    });
  }

  /* ---------- VUE: Etap (modil gid) ---------- */
  function renderEtape(eid) {
    setTab('program');
    const etape = guideEtape(eid);
    if (!etape) { renderProgram(); return; }
    const p = store.progress;
    let rows = '';
    (etape.modules || []).forEach(function (m) {
      const ids = (m.lessons || []).map(function (l) { return l.id; });
      const doneCount = ids.filter(function (id) { return (p.lessonsDone || []).indexOf(id) >= 0; }).length;
      rows += '<div class="lesson-row" data-module="' + esc(m.id) + '">' +
        '<div><strong>📦 ' + esc(m.title_ht) + '</strong><br>' +
        '<small style="color:var(--text-dim)">' + esc(m.description_ht) + '</small><br>' +
        '<small style="color:var(--text-dim)">' + doneCount + '/' + ids.length + ' leson fini' +
        ((m.projects || []).length ? ' • ' + m.projects.length + ' pwojè' : '') + '</small></div>' +
        '<div class="status">›</div></div>';
    });
    view.innerHTML = '<span class="back-link" id="back-program">← ' + esc(t('back')) + '</span>' +
      '<h1>' + esc(etape.icon) + ' ' + esc(t('etape')) + ' ' + etape.numero + '</h1>' +
      '<p style="color:var(--text-dim)">' + esc(etape.title_ht) + '</p>' +
      '<div class="card"><div class="body-text">' + esc(etape.description_ht) + '</div></div>' + rows;
    document.getElementById('back-program').addEventListener('click', renderProgram);
    view.querySelectorAll('[data-module]').forEach(function (r) {
      r.addEventListener('click', function () { renderGuideModule(eid, r.dataset.module); });
    });
  }

  /* ---------- VUE: Modil gid (leson + kontni ki gen rapò + pwojè) ---------- */
  function renderGuideModule(eid, mid) {
    setTab('program');
    const f = guideModule(eid, mid);
    if (!f) { renderProgram(); return; }
    const p = store.progress;
    let html = '<span class="back-link" id="back-etape">← ' + esc(t('back')) + '</span>' +
      '<h1>📦 ' + esc(f.module.title_ht) + '</h1>' +
      '<p style="color:var(--text-dim)">' + esc(t('etape')) + ' ' + f.etape.numero + ' — ' + esc(f.etape.title_ht) + '</p>' +
      '<div class="card"><div class="body-text">' + esc(f.module.description_ht) + '</div></div>';
    if (f.module.pass_criteria_ht) {
      html += '<div class="expert-note"><strong>🎯 ' + esc(t('passCriteria')) + ':</strong><br>' +
        esc(f.module.pass_criteria_ht) + '</div>';
    }

    html += '<h2>📖 ' + esc(t('guideLessons')) + ' (' + (f.module.lessons || []).length + ')</h2>';
    (f.module.lessons || []).forEach(function (l) {
      const done = (p.lessonsDone || []).indexOf(l.id) >= 0;
      html += '<div class="lesson-row" data-glesson="' + esc(l.id) + '">' +
        '<div><strong>📖 ' + esc(l.title_ht) + '</strong><br>' +
        '<small style="color:var(--text-dim)">' + (l.exercises || []).length + ' ' + esc(t('exercise')) + 's</small></div>' +
        '<div class="status">' + (done ? '✅' : '⭕') + '</div></div>';
    });

    const relLessons = (f.module.related_lessons || [])
      .map(function (id) { return LESSONS.find(function (x) { return x.id === id; }); })
      .filter(Boolean);
    if (relLessons.length) {
      html += '<h2>⚡ ' + esc(t('relatedLessons')) + '</h2>';
      relLessons.forEach(function (l) {
        html += '<div class="lesson-row" data-rlesson="' + esc(l.id) + '">' +
          '<div><strong>' + esc(l.id) + ' — ' + esc(loc(l, 'title')) + '</strong><br>' +
          '<small style="color:var(--text-dim)">' + esc(l.domain || '') + '</small></div>' +
          '<div class="status">›</div></div>';
      });
    }

    const relModules = (f.module.related_modules || [])
      .map(function (id) { return MODULES.find(function (m) { return m && m.id === id; }); })
      .filter(Boolean);
    if (relModules.length) {
      html += '<h2>💻 ' + esc(t('relatedModules')) + '</h2><div class="card">';
      relModules.forEach(function (m) {
        html += '<div style="margin-bottom:10px"><strong>💻 ' + esc(m.name) + '</strong><br>' +
          '<small style="color:var(--text-dim)">' + esc(m.description_ht || '') + '</small></div>';
      });
      html += '</div>';
    }

    if ((f.module.projects || []).length) {
      html += '<h2>🛠️ ' + esc(t('projects')) + ' (' + f.module.projects.length + ')</h2>';
      f.module.projects.forEach(function (pr) {
        html += '<div class="lesson-row" data-gproj="' + esc(pr.id) + '">' +
          '<div><strong>🛠️ ' + esc(pr.title_ht) + '</strong><br>' +
          '<small style="color:var(--text-dim)">' + esc(pr.description_ht).slice(0, 120) + '…</small></div>' +
          '<div class="status">›</div></div>';
      });
    }

    view.innerHTML = html;
    document.getElementById('back-etape').addEventListener('click', function () { renderEtape(eid); });
    view.querySelectorAll('[data-glesson]').forEach(function (r) {
      r.addEventListener('click', function () { renderGuideLesson(eid, mid, r.dataset.glesson); });
    });
    view.querySelectorAll('[data-rlesson]').forEach(function (r) {
      r.addEventListener('click', function () { renderLesson(r.dataset.rlesson); });
    });
    view.querySelectorAll('[data-gproj]').forEach(function (r) {
      r.addEventListener('click', function () { renderGuideProject(eid, mid, r.dataset.gproj); });
    });
  }

  /* ---------- VUE: Leson gid (🔊 + checkpoint + egzèsis) ---------- */
  function renderGuideLesson(eid, mid, lid) {
    setTab('program');
    const f = guideLesson(eid, mid, lid);
    if (!f) { renderProgram(); return; }
    const p = store.progress;
    const l = f.lesson;
    const done = (p.lessonsDone || []).indexOf(l.id) >= 0;
    const exs = l.exercises || [];

    let html = '<span class="back-link" id="back-gmodule">← ' + esc(t('back')) + '</span>' +
      '<h1>' + esc(l.title_ht) + '</h1>' +
      '<p style="color:var(--text-dim)">' + esc(t('etape')) + ' ' + f.etape.numero + ' • ' + esc(f.module.id.toUpperCase()) + '</p>' +
      lessonBodyHtml(l);

    if (l.code) {
      html += '<div class="card"><h2>💻 ' + esc(t('codeExample')) + ' (' + esc(l.code_lang || '') + ')</h2>' +
        '<pre class="code-block">' + highlight(l.code) + '</pre></div>';
    }

    html += '<div class="expert-note"><strong>🎓 ' + esc(t('expertNote')) + ':</strong><br>' +
      esc(l.expert_note_ht || '') + '</div>';

    html += '<button class="btn btn-secondary" id="btn-listen">🔊 ' + esc(t('listen')) + '</button>' +
      (done
        ? '<button class="btn btn-done" disabled>✅ ' + esc(t('lessonDone')) + '</button>'
        : '<button class="btn btn-primary" id="btn-done">' + esc(t('markDone')) + '</button>');

    if (exs.length) {
      html += '<h2 style="margin-top:20px">📝 ' + esc(t('exercise')) + 's</h2>';
      exs.forEach(function (e) {
        const edone = (p.exercisesDone || []).indexOf(e.id) >= 0;
        const erev = (p.revealed || []).indexOf(e.id) >= 0;
        html += '<div class="lesson-row" data-gex="' + esc(e.id) + '">' +
          '<div><strong>' + esc(e.id) + '</strong> — ' + esc(e.prompt_ht) + '</div>' +
          '<div class="status">' + (edone ? '✅' : (erev ? '💡' : '⭕')) + '</div></div>';
      });
    }

    view.innerHTML = html;
    document.getElementById('back-gmodule').addEventListener('click', function () { renderGuideModule(eid, mid); });
    document.getElementById('btn-listen').addEventListener('click', function () {
      // Règ 1: vwa a li TOUT leson an (tit + eksplikasyon + nòt ekspè), san makè
      speak(l.title_ht + '. ' + stripChecks(l.body_ht) + '. ' + (l.expert_note_ht || ''));
    });
    const bd = document.getElementById('btn-done');
    if (bd) bd.addEventListener('click', function () {
      const pp = store.progress;
      if ((pp.lessonsDone || []).indexOf(l.id) < 0) {
        pp.lessonsDone = pp.lessonsDone || [];
        pp.lessonsDone.push(l.id);
        store.progress = pp;
        addXp(5);
        toast('🎉 ' + t('lessonDone'));
      }
      updateHeader();
      renderGuideLesson(eid, mid, lid);
    });
    view.querySelectorAll('[data-gex]').forEach(function (r) {
      r.addEventListener('click', function () { renderGuideExercise(r.dataset.gex); });
    });
    bindCheckpoints();
  }

  /* ---------- VUE: Pwojè pratik ---------- */
  function renderGuideProject(eid, mid, pid) {
    setTab('program');
    const f = guideProject(eid, mid, pid);
    if (!f) { renderProgram(); return; }
    const pr = f.project;
    let html = '<span class="back-link" id="back-gmodule2">← ' + esc(t('back')) + '</span>' +
      '<h1>🛠️ ' + esc(pr.title_ht) + '</h1>' +
      '<div class="card"><div class="body-text">' + esc(pr.description_ht) + '</div></div>' +
      '<h2>🎯 ' + esc(t('objectives')) + '</h2><div class="card"><ul>';
    (pr.objectives_ht || []).forEach(function (o) { html += '<li>' + esc(o) + '</li>'; });
    html += '</ul></div><h2>✅ ' + esc(t('criteria')) + '</h2><div class="card"><ul>';
    (pr.criteria_ht || []).forEach(function (c) { html += '<li>☑️ ' + esc(c) + '</li>'; });
    html += '</ul></div>';
    view.innerHTML = html;
    document.getElementById('back-gmodule2').addEventListener('click', function () { renderGuideModule(eid, mid); });
  }

  /* ---------- VUE: Resous ---------- */
  function renderResources() {
    setTab('resources');
    if (!RESOURCES) {
      view.innerHTML = '<h1>🔗 ' + esc(t('tabResources')) + '</h1><div class="card">Resous yo pa chaje.</div>';
      return;
    }
    let html = '<h1>🔗 ' + esc(t('tabResources')) + '</h1>' +
      '<p style="color:var(--text-dim)">Sous ofisyèl pou aprann pi fon — dokimantasyon ak kou gratis.</p>';
    (RESOURCES.groups || []).forEach(function (gr) {
      html += '<h2>' + esc(gr.title_ht) + '</h2><div class="card">';
      (gr.items || []).forEach(function (it) {
        html += '<div style="margin-bottom:12px"><strong>🌐 <a href="' + esc(it.url) +
          '" target="_blank" rel="noopener">' + esc(it.name) + '</a></strong><br>' +
          '<small style="color:var(--text-dim)">' + esc(it.description_ht) + '</small></div>';
      });
      html += '</div>';
    });
    view.innerHTML = html;
  }

  /* ---------- VUE: Nouvèl (echantiyon lokal + stub rafrechi) ---------- */
  // STUB DOKIMANTE: pou v1.0.0 nouvèl yo se 3 echantiyon lokal an kreyòl.
  // Bouton "Rafrechi" a pare pou konekte ak yon sous an dirèk (API/RSS) nan yon
  // vèsyon pita; pou kounye a li jis re-afiche echantiyon yo (offline nèt).
  const SAMPLE_NEWS = [
    { date: '18 Oktòb 2026', title: 'Kòd Akademi v1.0.0 disponib sou Windows, Mac ak Linux',
      body: 'Premye vèsyon aplikasyon desktop lan soti: 24 leson, 48 egzèsis, tout offline. Telechaje l gratis epi kòmanse aprann pwogramasyon an kreyòl jodi a.' },
    { date: '15 Oktòb 2026', title: 'Poukisa aprann JavaScript an premye?',
      body: 'JavaScript se langaj ki fè paj web yo vivan. Avèk HTML ak CSS, se trio debaz tout devlopè web dwe metrize anvan yo ale pi lwen.' },
    { date: '10 Oktòb 2026', title: 'Konsèy ekspè: pratike 30 minit chak jou',
      body: 'Pwogramasyon se tankou espò: regilarite bat entansite. Trant minit pratik chak jou ap mennen w pi lwen pase 5 èdtan yon sèl jou pa semèn.' }
  ];
  function renderNews() {
    setTab('news');
    let html = '<h1>📰 ' + esc(t('newsTitle')) + '</h1>' +
      '<button class="btn btn-secondary" id="btn-refresh">🔄 ' + esc(t('newsRefresh')) + '</button>' +
      '<div style="margin-top:14px">';
    if (!SAMPLE_NEWS.length) {
      html += '<div class="card">' + esc(t('newsEmpty')) + '</div>';
    } else {
      SAMPLE_NEWS.forEach(n => {
        html += '<div class="card news-item"><div class="date">' + esc(n.date) + '</div>' +
          '<h2>' + esc(n.title) + '</h2><div class="body-text">' + esc(n.body) + '</div></div>';
      });
    }
    html += '</div>';
    view.innerHTML = html;
    document.getElementById('btn-refresh').addEventListener('click', () => {
      // Stub: pa gen sous an dirèk nan v1.0.0 (offline). Re-afiche echantiyon yo.
      renderNews();
      toast('📡 ' + t('newsRefresh') + ' — offline (v1.0.0)');
    });
  }

  /* ---------- VUE: Paramèt ---------- */
  function renderSettings() {
    setTab('settings');
    const langs = ['ht', 'fr', 'en', 'es'];
    const names = { ht: 'Kreyòl 🇭🇹', fr: 'Français 🇫🇷', en: 'English 🇺🇸', es: 'Español 🇪🇸' };
    let opts = '';
    langs.forEach(l => {
      opts += '<option value="' + l + '"' + (l === lang ? ' selected' : '') + '>' + names[l] + '</option>';
    });
    view.innerHTML = '<h1>⚙️ ' + esc(t('tabSettings')) + '</h1>' +
      '<div class="card"><div class="setting-row"><strong>🌍 ' + esc(t('chooseLanguage')) + '</strong>' +
      '<select id="lang-select">' + opts + '</select></div></div>' +
      '<div class="card"><div class="setting-row"><strong>🎨 Mòd</strong>' +
      '<button class="btn btn-secondary" id="btn-theme2">🌙/☀️</button></div></div>' +
      '<div class="card"><strong>📊 ' + esc(t('progress')) + '</strong><br>' +
      '<span style="color:var(--text-dim)">⭐ <span id="xp-set">' + (store.progress.xp || 0) + '</span> ' + esc(t('xp')) + '</span></div>';
    document.getElementById('lang-select').addEventListener('change', e => {
      lang = e.target.value;
      localStorage.setItem('ka_lang', lang);
      document.documentElement.lang = lang;
      applyI18n();
      updateHeader();
      renderSettings();
      toast('🌍 ' + names[lang]);
    });
    document.getElementById('btn-theme2').addEventListener('click', toggleTheme);
  }

  /* ---------- Tèm klè/fonse ---------- */
  function toggleTheme() {
    document.body.classList.toggle('light');
    const light = document.body.classList.contains('light');
    localStorage.setItem('ka_theme', light ? 'light' : 'dark');
    document.getElementById('theme-toggle').textContent = light ? '☀️' : '🌙';
  }

  /* ---------- Inisyalizasyon ---------- */
  function init() {
    if (localStorage.getItem('ka_theme') === 'light') {
      document.body.classList.add('light');
      document.getElementById('theme-toggle').textContent = '☀️';
    }
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    applyI18n();
    updateHeader();
    renderProgram();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
