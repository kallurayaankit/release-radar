const galaxy = document.createElement('div');
galaxy.className = 'galaxy';
galaxy.setAttribute('aria-hidden', 'true');
galaxy.innerHTML = `<div class="galaxy-depth"><div class="nebula nebula-violet"></div><div class="nebula nebula-blue"></div><div class="galactic-band"></div><div class="galaxy-stars"></div><div class="galaxy-planet planet-amber"><i></i></div><div class="galaxy-planet planet-ice"></div><div class="galaxy-orbit"></div><div class="galaxy-comet"></div></div>`;
const stars = galaxy.querySelector('.galaxy-stars');
// Fixed seed keeps the sky consistent across visits and screenshots.
let seed = 43;
const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
for (let i = 0; i < 170; i++) {
  const star = document.createElement('i');
  const size = i % 17 === 0 ? 4 : 1 + random() * 1.5;
  star.className = i % 17 === 0 ? 'galaxy-star bright' : 'galaxy-star';
  star.style.cssText = `left:${random()*100}%;top:${random()*100}%;width:${size}px;height:${size}px;--delay:${-random()*9}s;--light:${.3+random()*.6}`;
  stars.append(star);
}
document.body.prepend(galaxy);
// Stop background animation work while the tab is hidden.
function pauseHiddenSky() { document.documentElement.dataset.skyPaused = String(document.hidden); }
document.addEventListener('visibilitychange', pauseHiddenSky);
pauseHiddenSky();
