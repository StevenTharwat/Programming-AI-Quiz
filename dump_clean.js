const fs=require('fs'),vm=require('vm');
function L(f,n){const t=fs.readFileSync(f,'utf8');const c={};vm.createContext(c);vm.runInContext(t+';globalThis.__Q='+n+'.questions;',c);return c.__Q;}
const fillers=['حسب ما ورد في شرح الدرس','وفق ما ذكره الكتاب المدرسي','في سياق موضوع هذا الدرس','ضمن نطاق ما تناوله الدرس','كما جاء في شرح الكتاب','حسب ما ورد في الدرس','وفق ما ذكره الكتاب','في إطار موضوع الدرس','ضمن ما شرحه الدرس','المذكور في الشرح','الموضح في الكتاب','الوارد في المنهج','المتعلق بهذا الدرس','الخاص بهذا الموضوع','كما تم توضيحه في الشرح','في سياق الدرس','في هذا السياق','حسب ما ورد','كما جاء في الشرح','حسب الشرح الموضح','وفق الشرح المذكور','المذكور في المنهج','الموضح في الدرس','في شرح الدرس','حسب المنهج','في تقنيات التشفير والمصادقة','في تصميم أمن الشبكات','في الاستجابة للحوادث وإدارة المخاطر','المذكور','المحدد','المقصود','الموضح'];
const sorted=fillers.slice().sort((a,b)=>[...b].length-[...a].length);
function core(s){let r=' '+s;for(const f of sorted)r=r.split(' '+f).join('');return r.trim().replace(/\s+/g,' ');}
for(const [f,n] of [['data-21.js','LESSON_21'],['data-22.js','LESSON_22'],['data-23.js','LESSON_23']]){
 const Q=L(f,n);
 console.log('#### '+f);
 Q.forEach((qq,i)=>{
  const cs=qq.o.map(core);
  const lens=cs.map(s=>[...s].length);
  const d=Math.max(...lens)-Math.min(...lens);
  console.log('Q'+(i+1)+' diff='+d+' lens='+lens.join('/')+' | '+qq.q);
  cs.forEach((s,k)=>console.log('  o'+k+': '+s));
 });
}
