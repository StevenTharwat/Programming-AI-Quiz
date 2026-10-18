const fs = require('fs');
const L = s => [...s].length;
const files = ['n12_1.json','n12_2.json','n12_3.json','n13_1.json','n13_2.json','n13_3.json'];
// tails: natural domain-specific extensions per group
const tails12 = [
  ' في حياتك اليومية', ' دون ذكاء حقيقي', ' على الإطلاق', ' إطلاقا',
  ' كما ورد في الدرس', ' حسب شرح الدرس', ' في هذا الدرس', ' وفق الدرس',
  ' من البيانات الكثيرة', ' للتنبؤ والتصنيف', ' في التطبيقات', ' العملية',
];
const tails13 = [
  ' في حياتك اليومية', ' كما ورد في الدرس', ' حسب شرح الدرس', ' في هذا الدرس',
  ' دون ذكاء حقيقي', ' على الإطلاق', ' إطلاقا', ' تماما',
  ' للمستخدمين', ' في التطبيقات', ' اليومية', ' والصناعية',
];
function tuneFile(f, tails) {
  const groups = JSON.parse(fs.readFileSync(f, 'utf8'));
  groups.forEach((opts, gi) => {
    let guard = 0;
    while (guard < 30) {
      const lens = opts.map(L);
      const mx = Math.max(...lens), mn = Math.min(...lens);
      if (mx - mn <= 5) break;
      // extend shortest that is >5 below max with a tail that fits (no overshoot beyond mx+1, no repeat words)
      let idx = -1, best = -1;
      lens.forEach((l, k) => { if (mx - l > 5 && l > best) { best = l; idx = k; } });
      // pick longest-first? use shortest actually: smallest gap>5 -> extend the smallest
      idx = -1; let small = 1e9;
      lens.forEach((l, k) => { if (mx - l > 5 && l < small) { small = l; idx = k; } });
      if (idx < 0) break;
      const gap = mx - L(opts[idx]);
      let placed = false;
      const order = tails.slice().sort((a,b)=> L(b)-L(a));
      for (const t of order) {
        if (opts[idx].includes(t.trim())) continue;
        const nl = L(opts[idx] + t);
        if (nl <= mx + 0 && (mx - nl <= 5)) { opts[idx] += t; placed = true; break; }
      }
      if (!placed) {
        // try smallest tail that still leaves diff<=5 and doesn't exceed mx
        for (const t of tails.slice().sort((a,b)=> L(a)-L(b))) {
          if (opts[idx].includes(t.trim())) continue;
          const nl = L(opts[idx] + t);
          if (nl <= mx && (mx - nl <= 5)) { opts[idx] += t; placed = true; break; }
        }
      }
      if (!placed) break;
      guard++;
    }
  });
  fs.writeFileSync(f, JSON.stringify(groups, null, 1), 'utf8');
}
tuneFile('n12_1.json', tails12);
tuneFile('n12_2.json', tails12);
tuneFile('n12_3.json', tails12);
tuneFile('n13_1.json', tails13);
tuneFile('n13_2.json', tails13);
tuneFile('n13_3.json', tails13);
console.log('tuned');
