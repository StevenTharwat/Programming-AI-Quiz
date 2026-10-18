const fs = require('fs'), vm = require('vm');
function L(f, n) {
  let t = fs.readFileSync(f, 'utf8');
  let c = {};
  vm.createContext(c);
  vm.runInContext(t + ';globalThis.__Q=' + n + '.questions;', c);
  return c.__Q;
}
const fillers = ['حسب ما ورد في شرح الدرس','وفق ما ذكره الكتاب المدرسي','في سياق موضوع هذا الدرس','ضمن نطاق ما تناوله الدرس','كما جاء في شرح الكتاب','حسب ما ورد في الدرس','وفق ما ذكره الكتاب','في إطار موضوع الدرس','ضمن ما شرحه الدرس','المذكور في الشرح','الموضح في الكتاب','الوارد في المنهج','المتعلق بهذا الدرس','الخاص بهذا الموضوع','كما تم توضيحه في الشرح','في سياق الدرس','في هذا السياق','حسب ما ورد','كما جاء في الشرح','حسب الشرح الموضح','وفق الشرح المذكور','في هذا الموضوع','لهذا المفهوم','لهذا المصطلح','في المنهج المقرر','كما ورد في المنهج','في الكتاب المدرسي','المذكور في المنهج','الموضح في الدرس','في شرح الدرس','حسب المنهج','في آلية عمل الذكاء الاصطناعي','في استخدامات الذكاء الاصطناعي اليومية والصناعية','المذكور','المحدد','المقصود','الموضح'];
const sorted = fillers.slice().sort((a,b)=>[...b].length-[...a].length);
function core(s) {
  let r = ' ' + s;
  for (const f of sorted) r = r.split(' ' + f).join('');
  return r.trim();
}
let out = '';
for (const [f, n] of [['data-12.js','LESSON_12'],['data-13.js','LESSON_13']]) {
  const Q = L(f, n);
  out += '######## ' + f + ' Q=' + Q.length + '\n';
  Q.forEach((qq, i) => {
    out += '===Q' + (i+1) + ' a=' + qq.a + ': ' + qq.q + '\n';
    qq.o.forEach((s, k) => out += ' o' + k + ' core[' + [...core(s)].length + ']: ' + core(s) + '\n');
  });
}
fs.writeFileSync('cores.txt', out, 'utf8');
console.log('wrote cores.txt len=' + out.length);
