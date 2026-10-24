/* ===== منطق لعبة تحدي الذكاء الاصطناعي — المحرك (engine) =====
   المحتوى كله يأتي من content/*.json عبر ContentLoader في بداية التشغيل.
   لا يوجد أي سؤال أو قصة أو ملخص داخل هذا الملف. */

/* ---------- المحتوى (يُملأ من JSON عند الإقلاع) ---------- */
let L1 = [], L2 = [], VAR1 = [], VAR2 = [];
let SUMMARIES = {}, CHAPTER_SUMMARIES = {};
let CHAPTERS = {}, CHAPTER_META = {};
let LESSON_EXTRAS = {};
let CONTENT_SOURCE = 'loading';
let CONTENT_CHECK = null;

// ندمج الأسئلة متنوعة الأنواع داخل كل درس
function prepare(bank, variety) {
  bank.forEach(L => { L.questions = L.questions.concat(variety.filter(v => v.L === L.id)); });
  return bank;
}
let BANKS = { 1: [], 2: [] };

function applyContent(d) {
  L1 = d.L1; L2 = d.L2; VAR1 = d.VAR1; VAR2 = d.VAR2;
  SUMMARIES = d.SUMMARIES;
  CHAPTERS = d.CHAPTERS; CHAPTER_META = d.CHAPTER_META;
  CHAPTER_SUMMARIES = d.CHAPTER_SUMMARIES || {};
  LESSON_EXTRAS = d.EXTRAS || {};
  CONTENT_SOURCE = d.source || 'json';
  BANKS = { 1: prepare(L1, VAR1), 2: prepare(L2, VAR2) };
  try {
    CONTENT_CHECK = {
      l1: L1.reduce((a, L) => a + L.questions.length, 0),
      l2: L2.reduce((a, L) => a + L.questions.length, 0)
    };
  } catch (e) { CONTENT_CHECK = null; }
}

let curLevel = 1;
const curBank = () => BANKS[curLevel];

/* ---------- مطابقة مفاتيح المحتوى بين المستويين ----------
   دروس المستوى الأول: l11..l23 | دروس المستوى الثاني: h11..h23
   أما الملخصات والإضافات وفهرس الفصول فهي بمفاتيح l* فقط. */
const contentKey = id => String(id).replace(/^h(\d)/, 'l$1');
const chapterIds = (ch, level) => (CHAPTERS[ch] || []).map(id => (level === 2 ? id.replace(/^l(\d)/, 'h$1') : id));
const progressKey = (id, level) => String(id) + '_L' + (level || curLevel);

const CFG = {
  perAll: 30,         // عدد أسئلة الامتحان الشامل
  time: 30,           // ثواني لكل سؤال
  correct: 10,        // نقاط الإجابة الصحيحة
  wrong: -5,          // نقاط الإجابة الخاطئة
  speedBonus: 25,     // نقاط الإجابة السريعة
  fastTime: 10,       // زمن البونس
  xpCorrect: 5,       // خبرة للإجابة الصحيحة
  xpLessonComplete: 50, // خبرة عند إكمال درس
  xpPerfect: 100      // خبرة عند العلامة الكاملة
};

/* ---------- الوضع الليلي / الفاتح ---------- */
const THEME_KEY = 'aiq_theme';
let theme = localStorage.getItem(THEME_KEY) || 'dark';
function applyTheme() {
  if (theme === 'light') document.body.classList.add('light');
  else document.body.classList.remove('light');
  const btn = $('theme-toggle');
  if (btn) btn.textContent = theme === 'light' ? '☀️' : '🌙';
}
function toggleTheme() {
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem(THEME_KEY, theme);
  applyTheme();
}

/* ---------- التقدم لكل درس (localStorage) ---------- */
const PROGRESS_KEY = 'aiq_progress';
let Progress = {}; // { lessonId: { done, best, attempts, lastPlayed, xp } }
function loadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    Progress = raw ? JSON.parse(raw) : {};
  } catch (e) { Progress = {}; }
}
function saveProgress() {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(Progress)); } catch (e) {}
}
function getProgress(lessonId) {
  return Progress[lessonId] || { done: false, best: 0, attempts: 0, lastPlayed: 0, xp: 0 };
}
function updateProgress(lessonId, pct, xpEarned) {
  const prev = getProgress(lessonId);
  const next = {
    done: pct === 100,
    best: Math.max(prev.best, pct),
    attempts: prev.attempts + 1,
    lastPlayed: Date.now(),
    xp: prev.xp + xpEarned
  };
  Progress[lessonId] = next;
  saveProgress();
  return next;
}

/* ---------- دفتر الأخطاء الدائم ---------- */
const NOTEBOOK_KEY = 'aiq_notebook';
let Notebook = []; // [{q, right, lesson, date}]
function loadNotebook() {
  try {
    const raw = localStorage.getItem(NOTEBOOK_KEY);
    Notebook = raw ? JSON.parse(raw) : [];
  } catch (e) { Notebook = []; }
}
function saveNotebook() {
  try { localStorage.setItem(NOTEBOOK_KEY, JSON.stringify(Notebook)); } catch (e) {}
}
function addToNotebook(q, right, lesson) {
  const lid = String((lesson && lesson.id) || '').split('_')[0];
  Notebook.push({
    q, right,
    lesson: (lesson && lesson.num) || (lesson && lesson.title) || '',
    lid, level: curLevel, date: Date.now()
  });
  saveNotebook();
}
/* هل الخطأ من هذا الدرس؟ نعتمد على معرّف الدرس والمستوى، ومع fallback على رقم الدرس للبيانات القديمة */
function notebookMatches(item, lesson) {
  const lid = String((lesson && lesson.id) || '').split('_')[0];
  if (item.lid) {
    if (item.lid !== lid) return false;
    return (item.level == null || item.level === curLevel);
  }
  return String(item.lesson || '').indexOf(lesson.num) > -1;
}
function clearNotebook() {
  Notebook = [];
  saveNotebook();
}
function buildNotebook() {
  const box = $('notebook-list');
  if (!box) return;
  box.innerHTML = '';
  // تحديث عدّاد دفتر الأخطاء على التبويب
  const tabBtn = $('tabbtn-s');
  if (tabBtn) tabBtn.textContent = Notebook.length > 0 ? '📚 ملخصات (' + ar(Notebook.length) + ')' : '📚 ملخصات';
  if (Notebook.length === 0) {
    box.innerHTML = '<div class="notebook-empty">لا توجد أخطاء مسجلة بعد. حل الأسئلة وسيتم حفظ أخطائك هنا للمراجعة لاحقاً.</div>';
    return;
  }
  Notebook.slice().reverse().forEach(item => {
    const d = document.createElement('div');
    d.className = 'notebook-item';
    const dt = new Date(item.date).toLocaleString('ar-SA');
    d.innerHTML =
      '<div class="nq">❓ ' + esc(item.q) + '</div>' +
      '<div class="na">✔ ' + esc(item.right) + '</div>' +
      '<div class="ns">الدرس: ' + esc(item.lesson) + ' — ' + dt + '</div>';
    box.appendChild(d);
  });
}

