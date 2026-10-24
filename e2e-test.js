/* ===== e2e-test.js — headless DOM regression harness (jsdom) =====
   Runs the real engine (content-bundle.js + content-loader.js + app.js)
   inside jsdom and verifies the L1/L2 behaviours:
     - level switching (counts, lesson cards, chapter exam counts)
     - chapter exam lesson selection (h* -> l* mapping)
     - summaries / extras / smartExplain / smartTip lookups
     - quiz completion -> progress persistence (level-scoped keys)
     - certificate completion gate
     - notebook isolation between L1 and L2
     - bottom-nav active states
   Usage: node e2e-test.js
*/
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = requireJsdom();
function requireJsdom() {
  const cands = [
    process.env.JSDOM_PATH,
    'jsdom',
    'C:/Users/steve/Downloads/_quiztest_tools/node_modules/jsdom'
  ].filter(Boolean).map(p => p.trim());
  for (const c of cands) {
    try { return require(c); } catch (e) { /* try next */ }
  }
  throw new Error('jsdom not found. Install it or set JSDOM_PATH. Tried: ' + cands.join(', '));
}
const ROOT = __dirname;

/* ---------- small assertion helpers ---------- */
let fails = 0, passes = 0;
const t = (name, cond, extra) => {
  if (cond) { passes++; console.log('OK   ' + name); }
  else { fails++; console.log('FAIL ' + name + (extra !== undefined ? '  -> ' + extra : '')); }
};
const eq = (name, a, b) => t(name, JSON.stringify(a) === JSON.stringify(b), 'got=' + JSON.stringify(a) + ' want=' + JSON.stringify(b));

/* ---------- build the jsdom page from the real index.html ---------- */
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const vc = new VirtualConsole();
vc.on('jsdomError', e => { if (!/Not implemented/.test(e.message)) console.log('[jsdomError]', e.message); });

const dom = new JSDOM(html, {
  url: 'https://local.test/quiz/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  virtualConsole: vc
});
const { window } = dom;

/* ---------- browser APIs jsdom lacks ---------- */
window.scrollTo = () => {};
window.print = () => {};
window.confirm = () => true;
window.alert = () => {};
window.open = () => null;
// jsdom returns null from getContext unless the `canvas` package is installed -> stub it
window.HTMLCanvasElement.prototype.getContext = function () {
  return {
    clearRect() {}, fillRect() {}, beginPath() {}, arc() {}, fill() {}, stroke() {},
    save() {}, restore() {}, setTransform() {}, translate() {}, scale() {}, rotate() {},
    drawImage() {}, measureText: () => ({ width: 10 }), fillText() {}, strokeText() {},
    createLinearGradient: () => ({ addColorStop() {} })
  };
};
if (!window.AudioContext) window.AudioContext = function () {
  return { createOscillator: () => ({ type: '', frequency: { value: 0 }, connect() {}, start() {}, stop() {} }), createGain: () => ({ gain: { value: 0, exponentialRampToValueAt() {} }, connect() {}, destination: {} }), currentTime: 0, destination: {} };
};

const storage = {};
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: {
    getItem: k => (k in storage ? storage[k] : null),
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: k => { delete storage[k]; },
    clear: () => { Object.keys(storage).forEach(k => delete storage[k]); },
    key: i => Object.keys(storage)[i] || null,
    get length() { return Object.keys(storage).length; }
  }
});
// let the app see the storage we stubbed
window.Storage = function () {};

module.exports = { dom, window, storage, t, eq, ROOT, getFails: () => fails, getPasses: () => passes, setFails: v => { fails = v; }, setPasses: v => { passes = v; } };

/* ---------- load the real scripts into the jsdom window ---------- */
window.requestAnimationFrame = () => 0; // stop the confetti loop in tests
window.cancelAnimationFrame = () => {};

