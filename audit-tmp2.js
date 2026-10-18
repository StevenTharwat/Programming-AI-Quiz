const fs = require('fs');
const base = 'C:\\Users\\steve\\Downloads\\ai-quiz-game-publish\\';
for (const f of ['data-11.js','data-12.js','data-13.js','data-14.js']) {
  let txt = fs.readFileSync(base + f, 'utf8');
  const m = txt.match(/const (LESSON_\d+)\s*=/);
  const key = m[1];
  txt = txt.replace('const ' + key, 'globalThis.' + key);
  eval(txt);
  const L = globalThis[key];
  console.log('==' + f + ' ' + key + ' n=' + L.questions.length);
  let bad = 0;
  L.questions.forEach((qq, i) => {
    const lens = qq.o.map(s => s.length);
    const mn = Math.min(...lens), mx = Math.max(...lens);
    if (mx - mn > 5) { bad++; console.log((i+1) + '. [' + lens.join(',') + '] diff=' + (mx-mn) + ' q=' + qq.q.slice(0,50)); }
  });
  console.log('violations: ' + bad);
}
