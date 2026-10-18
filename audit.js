const fs = require('fs');
const files = ['data-11.js','data-12.js','data-13.js','data-14.js','data-21.js','data-22.js','data-23.js','data2-11.js','data2-12.js','data2-13.js','data2-14.js','data2-21.js','data2-22.js','data2-23.js'];
let total=0, bad=0;
let worst=[];
files.forEach(f=>{
  const t = fs.readFileSync(f,'utf8');
  // match o: [...] arrays
  const re = /o:\s*\[/g;
  let m;
  while((m=re.exec(t))!==null){
    let start=m.index+m[0].length-1;
    // find matching ]
    let depth=0, end=start;
    for(let i=start;i<t.length;i++){
      if(t[i]==='[') depth++;
      else if(t[i]===']'){ depth--; if(depth===0){ end=i; break; } }
    }
    const inner = t.slice(start, end+1);
    try{
      const arr = eval(inner);
      if(Array.isArray(arr)&&arr.length>=3&&typeof arr[0]==='string'){
        total++;
        const lens=arr.map(s=>[...s].length);
        const mx=Math.max(...lens), mn=Math.min(...lens);
        if(mx-mn>5) { bad++; if(worst.length<8) worst.push({f, lens, mxmn:mx-mn, arr}); }
      }
    }catch(e){}
  }
});
console.log('total MCQ:',total,' imbalanced(>5 diff):',bad, 'pct:', Math.round(bad/total*100)+'%');
worst.forEach((w,i)=>{ console.log('---'+(i+1)+') '+w.f+' diff='+w.mxmn+' lens='+w.lens.join(',')+' | '+JSON.stringify(w.arr).slice(0,220)); });
