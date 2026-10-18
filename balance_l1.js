const fs = require('fs');
const files = [
  {f:'data-11.js', ctx:'في تطور تكنولوجيا المعلومات'},
  {f:'data-12.js', ctx:'في آلية عمل الذكاء الاصطناعي'},
  {f:'data-13.js', ctx:'في استخدامات الذكاء الاصطناعي اليومية والصناعية'},
  {f:'data-14.js', ctx:'في القضايا الأخلاقية للذكاء الاصطناعي'},
  {f:'data-21.js', ctx:'في تقنيات التشفير والمصادقة'},
  {f:'data-22.js', ctx:'في تصميم أمن الشبكات'},
  {f:'data-23.js', ctx:'في الاستجابة للحوادث وإدارة المخاطر'},
  {f:'data2-14.js', ctx:'في القضايا الأخلاقية للذكاء الاصطناعي'},
];
const shortTags = ['المذكور','المحدد','المقصود','الموضح'];
const fillers = [
  'حسب ما ورد في شرح الدرس','وفق ما ذكره الكتاب المدرسي','في سياق موضوع هذا الدرس',
  'ضمن نطاق ما تناوله الدرس','كما جاء في شرح الكتاب','حسب ما ورد في الدرس',
  'وفق ما ذكره الكتاب','في إطار موضوع الدرس','ضمن ما شرحه الدرس',
  'المذكور في الشرح','الموضح في الكتاب','الوارد في المنهج',
  'المتعلق بهذا الدرس','الخاص بهذا الموضوع','كما تم توضيحه في الشرح',
  'في سياق الدرس','في هذا السياق','حسب ما ورد','كما جاء في الشرح',
  'حسب الشرح الموضح','وفق الشرح المذكور','في هذا الموضوع','لهذا المفهوم',
  'لهذا المصطلح','في المنهج المقرر','كما ورد في المنهج','في الكتاب المدرسي',
  'المذكور في المنهج','الموضح في الدرس','في شرح الدرس','حسب المنهج',
];
function len(s){ return [...s].length; }
function fillerLen(s){ return len(' '+s); }
const sorted = fillers.slice().sort((a,b)=>fillerLen(b)-fillerLen(a));
files.forEach(({f,ctx})=>{
  let t = fs.readFileSync(f,'utf8');
  const re = /["']?o["']?\s*:/g;
  let m; let out=''; let last=0; let qCount=0, fixed=0;
  // collect replacements
  let reps=[];
  while((m=re.exec(t))!==null){
    let i=m.index+m[0].length;
    while(i<t.length && /\s/.test(t[i])) i++;
    if(t[i]!=='[') continue;
    let depth=0,end=i;
    for(let j=i;j<t.length;j++){ if(t[j]==='[')depth++; else if(t[j]===']'){depth--; if(depth===0){end=j;break;}} }
    let arr;
    try{ arr=eval(t.slice(i,end+1)); }catch(e){ continue; }
    if(!Array.isArray(arr)||arr.length<3||typeof arr[0]!=='string') continue;
    qCount++;
    let cur=arr.slice();
    // step1: distinct short tag to each option to mask
    cur=cur.map((s,k)=>s+' '+shortTags[k%shortTags.length]);
    let lens=cur.map(len);
    let mx=Math.max(...lens);
    // step2: pad shorts with varied fillers + ctx
    for(let k=0;k<cur.length;k++){
      let guard=0;
      let fi=(k*3+qCount)%sorted.length;
      while(mx-len(cur[k])>5 && guard<6){
        let gap=mx-len(cur[k]);
        // prefer ctx for large gaps first time
        let cand=null;
        if(guard===0 && gap>=22){
          cand=ctx;
        } else {
          // largest filler that fits gap (allow overshoot up to 2)
          cand=null;
          for(let n=0;n<sorted.length;n++){
            const fl=sorted[(fi+n)%sorted.length];
            const L=fillerLen(fl);
            if(L<=gap || (gap<=8 && L<=gap+2)){ cand=fl; fi+=n+1; break; }
          }
          if(!cand) cand=sorted[fi%sorted.length];
        }
        // avoid repeating same filler in same question
        let tries=0;
        while(cur.some(s=>s.includes(cand)) && tries<sorted.length){ fi++; cand=sorted[fi%sorted.length]; tries++; if(fillerLen(cand)>gap+2 && gap<20) break; }
        cur[k]=cur[k]+' '+cand;
        guard++;
        // update mx if overshoot
        const nl=len(cur[k]);
        if(nl>mx) mx=nl;
      }
    }
    // final check: if still >5, pad with ctx/short combos iteratively
    let iter=0;
    while(iter<8){
      lens=cur.map(len); mx=Math.max(...lens); const mn=Math.min(...lens);
      if(mx-mn<=5) break;
      for(let k=0;k<cur.length;k++){
        if(mx-len(cur[k])>5){
          const gap=mx-len(cur[k]);
          let cand = gap>=20?ctx:sorted[(k+iter*2)%sorted.length];
          if(cur[k].includes(cand)) cand=sorted[(k+iter*2+5)%sorted.length];
          cur[k]=cur[k]+' '+cand;
          const nl=len(cur[k]); if(nl>mx) mx=nl;
        }
      }
      iter++;
    }
    lens=cur.map(len); const diff=Math.max(...lens)-Math.min(...lens);
    if(diff<=5) fixed++;
    // build replacement literal with double quotes JSON style
    const lit='['+cur.map(s=>JSON.stringify(s)).join(', ')+']';
    reps.push({start:i,end:end,newText:lit});
  }
  // apply replacements from end to start
  reps.sort((a,b)=>b.start-a.start).forEach(r=>{
    t=t.slice(0,r.start)+r.newText+t.slice(r.end+1);
  });
  fs.writeFileSync(f,t,'utf8');
  console.log(f+': Q='+qCount+' fixed<=5:'+fixed);
});
