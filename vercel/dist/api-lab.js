import {summarizeApi} from './testing-core.js';
import {importApi} from './api-import.js';
import {prepare,objectJson,checkAssertions,diffJson,validateCollection,safeRequest,curl} from './api-core.js';
const $=id=>document.getElementById(id), key='rr-api-collection-v1';
let collection=[], history=[], current=null, pinned=null, controller=null, busy=false;
const milestones=new Set();
try{collection=validateCollection(JSON.parse(localStorage.getItem(key)||'[]')).map(safeRequest);}catch{}
function message(s){$('api-status').textContent=s;}
function award(id){milestones.add(id);$('xp').textContent=`${milestones.size*100} XP`;$('xp-progress').value=milestones.size;$('quests').textContent=['request','checks','compare'].map((m,i)=>`${milestones.has(m)?'✓':'○'} ${['First request','Passing checks','Response comparison'][i]}`).join(' · ');}
function read(){return {name:$('request-name').value.trim()||'Untitled request',method:$('method').value,url:$('url').value.trim(),headers:$('headers').value,body:$('body').value,assertions:JSON.parse($('assertions').value)}}
function load(r){$('request-name').value=r.name;$('method').value=r.method;$('url').value=r.url;$('headers').value=r.headers||'{}';$('body').value=r.body||'';$('assertions').value=JSON.stringify(r.assertions,null,2);$('authorize').checked=false;}
function demo(bug){load({name:bug?'Checkout · seeded bug':'Checkout · fixed contract',method:'GET',url:`demo://checkout/${bug?'buggy':'fixed'}`,headers:'{}',body:'',assertions:[{type:'status',value:200},{type:'json',path:'shipping',value:10},{type:'time',value:2000}]});message('Local simulation loaded: $110 subtotal − $20 discount. Expected shipping: $10.');}
function download(name,data){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function renderCollection(){const host=$('collection-list');host.replaceChildren();if(!collection.length)host.textContent='No saved requests yet.';collection.forEach((r,i)=>{const b=document.createElement('button');b.textContent=`${i+1}. ${r.method} · ${r.name}`;b.onclick=()=>{if(!busy){load(r);message('Request loaded. Review variables, authentication and body before sending.');}};host.append(b);});}
function persist(){localStorage.setItem(key,JSON.stringify(collection.map(safeRequest)));renderCollection();}
function toggle(value){busy=value;for(const id of ['send','run-collection','demo','demo-bug','save-request','import-collection','clear-collection'])$(id).disabled=value;$('cancel').disabled=!value;}
function validate(r){validateCollection([r]);prepare(r,objectJson($('variables').value,'Variables'));}
async function execute(r){
  const req=prepare(r,objectJson($('variables').value,'Variables'));
  const simulated=req.url.startsWith('demo://');
  if(!simulated&&$('use-oauth')?.checked&&$('transport').value!=='relay')throw Error('OAuth connections require the hosted relay.');
  if(!simulated&&!$('authorize').checked)throw Error('Check the authorization box before sending live requests.');
  const seconds=Number($('timeout').value);if(!Number.isFinite(seconds)||seconds<1||seconds>30)throw Error('Timeout must be between 1 and 30 seconds');
  const start=performance.now();controller=new AbortController();let timer;
  try{
    let result;
    if(simulated){
      if(!['demo://checkout/fixed','demo://checkout/buggy'].includes(req.url))throw Error('Unknown demo. Load a checkout demo from the flight deck.');
      result={status:200,headers:{'content-type':'application/json','x-releaseradar-source':'local simulation'},body:JSON.stringify({subtotal:110,discount:20,shipping:req.url.endsWith('buggy')?0:10,total:req.url.endsWith('buggy')?90:100},null,2)};
    }else{
      timer=setTimeout(()=>controller.abort('timeout'),(seconds+2)*1000);
      if($('transport').value==='relay'){
        const response=await fetch('/api/relay',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:req.url,method:req.method,headers:req.headers,body:req.body,timeout:seconds,authorized:true,oauth:!!$('use-oauth')?.checked}),signal:controller.signal});
        const data=await response.json();if(!response.ok)throw Error(data.error||'Relay failed.');result=data;
      }else{
      const response=await fetch(req.url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:req.body||undefined,signal:controller.signal,credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'});
      const reader=response.body?.getReader();const chunks=[];let size=0;
      if(reader)while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>1024*1024){await reader.cancel();throw Error('Response exceeded the 1 MB limit.');}chunks.push(value);}
      const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
      result={status:response.status,headers:Object.fromEntries(response.headers),body:new TextDecoder().decode(bytes)};
      }
    }
    result={...result,name:r.name,method:r.method,source:simulated?'LOCAL SIMULATION':result.transport==='hosted-relay'?'LIVE HTTP · RELAY':'LIVE HTTP · BROWSER',timestamp:new Date().toISOString(),ms:result.ms??Math.round(performance.now()-start)};
    result.checks=checkAssertions(result,r.assertions);current=result;history.unshift(result);history=history.slice(0,20);render(result);award('request');if(result.checks.length&&result.checks.every(c=>c.pass))award('checks');return result;
  }catch(e){if(controller.signal.aborted)throw Error(controller.signal.reason==='timeout'?'Request timed out. The server may still have processed it.':'Request cancelled. The server may still have processed it.');if(e instanceof TypeError)throw Error('Network request failed. Check the URL, network, HTTPS and endpoint CORS settings. No response was available for assertions.');throw e;}finally{clearTimeout(timer);controller=null;}
}
function render(r){
  $('metrics').replaceChildren();for(const t of [r.source,`HTTP ${r.status}`,`${r.ms} ms`,`${r.checks.filter(c=>c.pass).length}/${r.checks.length} checks`]){const s=document.createElement('span');s.textContent=t;$('metrics').append(s);}
  $('assertion-results').replaceChildren();for(const c of r.checks){const d=document.createElement('div');d.className=`check ${c.pass?'pass':'fail'}`;d.textContent=`${c.pass?'✓ PASS':'✕ FAIL'} · ${c.type}${c.path?' '+c.path:''} · expected ${JSON.stringify(c.value)} · actual ${JSON.stringify(c.actual)}`;$('assertion-results').append(d);}
  try{$('response').textContent=JSON.stringify(JSON.parse(r.body),null,2);}catch{$('response').textContent=r.body||'(empty body)';}
  $('response-headers').textContent=JSON.stringify(r.headers,null,2);$('baseline').disabled=false;$('compare').disabled=!pinned;$('export-evidence').disabled=false;$('send-workbench').disabled=false;
  $('history').replaceChildren();for(const h of history){const d=document.createElement('div');d.className='history-row';d.textContent=`${h.name} · ${h.source} · ${h.checks.filter(c=>c.pass).length}/${h.checks.length} checks`;const s=document.createElement('small');s.textContent=`${h.timestamp} · HTTP ${h.status} · ${h.ms} ms`;d.append(s);$('history').append(d);}
}
function guard(fn){return async()=>{try{await fn();}catch(e){message(e.message);}};}
$('demo').onclick=()=>demo(false);$('demo-bug').onclick=()=>demo(true);
$('send').onclick=guard(async()=>{const r=read();validate(r);toggle(true);message('Request in flight…');try{const result=await execute(r);message(`${result.source}: completed with ${result.checks.filter(c=>!c.pass).length} failing assertions.${result.redirect?' Redirect returned: review Location and send a new request manually.':''}`);}finally{toggle(false);}});
$('cancel').onclick=()=>controller?.abort('cancel');
$('save-request').onclick=guard(()=>{const r=read();validate(r);if(collection.length>=30)throw Error('Maximum 30 requests per collection');collection.push(safeRequest(r));persist();message('Template saved without headers, body or query parameters.');});
$('clear-collection').onclick=guard(()=>{collection=[];persist();message('Saved collection cleared.');});
$('export-collection').onclick=()=>download('releaseradar-collection.json',collection.map(safeRequest));
$('import-collection').onchange=guard(async()=>{const file=$('import-collection').files[0];if(!file)return;if(file.size>1000000)throw Error('Import limit is 1 MB');const imported=importApi(await file.text());collection=imported.requests;$('variables').value=JSON.stringify({...objectJson($('variables').value,'Variables'),...imported.variables},null,2);renderCollection();load(collection[0]);$('import-notes').textContent=imported.format+' · '+collection.length+' requests loaded in memory. '+imported.warnings.join(' ');message('Imported without sending any requests. Review the notes and fill environment values.');$('import-collection').value='';});
$('run-collection').onclick=guard(async()=>{
  if(!collection.length)throw Error('Save a request first.');
  for(const r of collection)validate(r);
  if(collection.some(r=>!prepare(r,objectJson($('variables').value,'Variables')).url.startsWith('demo://'))&&!$('authorize').checked)throw Error('Authorize collection requests before running. Review all collection requests and variables before authorizing.');
  toggle(true);let failed=0,ran=0;
  try{for(const r of collection){message(`Running ${ran+1}/${collection.length}: ${r.name}`);const result=await execute(r);ran++;if(result.checks.some(c=>!c.pass))failed++;}message(`Collection complete: ${ran} requests, ${failed} with failing assertions.`);}finally{toggle(false);}
});
$('baseline').onclick=()=>{pinned=structuredClone(current);$('compare').disabled=false;$('comparison').textContent=`Baseline pinned: ${pinned.name} (${pinned.source}). Run another request to compare.`;};
$('compare').onclick=guard(()=>{const parse=s=>{try{return JSON.parse(s);}catch{return s;}};const diff=diffJson(parse(pinned.body),parse(current.body));$('comparison').replaceChildren();const title=document.createElement('p');title.textContent=`${diff.length} body difference(s) · status ${pinned.status} → ${current.status} · time ${pinned.ms} → ${current.ms} ms`;$('comparison').append(title);const pre=document.createElement('pre');pre.textContent=JSON.stringify(diff,null,2);$('comparison').append(pre);award('compare');});
$('export-evidence').onclick=()=>download('releaseradar-api-evidence.json',{generatedAt:new Date().toISOString(),runs:history});
$('copy-curl').onclick=guard(async()=>{if($('use-oauth')?.checked)throw Error('OAuth tokens stay server-side; cURL export does not include this connection.');const r=prepare(read(),objectJson($('variables').value,'Variables'));if(r.url.startsWith('demo://'))throw Error('cURL requires a live HTTP(S) endpoint.');await navigator.clipboard.writeText(curl(r));message('cURL copied for a POSIX shell. It includes your entered headers and body; review before sharing.');});
renderCollection();

$('send-workbench').onclick=guard(()=>{if(!current)throw Error('Run a request first.');sessionStorage.setItem('rr-testing-handoff',JSON.stringify({summary:summarizeApi(current)}));location.assign('testing-workbench.html');});