const EXPORT = `
window.__T = {
  get curLevel(){ return curLevel; }, set curLevel(v){ curLevel = v; },
  get L1(){ return L1; }, get L2(){ return L2; },
  get BANKS(){ return BANKS; }, get SUMMARIES(){ return SUMMARIES; },
  get CHAPTERS(){ return CHAPTERS; }, get CHAPTER_META(){ return CHAPTER_META; },
  get LESSON_EXTRAS(){ return LESSON_EXTRAS; }, get CONTENT_SOURCE(){ return CONTENT_SOURCE; },
  get Progress(){ return Progress; }, get Notebook(){ return Notebook; }, get TotalXP(){ return TotalXP; },
  get StudyMode(){ return StudyMode; },
  get S(){ return S; }, get LP(){ return LP; },
  buildHome, buildSummaries, buildNotebook, openLesson, startQuiz, startChapter, startAll,
  startCram, startMistakes, nextQuestion, finishAnswer, finish, show, switchHomeTab,
  updateBottomNav, getProgress, progressKey, contentKey, chapterIds,
  smartExplain, smartTip, allLessonsCompleted, gotoHome, gotoSummaries, gotoNotebook,
  loadProgress, loadNotebook, loadXP, applyContent, prepare, esc
};
`;

const code = ['content-bundle.js', 'content-loader.js', 'app.js']
  .map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n;\n') + '\n' + EXPORT;

window.eval(code);

/* ---------- helpers to interact with the DOM ---------- */
const $ = id => window.document.getElementById(id);
const txt = id => { const el = $(id); return el ? (el.textContent || '').trim() : ''; };
const ar = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[+d]);
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* answer the currently rendered question correctly (or wrongly) */
async function answerCurrent(correct = true) {
  const q = window.__T.S.queue[window.__T.S.i];
  const box = $('options');
  if (!q || !box) return false;
  if (!q.t || q.t === 'mcq') {
    const btns = [...box.querySelectorAll('button.opt')];
    const target = btns.find(b => +b.dataset.idx === q.a);
    const pick = correct ? target : btns.find(b => +b.dataset.idx !== q.a);
    if (!pick) return false;
    pick.click();
  } else if (q.t === 'tf') {
    const btns = [...box.querySelectorAll('button.opt')];
    const want = q.a ? 0 : 1;
    const target = btns.find(b => +b.dataset.idx === want);
    const pick = correct ? target : btns.find(b => +b.dataset.idx !== want);
    if (!pick) return false;
    pick.click();
  } else if (q.t === 'fill') {
    const inp = box.querySelector('input.fill-in');
    const btn = box.querySelector('button.check');
    if (!inp || !btn) return false;
    inp.value = correct ? q.ans[0] : 'إجابة خاطئة تماما ✗';
    btn.click();
  } else if (q.t === 'order') {
    const pool = box.querySelector('.pool');
    const btn = box.querySelector('button.check');
    if (!pool || !btn) return false;
    // click pool chips one at a time with fresh DOM queries, because every
    // click re-renders the pool (old chip elements go stale)
    const seq = correct ? q.items : [...q.items].reverse();
    for (const want of seq) {
      const c = [...pool.querySelectorAll('button.chip')].find(x => x.textContent === want);
      if (!c) return false;
      c.click();
    }
    btn.click();
  } else if (q.t === 'classify') {
    const rows = [...box.querySelectorAll('.cls-row')];
    for (const r of rows) {
      const label = r.querySelector('.cls-item').textContent;
      const gi = q.groups.findIndex(g => (g.items || []).includes(label));
      if (gi < 0) return false;
      const btns = [...r.querySelectorAll('.cls-btn')];
      const pick = correct ? btns[gi] : btns[(gi + 1) % q.groups.length];
      pick.click();
    }
    const btn = box.querySelector('button.check');
    if (!btn) return false;
    btn.click();
  } else return false;
  await sleep(0);
  return true;
}

/* run the whole quiz queue, answering all correctly */
async function playQuiz(correct = true, maxQ = 500) {
  const T = window.__T;
  let n = 0;
  while (T.S.i < T.S.queue.length && n < maxQ) {
    const before = T.S.i;
    const ok = await answerCurrent(correct);
    if (!ok) break;
    n++;
    if (T.S.locked) {
      const btn = $('btn-next');
      if (btn) btn.click();
      await sleep(0);
    } else break;
    if (T.S.i === before) break;
  }
  await sleep(0);
  return n;
}