/* --------- نقاط الخبرة (XP) والشهادة --------- */
let TotalXP = 0;
const XP_KEY = 'aiq_xp';
function loadXP() {
  try { TotalXP = parseInt(localStorage.getItem(XP_KEY) || '0', 10); } catch (e) { TotalXP = 0; }
}
function saveXP() {
  try { localStorage.setItem(XP_KEY, String(TotalXP)); } catch (e) {}
}
function addXP(amount) {
  TotalXP += amount;
  saveXP();
  $('xp-chip').innerHTML = '✨ <b>' + ar(TotalXP) + '</b>';
}
function allLessonsCompleted() {
  const ids = curBank().map(L => L.id);
  return ids.length > 0 && ids.every(id => getProgress(progressKey(id, curLevel)).done);
}

/* ---------- النطق الصوتي (Web Speech API) ---------- */
let synth = null;
function initSpeech() {
  if (typeof speechSynthesis !== 'undefined') synth = window.speechSynthesis;
}
function speak(text) {
  if (!synth || !text) return;
  try {
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ar-SA';
    u.rate = 0.9;
    synth.speak(u);
  } catch (e) {}
}

/* ---------- الحالة ---------- */
const S = {
  lesson: null, level: 1, queue: [], i: 0,
  score: 0, streak: 0, bestStreak: 0,
  correct: 0, wrong: 0, fast: 0,
  locked: false, left: CFG.time, timer: null, wrongList: []
};

/* ---------- أدوات ---------- */
const $ = id => document.getElementById(id);
const AR_D = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
const ar = n => String(n).replace(/\d/g, d => AR_D[+d]);
const shuffle = arr => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const LEVEL_NAME = { 1: 'المستوى الأول', 2: 'المستوى الثاني' };
const LEVEL_DESC = { 1: 'أسئلة الدرس الأساسية', 2: 'أسئلة امتحانية متقدمة' };
// تنظيف النتائج القديمة المحفوظة
try { Object.keys(localStorage).filter(k => k.indexOf('aiq_best_') === 0).forEach(k => localStorage.removeItem(k)); } catch (e) {}

/* ---------- المؤثرات الصوتية ---------- */
let actx = null;
function beep(freq, dur, type) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(.0001, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(.18, actx.currentTime + .01);
    g.gain.exponentialRampToValueAtTime(.0001, actx.currentTime + dur);
    o.connect(g); g.connect(actx.destination);
    o.start(); o.stop(actx.currentTime + dur + .02);
  } catch (e) {}
}
const sfxOk = () => { beep(660, .12); setTimeout(() => beep(990, .16), 90); };
const sfxBad = () => { beep(220, .22, 'sawtooth'); };
const sfxEnd = () => { [523, 659, 784, 1046].forEach((f, k) => setTimeout(() => beep(f, .18), k * 130)); };

/* ---------- الاحتفال ---------- */
const cvs = $('fx'), ctx = cvs.getContext('2d');
let parts = [];
function sizeFx() {
  cvs.width = innerWidth * devicePixelRatio;
  cvs.height = innerHeight * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
addEventListener('resize', sizeFx); sizeFx();

function celebrate(n) {
  const colors = ['#22c55e', '#fbbf24', '#8b5cf6', '#22d3ee', '#f472b6', '#f97316'];
  for (let i = 0; i < (n || 70); i++) {
    parts.push({
      x: innerWidth / 2 + (Math.random() - .5) * 220,
      y: innerHeight * .32,
      vx: (Math.random() - .5) * 11,
      vy: Math.random() * -13 - 4,
      s: 5 + Math.random() * 7,
      c: colors[Math.random() * colors.length | 0],
      r: Math.random() * 6,
      life: 90 + Math.random() * 40
    });
  }
}
function drawFx() {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter(p => p.life-- > 0);
  parts.forEach(p => {
    p.x += p.vx; p.y += p.vy; p.vy += .32; p.r += .18;
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(p.r);
    ctx.fillStyle = p.c; ctx.globalAlpha = Math.max(0, p.life / 110);
    ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 1.6);
    ctx.restore();
  });
  requestAnimationFrame(drawFx);
}
requestAnimationFrame(drawFx);

/* ---------- صفحة الدرس الواحدة ---------- */
let LP = { lesson: null, tab: 'study' };
const MODE_KEY = 'aiq_mode';
let StudyMode = 'study';
try { StudyMode = localStorage.getItem(MODE_KEY) || 'study'; } catch (e) {}

