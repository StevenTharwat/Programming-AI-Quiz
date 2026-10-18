/* ===== منطق لعبة تحدي الذكاء الاصطناعي ===== */
'use strict';

const L1 = [LESSON_11, LESSON_12, LESSON_13, LESSON_14, LESSON_21, LESSON_22, LESSON_23];
const L2 = [L2_11, L2_12, L2_13, L2_14, L2_21, L2_22, L2_23];

// بنك الأسئلة متنوعة الأنواع لكل مستوى
const VAR1 = VARIETY;
const VAR2 = (typeof L2_VARIETY !== 'undefined') ? L2_VARIETY : [];

// ندمج الأسئلة متنوعة الأنواع داخل كل درس
function prepare(bank, variety) {
  bank.forEach(L => { L.questions = L.questions.concat(variety.filter(v => v.L === L.id)); });
  return bank;
}
const BANKS = { 1: prepare(L1, VAR1), 2: prepare(L2, VAR2) };

/* ---------- مجموعات الفصول (ميزة امتحان الفصل) ---------- */
const CHAPTERS = { ch1: ['l11', 'l12', 'l13', 'l14'], ch2: ['l21', 'l22', 'l23'] };
const CHAPTER_META = {
  ch1: { num: 'الفصل الأول — 1-1..1-4', title: 'امتحان الفصل الأول', icon: '🎓', color: '#a78bfa' },
  ch2: { num: 'الفصل الثاني — 2-1..2-3', title: 'امتحان الفصل الثاني', icon: '🛡️', color: '#22d3ee' }
};

let curLevel = 1;
const curBank = () => BANKS[curLevel];

const CFG = {
  perAll: 30,         // عدد أسئلة الامتحان الشامل
  time: 30,           // ثواني لكل سؤال
  correct: 10,        // نقاط الإجابة الصحيحة
  wrong: -5,          // نقاط الإجابة الخاطئة
  speedBonus: 25,     // نقاط الإجابة السريعة
  fastTime: 10        // زمن البونس
};

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
    const el = document.createElement('button');
    el.className = 'lesson';
    el.style.setProperty('--c', L.color);
    el.innerHTML =
      '<span class="l-chap">فصل ' + L.num.charAt(0) + '</span>' +
      '<div class="l-top"><span class="l-icon">' + L.icon + '</span>' +
      '<span class="l-num">الدرس ' + L.num + '</span></div>' +
      '<div class="l-title">' + L.title + '</div>' +
      '<div class="l-foot"><span class="pill">' + ar(L.questions.length) + ' سؤال</span>' +
      '<span class="best">اضغط للبدء ▶</span></div>';
    el.addEventListener('click', () => startQuiz(L));
    wrap.appendChild(el);
  });
  $('btn-all').textContent = (curLevel === 1 ? '🎓 امتحان شامل' : '🎓 امتحان شامل — المستوى الثاني');
  // عدّادات امتحانات الفصول حسب المستوى الحالي
  const chCount = ch => curBank().filter(L => CHAPTERS[ch].includes(L.id)).reduce((a, L) => a + L.questions.length, 0);
  $('btn-ch1').textContent = '🎓 امتحان الفصل الأول 1-1..1-4 (' + ar(chCount('ch1')) + ' سؤال)';
  $('btn-ch2').textContent = '🛡️ امتحان الفصل الثاني 2-1..2-3 (' + ar(chCount('ch2')) + ' سؤال)';
}

/* ---------- بدء الامتحان ---------- */
function startQuiz(lesson) {
  S.lesson = lesson;
  S.level = curLevel;
  S.queue = shuffle(lesson.questions);
  S.i = 0; S.score = 0; S.streak = 0; S.bestStreak = 0;
  S.correct = 0; S.wrong = 0; S.fast = 0; S.wrongList = [];
  show('quiz');
  $('q-lesson').textContent = 'الدرس ' + lesson.num;
  $('q-level').textContent = LEVEL_NAME[curLevel];
  $('q-level').classList.toggle('lvl2', curLevel === 2);
  nextQuestion();
}

