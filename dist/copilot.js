import {validateQaInput,qualifyQaReport,qaExample,qaExampleReport} from './copilot-core.js';
const $=s=>document.querySelector(s);const fields=Object.keys(qaExample);let saved=null,busy=false,enabled=false;
const read=()=>Object.fromEntries(fields.map(k=>[k,$('#'+k).value]));
function el(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;}
function setBusy(value){busy=value;for(const control of $('#qa-form').elements)control.disabled=value;$('#analyze').disabled=value||!enabled;$('#export-report').disabled=value||!saved;$('#analyze').textContent=value?'Reviewing your release…':'Analyze release ↗';}
function snapshotMatches(html,selector){
  if(!html)return 'Not checked: no HTML supplied.';
  try{
    // Parsing in an inert template prevents script execution and resource loads.
    const template=document.createElement('template');template.innerHTML=html;
    const count=template.content.querySelectorAll(selector).length;
    return count===1?'1 match in supplied HTML. Confirm intent, visibility and behavior in a real browser.':count===0?'0 matches in supplied HTML. Do not apply this candidate.':`${count} matches in supplied HTML. Ambiguous; do not apply without refinement.`;
  }catch{return 'Invalid CSS selector; cannot verify.';}
}
function render(envelope,input){
  saved={...envelope,input,report:qualifyQaReport(envelope.report,input)};
  saved.selectorChecks=saved.report.selectors.map(s=>({...s,check:snapshotMatches(input.html,s.candidate)}));
  const target=$('#report-content');target.replaceChildren();const report=saved.report;
  $('#report-meta').className='muted';$('#report-meta').textContent=`${saved.source==='sample'?'SAMPLE · prepared illustration':'LIVE AI · '+saved.model} · ${new Date(saved.generatedAt).toLocaleString()} · Revision: ${input.revision||'not supplied'} · Results are user-reported, not independently verified.`;
  const decision=el('div',undefined,'decision '+report.recommendation.decision);decision.append(el('span','RELEASE RECOMMENDATION','badge'),el('strong',({hold:'Hold release',review:'More review needed',conditional:'Conditional recommendation'})[report.recommendation.decision]),el('p',report.recommendation.rationale));const conditions=el('ul');report.recommendation.conditions.forEach(x=>conditions.append(el('li',x)));decision.append(conditions);target.append(decision,el('p',report.summary));
  function group(title,items,draw){target.append(el('h2',title,'subheading'));if(!items.length)target.append(el('p','No findings supplied in this category. This is not proof of coverage.','muted'));for(const item of items){const card=el('article');draw(card,item);target.append(card);}}
  group('01 / Risk report',report.risks,(c,r)=>c.append(el('span',r.severity,'badge'),el('h3',r.title),el('p','Evidence · '+r.evidence),el('p','Impact · '+r.impact),el('p','Next action · '+r.mitigation)));
  group('02 / Test plan',report.tests,(c,t)=>c.append(el('span',t.priority+' · '+t.level+' · NOT EXECUTED','badge'),el('h3',t.title),el('p','Steps · '+t.steps),el('p','Expected · '+t.expected),el('p','Risk covered · '+t.risk)));
  group('03 / Selector repair suggestions',saved.selectorChecks,(c,s)=>{c.append(el('p','Original · '+s.original),el('code',s.candidate),el('p',s.reason),el('p',s.check));const copy=el('button','Copy candidate');copy.onclick=async()=>{try{await navigator.clipboard.writeText(s.candidate);copy.textContent='Copied';}catch{copy.textContent='Select the code above to copy';}};c.append(copy);});
  target.append(el('h2','04 / Unknowns & follow-up','subheading'));const list=el('ul');(report.unknowns.length?report.unknowns:['No additional unknowns listed by the model. Review scope and evidence before deciding.']).forEach(x=>list.append(el('li',x)));target.append(list);$('#export-report').disabled=false;
}
function invalidate(){if(saved){$('#report-meta').classList.add('stale');$('#report-meta').textContent='BRIEF CHANGED · This report describes the previous inputs. Analyze again for an updated recommendation. Export retains the original brief.';}}
$('#qa-form').addEventListener('input',invalidate);
$('#example').onclick=()=>{for(const k of fields)$('#'+k).value=qaExample[k];invalidate();$('#qa-status').textContent='Sample brief loaded. Analyze for a live response or view the prepared sample report.';};
$('#sample-report').onclick=()=>{for(const k of fields)$('#'+k).value=qaExample[k];render({report:qaExampleReport,source:'sample',model:null,generatedAt:new Date().toISOString()},structuredClone(qaExample));$('#qa-status').textContent='Prepared sample report shown. No AI request or test execution occurred.';};
$('#qa-form').onreset=()=>{saved=null;$('#report-content').replaceChildren(el('p','Start a new release brief.','muted'));$('#report-meta').textContent='A report will appear here.';$('#report-meta').className='muted';$('#export-report').disabled=true;$('#qa-status').textContent='Brief and report cleared.';};
$('#qa-form').onsubmit=async e=>{e.preventDefault();if(busy)return;let input;try{input=validateQaInput(read());}catch(error){$('#qa-status').textContent=error.message;return;}setBusy(true);$('#qa-status').textContent='Analyzing supplied context. Usually takes 15–45 seconds…';try{const response=await fetch('/api/copilot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(70000)});let result;try{result=await response.json();}catch{throw Error('Server returned an unreadable response. Your brief is preserved.');}if(!response.ok)throw Error(result.error||'Analysis failed. Retry shortly.');render(result,input);$('#qa-status').textContent='Review ready. Proposed tests have not been executed. Review selector intent before changing tests.';}catch(error){$('#qa-status').textContent='Analysis failed: '+error.message+' No sample results were substituted.';}finally{setBusy(false);}};
$('#export-report').onclick=()=>{if(!saved)return;const blob=new Blob([JSON.stringify({version:'qa-copilot-v1',...saved},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=el('a');a.href=url;a.download='releaseradar-qa-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
fetch('/api/config').then(r=>r.json()).then(c=>{enabled=Boolean(c.copilotConfigured);$('#connection').textContent=enabled?'Live AI ready · '+c.model:'Live AI unavailable · sample available';$('#analyze').disabled=!enabled;}).catch(()=>{$('#connection').textContent='Server unavailable · sample available';});
