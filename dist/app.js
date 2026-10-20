import './stress.js';
import {baseline, prepared, validatePlan, playwrightSpec, generationPrompt} from './scenario.js';
import {money} from './checkout.js';
import {mountQuest, updateQuest} from './quest.js';
import './challenge.js';
import './guide.js';
import {mountDepth} from './depth.js';
mountQuest();
mountDepth();
const connectionBadge=document.createElement('span');connectionBadge.id='ai-connection';connectionBadge.className='ai-connection';connectionBadge.textContent='Checking AI connection…';document.querySelector('.top-actions').prepend(connectionBadge);
const planButton=document.createElement('button');planButton.id='download-plan';planButton.className='text-button';planButton.textContent='↓ Test cases';planButton.disabled=true;document.querySelector('.evidence-tools').prepend(planButton);
const proofCard=document.createElement('section');proofCard.id='proof-card';proofCard.className='proof-card';proofCard.hidden=true;document.querySelector('.evidence-panel').before(proofCard);
const $ = selector => document.querySelector(selector);
const escape = text => String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let stage=0, busy=false, plan=null, source='', results=[], startedAt=null;
const versions=['correct','buggy'];
const labels=['Run existing tests','Prepare missing tests','Run new tests on both builds','Apply fix & rerun unchanged tests','Demo complete — reset to replay'];
const headings=['Start with what we already test','Find the missing interaction','Review the cases. Then prove it.','Fix the implementation, keep the tests','One regression. A verified fix.'];
const descriptions=['Three existing checkout tests cover shipping without discounts. Run them against both builds.','The existing suite never combines discounts and shipping eligibility. Choose how to produce the missing cases.','Expected outcomes come from the business requirement. Run these exact cases against the correct and buggy builds.','Switch the shipping basis back to the discounted subtotal. Rerun every original and generated test, without editing their assertions.','The evidence below records what actually ran. Export the results and test spec for your presentation.'];
function update(){
  updateQuest(stage,busy);
  $('#download-plan').disabled=busy||!plan;
  const reproduced=stage>=3&&plan?.tests.find(t=>results.some(r=>r.group==='New'&&r.name===t.name&&r.version==='buggy'&&!r.pass&&!r.error));
  proofCard.hidden=!reproduced;
  if(reproduced){const t=reproduced;const observed=results.findLast(r=>r.group==='New'&&r.name===t.name&&r.version==='buggy');const fixed=results.findLast(r=>r.group==='New'&&r.name===t.name&&r.version==='fixed');proofCard.innerHTML=`<div class="proof-intro"><span class="quest-kicker">THE MOMENT OF PROOF</span><h2>One cart. Two different answers.</h2><p>${money(t.subtotal)} cart − ${money(t.discount)} discount = <strong>${money(t.subtotal-t.discount)}</strong> after discounts.</p></div><div class="proof-values"><div><small>Required shipping</small><strong>${money(t.expectedShipping)}</strong><span>From the business rule</span></div><div class="proof-bug"><small>Buggy build charged</small><strong>${escape(observed.actual)}</strong><span>Confirmed by the test</span></div><div class="${fixed?.pass?'proof-fixed':''}"><small>Fixed build charged</small><strong>${fixed?escape(fixed.actual):'—'}</strong><span>${fixed?(fixed.pass?'Same test · now passing':'Check still failing'):'Run the fix to verify'}</span></div></div>`;}
  $('#primary').innerHTML=escape(labels[stage])+' <span>→</span>';
  $('#primary').disabled=busy||stage===4;
  $('#action-heading').textContent=headings[stage];$('#action-description').textContent=descriptions[stage];
  $('#generation-controls').hidden=stage!==1;
  for(const el of document.querySelectorAll('.step')){const n=Number(el.dataset.step);el.classList.toggle('current',n===Math.min(stage,3));el.classList.toggle('done',n<stage);}
  $('#download-test').disabled=busy||!plan;$('#export').disabled=busy||!results.length;$('#reset').disabled=busy;$('#mode').disabled=busy;
}
function status(message){$('#status').textContent=message;}
function verdict(title,body,warning=false){$('#verdict').hidden=false;$('#verdict').className='verdict'+(warning?' warning':'');$('#verdict').innerHTML=`<span class="verdict-icon">${warning?'!':'✓'}</span><div><strong>${escape(title)}</strong><p>${escape(body)}</p></div>`;}
function renderEvidence(){
  const groups=plan?[...baseline.map(t=>({...t,group:'Existing'})),...plan.tests.map(t=>({...t,group:'New'}))]:baseline.map(t=>({...t,group:'Existing'}));
  const columns=results.some(r=>r.version==='fixed')?['correct','buggy','fixed']:versions;
  let html='<div class="table-wrap"><table><thead><tr><th>Test case / expected shipping</th>'+columns.map(v=>`<th>${v==='correct'?'Correct build':v==='buggy'?'Buggy build':'Fixed build'}</th>`).join('')+'</tr></thead><tbody>';
  for(const t of groups){html+=`<tr><td><strong>${escape(t.name)}</strong><small>${escape(t.group)} · ${money(t.subtotal)} − ${money(t.discount)} → shipping ${money(t.expectedShipping)}<br>${escape(t.reason)}</small></td>`;for(const version of columns){const r=results.findLast(r=>r.name===t.name&&r.group===t.group&&r.version===version);html+=r?`<td><span class="result ${r.error?'error':r.pass?'pass':'fail'}">${r.error?'! ERROR':r.pass?'✓ PASS':'× FAIL'}</span><span class="actual">${r.error?escape(r.error):'actual '+escape(r.actual)}</span></td>`:'<td><span class="actual">Not run</span></td>'; }html+='</tr>';}
  html+='</tbody></table></div>';
  if(plan)html+=`<p class="source-note"><strong>${escape(source)}</strong> · ${escape(plan.summary)}</p><details class="source-note"><summary>Inspect generated Playwright assertions</summary><pre style="overflow:auto;font-size:10px">${escape(playwrightSpec(plan.tests))}</pre></details>`;
  $('#evidence').innerHTML=html;
  $('#source-label').textContent=source||'EXISTING SUITE';
}
async function loadFrame(version){
  const frame=document.createElement('iframe');
  const ready=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Checkout did not load within 8 seconds.')),8000);frame.onload=()=>{clearTimeout(timer);resolve();};frame.onerror=()=>{clearTimeout(timer);reject(new Error('Checkout failed to load.'));};});
  frame.src='cart.html?version='+version;$('#runner-container').append(frame);
  try{await ready;if(frame.contentDocument.body.dataset.ready!=='true')throw new Error('Checkout module did not initialise.');return frame;}catch(error){frame.remove();throw error;}
}
async function runCases(cases,builds,group){
  for(const version of builds){let frame;try{frame=await loadFrame(version);const doc=frame.contentDocument;for(const t of cases){status(`Running ${group.toLowerCase()} case on ${version}: ${t.name}`);doc.querySelector('#subtotal').value=String(t.subtotal/100);doc.querySelector('#discount').value=String(t.discount/100);doc.querySelector('button').click();const actual=doc.querySelector('[data-testid="shipping"]').textContent;const error=doc.querySelector('#error').textContent;results.push({name:t.name,group,version,expected:money(t.expectedShipping),actual,pass:!error&&actual===money(t.expectedShipping),error:error||null,input:{subtotal:t.subtotal,discount:t.discount},at:new Date().toISOString(),domSnapshot:doc.querySelector('.receipt').outerHTML});renderEvidence();await new Promise(resolve=>setTimeout(resolve,90));}}finally{frame?.remove();}}
}
async function generate(){
  const mode=$('#mode').value;
  if(mode==='prepared'){plan=validatePlan(structuredClone(prepared));source='Prepared demo · generated by Codex during build';}
  else if(mode==='import'){plan=validatePlan(JSON.parse($('#import-json').value));source='Imported cases · supplied by presenter';}
  else{status('Generating missing tests from the requirement and diff…');const response=await fetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(65000)});const data=await response.json();if(!response.ok){connectionBadge.textContent='AI request failed · retry available';connectionBadge.classList.remove('connected');throw new Error(data.error||'Live generation failed.');}plan=validatePlan(data.plan);source='Live AI · '+data.model;connectionBadge.textContent='Live AI verified';connectionBadge.classList.add('connected');}
  results=results.filter(r=>r.group==='Existing');stage=2;renderEvidence();$('#verdict').hidden=true;status('Cases ready for review. No generated tests have run yet.');
}
$('#primary').addEventListener('click',async()=>{
  if(busy)return;busy=true;update();
  try{
    if(stage===0){startedAt=new Date().toISOString();results=[];await runCases(baseline,versions,'Existing');if(results.some(r=>!r.pass))throw new Error('Baseline did not pass. Inspect the results before continuing.');$('#baseline-count').textContent=`${baseline.length}/${baseline.length}`;verdict('All green. But what did we miss?','The same three tests pass on both builds. None applies a discount; the changed behavior is untested.');stage=1;status('Both builds passed the existing suite. Find the coverage gap next.');}
    else if(stage===1){await generate();}
    else if(stage===2){results=results.filter(r=>r.group!=='New');await runCases(plan.tests,versions,'New');const correct=results.filter(r=>r.group==='New'&&r.version==='correct');const buggy=results.filter(r=>r.group==='New'&&r.version==='buggy');const caught=correct.every(r=>r.pass)&&buggy.some(r=>!r.pass&&!r.error)&&!buggy.some(r=>r.error);if(caught){$('#caught-count').textContent='1';verdict('Regression reproduced. The test distinguishes the builds.',`${buggy.filter(r=>!r.pass).length} new case(s) fail on the buggy build; every new case passes on the correct build. Shipping eligibility uses the pre-discount subtotal.`,true);stage=3;status('The assertion is unchanged between builds. Ready to verify the fix.');}else{stage=1;verdict('The cases have not proved the regression.','A useful test must pass on the correct build and fail on the buggy build. Review the expected outcomes or choose another set of cases.',true);status('No validated regression found. Review or regenerate the cases.');}}
    else if(stage===3){$('#checkout-preview').src='cart.html?version=fixed';$('#build-label').textContent='Fixed build';$('#build-label').className='pill success';await runCases(baseline,['fixed'],'Existing');await runCases(plan.tests,['fixed'],'New');const fixed=results.filter(r=>r.version==='fixed');if(fixed.every(r=>r.pass)){stage=4;verdict('Fix verified against the unchanged tests.',`All ${fixed.length} checks pass on the corrected implementation. The original buggy-build failures remain in the evidence. This verifies the demonstrated rule, not the entire release.`);status('Demo complete. Download the evidence and generated Playwright spec.');}else{verdict('Fix not verified.','At least one check still fails. Inspect the evidence before making any claim.',true);status('Verification failed. Review the results.');}}
  }catch(error){status(error.message||String(error));verdict('This step could not complete.',error.message||String(error),true);}finally{busy=false;update();}
});
$('#mode').addEventListener('change',()=>{$('#import-area').hidden=$('#mode').value!=='import';$('#mode-help').textContent=({'prepared':'Prepared cases are loaded instantly. The browser checks still run for real.','live':'Sends this demo requirement, diff, and existing cases to the configured OpenAI model.','import':'Copy the prompt into Codex or Astra, then paste its JSON response. Imported text is validated as data, never executed.'})[$('#mode').value];});
$('#reset').addEventListener('click',()=>{stage=0;plan=null;source='';results=[];startedAt=null;$('#baseline-count').textContent='—';$('#caught-count').textContent='—';$('#checkout-preview').src='cart.html?version=buggy';$('#build-label').textContent='Buggy build';$('#build-label').className='pill danger';$('#evidence').innerHTML='<div class="empty"><strong>Every claim starts with a test.</strong><p>Run the baseline to begin again.</p></div>';$('#verdict').hidden=true;$('#source-label').textContent='NO RUN YET';status('Ready when you are.');update();});
function download(name,value,type){const url=URL.createObjectURL(new Blob([value],{type}));const anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#download-test').addEventListener('click',()=>download('releaseradar.generated.spec.js',playwrightSpec(plan.tests),'text/javascript'));
$('#download-plan').addEventListener('click',()=>download('releaseradar-test-cases.json',JSON.stringify(plan,null,2),'application/json'));
$('#export').addEventListener('click',()=>download('releaseradar-evidence.json',JSON.stringify({app:'ReleaseRadar',scenario:'Seeded checkout shipping regression',startedAt,exportedAt:new Date().toISOString(),source,plan,results,scope:'DOM-based browser checks in same-origin iframes; not a Playwright run. Exported Playwright spec runs separately.'},null,2),'application/json'));
$('#guide').addEventListener('click',()=>$('#notes').showModal());$('#close-notes').addEventListener('click',()=>$('#notes').close());
$('#present').addEventListener('click',()=>{const on=document.body.classList.toggle('presenting');$('#present').textContent=on?'↙ Exit presentation':'↗ Presentation view';});
async function copy(text,button){try{await navigator.clipboard.writeText(text);const prior=button.textContent;button.textContent='Copied';setTimeout(()=>button.textContent=prior,1500);}catch{status('Clipboard unavailable. Use the prompt in the project README.');}}
$('#copy-prompt').addEventListener('click',()=>copy(generationPrompt(),$('#copy-prompt')));
$('#copy-pitch').addEventListener('click',()=>copy('A green test suite only tells us the tests we wrote passed. ReleaseRadar finds the missing test: the same case passes on the correct checkout, fails on a seeded regression, and passes again after the fix. The assertions stay unchanged.',$('#copy-pitch')));
fetch('/api/config').then(r=>r.ok?r.json():null).then(data=>{const option=$('#mode option[value="live"]');option.disabled=!data?.configured;option.textContent=data?.configured?'Live AI · '+data.model:'Live AI · configure local API key to enable';connectionBadge.textContent=data?.configured?'AI key configured · '+data.model:'Prepared / imported cases';connectionBadge.title=data?.configured?'The key is configured. A successful generation will verify API access.':'Live generation is available through the local server; this hosted demo supports prepared and imported cases.';}).catch(()=>{$('#mode option[value="live"]').textContent='Live AI · available with the local server';connectionBadge.textContent='Prepared / imported cases';});
update();
