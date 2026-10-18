const fs = require('fs');
const tails = [' في حياتك اليومية',' دون ذكاء حقيقي',' على الإطلاق',' إطلاقا',' كما ورد في الدرس',' حسب شرح الدرس',' في هذا الدرس',' وفق الدرس',' من البيانات الكثيرة',' للتنبؤ والتصنيف',' في التطبيقات',' العملية',' للمستخدمين',' اليومية',' والصناعية',' تماما'];
// strip at most one appended tail per option (tune added tails at end, sometimes two)
for (const f of ['n12_1.json','n12_2.json','n12_3.json','n13_1.json','n13_2.json','n13_3.json']) {
  const groups = JSON.parse(fs.readFileSync(f, 'utf8'));
  groups.forEach(opts => {
    for (let k = 0; k < opts.length; k++) {
      for (let r = 0; r < 2; r++) {
        let changed = false;
        const sorted = tails.slice().sort((a,b)=>b.length-a.length);
        for (const t of sorted) {
          if (opts[k].endsWith(t)) { opts[k] = opts[k].slice(0, opts[k].length - t.length); changed = true; break; }
        }
        if (!changed) break;
      }
    }
  });
  fs.writeFileSync(f, JSON.stringify(groups, null, 1), 'utf8');
}
console.log('stripped');
// verify no tail remains at end
for (const f of ['n12_1.json','n12_2.json','n12_3.json','n13_1.json','n13_2.json','n13_3.json']) {
  const groups = JSON.parse(fs.readFileSync(f, 'utf8'));
  groups.forEach((opts, gi) => opts.forEach(s => {
    tails.forEach(t => { if (s.endsWith(t)) console.log('REMAIN ' + f + ' Q' + (gi+1) + ' : ...' + s.slice(-30)); });
  }));
}
console.log('verify done');
