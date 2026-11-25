// Download published report data only. Never execute code from the measured repository.
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(process.argv[2]);
const repo='ella79/agentic-playwright-suite';
const older = process.argv[3] === 'development';
const revision=older?'279ee2ab4044eb08a4b6d2895736e7c7815b30e7':'cfd20eb1addf3a4f5456fd111d32b1339fc51dd6';
const raw='https://raw.githubusercontent.com/'+repo+'/'+revision;
await mkdir(root,{recursive:true});
async function cached(name,url,headers={}) {
  const file=resolve(root,name);
  try {return await readFile(file,'utf8')} catch(e){if(e.code!=='ENOENT') throw e}
  const response=await fetch(url,{headers,signal:AbortSignal.timeout(30000)});
  if(!response.ok) throw Error(response.status+' '+url);
  const data=await response.text();
  await writeFile(file,data);return data;
}
const history=JSON.parse(await cached('history-'+revision+'.json',raw+'/metrics/history.json'));
const selected=history.filter(r=>r.branch==='main'&&(older?r.run>=186&&r.run<=247:r.run>=470&&r.run<=556));
const runs=[...new Map(selected.map(run=>[run.runUrl,run])).values()];
export function leaves(tree,parents=[],rows=[]) {
  if(tree.children) for(const child of tree.children) leaves(child,[...parents,tree.name],rows);
  else rows.push({suites:parents.slice(1),className:'',name:tree.name,status:tree.status});
  return rows;
}
let previous;
for(const run of runs){
  const rows=leaves(JSON.parse(await cached(run.run+'.json',raw+'/runs/'+run.run+'/data/suites.json')));
  const keys=new Map(rows.map(r=>[JSON.stringify([r.suites,r.name]),r]));
  if(keys.size!==rows.length) throw Error('Duplicate report identity in '+run.run);
  if(previous) {
    const missing=[...previous.keys].filter(([key])=>!keys.has(key)).map(([,row])=>row);
    if(missing.length){
      const id=previous.run.run+'-'+run.run;
      await cached(id+'.diff','https://github.com/'+repo+'/compare/'+previous.run.commit+'...'+run.commit+'.diff');
      await cached(run.run+'.html',raw+'/runs/'+run.run+'/playwright-report/index.html');
      console.log(id,missing.length+' missing identities');
    }
  }
  previous={keys,run};
}
