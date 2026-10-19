/* Verify new JSON content is IDENTICAL to the legacy JS globals.
   Usage: node verify-content.js
   Compares: L1/L2 lessons (incl. every question), variety, summaries,
   chapter summaries, lesson extras. Exits non-zero on ANY difference. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = __dirname;
const C = path.join(ROOT, 'content');

function loadJs(file, names) {
  const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const sb = {};
  vm.createContext(sb);
  vm.runInContext(code + '\n;globalThis.__out={ ' + names.map(n => n + ':' + n).join(',') + ' };', sb, { filename: file });
  return vm.runInContext('globalThis.__out', sb);
}
function loadJson(n) { return JSON.parse(fs.readFileSync(path.join(C, n + '.json'), 'utf8')); }

function canon(v) {
  // canonical JSON: sorted keys, compact — order-insensitive deep compare
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  return JSON.stringify(v);
}
let fails = 0;
function eq(name, a, b) {
  const x = canon(a), y = canon(b);
  if (x === y) { console.log('OK  ', name); }
  else {
    fails++;
    console.log('FAIL', name);
    // find first differing index for debugging
    let i = 0;
    while (i < Math.min(x.length, y.length) && x[i] === y[i]) i++;
    console.log('   first diff at char', i);
    console.log('   legacy:', x.slice(Math.max(0, i - 80), i + 120));
    console.log('   json  :', y.slice(Math.max(0, i - 80), i + 120));
  }
}

const legacyL1 = [['data-11.js', 'LESSON_11'], ['data-12.js', 'LESSON_12'], ['data-13.js', 'LESSON_13'], ['data-14.js', 'LESSON_14'], ['data-21.js', 'LESSON_21'], ['data-22.js', 'LESSON_22'], ['data-23.js', 'LESSON_23']].map(([f, n]) => loadJs(f, [n])[n]);
const legacyL2 = [['data2-11.js', 'L2_11'], ['data2-12.js', 'L2_12'], ['data2-13.js', 'L2_13'], ['data2-14.js', 'L2_14'], ['data2-21.js', 'L2_21'], ['data2-22.js', 'L2_22'], ['data2-23.js', 'L2_23']].map(([f, n]) => loadJs(f, [n])[n]);
const legacyV1 = loadJs('data-variety.js', ['VARIETY']).VARIETY;
const legacyV2 = loadJs('data2-variety.js', ['L2_VARIETY']).L2_VARIETY;
const legacySum = loadJs('summaries.js', ['SUMMARIES', 'CHAPTER_SUMMARIES']);
const legacyEx = loadJs('lesson-extras.js', ['LESSON_EXTRAS']).LESSON_EXTRAS;

eq('lessons L1 (7 lessons, all questions)', legacyL1, loadJson('lessons-l1'));
eq('lessons L2 (7 lessons, all questions)', legacyL2, loadJson('lessons-l2'));
eq('variety L1 (100 items)', legacyV1, loadJson('variety-l1'));
eq('variety L2 (35 items)', legacyV2, loadJson('variety-l2'));
eq('summaries (7 lessons)', legacySum.SUMMARIES, loadJson('summaries'));
eq('chapter summaries', legacySum.CHAPTER_SUMMARIES, loadJson('chapters').CHAPTER_SUMMARIES);
eq('lesson extras (stories/mnemonics/maps)', legacyEx, loadJson('lesson-extras'));

// also verify bundle matches JSON
const bundleCode = fs.readFileSync(path.join(ROOT, 'content-bundle.js'), 'utf8');
const sb2 = { window: {} };
vm.createContext(sb2);
vm.runInContext(bundleCode, sb2);
const b = sb2.window.__CONTENT_BUNDLE__;
['lessons-l1', 'lessons-l2', 'variety-l1', 'variety-l2', 'summaries', 'lesson-extras'].forEach(n => eq('bundle:' + n, loadJson(n), b[n]));
eq('bundle:chapters', loadJson('chapters'), b['chapters']);
eq('bundle:manifest', loadJson('manifest'), b['manifest']);

if (fails) { console.log('\nRESULT: ' + fails + ' DIFFERENCE(S) — do not migrate!'); process.exit(1); }
console.log('\nRESULT: identical output — safe to migrate engine.');
