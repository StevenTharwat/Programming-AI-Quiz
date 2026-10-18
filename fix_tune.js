const fs = require('fs');
const L = s => [...s].length;
const tails12 = [
  ' كالتنبؤ والتصنيف', ' من بيانات التدريب', ' للتنبؤ والتصنيف',
  ' مثل سيري ومساعد جوجل', ' مثل ChatGPT', ' كتصنيف المزعجة',
  ' والتعرف على الكلام', ' متعددة الطبقات', ' أثناء التدريب',
  ' من الأنماط المعقدة', ' لتقريرك المدرسي', ' قبل اعتمادها',
  ' ضيقة النطاق', ' لمهمة محددة', ' أو توليد المحتوى',
  ' أو تنبؤ', ' أو تعرف', ' أو تصنيف', ' أو ترجمة'
];
const tails13 = [
  ' كسيري ومساعد جوجل', ' مثل DeepL', ' لفتح الهاتف',
  ' من صور الأشعة', ' لمواعيد الحصاد', ' لمسارات التوصيل',
  ' في المصانع', ' في الحقول', ' للأطباء', ' بتفضيلاتك',
  ' من سلوكك السابق', ' والترجمة الآلية', ' والتعرف على الوجه',
  ' والتوصية', ' أو تنبؤ', ' أو تصنيف', ' أو ترجمة'
];
function tuneFile(f, tails) {
  const a = JSON.parse(fs.readFileSync(f, 'utf8'));
  a.forEach(opts => {
    let guard = 0;
    while (guard < 20) {
      const lens = opts.map(L);
      const mx = Math.max(...lens), mn = Math.min(...lens);
      if (mx - mn <= 5) break;
      // shortest option more than 5 below max
      let idx = -1, small = 1e9;
      lens.forEach((l, k) => { if (mx - l > 5 && l < small) { small = l; idx = k; } });
      if (idx < 0) break;
      const gap = mx - L(opts[idx]);
      // candidates: tails not already in option, with new len <= mx and mx-newlen<=5 preferred
      const cands = tails.filter(t => !opts[idx].includes(t.trim())).map(t => ({ t, nl: L(opts[idx] + t) }))
        .filter(x => x.nl <= mx && (mx - x.nl) <= 5)
        .sort((x, y) => y.nl - x.nl);
      if (cands.length) { opts[idx] += cands[0].t; }
      else {
        // allow exceed mx by <=2 then re-loop (max grows, others may need extend)
        const c2 = tails.filter(t => !opts[idx].includes(t.trim())).map(t => ({ t, nl: L(opts[idx] + t) }))
          .filter(x => x.nl <= mx + 2 && x.nl > mx)
          .sort((x, y) => x.nl - y.nl);
        if (c2.length) opts[idx] += c2[0].t;
        else break;
      }
      guard++;
    }
  });
  fs.writeFileSync(f, JSON.stringify(a, null, 1), 'utf8');
}
tuneFile('n12_1.json', tails12);
tuneFile('n12_2.json', tails12);
tuneFile('n12_3.json', tails12);
tuneFile('n13_1.json', tails13);
tuneFile('n13_2.json', tails13);
tuneFile('n13_3.json', tails13);
console.log('domain tune done');
