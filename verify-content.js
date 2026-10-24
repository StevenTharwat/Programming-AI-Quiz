/* Verify content/*.json integrity + bundle equality (JSON is the single source of truth).
   Usage: node verify-content.js   — exits non-zero on ANY problem.
   Checks:
     1) all content/*.json parse and follow the engine schema (MCQ/tf/fill/order/classify)
     2) per-lesson integrity: ids, titles, counts, answer indices in range
     3) variety refs (L) + answers always resolvable; every lesson has >=1 varied item
     4) summaries/extras keys match L1 lesson ids; required fields present
     5) chapters: CHAPTERS cover every L1 lesson id; meta/summaries complete
     6) manifest.expected matches the real counts
     7) content-bundle.js is byte-equal to the JSON files (file:// fallback) */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = __dirname;
const C = path.join(ROOT, 'content');

function loadJson(n) { return JSON.parse(fs.readFileSync(path.join(C, n + '.json'), 'utf8')); }
let fails = 0;
const fail = m => { fails++; console.log('FAIL', m); };
const ok = m => console.log('OK  ', m);

const l1 = loadJson('lessons-l1'), l2 = loadJson('lessons-l2'),
      v1 = loadJson('variety-l1'), v2 = loadJson('variety-l2'),
      sum = loadJson('summaries'), ch = loadJson('chapters'),
      ex = loadJson('lesson-extras'), man = loadJson('manifest');

// 1+2) lessons schema
function checkLessons(list, label) {
  const ids = list.map(l => l.id);
  if (new Set(ids).size !== ids.length) fail(label + ': duplicate lesson ids');
  const lNums = list.map(l => l.num);
  if (new Set(lNums).size !== lNums.length) fail(label + ': duplicate lesson nums');
  const nonZeroA = [];
  for (const l of list) {
    for (const k of ['id', 'num', 'title', 'icon', 'color', 'questions']) {
      if (!(k in l)) fail(label + ' ' + l.id + ': missing field ' + k);
    }
    if (!Array.isArray(l.questions) || l.questions.length === 0) fail(label + ' ' + l.id + ': empty questions');
    for (const q of l.questions) {
      if (!q.q || typeof q.q !== 'string' || !q.q.trim()) fail(label + ' ' + l.id + ': empty question text');
      if (!Array.isArray(q.o) || q.o.length < 2) fail(label + ' ' + l.id + ': options < 2');
      if (typeof q.a !== 'number' || q.a < 0 || q.a >= (q.o ? q.o.length : 0)) fail(label + ' ' + l.id + ': a out of range for: ' + String(q.q).slice(0, 30));
      if (q.o && typeof q.a === 'number' && q.a >= q.o.length) fail(label + ' ' + l.id + ': a beyond options');
      if (q.a !== 0) nonZeroA.push(l.id + ' :: ' + String(q.q).slice(0, 40));
    }
  }
  if (nonZeroA.length) console.log('NOTE', label + ': non-zero-a questions (allowed — contrarian wording): ' + nonZeroA.join(' | '));
  return list.reduce((a, l) => a + l.questions.length, 0);
}
const t1 = checkLessons(l1, 'lessons-l1');
const t2 = checkLessons(l2, 'lessons-l2');
ok('lessons schema (L1 ' + t1 + ' questions, L2 ' + t2 + ' questions)');

// 3) variety schema + refs
function checkVariety(list, label, lessonIds) {
  if (!Array.isArray(list) || list.length === 0) return fail(label + ': empty');
  const byL = {}, byT = {};
  for (const it of list) {
    byT[it.t] = (byT[it.t] || 0) + 1;
    byL[it.L] = (byL[it.L] || 0) + 1;
    if (!lessonIds.includes(it.L)) fail(label + ': unknown lesson ref ' + it.L);
    if (!it.q || !String(it.q).trim()) fail(label + ': empty q in ' + it.L);
    if (it.t === 'tf') {
      if (typeof it.a !== 'boolean') fail(label + ' ' + it.L + ': tf a not boolean');
      if (!it.fix || typeof it.fix !== 'string') fail(label + ' ' + it.L + ': tf without fix');
    } else if (it.t === 'fill') {
      if (!Array.isArray(it.ans) || !it.ans.some(a => typeof a === 'string' && a.trim())) fail(label + ' ' + it.L + ': fill bad ans: ' + String(it.q).slice(0, 30));
    } else if (it.t === 'order') {
      if (!Array.isArray(it.items) || it.items.length < 2 || it.items.some(x => typeof x !== 'string' || !x.trim())) fail(label + ' ' + it.L + ': order bad items');
    } else if (it.t === 'classify') {
      if (!Array.isArray(it.groups) || it.groups.length < 2) fail(label + ' ' + it.L + ': classify bad groups');
      else for (const g of it.groups) if (!g.g || !Array.isArray(g.items) || !g.items.length) fail(label + ' ' + it.L + ': classify bad group');
    } else fail(label + ': unknown type ' + it.t);
  }
  for (const id of lessonIds) if (!byL[id]) fail(label + ': lesson ' + id + ' has no varied questions');
  ok(label + ': ' + list.length + ' items — ' + JSON.stringify(byT));
  return { total: list.length, byT };
}
const s1 = checkVariety(v1, 'variety-l1', l1.map(l => l.id));
const s2 = checkVariety(v2, 'variety-l2', l2.map(l => l.id));

