const fs=require('fs');
for(const fn of ['data2-11.js','data2-12.js','data2-13.js','data2-14.js']){
  const txt=fs.readFileSync(fn,'utf8');
  const re=/\{"q":.*?"fix":.*?"\}/g;
  let m, i=0;
  console.log('== '+fn);
  while((m=re.exec(txt))!==null){
    try{
      const d=JSON.parse(m[0]);
      const lens=d.o.map(s=>[...s].length);
      console.log(i, JSON.stringify(lens), 'maxmin='+(Math.max(...lens)-Math.min(...lens)), 'q='+d.q.slice(0,35));
    }catch(e){ console.log(i,'JSON fail '+e.message); }
    i++;
  }
}