/* ================= TESTS ================= */
(async function main() {
  const T = window.__T;
  await sleep(600); // let boot() finish

  /* ---- 1. content loaded ---- */
  t('content loaded (bundle/json source)', T.CONTENT_SOURCE !== 'loading', T.CONTENT_SOURCE);
  t('L1 has 7 lessons', T.L1.length === 7, T.L1.length);
  t('L2 has 7 lessons', T.L2.length === 7, T.L2.length);
  eq('L1 lesson ids', T.L1.map(L => L.id), ['l11', 'l12', 'l13', 'l14', 'l21', 'l22', 'l23']);
  eq('L2 lesson ids', T.L2.map(L => L.id), ['h11', 'h12', 'h13', 'h14', 'h21', 'h22', 'h23']);

  /* ---- 2. level switching: counts + lesson cards ---- */
  T.curLevel = 1; T.buildHome();
  const l1Cards = $('lessons').querySelectorAll('button.lesson').length;
  const l1Hero = txt('hero-sub');
  const l1Total = T.L1.reduce((a, L) => a + L.questions.length, 0);
  t('L1 renders 7 lesson cards', l1Cards === 7, l1Cards);
  t('L1 hero shows L1 total', l1Hero.includes(ar(l1Total)), l1Hero.slice(0, 80));

  T.curLevel = 2; T.buildHome();
  const l2Cards = $('lessons').querySelectorAll('button.lesson').length;
  const l2Hero = txt('hero-sub');
  const l2Total = T.L2.reduce((a, L) => a + L.questions.length, 0);
  t('L2 renders 7 lesson cards', l2Cards === 7, l2Cards);
  t('L2 hero shows L2 total', l2Hero.includes(ar(l2Total)), l2Hero.slice(0, 80));
  t('L2 total differs from L1', l1Total !== l2Total, l1Total + '/' + l2Total);
  t('L2 level button is active', $('lv2-btn').classList.contains('on'), $('lv2-btn').className);

  /* ---- 3. chapter exam counts per level ---- */
  const chCount = (ch, lvl) => T.BANKS[lvl].filter(L => T.chapterIds(ch, lvl).includes(L.id)).reduce((a, L) => a + L.questions.length, 0);
  eq('chapterIds ch1 L1', T.chapterIds('ch1', 1), ['l11', 'l12', 'l13', 'l14']);
  eq('chapterIds ch1 L2', T.chapterIds('ch1', 2), ['h11', 'h12', 'h13', 'h14']);
  eq('chapterIds ch2 L1', T.chapterIds('ch2', 1), ['l21', 'l22', 'l23']);
  eq('chapterIds ch2 L2', T.chapterIds('ch2', 2), ['h21', 'h22', 'h23']);

  T.curLevel = 1; T.buildHome();
  const c1L1 = txt('btn-ch1'), c2L1 = txt('btn-ch2');
  T.curLevel = 2; T.buildHome();
  const c1L2 = txt('btn-ch1'), c2L2 = txt('btn-ch2');
  t('L1 ch1 button count correct', c1L1.includes(ar(chCount('ch1', 1))), c1L1);
  t('L2 ch1 button count correct', c1L2.includes(ar(chCount('ch1', 2))), c1L2);
  t('L1 ch2 button count correct', c2L1.includes(ar(chCount('ch2', 1))), c2L1);
  t('L2 ch2 button count correct', c2L2.includes(ar(chCount('ch2', 2))), c2L2);
  t('L2 ch1 count differs from L1', chCount('ch1', 1) !== chCount('ch1', 2), chCount('ch1', 1) + '/' + chCount('ch1', 2));

  /* ---- 4. chapter exam uses the right lessons (h* for L2) ---- */
  T.curLevel = 2;
  T.startChapter('ch1');
  const chLessons = new Set(T.S.queue.map(q => q));
  const chLessonIds = [...new Set(T.S.lesson.questions.map(q => q))];
  t('L2 chapter-1 quiz is non-empty', T.S.queue.length === chCount('ch1', 2), T.S.queue.length + ' vs ' + chCount('ch1', 2));
  // every question must belong to an L2 lesson (h11..h14)
  const hIds = new Set(T.BANKS[2].filter(L => ['h11', 'h12', 'h13', 'h14'].includes(L.id)).flatMap(L => L.questions));
  t('L2 chapter-1 quiz uses only L2 questions', T.S.queue.every(q => hIds.has(q)), 'foreign questions found');
  t('L2 chapter-1 badge shows L2 level', txt('q-level').includes('الثاني'), txt('q-level'));

  T.curLevel = 1;
  T.startChapter('ch2');
  const l1ch2 = new Set(T.BANKS[1].filter(L => ['l21', 'l22', 'l23'].includes(L.id)).flatMap(L => L.questions));
  t('L1 chapter-2 quiz uses only L1 questions', T.S.queue.every(q => l1ch2.has(q)), 'foreign questions found');
  t('L1 chapter-2 badge shows L1 level', txt('q-level').includes('الأول'), txt('q-level'));

  /* ---- 5. lesson page uses canonical summary/extras for both levels ---- */
  const sumOverview = id => (T.SUMMARIES[id] && T.SUMMARIES[id].overview) || '';
  const l11 = T.L1.find(L => L.id === 'l11');
  const h11 = T.L2.find(L => L.id === 'h11');
  T.curLevel = 1; T.openLesson(l11);
  const l1Body = $('lesson-body').textContent;
  t('L1 lesson page shows its summary', l1Body.includes(sumOverview('l11').slice(0, 25)), l1Body.slice(0, 60));
  const rm0 = (T.LESSON_EXTRAS['l11'].roadmap || [])[0] || {};
  t('L1 lesson page shows roadmap (extras)', !rm0.t || l1Body.includes(rm0.t), 'roadmap missing');

  T.curLevel = 2; T.openLesson(h11);
  const l2Body = $('lesson-body').textContent;
  t('L2 lesson page falls back to canonical l11 summary', l2Body.includes(sumOverview('l11').slice(0, 25)), l2Body.slice(0, 60));
  t('L2 lesson nav shows level 2', txt('lesson-nav-num').includes('الثاني'), txt('lesson-nav-num'));

  /* ---- 6. smartExplain / smartTip resolve for L2 ---- */
  // smartTip/smartExplain read S.lesson (set by startQuiz), so test them in-quiz:
  T.curLevel = 2;
  T.startQuiz(h11);
  const qL2 = T.S.queue.find(q => q.explain || q.fix) || T.S.queue[0];
  const ex = T.smartExplain(qL2);
  const tip = T.smartTip(qL2);
  t('smartExplain returns text for L2 question', typeof ex === 'string' && ex.length > 0, JSON.stringify(ex));
  t('smartTip returns a mnemonic for L2 question', !!tip && !!tip.t, JSON.stringify(tip));
  T.curLevel = 1;
  T.startQuiz(l11);
  t('smartTip returns a mnemonic for L1 question', !!T.smartTip(T.S.queue[0]), 'no tip');

  /* ---- 7. summaries tab ---- */
  T.curLevel = 1; T.buildSummaries();
  const sumCards = $('sum-lessons').querySelectorAll('article.sum-card').length;
  const sumChCards = $('sum-chapters').querySelectorAll('article.sum-card').length;
  t('summaries render 7 lesson cards', sumCards === 7, sumCards);
  t('summaries render 2 chapter cards', sumChCards === 2, sumChCards);

  /* ---- 8. bottom nav active states ---- */
  T.gotoHome();
  t('bottom nav visible on home', $('bottom-nav').hidden === false, $('bottom-nav').hidden);
  t('nav-home active on questions tab', $('nav-home').classList.contains('active'), $('nav-home').className);
  T.gotoSummaries();
  t('nav-summaries active on summaries tab', $('nav-summaries').classList.contains('active'), $('nav-summaries').className);
  t('nav-home not active on summaries tab', !$('nav-home').classList.contains('active'), $('nav-home').className);
  T.gotoHome();
  t('nav-home active again after returning', $('nav-home').classList.contains('active'), $('nav-home').className);

  /* ---- 9. quiz completion -> progress persistence (level-scoped) ---- */
  T.curLevel = 1;
  T.startQuiz(l11);
  const qn = await playQuiz(true);
  t('L1 quiz answered all questions', qn === l11.questions.length, qn + '/' + l11.questions.length);
  await sleep(50);
  const pk1 = T.progressKey('l11', 1);
  t('L1 progress stored under l11_L1', !!T.Progress[pk1], Object.keys(T.Progress).join(','));
  t('L1 lesson marked done', !!(T.Progress[pk1] && T.Progress[pk1].done), JSON.stringify(T.Progress[pk1]));
  t('L1 best score is 100', (T.Progress[pk1] || {}).best === 100, (T.Progress[pk1] || {}).best);
  t('no cross-level progress key leaked', !T.Progress['l11_L2'] && !T.Progress['h11_L1'], Object.keys(T.Progress).join(','));
  t('progress persisted to localStorage', !!storage['aiq_progress'], Object.keys(storage).join(','));

  /* L2 quiz on h11 must not touch the L1 record */
  T.curLevel = 2;
  T.startQuiz(h11);
  await playQuiz(true);
  await sleep(50);
  const pk2 = T.progressKey('h11', 2);
  t('L2 progress stored under h11_L2', !!T.Progress[pk2], Object.keys(T.Progress).join(','));
  t('L2 lesson marked done', !!(T.Progress[pk2] && T.Progress[pk2].done), JSON.stringify(T.Progress[pk2]));
  t('L1 progress untouched by L2 quiz', T.Progress[pk1].done === true && T.Progress[pk1].best === 100, JSON.stringify(T.Progress[pk1]));

  /* home shows completion badge per level */
  T.curLevel = 1; T.buildHome();
  const l1Badges = $('lessons').querySelectorAll('.lesson-done').length;
  T.curLevel = 2; T.buildHome();
  const l2Badges = $('lessons').querySelectorAll('.lesson-done').length;
  t('L1 home shows 1 completed badge', l1Badges === 1, l1Badges);
  t('L2 home shows 1 completed badge', l2Badges === 1, l2Badges);

  /* ---- 10. notebook isolation ---- */
  T.curLevel = 1;
  T.startQuiz(l11);
  await playQuiz(false); // answer everything wrong -> fills the notebook
  await sleep(50);
  t('notebook has entries from L1 run', T.Notebook.length > 0, T.Notebook.length);
  t('notebook entry carries lesson id', T.Notebook[0] && T.Notebook[0].lid === 'l11', JSON.stringify(T.Notebook[0] && { lid: T.Notebook[0].lid, level: T.Notebook[0].level }));
  t('notebook entry carries level', T.Notebook[0] && T.Notebook[0].level === 1, JSON.stringify(T.Notebook[0] && T.Notebook[0].level));
  t('notebook has no L2 entries yet', T.Notebook.filter(n => n.level === 2).length === 0, T.Notebook.filter(n => n.level === 2).length);
  T.curLevel = 2;
  T.openLesson(h11);
  const quizTabBtn = [...window.document.querySelectorAll('#lesson-tabs button')].find(b => b.dataset.lt === 'quiz');
  quizTabBtn.click();
  await sleep(0);
  const mistTxt = ($('lesson-body').textContent.match(/أخطائي \(([^)]+)\)/) || [])[1];
  t('L2 lesson mistakes counter is 0 (isolated)', mistTxt === '٠' || mistTxt === '0', mistTxt);

  /* ---- 11. certificate gate ---- */
  T.curLevel = 1;
  t('not all L1 lessons done -> no certificate', T.allLessonsCompleted() === false, 'unexpected true');
  T.L1.forEach(L => { T.Progress[T.progressKey(L.id, 1)] = { done: true, best: 100, attempts: 1, lastPlayed: Date.now(), xp: 50 }; });
  t('all L1 lessons done -> certificate unlocked', T.allLessonsCompleted() === true, 'still false');
  T.curLevel = 2;
  t('L2 not complete while in L1', T.allLessonsCompleted() === false, 'L2 wrongly complete');
  T.curLevel = 1;
  T.startQuiz(l11);
  await playQuiz(true);
  await sleep(80);
  t('certificate screen shown after completing all L1 lessons', $('screen-cert').classList.contains('active'), 'cert not active');
  t('result screen hidden when certificate shown', !$('screen-result').classList.contains('active'), 'result still active');

  console.log('\n--- part 3 done ---');
  module.exports.setFails(fails); module.exports.setPasses(passes);
  global.__RESULT = { fails, passes };
  finish();
})().catch(e => {
  console.log('HARNESS ERROR:', e && e.stack ? e.stack : e);
  process.exit(1);
});

function finish() {
  const r = global.__RESULT || { fails: 0, passes: 0 };
  console.log(r.fails ? '\nRESULT: ' + r.fails + ' FAILURE(S)' : '\nRESULT: all checks passed ✅');
  process.exit(r.fails ? 1 : 0);
}
