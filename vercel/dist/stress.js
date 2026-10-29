import {runStress,generateCorpus} from './stress-core.js';
const section=document.createElement('section');
section.className='challenge stress-lab';section.id='stress-lab';
section.innerHTML=`<div class="eyebrow">REPRODUCIBLE EVIDENCE · NO AI REQUIRED</div><h2>Go beyond the happy path.</h2><p>Probe thousands of prices and discounts. Verify the controls. See exactly which seeded defects the checks detect.</p><div class="stress-inputs"><label>Replay seed<input id="stress-seed" type="number" min="0" max="4294967295" step="1" value="20261020"></label><label>Generated cases<select id="stress-count"><option value="1000">1,000</option><option value="5000" selected>5,000</option><option value="20000">20,000</option></select></label><button id="stress-run" class="primary">Run stress suite</button><button id="stress-export" class="secondary" disabled>Download stress report</button></div><p id="stress-status" role="status">Ready. Includes 36 boundary cases and 10 invalid-input checks per control build.</p><div id="stress-results"></div><p class="challenge-scope">Calculation checks, separate from the browser demo above. Three hand-seeded defects; a pass is not proof that a release is safe. The same seed and engine version reproduce the same cases.</p>`;
document.querySelector('.page-footer').before(section);
const nav=document.createElement('button');nav.className='nav';nav.textContent='Stress lab';nav.onclick=()=>{section.scrollIntoView({behavior:'auto',block:'start'});$('#stress-seed').focus({preventScroll:true});};
document.querySelector('.sidebar-bottom').before(nav);
const $=s=>section.querySelector(s);let report=null;
$('#stress-run').onclick=async()=>{
  const seed=Number($('#stress-seed').value),count=Number($('#stress-count').value);
  report=null;$('#stress-export').disabled=true;$('#stress-results').replaceChildren();
  if(!$('#stress-seed').value.trim()){ $('#stress-status').textContent='Enter a replay seed.';return;}
  $('#stress-run').disabled=true;$('#stress-status').textContent='Running reference, invariant, and defect checks…';
  await new Promise(r=>setTimeout(r,30));
  try{
    const result=runStress({seed,count});
    const corpus=JSON.stringify(generateCorpus(seed,count));
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(corpus));
    report={...result,corpusSha256:Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join(''),createdAt:new Date().toISOString()};
    $('#stress-status').textContent=`${result.caseCount.toLocaleString()} cases · controls ${result.controlsPass?'passed':'failed'} · ${result.detected}/3 seeded defects detected · ${result.verdict}`;
    for(const r of [...result.controls,...result.mutants]){
      const card=document.createElement('article');card.className='stress-result';
      const heading=document.createElement('h3');heading.textContent=`${r.version} — ${r.status||(!r.failures&&!r.errors?'passed':'failed')}`;
      const text=document.createElement('p');text.textContent=`${r.failures} mismatches · ${r.errors} runner errors`;
      card.append(heading,text);
      if(r.witness){const details=document.createElement('details'),summary=document.createElement('summary'),pre=document.createElement('pre');summary.textContent='Inspect first counterexample';pre.textContent=JSON.stringify(r.witness,null,2);details.append(summary,pre);card.append(details);}
      $('#stress-results').append(card);
    }
    $('#stress-export').disabled=false;
  }catch(error){$('#stress-status').textContent=error.message;}
  finally{$('#stress-run').disabled=false;}
};
$('#stress-export').onclick=()=>{
  if(!report)return;
  const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=`releaseradar-stress-${report.seed}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
