const fs = require('fs');
const files = ['data-11.js','data-12.js','data-13.js','data-14.js','data-21.js','data-22.js','data-23.js','data2-11.js','data2-12.js','data2-13.js','data2-14.js','data2-21.js','data2-22.js','data2-23.js'];
let gT=0, gB=0;
files.forEach(f=>{
  const t = fs.readFileSync(f,'utf8');
  const re = /["']?o["']?\s*:/g;
  let m, total=0, bad=0, worst=0;
  while((m=re.exec(t))!==null){
    let i = m.index + m[0].length;
    while(i<t.length && /\s/.test(t[i])) i++;
    if(t[i]!=='[') continue;
    let depth=0, end=i;
    for(let j=i;j<t.length;j++){
      if(t[j]==='[') depth++;
      else if(t[j]===']'){ depth--; if(depth===0){ end=j; break; } }
    }
    try{
      const arr = eval(t.slice(i, end+1));
      if(Array.isArray(arr)&&arr.length>=3&&typeof arr[0]==='string'){
        total++;
        const lens=arr.map(s=>[...s].length);
        const d=Math.max(...lens)-Math.min(...lens);
        if(d>worst) worst=d;
        if(d>5) bad++;
      }
    }catch(e){}
  }
  gT+=total; gB+=bad;
  console.log(f+': MCQ='+total+' bad(>5)='+bad+' worstDiff='+worst+(bad===0?'  OK':'')); 
});
console.log('TOTAL MCQ:'+gT+' BAD:'+gB);