// 4) summaries/extras
const sumReq = ['num', 'title', 'icon', 'color', 'overview', 'points', 'keyTerms', 'table', 'mainQ', 'mainA', 'examQ', 'examA'];
const extReq = ['roadmap', 'story', 'mnemonics', 'mindmap'];
const ids1 = l1.map(l => l.id);
for (const id of ids1) {
  if (!sum[id]) fail('summaries missing ' + id);
  else for (const k of sumReq) if (!(k in sum[id])) fail('summaries ' + id + ': missing ' + k);
  if (!ex[id]) fail('extras missing ' + id);
  else {
    for (const k of extReq) if (!(k in ex[id])) fail('extras ' + id + ': missing ' + k);
    if (sum[id] && ex[id] && sum[id].title !== ex[id].title && ex[id].title) { /* extras may omit title; no check */ }
  }
}
const oddSum = Object.keys(sum).filter(k => !ids1.includes(k));
const oddEx = Object.keys(ex).filter(k => !ids1.includes(k));
if (oddSum.length) fail('summaries has non-lesson keys: ' + oddSum.join(','));
if (oddEx.length) fail('extras has non-lesson keys: ' + oddEx.join(','));
ok('summaries + extras keys & fields (' + Object.keys(sum).length + '/' + Object.keys(ex).length + ')');

// 5) chapters
const covered = new Set([].concat(...Object.values(ch.CHAPTERS)));
for (const id of ids1) if (!covered.has(id)) fail('chapters: lesson ' + id + ' not in any chapter');
const odd = [...covered].filter(id => !ids1.includes(id));
if (odd.length) fail('chapters: unknown lesson refs: ' + odd.join(','));
for (const c of Object.keys(ch.CHAPTERS)) {
  if (!ch.CHAPTER_META[c]) fail('chapters: missing meta ' + c);
  if (!ch.CHAPTER_SUMMARIES[c]) fail('chapters: missing summary ' + c);
  else for (const k of ['title', 'lessons', 'overview']) if (!(k in ch.CHAPTER_SUMMARIES[c])) fail('chapters ' + c + ': missing ' + k);
}
const chSumLessons = Object.values(ch.CHAPTERS).map(a => a.length).join('+');
ok('chapters (' + chSumLessons + ' lessons)');

// 6) manifest
const expect = {
  l1Lessons: l1.length, l2Lessons: l2.length,
  l1Questions: t1, l2Questions: t2,
  varietyL1: v1.length, varietyL2: v2.length,
  summaries: Object.keys(sum).length, extras: Object.keys(ex).length,
};
for (const k of Object.keys(expect)) {
  if (man.expected[k] !== expect[k]) fail('manifest expected.' + k + ' = ' + man.expected[k] + ', actual ' + expect[k]);
}
ok('manifest counts match');

// 7) bundle equality
const bundleCode = fs.readFileSync(path.join(ROOT, 'content-bundle.js'), 'utf8');
const sb = { window: {} };
vm.createContext(sb);
vm.runInContext(bundleCode, sb);
const b = sb.window.__CONTENT_BUNDLE__;
if (!b) fail('content-bundle.js did not define window.__CONTENT_BUNDLE__');
else for (const n of ['lessons-l1', 'lessons-l2', 'variety-l1', 'variety-l2', 'summaries', 'lesson-extras', 'chapters', 'manifest']) {
  const a = JSON.stringify(loadJson(n));
  const c = JSON.stringify(b[n]);
  if (a === c) ok('bundle matches: ' + n);
  else fail('bundle differs: ' + n);
}

console.log('\nTOTAL: ' + (t1 + s1.total) + ' L1 / ' + (t2 + s2.total) + ' L2  = ' + (t1 + s1.total + t2 + s2.total) + ' questions');
if (fails) { console.log('RESULT: ' + fails + ' PROBLEM(S)'); process.exit(1); }
console.log('RESULT: content OK — JSON files, manifest and bundle are consistent.');
