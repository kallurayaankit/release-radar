const reduced = matchMedia('(prefers-reduced-motion: reduce)');
import './galaxy.js';
const motion = document.createElement('button');
motion.className = 'lux-motion';
motion.type = 'button';
let enabled = !reduced.matches;
let frame = 0, previousScroll = scrollY, impulse = 0, currentImpulse = 0;
let previousTime = 0;
function update() {
  document.documentElement.dataset.luxMotion = enabled ? 'on' : 'off';
  motion.textContent = enabled ? '✧ Motion on' : '✧ Motion off';
  motion.setAttribute('aria-label', enabled ? 'Pause decorative motion' : 'Enable decorative motion');
  motion.setAttribute('aria-pressed', String(enabled));
  if (typeof requestWobble === 'function') requestWobble();
}
motion.onclick = () => { enabled = !enabled; update(); };
reduced.addEventListener('change', () => { enabled = !reduced.matches; update(); });
update();
document.body.append(motion);

// Scroll velocity adds a brief spring; position gives each section its own depth.
// Only transform painted surfaces: layout, focus, dialogs and fixed controls stay stable.
function requestWobble() {
  if (document.readyState === 'loading') return;
  if (!frame) frame = requestAnimationFrame(paintWobble);
}
function paintWobble(time) {
  frame = 0;
  const active = enabled && !reduced.matches;
  const dt = Math.min(40, previousTime ? time - previousTime : 16);
  previousTime = time;
  currentImpulse += (impulse - currentImpulse) * (1 - Math.exp(-dt / 90));
  impulse *= Math.exp(-dt / 160);
  const mobile = innerWidth < 600 ? .45 : 1;
  const sway = active ? Math.sin(scrollY / 290) * mobile : 0;
  const push = active ? currentImpulse * mobile : 0;
  const root = document.documentElement.style;
  
  
  
  root.setProperty('--galaxy-x', `${(-sway * 24 - push * .3).toFixed(2)}px`);
  const surfaces = document.querySelectorAll('.radar-scene');
  surfaces.forEach((element, index) => {
    element.classList.add('scroll-depth');
    if (!active) {
      element.style.removeProperty('--wobble');
      return;
    }
    const rect = element.getBoundingClientRect();
    if (rect.bottom < -100 || rect.top > innerHeight + 100) return;
    const position = Math.max(-1, Math.min(1, (rect.top + rect.height / 2 - innerHeight / 2) / innerHeight));
    const wave = Math.sin(scrollY / 250 + index * .8);
    const pitch = (position * 3 + currentImpulse * .08) * mobile;
    const roll = (wave * 1.25 + currentImpulse * .035) * mobile;
    const lift = wave * 5 * mobile;
    element.style.setProperty('--wobble', `perspective(1400px) rotateX(${pitch.toFixed(3)}deg) rotateY(${(wave * 1.8 * mobile).toFixed(3)}deg) rotateZ(${roll.toFixed(3)}deg) translateY(${lift.toFixed(3)}px)`);
  });
  if (active && (Math.abs(impulse) > .02 || Math.abs(currentImpulse) > .02)) {
    frame = requestAnimationFrame(paintWobble);
  }
}
addEventListener('scroll', () => {
  const delta = scrollY - previousScroll;
  previousScroll = scrollY;
  impulse = Math.max(-18, Math.min(18, impulse + delta * .12));
  requestWobble();
}, {passive:true});
addEventListener('resize', requestWobble, {passive:true});
addEventListener('load', requestWobble, {once:true});
requestWobble();