function openLesson(lesson) {
  if (!lesson) { buildHome(); show('home'); return; }
  LP.lesson = lesson; LP.tab = 'study';
  $('lesson-nav-icon').textContent = lesson.icon || '📚';
  $('lesson-nav-num').textContent = 'الدرس ' + lesson.num + ' — ' + LEVEL_NAME[curLevel];
  $('lesson-nav-title').textContent = lesson.title;
  const p = getProgress(progressKey(lesson.id, curLevel));
  $('lesson-nav-best').textContent = '🏆 ' + ar(p.best) + '٪';
  document.querySelectorAll('#lesson-tabs button').forEach(b => {
    b.classList.toggle('on', b.dataset.lt === 'study');
    b.onclick = () => { LP.tab = b.dataset.lt; document.querySelectorAll('#lesson-tabs button').forEach(x => x.classList.toggle('on', x === b)); renderLessonBody(); };
  });
  renderLessonBody();
  show('lesson');
}
function lessonReviewInfo() {
  const p = getProgress(progressKey(LP.lesson.id, curLevel));
  if (!p.lastPlayed) return '👋 أهلا بيك! امشي بالترتيب: خريطة 60 ثانية ← القصة ← جمل الحفظ ← اختبر.';
  const days = Math.floor((Date.now() - p.lastPlayed) / 864e5);
  if (p.best < 70) return '⚠️ نتيجتك ' + ar(p.best) + '٪ — راجع القصة وجمل الحفظ قبل ما تختبر تاني.';
  if (days >= 3) return '⏰ عدى ' + ar(days) + ' أيام من غير مراجعة — راجع سريع عشان المعلومة تثبت.';
  if (p.done) return '✅ ممتاز! قفلت الدرس ده. راجع ليلة الامتحان بس.';
  return '💪 مستواك ' + ar(p.best) + '٪ — فاضل خطوة وتقفل الدرس.';
}
function renderLessonBody() {
  const L = LP.lesson;
  if (!L) { buildHome(); show('home'); return; }
  const ck = contentKey(L.id);
  const sum = SUMMARIES[ck] || {}, ex = LESSON_EXTRAS[ck] || {};
  // إظهار التبويب المختار في منتصف الشريط على الموبايل
  try {
    const on = document.querySelector('#lesson-tabs button.on');
    if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  } catch (e) {}
  const body = $('lesson-body'); body.innerHTML = '';
  const mk = h => { const d = document.createElement('div'); d.className = 'lp-card'; d.innerHTML = h; body.appendChild(d); return d; };
  const rm = (ex.roadmap || []).map(r => '<div class="road-item"><b>🗺️ ' + esc(r.t) + '</b><span>' + esc(r.d) + '</span></div>').join('');
  if (LP.tab === 'study') {
    mk('<div class="review-alert">' + esc(lessonReviewInfo()) + '</div>');
    mk('<h3>🗺️ خريطة الدرس في 60 ثانية</h3><div class="road-grid">' + rm + '</div>');
    mk('<h3>📚 الشرح المختصر</h3><p>' + esc(sum.overview || '') + '</p><ul class="lp-points">' + (sum.points || []).map(p => '<li>' + esc(p) + '</li>').join('') + '</ul>');
    if (sum.table) mk('<h3>📊 جدول المقارنة — احفظ منه</h3><table class="lp-table"><tr>' + sum.table.headers.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr>' + sum.table.rows.map(r => '<tr>' + r.map(c => '<td>' + esc(c) + '</td>').join('') + '</tr>').join('') + '</table>');
    const c = mk('<h3>🎯 جاهز تختبر؟</h3><div class="quiz-modes"><div class="mode-row"><button class="mode-btn primary" id="lp-go-quiz">ابدأ الاختبار (' + ar(L.questions.length) + ' سؤال)</button><button class="mode-btn warn" id="lp-go-cram">🔥 ليلة الامتحان (15)</button></div><div class="mode-row"><button class="mode-btn ' + (StudyMode === 'study' ? 'on' : '') + '" id="lp-m-s">📖 حفظ (بدون وقت)</button><button class="mode-btn ' + (StudyMode === 'exam' ? 'on' : '') + '" id="lp-m-e">⏱️ امتحان (بتوقيت)</button></div></div>');
    c.querySelector('#lp-go-quiz').onclick = () => startQuiz(L);
    c.querySelector('#lp-go-cram').onclick = () => startCram(L);
    c.querySelector('#lp-m-s').onclick = () => { StudyMode = 'study'; try { localStorage.setItem(MODE_KEY, 'study'); } catch (e) {} renderLessonBody(); };
    c.querySelector('#lp-m-e').onclick = () => { StudyMode = 'exam'; try { localStorage.setItem(MODE_KEY, 'exam'); } catch (e) {} renderLessonBody(); };
  } else if (LP.tab === 'story') {
    mk('<h3>📜 احفظها بقصة المستر</h3><div class="story-box">' + esc(ex.story || '...') + '</div>');
    mk('<h3>❓ سؤال الامتحان</h3><div class="qa"><b>س: </b>' + esc(sum.mainQ || '') + '<br><b>ج: </b>' + esc(sum.mainA || '') + '</div><div class="qa"><b>س امتحاني: </b>' + esc(sum.examQ || '') + '<br><b>ج: </b>' + esc(sum.examA || '') + '</div>');
  } else if (LP.tab === 'tricks') {
    mk('<h3>🧠 جمل الحفظ — كلام المستر</h3><div class="trick-grid">' + (ex.mnemonics || []).map(m => '<div class="trick"><b>💡 ' + esc(m.t) + '</b><span>' + esc(m.d) + '</span></div>').join('') + '</div>');
  } else if (LP.tab === 'map') {
    mk('<h3>🗺️ الخريطة الذهنية</h3><div class="map-wrap">' + (ex.mindmap || []).map(n => '<div class="map-node"><b>📍 ' + esc(n.t) + '</b><div class="map-kids">' + (n.kids || []).map(k => '<span>' + esc(k) + '</span>').join('') + '</div></div>').join('') + '</div>');
    if (sum.table) mk('<h3>📊 جدول المقارنة</h3><table class="lp-table"><tr>' + sum.table.headers.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr>' + sum.table.rows.map(r => '<tr>' + r.map(c => '<td>' + esc(c) + '</td>').join('') + '</tr>').join('') + '</table>');
  } else if (LP.tab === 'terms') {
    const f = mk('<h3>🔤 بطاقات المصطلحات — دوس عشان تقلبها</h3><div class="flash-grid">' + (sum.keyTerms || []).map(k => '<div class="flash" tabindex="0"><div class="flash-inner"><div class="flash-face flash-front">' + esc(k.t) + '</div><div class="flash-face flash-back">' + esc(k.d) + '</div></div></div>').join('') + '</div>');
    f.querySelectorAll('.flash').forEach(fl => {
      const flip = () => fl.classList.toggle('flip');
      fl.addEventListener('click', flip);
      fl.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
    });
  } else if (LP.tab === 'quiz') {
    const nbCount = Notebook.filter(n => notebookMatches(n, L)).length;
    const c = mk('<h3>🎯 اختبر نفسك — ' + ar(L.questions.length) + ' سؤال</h3><div class="quiz-modes"><div class="mode-row"><button class="mode-btn ' + (StudyMode === 'study' ? 'on' : '') + '" id="lp-m-s2">📖 حفظ</button><button class="mode-btn ' + (StudyMode === 'exam' ? 'on' : '') + '" id="lp-m-e2">⏱️ امتحان</button></div><div class="mode-row"><button class="mode-btn primary" id="lp-q-all">ابدأ الدرس كامل</button><button class="mode-btn warn" id="lp-q-cram">🔥 ليلة الامتحان (15)</button></div><div class="mode-row"><button class="mode-btn" id="lp-q-mist">📘 أخطائي (' + ar(nbCount) + ')</button></div><p style="font-size:13px;color:var(--muted)">الحفظ: بدون وقت وبدون نقص ومع شرح. الامتحان: 30 ثانية و−٥ على الغلط.</p></div>');
    c.querySelector('#lp-q-all').onclick = () => startQuiz(L);
    c.querySelector('#lp-q-cram').onclick = () => startCram(L);
    c.querySelector('#lp-q-mist').onclick = () => startMistakes(L);
    c.querySelector('#lp-m-s2').onclick = () => { StudyMode = 'study'; try { localStorage.setItem(MODE_KEY, 'study'); } catch (e) {} renderLessonBody(); };
    c.querySelector('#lp-m-e2').onclick = () => { StudyMode = 'exam'; try { localStorage.setItem(MODE_KEY, 'exam'); } catch (e) {} renderLessonBody(); };
  }
}
function startCram(lesson) {
  const scored = lesson.questions.map(q => ({ q, s: (q.explain ? 2 : 0) + (q.t ? 1 : 0) + Math.random() }));
  scored.sort((a, b) => b.s - a.s);
  const pick = scored.slice(0, Math.min(15, lesson.questions.length)).map(x => x.q);
  const fake = { id: lesson.id + '_cram', num: lesson.num + ' 🔥', title: lesson.title + ' — ليلة الامتحان', icon: '🔥', color: lesson.color, questions: pick };
  S.lesson = fake; S.level = curLevel; S.queue = shuffle(pick.slice());
  S.i = 0; S.score = 0; S.streak = 0; S.bestStreak = 0; S.correct = 0; S.wrong = 0; S.fast = 0; S.wrongList = [];
  show('quiz'); $('q-lesson').textContent = '🔥 ' + lesson.num; $('q-level').textContent = LEVEL_NAME[curLevel]; $('q-level').classList.toggle('lvl2', curLevel === 2);
  nextQuestion();
}
function startMistakes(lesson) {
  const mine = Notebook.filter(n => notebookMatches(n, lesson));
  if (!mine.length) { alert('لسه مغلطتش في الدرس ده — ابدأ الاختبار الأول 💪'); return startQuiz(lesson); }
  const qs = mine.slice(-20).map(n => ({ q: n.q, o: ['✅ ' + n.right, '❌ راجع الملخص والقصة'], a: 0 }));
  const fake = { id: lesson.id + '_mist', num: lesson.num + ' 📘', title: lesson.title + ' — أخطائي', icon: '📘', color: lesson.color, questions: qs };
  S.lesson = fake; S.level = curLevel; S.queue = shuffle(qs.slice());
  S.i = 0; S.score = 0; S.streak = 0; S.bestStreak = 0; S.correct = 0; S.wrong = 0; S.fast = 0; S.wrongList = [];
  show('quiz'); $('q-lesson').textContent = '📘 ' + lesson.num; $('q-level').textContent = LEVEL_NAME[curLevel]; $('q-level').classList.toggle('lvl2', curLevel === 2);
  nextQuestion();
}

/* ---------- شاشة البداية ---------- */
function buildHome() {
  const wrap = $('lessons');
  const bank = curBank();
  const total = bank.reduce((a, L) => a + L.questions.length, 0);
  $('hero-sub').textContent = ar(total) + ' سؤالا في ' + LEVEL_NAME[curLevel]
    + ' من منهج الفصول الأول والثاني — كل إجابة صحيحة تضيف نقاطا، والإجابة الخاطئة تنقصك';
  $('lv1-btn').classList.toggle('on', curLevel === 1);
  $('lv2-btn').classList.toggle('on', curLevel === 2);
  $('lv-desc').textContent = LEVEL_DESC[curLevel];
  wrap.innerHTML = '';
  bank.forEach(L => {
    const prog = getProgress(progressKey(L.id, curLevel));
    const pct = prog.done ? 100 : Math.round((prog.best / 100) * 100);
    const doneBadge = prog.done ? '<span class="lesson-done">✅ مكتمل</span>' : '';
    const el = document.createElement('button');
    el.className = 'lesson';
    el.style.setProperty('--c', L.color);
    el.innerHTML =
      '<span class="l-chap">فصل ' + L.num.charAt(0) + '</span>' +
      '<div class="l-top"><span class="l-icon">' + L.icon + '</span>' +
      '<span class="l-num">الدرس ' + L.num + '</span>' + doneBadge + '</div>' +
      '<div class="l-title">' + L.title + '</div>' +
      '<div class="lesson-prog"><div class="lesson-prog-fill" style="width:' + pct + '%"></div></div>' +
      '<div class="l-foot"><span class="pill">' + ar(L.questions.length) + ' سؤال</span>' +
      '<span class="best">أفضل نتيجة: ' + ar(prog.best) + '٪</span></div>';
    el.addEventListener('click', () => openLesson(L));
    wrap.appendChild(el);
  });
  $('btn-all').textContent = (curLevel === 1 ? '🎓 امتحان شامل' : '🎓 امتحان شامل — المستوى الثاني');
  // عدّادات امتحانات الفصول حسب المستوى الحالي
  const chCount = ch => curBank().filter(L => chapterIds(ch, curLevel).includes(L.id)).reduce((a, L) => a + L.questions.length, 0);
  $('btn-ch1').textContent = '🎓 امتحان الفصل الأول 1-1..1-4 (' + ar(chCount('ch1')) + ' سؤال)';
  $('btn-ch2').textContent = '🛡️ امتحان الفصل الثاني 2-1..2-3 (' + ar(chCount('ch2')) + ' سؤال)';
}

/* ---------- بدء الامتحان ---------- */
function startQuiz(lesson) {
  S.lesson = lesson;
  S.level = curLevel;
  S.queue = shuffle(lesson.questions.slice());
  S.i = 0; S.score = 0; S.streak = 0; S.bestStreak = 0;
  S.correct = 0; S.wrong = 0; S.fast = 0; S.wrongList = [];
  show('quiz');
  $('q-lesson').textContent = 'الدرس ' + lesson.num;
  $('q-level').textContent = LEVEL_NAME[curLevel];
  $('q-level').classList.toggle('lvl2', curLevel === 2);
  nextQuestion();
}

function startChapter(ch) {
  const ids = chapterIds(ch, curLevel);
  const meta = CHAPTER_META[ch] || { num: ch, title: 'امتحان الفصل', icon: '🎓', color: '#a78bfa' };
  const mix = shuffle(curBank().filter(L => ids.includes(L.id)).flatMap(L => L.questions));
  const fake = { id: 'ch:' + ch, num: meta.num, title: meta.title, icon: meta.icon, color: meta.color, questions: mix, chapter: ch };
  S.lesson = fake;
  S.level = curLevel;
  S.queue = shuffle(mix);
  S.i = 0; S.score = 0; S.streak = 0; S.bestStreak = 0;
  S.correct = 0; S.wrong = 0; S.fast = 0; S.wrongList = [];
  show('quiz');
  $('q-lesson').textContent = meta.title;
  $('q-level').textContent = LEVEL_NAME[curLevel];
  $('q-level').classList.toggle('lvl2', curLevel === 2);
  nextQuestion();
}

function startAll() {
  const mix = shuffle(curBank().flatMap(L => L.questions)).slice(0, CFG.perAll);
  const fake = { id: 'all', num: 'ALL', title: 'الامتحان الشامل — كل الدروس', icon: '🎓', color: '#fbbf24', questions: mix };
  S.lesson = fake;
  S.level = curLevel;
  S.queue = shuffle(mix);
  S.i = 0; S.score = 0; S.streak = 0; S.bestStreak = 0;
  S.correct = 0; S.wrong = 0; S.fast = 0; S.wrongList = [];
  show('quiz');
  $('q-lesson').textContent = 'شامل';
  $('q-level').textContent = LEVEL_NAME[curLevel];
  $('q-level').classList.toggle('lvl2', curLevel === 2);
  nextQuestion();
}

/* ---------- التنقل بين الشاشات ---------- */
function show(name) {
  ['home', 'lesson', 'quiz', 'result', 'cert'].forEach(s => { const el = $('screen-' + s); if (el) el.classList.toggle('active', s === name); });
  updateBottomNav();
  scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---------- شريط التنقل السفلي للموبايل ---------- */
function updateBottomNav() {
  const nav = $('bottom-nav');
  if (!nav) return;
  // الشريط السفلي يظهر فقط في الرئيسية (home) — مخفي في الدرس والامتحان والنتيجة والشهادة
  const activeScreen = document.querySelector('.screen.active');
  const activeId = activeScreen ? activeScreen.id : 'screen-home';
  nav.hidden = activeId !== 'screen-home';

  // تحديث حالات التمييز (active)
  const summariesVisible = !($('pane-summaries') && $('pane-summaries').hidden);
  if ($('nav-home')) $('nav-home').classList.toggle('active', !summariesVisible);
  if ($('nav-summaries')) $('nav-summaries').classList.toggle('active', summariesVisible);
  if ($('nav-notebook')) $('nav-notebook').classList.toggle('active', false);
  if ($('nav-stats')) $('nav-stats').classList.toggle('active', false);
}

function gotoHome() { buildHome(); show('home'); switchHomeTab('q'); }
function gotoSummaries() { buildHome(); show('home'); switchHomeTab('s'); }
function gotoNotebook() { buildHome(); show('home'); switchHomeTab('s'); buildNotebook(); }
function gotoStats() { buildHome(); show('home'); switchHomeTab('q'); }

/* ---------- السؤال ---------- */
function nextQuestion() {
  clearInterval(S.timer);
  if (S.i >= S.queue.length) return finish();

  const q = S.queue[S.i];
  S.locked = false;
  S.left = CFG.time;

  $('q-num').textContent = 'السؤال ' + ar(S.i + 1) + ' من ' + ar(S.queue.length);
  $('q-counter').textContent = ar(S.i + 1) + ' / ' + ar(S.queue.length);
  $('bar-fill').style.width = ((S.i) / S.queue.length * 100) + '%';
  $('q-text').textContent = q.q;
  const qt = $('q-text');
  let spk = qt.parentElement.querySelector('.q-speak');
  if (!spk) {
    spk = document.createElement('button');
    spk.className = 'q-speak';
    spk.title = 'استمع للنص';
    qt.parentElement.insertBefore(spk, qt);
  }
  spk.textContent = '🔊';
  spk.onclick = () => speak(q.q);
  $('feedback').className = 'feedback';
  $('btn-next').classList.remove('show');
  $('btn-next').textContent = (S.i === S.queue.length - 1) ? 'إنهاء الامتحان 🏁' : 'التالي ⏭';

  renderQ(q);

  // وضع الحفظ: بدون مؤقت — وضع الامتحان: مؤقت 30 ثانية
  clearInterval(S.timer);
  if (StudyMode === 'study' && S.lesson && S.lesson.id && !String(S.lesson.id).startsWith('ch:') && S.lesson.id !== 'all' && String(S.lesson.id).indexOf('_') === -1) {
    $('timer-fill').style.width = '100%';
    return;
  }
  S.timer = setInterval(() => {
    S.left -= .25;
    $('timer-fill').style.width = Math.max(0, S.left / CFG.time * 100) + '%';
    const tf = $('timer-fill');
    if (S.left <= 5) { tf.style.background = 'var(--bad)'; tf.style.boxShadow = '0 0 12px var(--bad)'; }
    else { tf.style.background = ''; tf.style.boxShadow = ''; }
    if (S.left <= 0) timeOut(q);
  }, 250);
}

/* ---------- نص الإجابة الصحيحة لكل نوع ---------- */
function rightText(q) {
  if (!q.t || q.t === 'mcq') return q.o[q.a];
  if (q.t === 'tf') return q.a ? 'صحيح' : 'خطأ';
  if (q.t === 'fill') return q.ans[0];
  if (q.t === 'order') return q.items.join(' ← ');
  return q.groups.map(g => g.g + ': ' + g.items.join('، ')).join(' | ');
}
const groupText = q => q.groups.map(g => g.g + ': ' + g.items.join('، ')).join(' | ');

/* ---------- عرض السؤال حسب نوعه ---------- */
function renderQ(q) {
  const box = $('options');
  box.innerHTML = '';
  box.className = 'options';
  if (!q.t || q.t === 'mcq') renderMcq(q);
  else if (q.t === 'tf') renderTf(q);
  else if (q.t === 'fill') renderFill(q);
  else if (q.t === 'order') renderOrder(q);
  else if (q.t === 'classify') renderClassify(q);
}

function renderMcq(q) {
  shuffle(q.o.map((t, k) => ({ t, k }))).forEach((o, n) => {
    const b = document.createElement('button');
    b.className = 'opt';
    b.dataset.idx = o.k;
    b.innerHTML = '<span class="key">' + ar(n + 1) + '</span><span>' + o.t + '</span>';
    b.addEventListener('click', () => choose(n, q.a, q));
    $('options').appendChild(b);
  });
}

function renderTf(q) {
  ['صح', 'خطأ'].forEach((txt, k) => {
    const b = document.createElement('button');
    b.className = 'opt';
    b.dataset.idx = k;
    b.innerHTML = '<span class="key">' + ar(k + 1) + '</span><span>' + txt + '</span>';
    b.addEventListener('click', () => choose(k, q.a ? 0 : 1, q));
    $('options').appendChild(b);
  });
}

const norm = s => String(s).toLowerCase()
  .replace(/[\u064B-\u0652\u0640]/g, '')
  .replace(/[أإآ]/g, '\u0627').replace(/ى/g, '\u064A').replace(/ة/g, '\u0647')
  // لا تهتم بحرف التعريف "ال" في بداية كل كلمة (السائل == سائل، السرير == سرير)
  .replace(/(^|\s)ال/g, '$1')
  .replace(/[^\u0621-\u064Aa-z0-9]/g, '');

function renderFill(q) {
  const box = $('options');
  const inp = document.createElement('input');
  inp.className = 'fill-in';
  inp.type = 'text';
  inp.placeholder = 'اكتب إجابتك هنا ثم اضغط تحقق';
  const btn = document.createElement('button');
  btn.className = 'btn primary check';
  btn.textContent = 'تحقق ✅';
  const submit = () => {
    if (S.locked || !inp.value.trim()) return;
    S.locked = true; clearInterval(S.timer);
    $('timer-fill').style.width = '0%';
    inp.disabled = true; btn.disabled = true;
    const v = norm(inp.value);
    const ok = q.ans.some(a => { const n = norm(a); return v === n || (v.length >= 3 && n.indexOf(v) > -1); });
    const fb = $('feedback');
    if (ok) finishAnswer(true);
    else {
      fb.className = 'feedback bad show';
      $('fb-title').innerHTML = '❌ إجابة خاطئة — الصواب: ' + q.ans[0];
      $('fb-body').textContent = 'راجع السؤال في ملخص الأخطاء 📘';
      finishAnswer(false);
    }
  };
  btn.addEventListener('click', submit);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  box.appendChild(inp);
  box.appendChild(btn);
  setTimeout(() => inp.focus(), 80);
}

function renderOrder(q) {
  const box = $('options');
  let pool = shuffle(q.items);
  const picked = [];
  const info = document.createElement('div');
  info.className = 'ord-info';
  info.textContent = 'اضغط على العناصر بالترتيب الصحيح — والضغط على عنصر في السطر العلوي يعيده';
  const line = document.createElement('div'); line.className = 'line';
  const poolBox = document.createElement('div'); poolBox.className = 'pool';
  const btn = document.createElement('button');
  btn.className = 'btn primary check'; btn.textContent = 'تحقق ✅';
  function refresh() {
    line.innerHTML = ''; poolBox.innerHTML = '';
    picked.forEach((t, k) => {
      const b = document.createElement('button');
      b.className = 'chip on'; b.textContent = ar(k + 1) + '. ' + t;
      b.onclick = () => { if (S.locked) return; picked.splice(k, 1); pool.push(t); refresh(); };
      line.appendChild(b);
    });
    pool.forEach((t, k) => {
      const b = document.createElement('button');
      b.className = 'chip'; b.textContent = t;
      b.onclick = () => { if (S.locked) return; pool.splice(k, 1); picked.push(t); refresh(); };
      poolBox.appendChild(b);
    });
  }
  btn.onclick = () => {
    if (S.locked || picked.length !== q.items.length) return;
    S.locked = true; clearInterval(S.timer);
    $('timer-fill').style.width = '0%';
    btn.disabled = true;
    const ok = picked.every((t, k) => t === q.items[k]);
    const fb = $('feedback');
    if (ok) finishAnswer(true);
    else {
      fb.className = 'feedback bad show';
      $('fb-title').innerHTML = '❌ ترتيب غير صحيح — الترتيب الصحيح: ' + q.items.join(' ← ');
      $('fb-body').textContent = 'راجع السؤال في ملخص الأخطاء 📘';
      finishAnswer(false);
    }
  };
  box.appendChild(info); box.appendChild(line); box.appendChild(poolBox); box.appendChild(btn);
  refresh();
}

function renderClassify(q) {
  const box = $('options');
  const all = [];
  q.groups.forEach((g, gi) => g.items.forEach(t => all.push({ t, gi })));
  shuffle(all).forEach(it => {
    const row = document.createElement('div');
    row.className = 'cls-row';
    const lab = document.createElement('span');
    lab.className = 'cls-item'; lab.textContent = it.t;
    const btns = document.createElement('span');
    btns.className = 'cls-btns';
    q.groups.forEach((g, gi) => {
      const b = document.createElement('button');
      b.className = 'cls-btn'; b.textContent = g.g;
      b.dataset.want = gi; b.dataset.got = '';
      b.onclick = () => {
        if (S.locked) return;
        b.dataset.got = gi;
        [...btns.children].forEach(x => x.classList.remove('sel'));
        b.classList.add('sel');
      };
      btns.appendChild(b);
    });
    row.appendChild(lab); row.appendChild(btns);
    box.appendChild(row);
  });
  const btn = document.createElement('button');
  btn.className = 'btn primary check'; btn.textContent = 'تحقق ✅';
  btn.onclick = () => {
    if (S.locked) return;
    const rows = [...box.querySelectorAll('.cls-row')];
    if (rows.some(r => !r.querySelector('.cls-btn.sel'))) return;
    S.locked = true; clearInterval(S.timer);
    $('timer-fill').style.width = '0%';
    btn.disabled = true;
    const ok = rows.every(r => {
      const sel = r.querySelector('.cls-btn.sel');
      return +sel.dataset.got === +sel.dataset.want;
    });
    rows.forEach(r => {
      const sel = r.querySelector('.cls-btn.sel');
      const good = +sel.dataset.got === +sel.dataset.want;
      r.classList.add(good ? 'ok' : 'no');
      if (!good) sel.classList.add('no');
    });
    const fb = $('feedback');
    if (ok) finishAnswer(true);
    else {
      fb.className = 'feedback bad show';
      $('fb-title').innerHTML = '❌ تصنيف غير صحيح — الصواب: ' + groupText(q);
      $('fb-body').textContent = 'راجع السؤال في ملخص الأخطاء 📘';
      finishAnswer(false);
    }
  };
  box.appendChild(btn);
}

/* ---------- انتهاء الوقت ---------- */
function timeOut(q) {
  if (S.locked) return;
  S.locked = true;
  clearInterval(S.timer);
  $('timer-fill').style.width = '0%';
  [...$('options').querySelectorAll('button,input')].forEach(b => { b.disabled = true; });
  const fb = $('feedback');
  fb.className = 'feedback bad show';
  $('fb-title').innerHTML = '⏱ انتهى الوقت! الإجابة الصحيحة: ' + rightText(q);
  $('fb-body').textContent = q.fix || 'حاول الإجابة أسرع في السؤال القادم 💪';
  finishAnswer(false);
}

/* ---------- الاختيار من الخيارات ---------- */
function choose(pick, correctIdx, q) {
  if (S.locked) return;
  const btns = [...$('options').children];
  if (pick === -1 || pick === undefined) return timeOut(q);
  S.locked = true;
  clearInterval(S.timer);
  $('timer-fill').style.width = '0%';

  const correctPos = btns.findIndex(b => +b.dataset.idx === correctIdx);
  const right = rightText(q);
  const fb = $('feedback');

  btns.forEach((b, n) => {
    b.classList.add('locked');
    if (n === correctPos) b.classList.add('correct');
  });

  if (btns[pick].classList.contains('correct')) {
    finishAnswer(true);
  } else {
    btns[pick].classList.add('wrong');
    btns.forEach((b, n) => { if (n !== correctPos && n !== pick) b.classList.add('dim'); });
    fb.className = 'feedback bad show';
    $('fb-title').innerHTML = '❌ إجابة خاطئة — الإجابة الصحيحة: ' + right;
    $('fb-body').textContent = q.fix || ('خسرت ' + ar(5) + ' نقاط. راجع السؤال في ملخص الأخطاء 📘');
    finishAnswer(false);
  }
}

/* ---------- تطبيق النتيجة ---------- */
function smartExplain(q) {
  // شرح تلقائي: explain إن وجد، وإلا من الملخص/جمل الحفظ المرتبطة بالدرس
  if (q.explain) return q.explain;
  if (q.fix) return q.fix;
  try {
    const id = contentKey((S.lesson && S.lesson.id ? String(S.lesson.id).split('_')[0] : ''));
    const sum = SUMMARIES[id] || {};
    const kt = (sum.keyTerms || []).find(k => q.q && q.q.indexOf(k.t) > -1);
    if (kt) return kt.t + ': ' + kt.d;
  } catch (e) {}
  return '';
}
function smartTip(q) {
  try {
    const id = contentKey((S.lesson && S.lesson.id ? String(S.lesson.id).split('_')[0] : ''));
    const ex = LESSON_EXTRAS[id] || {};
    const all = (ex.mnemonics || []);
    for (let i = 0; i < all.length; i++) {
      const words = String(all[i].t).split(/[\s:،-]+/).filter(w => w.length > 2);
      if (words.some(w => q.q && q.q.indexOf(w) > -1)) return all[i];
    }
    if (all.length) return all[0];
  } catch (e) {}
  return null;
}
function finishAnswer(ok) {
  const q = S.queue[S.i];
  const fb = $('feedback');
  if (ok) {
    S.streak++;
    S.bestStreak = Math.max(S.bestStreak, S.streak);
    S.correct++;
    const mult = 1 + Math.min(1, Math.floor(S.streak / 3));
    let pts = CFG.correct * mult;
    const fast = S.left <= CFG.fastTime;
    if (fast) { pts += CFG.speedBonus; S.fast++; }
    // نقاط الخبرة للإجابة الصحيحة
    addXP(CFG.xpCorrect);
    S.score += pts;
    fb.className = 'feedback ok show';
    $('fb-title').innerHTML = (fast ? '⚡ إجابة سريعة! ' : '🎉 إجابة صحيحة! ') + '+' + ar(pts) + ' نقطة'
      + (mult > 1 ? ' (مضاعف ×' + ar(mult) + ')' : '');
    let body = S.streak > 1 ? '🔥 سلسلة صحيحة: ' + ar(S.streak) + ' إجابات متتالية!' : 'أحسنت، واصل التقدم 💪';
    // شرح المستر + جملة الحفظ لكل إجابة (فكرة 5 و 8)
    const ex = smartExplain(q), tip = smartTip(q);
    if (ex) body += ' 💡 ليه؟ ' + ex;
    if (tip) body += ' 🧠 للحفظ: ' + tip.t + ' — ' + tip.d;
    const fbBody = $('fb-body');
    fbBody.textContent = body;
    sfxOk(); celebrate(45);
    chipPop('score-chip', 'pop'); chipPop('streak-chip', 'pop');
  } else {
    S.score = Math.max(0, S.score + CFG.wrong);
    S.streak = 0; S.wrong++;
    S.wrongList.push({ q: q.q, right: rightText(q) });
    addToNotebook(q.q, rightText(q), S.lesson);
    sfxBad();
    chipPop('score-chip', 'bad-pop');
    let body = 'راجع السؤال في ملخص الأخطاء 📘';
    const ex2 = smartExplain(q), tip2 = smartTip(q);
    if (ex2) body += ' — ليه؟ ' + ex2;
    if (tip2) body += ' — 🧠 للحفظ: ' + tip2.t;
    const fbBody2 = $('fb-body');
    fbBody2.textContent = body;
  }
  updateHud();
  $('bar-fill').style.width = ((S.i + 1) / S.queue.length * 100) + '%';
  $('btn-next').classList.add('show');
}

function chipPop(id, cls) {
  const c = $(id);
  if (!c) return;
  c.classList.add(cls);
  setTimeout(() => c.classList.remove(cls), 450);
}

function updateHud() {
  $('score').textContent = ar(S.score);
  $('streak').textContent = ar(S.streak);
  $('xp-chip').innerHTML = '✨ <b>' + ar(TotalXP) + '</b>';
}

/* ---------- النتيجة ---------- */
function finish() {
  clearInterval(S.timer);
  const total = S.queue.length;
  const pct = Math.round((S.correct / total) * 100);

  let medal = '📚', title = 'حظًا أوفر في المرة القادمة!', msg = 'راجع الأخطاء وجرب مرة أخرى.';
  if (pct === 100) { medal = '👑'; title = 'ممتاز! علامة كاملة'; msg = 'أجبت على كل الأسئلة بشكل صحيح 🔥'; }
  else if (pct >= 80) { medal = '🏆'; title = 'أداء رائع!'; msg = 'فهمك للمنهج ممتاز، واصل التدريب 💪'; }
  else if (pct >= 60) { medal = '🥈'; title = 'جيد جدًا!'; msg = 'راجع الأخطاء لتثبيت المعلومة 📘'; }
  else if (pct >= 40) { medal = '🥉'; title = 'محاولة جيدة'; msg = 'ارجع للدرس ثم أعد المحاولة 📖'; }

  $('medal').textContent = medal;
  $('res-title').textContent = title;
  $('res-score').textContent = ar(S.score);
  $('res-msg').textContent = msg + (S.fast ? ' ⚡ إجابات سريعة: ' + ar(S.fast) : '')
    + (S.bestStreak > 1 ? ' 🔥 أطول سلسلة: ' + ar(S.bestStreak) : '');
  $('res-stars').textContent = '★'.repeat(Math.max(1, Math.round(pct / 20))) + '☆'.repeat(Math.max(0, 5 - Math.round(pct / 20)));

  $('st-correct').textContent = ar(S.correct);
  $('st-wrong').textContent = ar(S.wrong);
  $('st-pct').textContent = ar(pct) + '٪';
  // تحديث أفضل نتيجة للدرس (قبل عرضها على النتيجة)
  let bestPct = pct;
  if (S.lesson && S.lesson.id && !String(S.lesson.id).startsWith('ch:') && S.lesson.id !== 'all') {
    const baseId = String(S.lesson.id).split('_')[0];
    const prog = getProgress(progressKey(baseId, S.level));
    bestPct = Math.max(prog.best, pct);
  }
  $('st-best').textContent = ar(bestPct) + '٪';

  const rv = $('review');
  rv.innerHTML = '';
  if (S.wrongList.length) {
    const h = document.createElement('div');
    h.className = 'rq';
    h.textContent = '📘 مراجعة الإجابات الخاطئة (' + ar(S.wrongList.length) + ')';
    rv.appendChild(h);
    S.wrongList.forEach(w => {
      const d = document.createElement('div');
      d.className = 'rv';
      d.innerHTML = '<div class="rq">' + w.q + '</div><div class="ra">✔ ' + w.right + '</div>';
      rv.appendChild(d);
    });
  } else {
    const d = document.createElement('div');
    d.className = 'rv';
    d.style.cssText = 'background:rgba(34,197,94,.1);border-color:rgba(34,197,94,.35)';
    d.innerHTML = '<div class="rq">لا توجد أخطاء — أداء مثالي! 🎉</div>';
    rv.appendChild(d);
  }

  sfxEnd();
  celebrate(120);

  // تحديث التقدم ونقاط الإكمال للدرس الحالي (إذا كان درسًا عاديًا وليس امتحانًا شاملاً/فصلاً)
  if (S.lesson && S.lesson.id && !String(S.lesson.id).startsWith('ch:') && S.lesson.id !== 'all') {
    const xpEarned = pct === 100 ? CFG.xpPerfect : (pct >= 80 ? CFG.xpLessonComplete : 25);
    addXP(xpEarned);
    // حفظ التقدم على الدرس الأصلي (حتى لو امتحان فرعي cram/mist)
    const baseId = String(S.lesson.id).split('_')[0];
    updateProgress(progressKey(baseId, S.level), pct, xpEarned);
  }

  // إذا اكتملت جميع الدروس، اعرض شهادة الإتمام بدلاً من شاشة النتيجة العادية
  if (S.lesson && S.lesson.id && !String(S.lesson.id).startsWith('ch:') && S.lesson.id !== 'all' && allLessonsCompleted()) {
    $('cert-name').textContent = 'طالب / طالبة';
    $('cert-date').textContent = new Date().toLocaleDateString('ar-SA');
    $('cert-score').textContent = ar(TotalXP) + ' نقطة خبرة';
    show('cert');
  } else {
    show('result');
  }
  updateHud();
}

/* ---------- تصدير الامتحان للطباعة ---------- */
function exportExam() {
  if (!S.lesson || S.queue.length === 0) return;
  const win = window.open('', '_print');
  const total = S.queue.length;
  let html = '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>امتحان — ' + esc(S.lesson.title || 'غير محدد') + '</title>';
  html += '<style>body{font-family:"Segoe UI","Tahoma","Cairo",sans-serif;direction:rtl;line-height:1.6;padding:20px}';
  html += 'h1{text-align:center;color:#1a202c}.q{margin-bottom:20px;border-bottom:1px solid #ccc;padding-bottom:10px}';
  html += '.qnum{font-weight:bold;color:#2c5282}.options{margin-left:20px;margin-bottom:15px}';
  html += '.opt{display:block;margin:5px 0;padding:8px;border:1px solid #ccc;border-radius:6px;background:#f7fafc}';
  html += '.answer{margin-top:10px;padding:10px;background:#ebf4ff;border:1px solid #63b3ed;border-radius:6px;color:#2c5282}';
  html += '.explain{margin-top:5px;font-size:14px;color:#4a5568;font-style:italic}';
  html += '@media print{body{background:#fff}}</style></head><body>';
  html += '<h1>امتحان: ' + esc(S.lesson.title || 'غير محدد') + '</h1>';
  html += '<p>التاريخ: ' + new Date().toLocaleDateString('ar-SA') + ' — عدد الأسئلة: ' + total + '</p>';
  S.queue.forEach((q, idx) => {
    html += '<div class="q"><div class="qnum">السؤال ' + (idx + 1) + ':</div> ' + esc(q.q) + '<div class="options">';
    if (q.o) {
      q.o.forEach((o, k) => { html += '<div class="opt">' + (k + 1) + '. ' + esc(o) + '</div>'; });
    }
    html += '</div><div class="answer">الإجابة الصحيحة: ' + esc(rightText(q)) + '</div>';
    if (q.explain) html += '<div class="explain">الشرح: ' + esc(q.explain) + '</div>';
    html += '</div>';
  });
  html += '</body></html>';
  win.document.write(html);
  win.document.close();
}

/* ---------- الأحداث ---------- */
/* ---------- تبويبات الرئيسية: أسئلة | ملخصات ---------- */
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function switchHomeTab(which) {
  const q = which !== 's';
  $('tabbtn-q').classList.toggle('on', q);
  $('tabbtn-s').classList.toggle('on', !q);
  $('pane-questions').hidden = !q;
  $('pane-summaries').hidden = q;
  if (!q) { buildSummaries(); buildNotebook(); }
  updateBottomNav();
}
function buildSummaries() {
  const box = $('sum-lessons');
  box.innerHTML = '';
  ['l11', 'l12', 'l13', 'l14', 'l21', 'l22', 'l23'].forEach(k => {
    const s = SUMMARIES[k];
    if (!s) return;
    const el = document.createElement('article');
    el.className = 'sum-card collapsible';
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-expanded', 'false');
    el.style.setProperty('--c', s.color || '#8b5cf6');
    const terms = (s.keyTerms || []).map(t => '<span class="term-chip"><b>' + esc(t.t) + '</b> — ' + esc(t.d) + '</span>').join('');
    const pts = (s.points || []).map(p => '<li>' + esc(p) + '</li>').join('');
    let tbl = '';
    if (s.table && s.table.headers) {
      tbl = '<div class="sum-table-wrap"><table class="sum-table"><thead><tr>' +
        s.table.headers.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' +
        (s.table.rows || []).map(r => '<tr>' + r.map(c => '<td>' + esc(c) + '</td>').join('') + '</tr>').join('') +
        '</tbody></table></div>';
    }
    el.innerHTML =
      '<div class="sum-head"><span class="sum-icon">' + esc(s.icon || '📚') + '</span>' +
      '<div><div class="sum-num">الدرس ' + esc(s.num || k) + '</div>' +
      '<div class="sum-title2">' + esc(s.title || '') + '</div></div></div>' +
      '<div class="sum-body">' +
      '<p class="sum-over">' + esc(s.overview || '') + '</p>' +
      '<ul class="sum-points">' + pts + '</ul>' +
      (terms ? '<div class="sum-terms">' + terms + '</div>' : '') + tbl +
      ((s.mainQ || s.mainA) ? '<div class="sum-qa sum-main"><div class="sum-q">📖 السؤال من الكتاب: ' + esc(s.mainQ || '') + '</div>' +
      '<div class="sum-a">✅ ' + esc(s.mainA || '') + '</div></div>' : '') +
      ((s.examQ || s.examA) ? '<div class="sum-qa"><div class="sum-q">❓ ' + esc(s.examQ || '') + '</div>' +
      '<div class="sum-a">💡 ' + esc(s.examA || '') + '</div></div>' : '') +
      '</div>';
    box.appendChild(el);
  });
  const cb = $('sum-chapters');
  cb.innerHTML = '';
  ['ch1', 'ch2'].forEach(k => {
    const c = CHAPTER_SUMMARIES[k];
    if (!c) return;
      const d = document.createElement('article');
      d.className = 'sum-card ch-card';
      d.style.setProperty('--c', k === 'ch1' ? '#a78bfa' : '#22d3ee');
      d.innerHTML = '<div class="sum-head"><span class="sum-icon">' + (k === 'ch1' ? '🎓' : '🛡️') + '</span>' +
        '<div><div class="sum-num">' + esc((c.lessons || []).join('، ')) + '</div>' +
        '<div class="sum-title2">' + esc(c.title || '') + '</div></div></div>' +
        '<p class="sum-over">' + esc(c.overview || '') + '</p>';
      cb.appendChild(d);
  });
}
/* ---------- تطوي/فتح بطاقات الملخصات: النقر على البطاقة يفتحها ويغلقها ---------- */
function toggleSumCard(card) {
  const open = card.classList.toggle('open');
  card.setAttribute('aria-expanded', open ? 'true' : 'false');
}
document.addEventListener('click', e => {
  const card = e.target.closest('.sum-card.collapsible');
  if (card) toggleSumCard(card);
});
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList &&
      e.target.classList.contains('collapsible')) {
    e.preventDefault();
    toggleSumCard(e.target);
  }
});
addEventListener('keydown', e => {
  if (!$('screen-quiz').classList.contains('active')) return;
  if (S.locked) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('btn-next').click(); }
    return;
  }
  const n = ['١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'].indexOf(e.key);
  if (n >= 0 && $('options').children[n]) { e.preventDefault(); $('options').children[n].click(); }
});

