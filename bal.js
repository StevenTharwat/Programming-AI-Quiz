const fs=require('fs');
const files=['data2-11.js','data2-12.js','data2-13.js','data2-14.js'];
const constNames={'data2-11.js':'L2_11','data2-12.js':'L2_12','data2-13.js':'L2_13','data2-14.js':'L2_14'};
const words="مع تحليل مقارن دقيق لشروط الحالة كما وردت في الدرس وبمقارنة تحليلية شاملة لسياق المفهوم وعناصره مع مراعاة الفروق الجوهرية بين البدائل المطروحة وتقييمها تقويما تحليليا دقيقا لعناصر السؤال وشروطه في ضوء المعيار التحليلي المقارن للدرس".split(" ");
function slen(s){return [...s].length;}
function buildSuffix(need){
  let s=""; let idx=0;
  while(slen(s)<need && idx<200){
    const w=words[idx%words.length];
    s = s==="" ? " "+w : s+" "+w;
    idx++;
  }
  return s;
}
for(const fn of files){
  const txt=fs.readFileSync(fn,'utf8');
  const mHead=txt.match(/const\s+(L2_\d+)\s*=\s*\{\s*id\s*:\s*"([^"]+)"\s*,\s*num\s*:\s*"([^"]+)"\s*,\s*title\s*:\s*"([^"]+)"\s*,\s*icon\s*:\s*"([^"]+)"\s*,\s*color\s*:\s*"([^"]+)"/);
  if(!mHead){console.log(fn+' head parse fail'); continue;}
  const cname=mHead[1], id=mHead[2], num=mHead[3], title=mHead[4], icon=mHead[5], color=mHead[6];
  const re=/\{"q":.*?"fix":.*?"\}/g;
  let m; const outQs=[];
  let qi=0;
  while((m=re.exec(txt))!==null){
    const d=JSON.parse(m[0]);
    let opts=[...d.o];
    // iterative balance up to 5 passes
    for(let pass=0;pass<5;pass++){
      const lens=opts.map(slen);
      const target=Math.max(...lens);
      const mn=Math.min(...lens);
      if(target-mn<=5) break;
      let changed=false;
      for(let i=0;i<opts.length;i++){
        const L=slen(opts[i]);
        if(target-L>5){
          const wantTarget=target-2;
          const need=wantTarget-L;
          const suf=buildSuffix(need);
          // adjust: if suf makes len exceed target by >3, trim last word to fit closer
          let cand=opts[i]+suf;
          // if overshoot >3, try to shave by removing last word and adding shorter filler
          if(slen(cand)-target>3){
            // remove last word
            const parts=suf.trim().split(" ");
            parts.pop();
            const suf2=" "+parts.join(" ");
            // pad with small words to reach wantTarget if too short now
            let cand2=opts[i]+suf2;
            let k=0;
            const small=[" الدقيق"," الشامل"," المقارن"," التحليلي"];
            while(slen(cand2)<wantTarget-1 && k<10){
              cand2+=small[k%small.length];
              k++;
            }
            cand=cand2;
          }
          opts[i]=cand;
          changed=true;
        }
      }
      if(!changed) break;
    }
    const lens2=opts.map(slen);
    const diff=Math.max(...lens2)-Math.min(...lens2);
    if(diff>5){console.log(fn+' Q'+qi+' STILL '+diff+' '+JSON.stringify(lens2));}
    outQs.push({q:d.q,o:opts,a:0,fix:d.fix});
    qi++;
  }
  console.log(fn+' done '+outQs.length+' Qs');
  // rebuild file
  let out='// x\nconst '+cname+' = {\n  id: "'+id+'", num: "'+num+'", title: "'+title+'", icon: "'+icon+'", color: "'+color+'",\n  questions: [\n';
  outQs.forEach((qq,idx)=>{
    const line='    '+JSON.stringify({q:qq.q,o:qq.o,a:0,fix:qq.fix})+(idx<outQs.length-1?',':'')+'\n';
    out+=line;
  });
  out+='  ]\n};\n';
  fs.writeFileSync(fn,out,'utf8');
}
