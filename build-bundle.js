/* Build the offline bundle FROM content/*.json (identical bytes, guaranteed).
   Usage: node build-bundle.js  (run after build-content.js)
   Writes content-bundle.js : window.__CONTENT_BUNDLE__ = {...}
   Used when opening index.html via file:// where fetch() is blocked. */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const C = path.join(ROOT, 'content');
const names = ['lessons-l1', 'lessons-l2', 'variety-l1', 'variety-l2', 'summaries', 'chapters', 'lesson-extras', 'manifest'];
const bundle = {};
names.forEach(n => {
  const p = path.join(C, n + '.json');
  bundle[n] = JSON.parse(fs.readFileSync(p, 'utf8'));
});
const out = '/* Auto-generated from content/*.json — DO NOT EDIT. Regenerate: node build-content.js && node build-bundle.js */\nwindow.__CONTENT_BUNDLE__ = ' + JSON.stringify(bundle) + ';\n';
fs.writeFileSync(path.join(ROOT, 'content-bundle.js'), out, 'utf8');
console.log('content-bundle.js written:', Buffer.byteLength(out, 'utf8'), 'bytes');
