const titles = ['Observer', 'Pattern seeker', 'Test architect', 'Bug hunter', 'Regression guardian'];
const messages = ['Your investigation starts here.', 'The baseline is green. Look closer.', 'A hypothesis is ready. Put it to the test.', 'You caught it. Now close the loop.', 'Evidence collected. Fix verified.'];
const stamps = ['Baseline established','Cases prepared','Regression proved','Fix verified'];
let lastStage = 0;
export function mountQuest() {
  document.querySelector('.eyebrow').textContent='THE REGRESSION HUNT · CHAPTER 01';
  document.querySelector('.heading h1').innerHTML='Find the flaw.<br><em>Earn the confidence.</em>';
  document.querySelector('.heading p').textContent='One hidden bug. Four small steps. Proof that your fix works.';
  const art = document.createElement('div');
  art.className='zen-art';art.setAttribute('aria-hidden','true');
  art.innerHTML=`<svg viewBox="0 0 400 235" fill="none"><defs><linearGradient id="hill" x1="120" y1="85" x2="260" y2="235" gradientUnits="userSpaceOnUse"><stop stop-color="#b6c3a1"/><stop offset="1" stop-color="#718568"/></linearGradient></defs><circle cx="274" cy="79" r="37" fill="#c16b4d"/><circle cx="274" cy="79" r="49" stroke="#c16b4d" stroke-opacity=".18"/><path d="M20 193Q100 58 191 145T387 130V228H20Z" fill="#dbe0cd"/><path d="M54 225Q174 30 280 180Q322 226 390 191V235H54Z" fill="url(#hill)"/><path d="M10 213Q140 133 270 218T405 213M0 222Q140 147 265 227T405 223M5 231Q140 161 263 236T407 234" stroke="#f2f1e6" stroke-width="2" opacity=".5"/><path d="M173 135Q182 96 224 100Q268 105 264 146Q262 176 239 185" stroke="#314a38" stroke-width="7" stroke-linecap="round"/><path d="M173 135Q164 165 187 182" stroke="#314a38" stroke-width="4" stroke-linecap="round"/><circle cx="218" cy="143" r="3" fill="#314a38"/><path d="M218 143L244 118" stroke="#314a38" stroke-width="1.5"/><circle cx="244" cy="118" r="6" fill="#e8bc68"/><path d="M323 30v23m-11-12h23" stroke="#9caa88" stroke-width="1"/><circle cx="111" cy="85" r="2" fill="#b5bfa0"/></svg><span>Small steps. Lasting confidence.</span>`;
  const heading=document.querySelector('.heading');heading.append(art);
  const quest=document.createElement('section');quest.className='quest-progress';quest.setAttribute('aria-label','Investigation progress');
  quest.innerHTML=`<div class="rank-seal" aria-hidden="true"><svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M24 10l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" fill="none" stroke="currentColor" stroke-width="1.2"/></svg></div><div class="rank-copy"><span class="quest-kicker">YOUR PATH</span><strong id="quest-rank">Observer</strong><span id="quest-message">Your investigation starts here.</span></div><div class="xp-area"><div class="xp-label"><span id="quest-count">0 of 4 milestones</span><strong id="quest-xp">0 / 100 XP</strong></div><div class="xp-track" role="progressbar" aria-label="Demo progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span id="xp-fill"></span></div><small>XP tracks demo progress, not release confidence.</small></div>`;
  heading.after(quest);
  const descriptions=['See what passes','Discover what is missing','Make the bug visible','Keep the assertions'];
  document.querySelectorAll('.step').forEach((el,i)=>{const title=el.textContent.trim().replace(/^\d\s*/,'');el.innerHTML=`<span class="step-number">0${i+1}</span><div><strong>${title}</strong><small>${descriptions[i]}</small></div><b class="step-check" aria-hidden="true"></b>`;});
  const collection=document.createElement('section');collection.className='milestone-collection';collection.innerHTML=`<div class="collection-title"><span class="quest-kicker">EVIDENCE, EARNED</span><h2>Your field notes</h2><p>Four milestones. Each backed by an action.</p></div><div class="stamp-grid">${stamps.map((name,i)=>`<div class="stamp" data-stamp="${i}"><span class="stamp-icon" aria-hidden="true">${['◎','◇','⌁','✧'][i]}</span><strong>${name}</strong><small>Not earned yet</small></div>`).join('')}</div>`;
  document.querySelector('.evidence-panel').after(collection);
  const celebration=document.createElement('div');celebration.className='quest-finish';celebration.hidden=true;celebration.id='quest-finish';celebration.innerHTML='<span class="finish-flower" aria-hidden="true">✧</span><div><span class="quest-kicker">CHAPTER COMPLETE</span><h2>A little more certainty.</h2><p>You found the missing test and verified the fix. Your evidence is ready to take with you.</p></div><button class="secondary" id="finish-export">Take your field notes ↗</button>';
  collection.after(celebration);
  document.querySelector('#finish-export').addEventListener('click',()=>document.querySelector('#export').click());
  const chip=document.createElement('div');chip.className='sidebar-chapter';chip.innerHTML='<span class="quest-kicker">CURRENT CHALLENGE</span><strong>The checkout paradox</strong><p>When green tests hide<br>a costly assumption.</p><span class="chapter-label">01 / REGRESSION HUNT</span>';
  document.querySelector('.sidebar-bottom').before(chip);
}
export function updateQuest(stage,busy) {
  document.body.dataset.questStage=String(stage);
  document.body.classList.toggle('quest-running',busy);
  document.querySelector('#quest-rank').textContent=titles[stage];
  document.querySelector('#quest-message').textContent=busy?'Examining the evidence…':messages[stage];
  document.querySelector('#quest-count').textContent=`${stage} of 4 milestones`;
  document.querySelector('#quest-xp').textContent=`${stage*25} / 100 XP`;
  document.querySelector('#xp-fill').style.width=`${stage*25}%`;
  document.querySelector('.xp-track').setAttribute('aria-valuenow',String(stage*25));
  document.querySelectorAll('.step').forEach((el,i)=>{el.querySelector('.step-check').textContent=i<stage?'✓':'';if(i===stage)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});
  document.querySelectorAll('.stamp').forEach((el,i)=>{el.classList.toggle('earned',i<stage);el.querySelector('small').textContent=i<stage?'Earned · +25 XP':'Not earned yet';});
  document.querySelector('#quest-finish').hidden=stage!==4;
  document.querySelector('#finish-export').disabled=busy;
  if(stage>lastStage){const panel=document.querySelector('.quest-progress');panel.classList.remove('milestone-pop');void panel.offsetWidth;panel.classList.add('milestone-pop');}
  lastStage=stage;
}
