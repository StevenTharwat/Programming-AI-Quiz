/* Build content JSON from the existing JS data files (single source migration).
   Usage: node build-content.js
   Reads data-*.js (LESSON/L2/VARIETY), summaries.js, lesson-extras.js
   Writes content/*.json (UTF-8, no BOM). Verifies question counts. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'content');

function loadJs(file, names) {
  const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const sandbox = {};
  vm.createContext(sandbox);
  const exportLine = '\n;globalThis.__out={ ' + names.map(n => n + ':' + n).join(',') + ' };';
  vm.runInContext(code + exportLine, sandbox, { filename: file });
  const got = vm.runInContext('globalThis.__out', sandbox);
  const out = {};
  names.forEach(n => { if (got[n] === undefined) throw new Error(file + ' missing ' + n); out[n] = got[n]; });
  return out;
}

fs.mkdirSync(OUT, { recursive: true });

function writeJson(name, data) {
  const p = path.join(OUT, name);
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
  const st = fs.statSync(p);
  console.log('wrote', name, st.size, 'bytes');
  if (st.size === 0) throw new Error(name + ' written empty!');
}

// 1) L1 lessons
console.log('step 1: L1...');
const L1MAP = [['data-11.js', 'LESSON_11'], ['data-12.js', 'LESSON_12'], ['data-13.js', 'LESSON_13'], ['data-14.js', 'LESSON_14'], ['data-21.js', 'LESSON_21'], ['data-22.js', 'LESSON_22'], ['data-23.js', 'LESSON_23']];
const L1 = L1MAP.map(([f, n]) => loadJs(f, [n])[n]);
writeJson('lessons-l1.json', L1);

// 2) L2 lessons
console.log('step 2: L2...');
const L2MAP = [['data2-11.js', 'L2_11'], ['data2-12.js', 'L2_12'], ['data2-13.js', 'L2_13'], ['data2-14.js', 'L2_14'], ['data2-21.js', 'L2_21'], ['data2-22.js', 'L2_22'], ['data2-23.js', 'L2_23']];
const L2 = L2MAP.map(([f, n]) => loadJs(f, [n])[n]);
writeJson('lessons-l2.json', L2);

// 3) variety
console.log('step 3: variety...');
const VAR1 = loadJs('data-variety.js', ['VARIETY']).VARIETY;
writeJson('variety-l1.json', VAR1);
let VAR2 = [];
try { VAR2 = loadJs('data2-variety.js', ['L2_VARIETY']).L2_VARIETY; } catch (e) { console.log('variety L2 fallback:', e.message); VAR2 = []; }
writeJson('variety-l2.json', VAR2);

// 4) summaries + chapters
console.log('step 4: summaries...');
const SUM = loadJs('summaries.js', ['SUMMARIES', 'CHAPTER_SUMMARIES']);
writeJson('summaries.json', SUM.SUMMARIES);
writeJson('chapters.json', { CHAPTERS: { ch1: ['l11', 'l12', 'l13', 'l14'], ch2: ['l21', 'l22', 'l23'] }, CHAPTER_META: { ch1: { num: 'الفصل الأول — 1-1..1-4', title: 'امتحان الفصل الأول', icon: '🎓', color: '#a78bfa' }, ch2: { num: 'الفصل الثاني — 2-1..2-3', title: 'امتحان الفصل الثاني', icon: '🛡️', color: '#22d3ee' } }, CHAPTER_SUMMARIES: SUM.CHAPTER_SUMMARIES });

// 5) lesson extras (stories / mnemonics / mindmaps / roadmaps)
console.log('step 5: extras...');
const EX = loadJs('lesson-extras.js', ['LESSON_EXTRAS']).LESSON_EXTRAS;
writeJson('lesson-extras.json', EX);

// 6) manifest with expected counts for runtime self-test
const countQ = L => L.questions.length;
const manifest = {
  version: 1,
  files: ['lessons-l1.json', 'lessons-l2.json', 'variety-l1.json', 'variety-l2.json', 'summaries.json', 'chapters.json', 'lesson-extras.json'],
  expected: {
    l1Lessons: L1.length, l2Lessons: L2.length,
    l1Questions: L1.reduce((a, L) => a + countQ(L), 0),
    l2Questions: L2.reduce((a, L) => a + countQ(L), 0),
    varietyL1: VAR1.length, varietyL2: VAR2.length,
    summaries: Object.keys(SUM.SUMMARIES).length,
    extras: Object.keys(EX).length
  }
};
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
console.log('content/*.json written:', JSON.stringify(manifest.expected));
