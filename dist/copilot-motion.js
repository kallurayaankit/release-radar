const scene=document.createElement('div');scene.className='calm-scene';scene.setAttribute('aria-hidden','true');
scene.innerHTML='<div class="calm-depth"><i class="calm-orb sage"></i><i class="calm-orb blue"></i><i class="calm-orb sand"></i><i class="calm-ring"></i></div>';
document.body.prepend(scene);
const depth=scene.firstElementChild;
const actions=document.createElement('div');actions.className='bar-actions';const link=document.querySelector('.bar>a:last-child');link.before(actions);actions.append(link);
const button=document.createElement('button');button.type='button';button.id='background-motion';actions.prepend(button);
const reduced=matchMedia('(prefers-reduced-motion: reduce)');let preference=true;
try{preference=localStorage.getItem('releaseradar-calm-motion')!=='off';}catch{}
function update(){const active=preference&&!reduced.matches;document.documentElement.dataset.calmMotion=active?'on':'off';button.textContent=active?'Pause background':'Background paused';button.setAttribute('aria-pressed',String(active));button.setAttribute('aria-label',active?'Pause background motion':'Enable background motion');button.disabled=reduced.matches;button.title=reduced.matches?'Motion is off to respect your device’s reduced-motion preference.':'';}
button.onclick=()=>{preference=!preference;try{localStorage.setItem('releaseradar-calm-motion',preference?'on':'off');}catch{}update();};
reduced.addEventListener('change',update);update();
let pending=false,x=0,y=0;
function paint(){pending=false;if(document.documentElement.dataset.calmMotion!=='on')return;const scroll=Math.min(scrollY,1800)/1800;depth.style.setProperty('--scene-x',`${x*18}px`);depth.style.setProperty('--scene-y',`${y*12-scroll*36}px`);depth.style.setProperty('--scene-rx',`${-y*2}deg`);depth.style.setProperty('--scene-ry',`${x*3}deg`);}
function schedule(){if(!pending){pending=true;requestAnimationFrame(paint);}}
addEventListener('pointermove',event=>{if(event.pointerType!=='mouse')return;x=event.clientX/innerWidth-.5;y=event.clientY/innerHeight-.5;schedule();},{passive:true});
addEventListener('scroll',schedule,{passive:true});
document.addEventListener('visibilitychange',()=>{scene.style.visibility=document.hidden?'hidden':'';});
