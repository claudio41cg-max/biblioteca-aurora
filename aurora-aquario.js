/* O vidro e a decoração ficam parados. Cada peixe reutiliza sua própria silhueta. */
(() => {
  'use strict';
  const base = './assets/customizador/';
  const motion = '(prefers-reduced-motion: no-preference)';
  const visible = typeof IntersectionObserver === 'function' && new IntersectionObserver(entries => {
    for (const entry of entries) entry.target.toggleAttribute('data-em-pausa', !entry.isIntersecting);
  });

  class Aquarium extends HTMLElement {
    connectedCallback() { if (visible) visible.observe(this); }
    disconnectedCallback() { if (visible) visible.unobserve(this); }
  }
  customElements.define('aurora-aquario', Aquarium);

  function create(image) {
    const tank = document.createElement('aurora-aquario');
    tank.className = 'aquario-vivo';
    const picture = document.createElement('picture');
    const clean = document.createElement('source');
    clean.media = motion;
    clean.srcset = base + 'aquario-sem-peixes.webp';
    picture.append(clean,image);
    tank.append(picture);

    function showOriginal() {
      clean.remove();
      tank.classList.add('aquario-estatico');
    }
    image.addEventListener('error',showOriginal,{once:true});
    for (const species of ['bandeira','palhaco','neon']) {
      const fish = document.createElement('span');
      fish.className = 'aquario-peixe peixe-' + species;
      fish.setAttribute('aria-hidden','true');
      const sprite = base + 'peixe-' + species + '.webp';
      const body = document.createElement('img');
      body.alt = '';
      body.draggable = false;
      body.addEventListener('error',showOriginal,{once:true});
      body.src = sprite;
      fish.style.setProperty('--sprite','url("' + sprite + '")');
      fish.append(body);
      tank.append(fish);
    }
    return tank;
  }
  window.AuroraAquario = {create};
})();