/* ---------- الإقلاع: تحميل المحتوى من JSON ثم بناء التطبيق ---------- */
function on(id, ev, fn) { const el = $(id); if (el) el.addEventListener(ev, fn); }
function wireStaticUI() {
  on('btn-next', 'click', () => { S.i++; nextQuestion(); });
  on('btn-home', 'click', () => { if (LP.lesson) { openLesson(LP.lesson); } else { buildHome(); show('home'); } });
  on('btn-lesson-back', 'click', () => { buildHome(); show('home'); });
  on('btn-retry', 'click', () => {
    curLevel = S.level || 1;
    if (!S.lesson) { buildHome(); show('home'); return; }
    if (S.lesson.id === 'all') startAll();
    else if (String(S.lesson.id).indexOf('ch:') === 0) startChapter(S.lesson.chapter || S.lesson.id.slice(3));
    else if (String(S.lesson.id).indexOf('_cram') > -1) startCram(LP.lesson || S.lesson);
    else if (String(S.lesson.id).indexOf('_mist') > -1) startMistakes(LP.lesson || S.lesson);
    else startQuiz(S.lesson);
  });
  on('btn-all', 'click', startAll);
  on('btn-ch1', 'click', () => startChapter('ch1'));
  on('btn-ch2', 'click', () => startChapter('ch2'));
  on('tabbtn-q', 'click', () => switchHomeTab('q'));
  on('tabbtn-s', 'click', () => switchHomeTab('s'));
  on('lv1-btn', 'click', () => { curLevel = 1; buildHome(); if (!$('pane-summaries').hidden) buildSummaries(); });
  on('lv2-btn', 'click', () => { curLevel = 2; buildHome(); if (!$('pane-summaries').hidden) buildSummaries(); });
  on('theme-toggle', 'click', toggleTheme);
  on('btn-notebook-clear', 'click', () => { clearNotebook(); buildNotebook(); });
  on('btn-notebook-review', 'click', () => { buildNotebook(); });
  on('btn-export', 'click', exportExam);
  on('btn-print-preview', 'click', () => { window.print(); });
  on('btn-cert-print', 'click', () => { window.print(); });
  on('btn-cert-home', 'click', () => { buildHome(); show('home'); });
  on('btn-cert-notebook', 'click', gotoNotebook);
  on('btn-quit', 'click', () => {
    if (confirm('هل تريد الخروج من الامتحان الحالي؟ سيتم فقدان تقدمك في هذا السؤال.')) {
      clearInterval(S.timer);
      if (LP.lesson) openLesson(LP.lesson); else { buildHome(); show('home'); }
    }
  });
  on('btn-notebook-from-result', 'click', gotoNotebook);
  on('nav-home', 'click', gotoHome);
  on('nav-summaries', 'click', gotoSummaries);
  on('nav-notebook', 'click', gotoNotebook);
  on('nav-stats', 'click', gotoStats);
}

function bootError(msg) {
  const box = $('content-loading-msg');
  if (box) { box.textContent = 'تعذر تحميل المحتوى: ' + msg; box.style.color = 'var(--bad)'; }
  const main = $('app-main');
  if (main) main.hidden = false;
}

async function boot() {
  loadProgress();
  loadNotebook();
  loadXP();
  initSpeech();
  applyTheme();
  wireStaticUI();
  try {
    const d = await window.ContentLoader.load();
    applyContent(d);
  } catch (e) {
    bootError((e && e.message) || e);
    return;
  }
  const loading = $('content-loading');
  if (loading) loading.remove();
  const main = $('app-main');
  if (main) main.hidden = false;
  buildHome();
  buildNotebook();
  updateHud();
}
boot();