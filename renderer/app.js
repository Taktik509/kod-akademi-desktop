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
    const total = LESSONS.length + EXERCISES.length;
    const done = (p.lessonsDone || []).length + (p.exercisesDone || []).length + (p.revealed || []).length;
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
    if (v === 'home') renderHome();
    else if (v === 'languages') renderLanguages();
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
      '<div class="card"><div class="body-text">' + esc(loc(l, 'body')) + '</div></div>';

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
      speak(loc(l, 'title') + '. ' + loc(l, 'body'));
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
  }

  /* ---------- VUE: Egzèsis ---------- */
  // RÈG OBLIGATWA: chak egzèsis DWE gen chan tèks + bouton soumèt.
  // Normalize: trim().toLowerCase().replace(/\s+/g,' '). 3 tantativ max.
  function renderExercise(id) {
    setTab('home');
    const e = EXERCISES.find(x => x.id === id);
    if (!e) { renderHome(); return; }
    const p = store.progress;
    const done = p.exercisesDone.indexOf(id) >= 0;
    const revealed = (p.revealed || []).indexOf(id) >= 0;
    const accepted = (e.accepted || []).map(normalize);

    let html = '<span class="back-link" id="back-lesson">← ' + esc(t('back')) + '</span>' +
      '<h1>📝 ' + esc(e.id) + ' — ' + esc(t('exercise')) + '</h1>' +
      '<div class="card"><div class="body-text">' + esc(e.prompt_ht) + '</div>';

    if (e.type === 'qcm' && e.choices && e.choices.length) {
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
    document.getElementById('back-lesson').addEventListener('click', () => renderLesson(e.lessonId));

    const btn = document.getElementById('btn-submit');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const raw = document.getElementById('answer').value;
      const ans = normalize(raw);
      const fb = document.getElementById('feedback');
      const pp = store.progress;
      const attempts = pp.attempts || {};
      const n = attempts[id] || 0;

      if (!ans) { fb.innerHTML = '<div class="feedback retry">✏️ ...</div>'; return; }

      // Pou qcm: aksepte lèt (a/b/c/d) oswa tèks repons lan
      let ok = accepted.indexOf(ans) >= 0;
      if (!ok && e.type === 'qcm' && /^[a-d]\)?$/.test(ans)) {
        ok = accepted.indexOf(ans.replace(/\)$/, '')) >= 0;
      }

      if (ok) {
        if (pp.exercisesDone.indexOf(id) < 0) {
          pp.exercisesDone.push(id);
          store.progress = pp;
          addXp(10);
        }
        updateHeader();
        fb.innerHTML = '<div class="feedback good">🎉 <strong>' + esc(t('correct')) + '</strong><br><br>' +
          '<strong>' + esc(t('explanation')) + '</strong><br>' + esc(e.explanation_ht) + '<br><br>+10 ⭐</div>';
        btn.disabled = true;
      } else {
        const next = n + 1;
        attempts[id] = next;
        pp.attempts = attempts;
        store.progress = pp;
        if (next < 3) {
          const left = 3 - next;
          fb.innerHTML = '<div class="feedback retry">' + esc(t('wrongRetry')) + '<br>' +
            esc(t('attemptsLeft').replace('{n}', String(left))) + '</div>';
        } else {
          // 3 tantativ fini → montre bon repons lan otomatikman, san XP
          if ((pp.revealed || []).indexOf(id) < 0) {
            pp.revealed = pp.revealed || [];
            pp.revealed.push(id);
          }
          store.progress = pp;
          updateHeader();
          fb.innerHTML = '<div class="feedback reveal">💡 <strong>' + esc(t('revealTitle')) + '</strong><br><br>' +
            esc(e.correct_ht) + '<br><br><strong>' + esc(t('explanation')) + '</strong><br>' +
            esc(e.explanation_ht) + '</div>';
          btn.disabled = true;
        }
      }
    });
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
    renderHome();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
