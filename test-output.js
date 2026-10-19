/* ===== test-output.js — οι μεγάλες οθόνες (big screens) για την νέα μηχανή JSON =====
   Εκκινεί τη μηχανή του πραγματικού world με JSON / bundle / garbage collector
   αντικαταστάσει τις οι απαραίτητες global variables και ελέγχει:
     - είναι η κεφαλή των UEFA Champions League δημιουργείται από το σωστό content/*.json
     - ο αριθμός των μάχων είναι ίδιος με το παλιό αρχείο
     - οι nội dung και οι παίζουσες οι diverses (story, mnemonics, mindmaps) φορτίζονται
   Χρήση: node test-output.js
*/
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = __dirname;
const C = path.join(ROOT, 'content');
const J = n => JSON.parse(fs.readFileSync(path.join(C, n), 'utf8'));

const L1 = J('lessons-l1.json'), L2 = J('lessons-l2.json');
const V1 = J('variety-l1.json'), V2 = J('variety-l2.json');
const SUM = J('summaries.json'), CH = J('chapters.json'), EX = J('lesson-extras.json');

function merged(lessons, variety) {
  return lessons.map(L => ({ id: L.id, n: L.questions.length + variety.filter(v => v.L === L.id).length }));
}
const expL1 = merged(L1, V1), expL2 = merged(L2, V2);

const store = {};
const mkEl = id => {
  const base = {
    id, innerHTML: '', textContent: '', hidden: false, value: '',
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    style: { setProperty() {} },
    appendChild() {}, addEventListener() {}, remove() {},
    querySelectorAll() { return []; }, querySelector() { return null; },
    scrollTo() {}, setAttribute() {}, click() {}, focus() {},
    getContext: () => ({ clearRect() {}, fillRect() {}, beginPath() {}, arc() {}, fill() {}, save() {}, restore() {}, setTransform() {}, translate() {}, scale() {}, drawImage() {} }),
    getBoundingClientRect: () => ({ width: 100, height: 100 })
  };
  if (id === 'fx') { base.width = 300; base.height = 150; }
  return base;
};

const sb = {
  console, Math, Date, JSON, Object, Array, String, Number, Boolean,
  setTimeout, clearTimeout, setInterval, clearInterval,
  localStorage: { _m: {}, getItem(k) { return this._m[k] || null; }, setItem(k, v) { this._m[k] = String(v); } },
  document: {
    body: { classList: { add() {}, remove() {} }, style: {} },
    getElementById: id => { if (!store[id]) store[id] = mkEl(id); return store[id]; },
    createElement: () => ({ className: '', innerHTML: '', textContent: '', style: { setProperty() {} }, appendChild() {}, addEventListener() {}, setAttribute() {}, querySelectorAll() { return []; }, querySelector() { return null; }, classList: { add() {}, toggle() {} } }),
    addEventListener() {}, currentScript: null
  },
  location: { protocol: 'file:' },
  addEventListener() {}, scrollTo() {}, scrollIntoView() {}, alert() {}, confirm() { return false; },
  requestAnimationFrame() {},
  fetch: async () => { throw new Error('no fetch — bundle path'); },
  innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
  window: {}, navigator: { userAgent: 'test' },
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  screen: { width: 1280, height: 800, availWidth: 1280, availHeight: 800 },
  setTimeout, clearTimeout, setInterval, clearInterval
};
sb.window = sb; sb.globalThis = sb;
vm.createContext(sb);
const all = ['content-bundle.js', 'content-loader.js', 'app.js'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n;\n');
vm.runInContext(all, sb, { filename: 'engine' });

setTimeout(() => {
  let fails = 0;
  const t = (name, cond, extra) => {
    if (cond) console.log('OK  ', name);
    else { fails++; console.log('FAIL', name, extra || ''); }
  };
  try {
    const got1 = vm.runInContext('BANKS[1].map(L => ({id:L.id, n:L.questions.length}))', sb);
    const got2 = vm.runInContext('BANKS[2].map(L => ({id:L.id, n:L.questions.length}))', sb);
    t('L1 counts match JSON', JSON.stringify(got1) === JSON.stringify(expL1), JSON.stringify(got1));
    t('L2 counts match JSON', JSON.stringify(got2) === JSON.stringify(expL2), JSON.stringify(got2));
    t('source is bundle (file:// safe)', vm.runInContext('CONTENT_SOURCE', sb) === 'bundle', vm.runInContext('CONTENT_SOURCE', sb));
    t('7 summaries loaded', Object.keys(vm.runInContext('SUMMARIES', sb)).length === 7);
    t('7 extras loaded', Object.keys(vm.runInContext('LESSON_EXTRAS', sb)).length === 7);
    t('chapters loaded', !!vm.runInContext('CHAPTERS.ch1 && CHAPTERS.ch2', sb));
    vm.runInContext('buildHome(); buildSummaries();', sb);
    const lessonsHtml = store['lessons'] ? store['lessons'].innerHTML : '';
    t('home renders 7 lessons', (lessonsHtml.match(/lesson-card|class="lesson/g) || []).length >= 7, 'html len ' + lessonsHtml.length);
    const sumHtml = store['sum-lessons'] ? store['sum-lessons'].innerHTML : '';
    t('summaries render', sumHtml.length > 500, 'len ' + sumHtml.length);
    const hero = store['hero-sub'] ? store['hero-sub'].textContent : '';
    t('hero shows total questions', /سؤال/.test(hero), hero.slice(0, 60));
  } catch (e) { fails++; console.log('FAIL engine error:', String((e && e.stack) || e).slice(0, 600)); }
  console.log(fails ? '\nRESULT: ' + fails + ' FAILURE(S)' : '\nRESULT: engine output matches JSON ✅');
  process.exit(fails ? 1 : 0);
}, 500);
