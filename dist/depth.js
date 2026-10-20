export function mountDepth(){
  const art=document.querySelector('.zen-art');art.className='zen-art radar-scene';
  art.innerHTML=`<div class="radar-object"><div class="radar-plinth"></div><div class="radar-dial"><div class="radar-scan"></div><i class="radar-grid ring-one"></i><i class="radar-grid ring-two"></i><i class="radar-grid ring-three"></i><i class="radar-axis axis-one"></i><i class="radar-axis axis-two"></i><b class="radar-core"></b><b class="radar-signal signal-one"></b><b class="radar-signal signal-two"></b><span class="dial-label">RELEASE / RADAR</span></div><div class="floating-token token-check">✓</div><div class="floating-token token-gap">?</div><span class="radar-object-shadow"></span></div><span class="radar-art-caption">LOOK BENEATH THE GREEN.</span>`;
}
