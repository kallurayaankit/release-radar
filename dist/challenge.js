import {requirement,playwrightSpec,validatePlan} from './scenario.js';
import {money} from './checkout.js';
import {variants,oracle,freezePlan,starterPlan,preparedRepair,challengePrompt,classify,ruleId} from './challenge-core.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const panel=document.createElement('section');panel.className='challenge panel';panel.id='challenge';
panel.innerHTML=`<div class="challenge-intro"><div><span class="quest-kicker">BONUS ROUND · TEST YOUR TESTS</span><h2>Challenge my tests<span>✦</span></h2><p>Freeze your assertions. Let the audience pick a challenge. Find what still slips through.</p></div><span class="challenge-seal" aria-hidden="true">挑<br><small>CHALLENGE</small></span></div>
<div class="challenge-controls"><label>Challenge case source<select id="challenge-source"><option value="prepared">Prepared · original suite, then reviewed additions</option><option value="live" disabled>Live AI · checking connection</option><option value="import">Import reviewed JSON</option></select></label><button class="secondary" id="challenge-reset">↺ New challenge</button></div>
<div id="challenge-import" hidden><textarea id="challenge-json" aria-label="Challenge test JSON" rows="5" placeholder='Paste a test plan with summary and tests'></textarea><button class="text-button" id="challenge-prompt">Copy challenge prompt</button></div>
<div class="challenge-rule"><strong>${ruleId} · Acceptance rule</strong><p>${esc(requirement)}</p><small>Expected shipping is independently derived from this rule. This checks the supplied rule, not whether the business requirement itself is correct.</small></div>
<div class="challenge-actions"><button class="primary" id="challenge-freeze">1. Freeze test suite 🔒</button><button class="secondary" id="challenge-run" disabled>2. Run all challenges →</button><button class="secondary" id="challenge-improve" disabled>3. Propose gap tests ✦</button></div>
<p id="challenge-status" role="status" aria-live="polite">Challenge implementations are withheld from the initial AI prompt. The prepared option starts with the original three tests.</p>
<div id="challenge-cards" class="challenge-cards"></div><div id="challenge-review"></div><div id="challenge-results"></div>
<div class="challenge-exports"><button class="text-button" id="challenge-report" disabled>↓ Evidence report</button><button class="text-button" id="challenge-data" disabled>↓ Reproduction JSON</button><button class="text-button" id="challenge-replay" disabled>↓ Node replay</button><button class="text-button" id="challenge-spec" disabled>↓ Frozen Playwright spec</button></div>
<p class="challenge-scope">Three injected demo bugs, not a production benchmark. Detected / missed counts describe this challenge set only. A passing run is not release approval.</p>`;
document.querySelector('.evidence-panel').after(panel);
const link=document.createElement('a');link.href='#challenge';link.className='nav';link.textContent='✦ Challenge my tests';document.querySelector('.sidebar-bottom').before(link);
const $=s=>panel.querySelector(s);
let suite=null,pending=null,rounds=[],busy=false,selection='buggy',source='',fingerprint='',fixture='',fixtureHash='',frozenAt=null,requestLog=[];
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
const say=text=>$('#challenge-status').textContent=text;
function controls(){
  $('#challenge-freeze').disabled=busy||!!suite;
  $('#challenge-freeze').textContent=pending?'Freeze expanded suite 🔒':'1. Freeze test suite 🔒';
  $('#challenge-run').disabled=busy||!suite||rounds.some(r=>r.suiteHash===fingerprint);
  $('#challenge-improve').disabled=busy||!suite||!rounds.length||rounds.at(-1).suiteHash!==fingerprint||rounds.at(-1).summary.every(v=>v.status==='detected');
  $('#challenge-reset').disabled=busy;$('#challenge-source').disabled=busy||!!pending;
  $('#challenge-json').disabled=busy;$('#challenge-prompt').disabled=busy;
  for(const id of ['report','data','replay','spec'])$('#challenge-'+id).disabled=busy||!rounds.length;
  for(const b of panel.querySelectorAll('[data-challenge]'))b.disabled=busy||!suite;
}
function cards(){
  $('#challenge-cards').innerHTML=suite?variants.map(v=>`<button class="challenge-card ${selection===v.id?'selected':''}" data-challenge="${v.id}" aria-pressed="${selection===v.id}"><small>AUDIENCE PICK</small><strong>${esc(v.name)}</strong><span>${esc(v.description)}</span><b>${selection===v.id?'★ In the spotlight':'Choose this challenge'}</b></button>`).join(''):'<div class="challenge-locked">🔒 Freeze the suite to reveal the three challenges.</div>';
  for(const b of panel.querySelectorAll('[data-challenge]'))b.onclick=()=>{selection=b.dataset.challenge;cards();controls();say('Audience spotlight selected. All three variants will run against the identical frozen assertions.');};
}
function review(plan,isPending=false){
  $('#challenge-review').innerHTML=`<div class="challenge-suite"><h3>${isPending?'Review proposed additions before freezing':'Frozen suite · '+plan.tests.length+' assertions'}</h3><p>${esc(isPending?'Original assertions retained. Review the proposed suite; freezing creates a new version.':source)}</p>${!isPending?`<code title="${fingerprint}">SHA-256 ${fingerprint.slice(0,16)}…</code>`:''}<details ${isPending?'open':''}><summary>Inspect requirement → calculation → assertion</summary>${plan.tests.map(t=>{const o=oracle(t);return `<div class="oracle-row"><strong>${esc(t.name)}</strong><span>${money(t.subtotal)} − ${money(t.discount)} = ${money(o.net)}</span><code>${esc(o.explanation)}</code><small>${o.matches?'✓':'⚠'} ${ruleId} · proposed shipping ${money(t.expectedShipping)} · ${o.matches?'matches rule':'CONTRADICTS RULE'}</small><p>${esc(t.reason)}</p></div>`;}).join('')}</details></div>`;
}
async function makePlan(improve=false){
  const mode=$('#challenge-source').value;
  if(mode==='prepared')return {plan:structuredClone(improve?preparedRepair:starterPlan),source:'Prepared cases · authored during development'};
  if(mode==='import')return {plan:validatePlan(JSON.parse($('#challenge-json').value)),source:'Imported cases · presenter supplied'};
  const tests=improve?rounds.at(-1).tests:starterPlan.tests;
  const observations=improve?rounds.at(-1).rows.map(({name,version,actual,expected,pass,error})=>({name,version,actual,expected,pass,error})):null;
  const prompt=challengePrompt(tests,observations);requestLog.push({at:new Date().toISOString(),phase:improve?'repair':'initial',prompt});
  say(improve?'Asking AI for additional tests using completed observations…':'Generating from the requirement and original tests only…');
  const response=await fetch('/api/challenge-generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tests,observations}),signal:AbortSignal.timeout(65000)});
  const data=await response.json();if(!response.ok)throw Error(data.error||'AI generation failed. No prepared cases were substituted.');
  return {plan:validatePlan(data.plan),source:'Live AI · '+data.model};
}
async function action(fn){if(busy)return;busy=true;controls();try{await fn();}catch(e){say(e.message||String(e));}finally{busy=false;controls();}}
$('#challenge-freeze').onclick=()=>action(async()=>{
  let candidate=pending,origin=source;
  if(!candidate){const made=await makePlan();candidate=made.plan;origin=made.source;}
  review(candidate,true);
  const validated=freezePlan(candidate);
  const response=await fetch('checkout.js',{cache:'no-store'});if(!response.ok)throw Error('Cannot snapshot the checkout implementation.');
  const nextFixture=await response.text();const nextFixtureHash=await hash(nextFixture);
  if(fixtureHash&&fixtureHash!==nextFixtureHash)throw Error('Checkout source changed between rounds. Start a new challenge.');
  fixture=nextFixture;fixtureHash=nextFixtureHash;suite=validated;fingerprint=await hash(JSON.stringify(suite.tests));frozenAt=new Date().toISOString();source=origin;pending=null;
  review(suite);cards();say('Suite frozen. Choose an audience spotlight, then run all three injected bugs.');
});
async function runBrowser(tests,version){
  const frame=document.createElement('iframe');frame.title='Challenge runner '+version;frame.hidden=true;document.body.append(frame);
  try{
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Checkout load timed out.')),8000);frame.onload=()=>{clearTimeout(timer);resolve();};frame.onerror=()=>{clearTimeout(timer);reject(Error('Checkout load failed.'));};frame.src='cart.html?version='+version;});
    const doc=frame.contentDocument;if(doc.body.dataset.ready!=='true')throw Error('Checkout did not initialise.');
    return tests.map(t=>{doc.querySelector('#subtotal').value=String(t.subtotal/100);doc.querySelector('#discount').value=String(t.discount/100);doc.querySelector('button').click();const actual=doc.querySelector('#shipping').textContent;const error=doc.querySelector('#error').textContent||null;return {name:t.name,version,input:{subtotal:t.subtotal,discount:t.discount},expected:money(t.expectedShipping),actual,error,pass:!error&&actual===money(t.expectedShipping),at:new Date().toISOString(),domSnapshot:doc.querySelector('.receipt').outerHTML};});
  }catch(e){return tests.map(t=>({name:t.name,version,expected:money(t.expectedShipping),actual:null,error:e.message,pass:false}));}finally{frame.remove();}
}
$('#challenge-run').onclick=()=>action(async()=>{
  const res=await fetch('checkout.js',{cache:'no-store'});if(!res.ok||await hash(await res.text())!==fixtureHash)throw Error('Checkout source changed after freezing. Start a new challenge.');
  let rows=[];for(const version of ['correct',...variants.map(v=>v.id),'fixed']){say('Running frozen assertions against '+version+'…');rows.push(...await runBrowser(suite.tests,version));}
  const summary=classify(rows,suite.tests);rounds.push({number:rounds.length+1,source,spotlight:selection,frozenAt,completedAt:new Date().toISOString(),suiteHash:fingerprint,fixtureHash,tests:structuredClone(suite.tests),rows,summary,fixedVerified:rows.filter(r=>r.version==='fixed').length===suite.tests.length&&rows.filter(r=>r.version==='fixed').every(r=>r.pass&&!r.error)});
  renderResults();const caught=summary.filter(v=>v.status==='detected').length;
  say(`${caught} of 3 injected bugs detected. ${summary.filter(v=>v.status==='missed').length} missed; ${summary.filter(v=>v.status==='inconclusive').length} inconclusive. ${caught<3?'Propose additional tests to investigate the gaps.':'All three demo variants detected; this does not establish production safety.'}`);
});
$('#challenge-improve').onclick=()=>action(async()=>{
  const made=await makePlan(true);const original=rounds.at(-1).tests;
  const additions=made.plan.tests.filter(t=>!original.some(o=>o.subtotal===t.subtotal&&o.discount===t.discount&&o.expectedShipping===t.expectedShipping));
  if(!additions.length)throw Error('No new cases were proposed. Original suite and evidence retained. Try another source or import.');
  const candidate=validatePlan({summary:made.plan.summary,tests:[...original,...additions]});
  review(candidate,true);freezePlan(candidate);
  pending=candidate;suite=null;source=made.source+' · expanded suite; originals retained';review(candidate,true);cards();say('Review the proposed additions and requirement calculations. Freeze the expanded suite, then rerun all challenges.');
});
function renderResults(){
  $('#challenge-results').innerHTML=rounds.map(r=>`<article class="challenge-round"><div class="challenge-score"><span>ROUND ${r.number}</span><strong>${r.summary.filter(v=>v.status==='detected').length}<small> / 3</small></strong><p>injected bugs detected</p><small>${r.tests.length} unchanged assertions per build · ${r.fixedVerified?'corrected build passes':'corrected build NOT verified'}</small></div><div class="challenge-outcomes">${r.summary.map(v=>`<div class="challenge-outcome ${v.status}"><strong>${v.id===r.spotlight?'★ ':''}${esc(v.name)}</strong><b>${v.status.toUpperCase()}</b><p>${v.witness?esc(v.witness.name)+': expected '+esc(v.witness.expected)+', observed '+esc(v.witness.actual):v.status==='missed'?'Every assertion passed on this injected bug. A gap remains.':'Runner errors or a failing control prevent a detection claim.'}</p></div>`).join('')}<details><summary>Inspect all ${r.rows.length} browser checks</summary><div class="table-wrap"><table><thead><tr><th>Case / build</th><th>Expected</th><th>Observed</th><th>Result</th></tr></thead><tbody>${r.rows.map(row=>`<tr><td>${esc(row.name)}<small>${esc(row.version)}</small></td><td>${esc(row.expected)}</td><td>${esc(row.actual??'—')}</td><td>${esc(row.error|| (row.pass?'PASS':'FAIL'))}</td></tr>`).join('')}</tbody></table></div></details></div></article>`).join('');
}
function bundle(){return {schemaVersion:1,app:'ReleaseRadar Challenge',exportedAt:new Date().toISOString(),requirement:{id:ruleId,text:requirement},scope:'Same-origin iframe DOM checks of three injected demo bugs. Not a production safety score. Node replay checks the captured calculation function; Playwright export checks the UI separately.',fixture:{file:'checkout.js',sha256:fixtureHash,source:fixture},variants,requests:requestLog,rounds};}
function download(name,data,type){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#challenge-data').onclick=()=>download('releaseradar-challenge.json',JSON.stringify(bundle(),null,2),'application/json');
$('#challenge-spec').onclick=()=>download('releaseradar-challenge.spec.js',playwrightSpec(rounds.at(-1).tests).replace('correct, buggy, or fixed','correct, buggy, boundary, rounding, or fixed'),'text/javascript');
$('#challenge-replay').onclick=()=>{
  const data=JSON.stringify(bundle());
  const code=`// Run: node releaseradar-replay.mjs\n// Captured fixture logic; does not replay browser DOM. Expected mutant failures are evidence.\nimport {createHash} from 'node:crypto';\nconst evidence=${data};\nconst sha=s=>createHash('sha256').update(s).digest('hex');\nif(sha(evidence.fixture.source)!==evidence.fixture.sha256)throw Error('Fixture hash mismatch');\n${fixture.replaceAll('export ','')}\nlet mismatches=0;\nfor(const round of evidence.rounds){\n if(sha(JSON.stringify(round.tests))!==round.suiteHash)throw Error('Suite hash mismatch');\n for(const row of round.rows){const t=round.tests.find(t=>t.name===row.name);const actual=money(checkout(t.subtotal,t.discount,row.version).shipping);const matches=actual===row.actual; if(!matches)mismatches++; console.log('Round',round.number,row.version,t.name,actual===row.expected?'PASS':'FAIL (injected bug)',matches?'matches recorded result':'DIFFERS FROM RECORD');}\n}\nconsole.log('Replay mismatches:',mismatches);process.exitCode=mismatches?1:0;\n`;
  download('releaseradar-replay.mjs',code,'text/javascript');
};
$('#challenge-report').onclick=()=>{
  const data=bundle();const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>ReleaseRadar evidence report</title><style>body{font:16px system-ui;max-width:1000px;margin:40px auto;padding:24px;color:#292d46;background:#faf7f2}h1{font-size:40px}article,section{background:white;border:1px solid #ddd;padding:24px;margin:20px 0}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:10px;border-bottom:1px solid #ddd}small{display:block}code{overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere}@media print{details{display:block}article{break-inside:avoid}}</style><h1>ReleaseRadar · Evidence report</h1><p>${esc(data.exportedAt)}</p><section><h2>${ruleId}</h2><p>${esc(requirement)}</p><p>${esc(data.scope)}</p><small>Fixture SHA-256: <code>${fixtureHash}</code></small></section>${rounds.map(r=>`<article><h2>Round ${r.number}: ${r.summary.filter(v=>v.status==='detected').length} / 3 injected bugs detected</h2><p>${esc(r.source)} · ${r.tests.length} tests · fixed build ${r.fixedVerified?'verified':'not verified'}</p><small>Frozen ${esc(r.frozenAt)} · completed ${esc(r.completedAt)}</small><code>Suite SHA-256: ${r.suiteHash}</code><ul>${r.summary.map(v=>`<li>${esc(v.name)}: ${v.status}</li>`).join('')}</ul><h3>Requirement-backed assertions</h3>${r.tests.map(t=>`<p><strong>${esc(t.name)}</strong><br>${esc(oracle(t).explanation)}</p>`).join('')}<table><tr><th>Case / build</th><th>Expected</th><th>Observed</th><th>Result</th></tr>${r.rows.map(row=>`<tr><td>${esc(row.name)}<small>${esc(row.version)}</small></td><td>${esc(row.expected)}</td><td>${esc(row.actual??'—')}</td><td>${esc(row.error||(row.pass?'PASS':'FAIL'))}</td></tr>`).join('')}</table></article>`).join('')}<section><h2>Reproduce</h2><p>Download the companion Node replay for calculation checks, or the frozen Playwright spec for UI checks. Use CHECKOUT_VERSION=correct, buggy, boundary, rounding, or fixed. Injected-bug test failures are expected. This report contains no release approval.</p><details><summary>Captured checkout source</summary><pre>${esc(fixture)}</pre></details></section></html>`;
  download('releaseradar-evidence-report.html',html,'text/html');
};
$('#challenge-source').onchange=()=>{$('#challenge-import').hidden=$('#challenge-source').value!=='import';};
$('#challenge-prompt').onclick=async()=>{try{const last=rounds.at(-1);await navigator.clipboard.writeText(challengePrompt(last?.tests||starterPlan.tests,last?.rows||null));say('Challenge prompt copied.');}catch{say('Clipboard unavailable. Select a different source.');}};
$('#challenge-reset').onclick=()=>{suite=null;pending=null;rounds=[];source='';fingerprint='';fixture='';fixtureHash='';frozenAt=null;requestLog=[];$('#challenge-review').innerHTML='';$('#challenge-results').innerHTML='';cards();controls();say('New challenge. Freeze a suite before revealing the variants.');};
fetch('/api/config').then(r=>r.ok?r.json():null).then(config=>{const o=$('#challenge-source option[value="live"]');o.disabled=!config?.configured;o.textContent=config?.configured?'Live AI · '+config.model:'Live AI · available on the configured local server';}).catch(()=>{});
cards();controls();