function startChapter(ch) {
  const ids = CHAPTERS[ch] || [];
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
  ['home', 'quiz', 'result'].forEach(s => $('screen-' + s).classList.toggle('active', s === name));
  scrollTo({ top: 0, behavior: 'smooth' });
}

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
  $('feedback').className = 'feedback';
  $('btn-next').classList.remove('show');
  $('btn-next').textContent = (S.i === S.queue.length - 1) ? 'إنهاء الامتحان 🏁' : 'التالي ⏭';

  renderQ(q);

  S.timer = setInterval(() => {
    S.left -= .25;
    $('timer-fill').style.width = Math.max(0, S.left / CFG.time * 100) + '%';
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
    S.score += pts;
    fb.className = 'feedback ok show';
    $('fb-title').innerHTML = (fast ? '⚡ إجابة سريعة! ' : '🎉 إجابة صحيحة! ') + '+' + ar(pts) + ' نقطة'
      + (mult > 1 ? ' (مضاعف ×' + ar(mult) + ')' : '');
    $('fb-body').textContent = S.streak > 1 ? '🔥 سلسلة صحيحة: ' + ar(S.streak) + ' إجابات متتالية!' : 'أحسنت، واصل التقدم 💪';
    sfxOk(); celebrate(45);
    chipPop('score-chip', 'pop'); chipPop('streak-chip', 'pop');
  } else {
    S.score = Math.max(0, S.score + CFG.wrong);
    S.streak = 0; S.wrong++;
    S.wrongList.push({ q: q.q, right: rightText(q) });
    sfxBad();
    chipPop('score-chip', 'bad-pop');
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
  $('st-best').textContent = ar(S.bestStreak);

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
  show('result');
  updateHud();
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
  if (!q) buildSummaries();
}
function buildSummaries() {
  if (typeof SUMMARIES === 'undefined') return;
  const box = $('sum-lessons');
  box.innerHTML = '';
  ['l11', 'l12', 'l13', 'l14', 'l21', 'l22', 'l23'].forEach(k => {
    const s = SUMMARIES[k];
    if (!s) return;
    const el = document.createElement('article');
    el.className = 'sum-card';
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
      '<p class="sum-over">' + esc(s.overview || '') + '</p>' +
      '<ul class="sum-points">' + pts + '</ul>' +
      (terms ? '<div class="sum-terms">' + terms + '</div>' : '') + tbl +
      ((s.mainQ || s.mainA) ? '<div class="sum-qa sum-main"><div class="sum-q">📖 السؤال من الكتاب: ' + esc(s.mainQ || '') + '</div>' +
      '<div class="sum-a">✅ ' + esc(s.mainA || '') + '</div></div>' : '') +
      ((s.examQ || s.examA) ? '<div class="sum-qa"><div class="sum-q">❓ ' + esc(s.examQ || '') + '</div>' +
      '<div class="sum-a">💡 ' + esc(s.examA || '') + '</div></div>' : '');
    box.appendChild(el);
  });
  const cb = $('sum-chapters');
  cb.innerHTML = '';
  if (typeof CHAPTER_SUMMARIES !== 'undefined') {
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
}
$('btn-next').addEventListener('click', () => { S.i++; nextQuestion(); });
$('btn-quit').addEventListener('click', () => { clearInterval(S.timer); buildHome(); show('home'); });
$('btn-home').addEventListener('click', () => { buildHome(); show('home'); });
$('btn-retry').addEventListener('click', () => {
  curLevel = S.level || 1;
  if (S.lesson.id === 'all') startAll();
  else if (String(S.lesson.id).indexOf('ch:') === 0) startChapter(S.lesson.chapter || S.lesson.id.slice(3));
  else startQuiz(S.lesson);
});
$('btn-all').addEventListener('click', startAll);
$('btn-ch1').addEventListener('click', () => startChapter('ch1'));
$('btn-ch2').addEventListener('click', () => startChapter('ch2'));
$('tabbtn-q').addEventListener('click', () => switchHomeTab('q'));
$('tabbtn-s').addEventListener('click', () => switchHomeTab('s'));
$('lv1-btn').addEventListener('click', () => { curLevel = 1; buildHome(); });
$('lv2-btn').addEventListener('click', () => { curLevel = 2; buildHome(); });

addEventListener('keydown', e => {
  if (!$('screen-quiz').classList.contains('active')) return;
  if (S.locked) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('btn-next').click(); }
    return;
  }
  const n = ['١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'].indexOf(e.key);
  if (n >= 0 && $('options').children[n]) { e.preventDefault(); $('options').children[n].click(); }
});

buildHome();
updateHud();