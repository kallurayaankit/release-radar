export const exclusions = [
  'Payment processing, tax, inventory and order persistence',
  'Security, accessibility and performance of a real checkout',
  'Other browsers, devices, currencies and production services'
];
export function coverageReport(results, cases) {
  const build = results.some(r => r.version === 'fixed') ? 'fixed' : 'buggy';
  const runs = results.filter(r => r.version === build);
  const observed = cases.map(c => {
    const r = runs.findLast(r => r.name === c.name);
    return {name: c.name, status: !r ? 'Not run' : r.error ? 'Execution error' : r.pass ? 'Passed' : 'Failed'};
  });
  const passed = observed.filter(c => c.status === 'Passed').length;
  return {build, scope:'Seeded checkout shipping rule only. DOM checks in this browser; no whole-release approval.',
    passed, total:cases.length, cases:observed, untested:observed.filter(c => c.status === 'Not run').map(c => c.name),
    exclusions:[...exclusions], decision:observed.some(c=>['Failed','Execution error'].includes(c.status)) ? 'Investigate failures before proceeding' : observed.some(c=>c.status==='Not run') ? 'Collect missing evidence' : 'Listed checks passed; release risks still require review'};
}
const escape = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountCoverage(getState) {
  const panel=document.createElement('section');panel.className='panel coverage-panel';panel.id='coverage-report';panel.style.padding='24px';
  panel.innerHTML=`<div class="panel-heading"><h2>Coverage & remaining risks</h2><span class="pill neutral">Evidence, with boundaries</span></div><div id="coverage-content" aria-live="polite"></div><details><summary>Plan the next testing session</summary><p>Mark follow-up planning tasks complete. These checkboxes do not change test results or certify coverage. Saved in this browser only.</p><div id="coverage-tasks"></div><label for="coverage-notes">Remaining risks / handoff notes</label><textarea id="coverage-notes" rows="3" maxlength="4000" placeholder="What still needs investigation? Who will follow up?" style="width:100%;box-sizing:border-box"></textarea><p id="coverage-save" role="status"></p></details><button class="secondary" id="coverage-download">Download handoff report</button>`;
  document.querySelector('.evidence-panel').after(panel);
  const tasks=['Review one-cent and exact-threshold cases','Plan invalid-input and discount-limit checks','Schedule real integration and accessibility testing','Assign owners to remaining release risks'];
  let saved={notes:'',done:[]};try{const v=JSON.parse(localStorage.getItem('rr-coverage-v1'));if(v&&typeof v.notes==='string'&&Array.isArray(v.done))saved={notes:v.notes.slice(0,4000),done:v.done.filter(n=>Number.isInteger(n)&&n>=0&&n<tasks.length)};}catch{}
  panel.querySelector('#coverage-tasks').innerHTML=tasks.map((t,i)=>`<label style="display:block;margin:12px 0"><input type="checkbox" data-task="${i}" ${saved.done.includes(i)?'checked':''}> ${escape(t)}</label>`).join('');
  const notes=panel.querySelector('#coverage-notes');notes.value=saved.notes;
  const save=()=>{saved={notes:notes.value,done:[...panel.querySelectorAll('[data-task]:checked')].map(el=>Number(el.dataset.task))};try{localStorage.setItem('rr-coverage-v1',JSON.stringify(saved));panel.querySelector('#coverage-save').textContent='Saved locally';}catch{panel.querySelector('#coverage-save').textContent='Storage unavailable. Download the report to retain these notes.';}};
  panel.addEventListener('input',save);
  const report=()=>{const {results,cases}=getState();return {...coverageReport(results,cases),followUp:tasks.map((task,i)=>({task,planningComplete:saved.done.includes(i)})),notes:saved.notes};};
  panel.querySelector('#coverage-download').addEventListener('click',()=>{
    const r=report();const body=['ReleaseRadar testing handoff',new Date().toISOString(),r.scope,`Build: ${r.build}`,`Result: ${r.passed}/${r.total} listed cases passed`,r.decision,'','CHECKS',...r.cases.map(c=>`${c.status}: ${c.name}`),'','NOT COVERED BY THIS RUN',...r.exclusions,'','FOLLOW-UP PLANNING',...r.followUp.map(t=>`${t.planningComplete?'[x]':'[ ]'} ${t.task}`),'','NOTES',r.notes||'None recorded'].join('\n');
    const url=URL.createObjectURL(new Blob([body],{type:'text/plain'}));const a=document.createElement('a');a.href=url;a.download='releaseradar-testing-handoff.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  return {report,render(){const r=report();panel.querySelector('#coverage-content').innerHTML=`<p><strong>${escape(r.decision)}</strong></p><p>${r.passed}/${r.total} listed cases passed on the <strong>${r.build}</strong> build. This is a count of selected cases, not a code-coverage percentage.</p><p>${escape(r.scope)}</p><ul>${r.cases.map(c=>`<li><strong>${escape(c.status)}</strong> — ${escape(c.name)}</li>`).join('')}</ul><h3>Not covered by this run</h3><ul>${r.exclusions.map(x=>`<li>${escape(x)}</li>`).join('')}</ul><p>These are known exclusions, not an exhaustive list of possible risks. A passing case supports only its specific inputs and assertions.</p>`;}};
}
