
// Keep native details semantics, and let CSS animate the content before closing it.
const gallery = document.querySelector('.gallery-disclosure');
const gallerySummary = gallery.querySelector('summary');
const galleryContent = gallery.querySelector('.gallery-content');
gallery.dataset.expanded = String(gallery.open);
gallerySummary.setAttribute('aria-expanded', String(gallery.open));
galleryContent.inert = !gallery.open;
gallerySummary.addEventListener('click', event => {
  event.preventDefault();
  const expand = gallery.dataset.expanded !== 'true';
  if (expand) {
    gallery.open = true;
    galleryContent.getBoundingClientRect(); // Commit the collapsed grid before transitioning.
  }
  gallery.dataset.expanded = String(expand);
  gallerySummary.setAttribute('aria-expanded', String(expand));
  galleryContent.inert = !expand;
});
galleryContent.addEventListener('transitionend', event => {
  if (event.target === galleryContent && event.propertyName === 'grid-template-rows' && gallery.dataset.expanded === 'false') gallery.open = false;
});

// One interruptible scroll path for the navigation, greeting, and in-page links.
let scrollFrame = 0;
function cancelPageScroll() {
  cancelAnimationFrame(scrollFrame);
  scrollFrame = 0;
}
for (const name of ['wheel', 'touchstart']) window.addEventListener(name, cancelPageScroll, { passive: true });
window.addEventListener('keydown', event => {
  if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) cancelPageScroll();
});
document.addEventListener('click', event => {
  const link = event.target.closest('a[href^="#"]');
  if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  const target = document.getElementById(link.hash.slice(1));
  if (!target) return;
  event.preventDefault();
  cancelPageScroll();
  const from = window.scrollY;
  const padding = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
  const to = Math.max(0, Math.min(target.getBoundingClientRect().top + from - padding, document.documentElement.scrollHeight - window.innerHeight));
  const duration = Math.min(1100, 650 + Math.abs(to - from) * .12);
  const started = performance.now();
  if (location.hash !== link.hash) history.pushState(null, '', link.hash);
  document.querySelectorAll('nav a').forEach(item => {
    if (item.hash === link.hash) item.setAttribute('aria-current', 'location');
    else item.removeAttribute('aria-current');
  });
  function step(now) {
    const progress = Math.min(1, (now - started) / duration);
    const eased = progress < .5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
    const destination = Math.max(0, Math.min(target.getBoundingClientRect().top + window.scrollY - padding, document.documentElement.scrollHeight - window.innerHeight));
    window.scrollTo({ top: from + (destination - from) * eased, behavior: 'instant' });
    if (progress < 1) scrollFrame = requestAnimationFrame(step);
    else {
      scrollFrame = 0;
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }
  }
  scrollFrame = requestAnimationFrame(step);
});

const themeToggle = document.querySelector('.theme-toggle');
function updateThemeButton() {
  const dark = document.documentElement.dataset.theme === 'dark';
  themeToggle.setAttribute('aria-pressed', String(dark));
  themeToggle.setAttribute('aria-label', dark ? '切换到浅色模式' : '切换到深色模式');
  document.querySelector('meta[name="theme-color"]').content = dark ? '#131313' : '#ffffff';
}
let themeChanging = false;
themeToggle.addEventListener('click', async () => {
  if (themeChanging) return;
  const root = document.documentElement;
  const theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  const applyTheme = () => {
    root.dataset.theme = theme;
    try { localStorage.setItem('guok-theme', theme); } catch { /* The theme still works without storage. */ }
    updateThemeButton();
  };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return applyTheme();
  themeChanging = true;
  try {
    if (!document.startViewTransition) {
      root.classList.add('theme-fading');
      applyTheme();
      await new Promise(resolve => setTimeout(resolve, 350));
      return;
    }
    root.classList.add('theme-revealing');
    const rect = themeToggle.getBoundingClientRect();
    const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const transition = document.startViewTransition(applyTheme);
    await transition.ready;
    await root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] }, {
      duration: 650, easing: 'cubic-bezier(.4, 0, .2, 1)', pseudoElement: '::view-transition-new(root)'
    }).finished;
    await transition.finished;
  } catch { /* A skipped snapshot still applies the selected theme. */ }
  finally {
    root.classList.remove('theme-revealing');
    root.classList.remove('theme-fading');
    themeChanging = false;
  }
});
updateThemeButton();

const memories = [...document.querySelectorAll('.memory')];
const filterButtons = [...document.querySelectorAll('.filters button')];
filterButtons.forEach(button => button.addEventListener('click', () => {
  filterButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
  memories.forEach(item => { item.hidden = button.dataset.filter !== 'all' && item.dataset.category !== button.dataset.filter; });
  document.querySelector('.convention-note').hidden = !['all', '漫展'].includes(button.dataset.filter);
  document.querySelector('.gallery-count').textContent = `正在展示 ${memories.filter(item => !item.hidden).length} 张切片`;
}));

const lightbox = document.querySelector('.lightbox');
const lightboxImage = document.querySelector('.lightbox-image');
let currentPhoto = 0, visiblePhotos = [];
function displayPhoto(index) {
  currentPhoto = (index + visiblePhotos.length) % visiblePhotos.length;
  const button = visiblePhotos[currentPhoto];
  lightboxImage.src = button.dataset.src;
  lightboxImage.alt = button.querySelector('img').alt;
  document.querySelector('.lightbox-category').textContent = button.dataset.category;
  document.querySelector('.lightbox-counter').textContent = `${currentPhoto + 1} / ${visiblePhotos.length}`;
}
document.querySelectorAll('.memory-open').forEach(button => button.addEventListener('click', () => {
  visiblePhotos = memories.filter(item => !item.hidden).map(item => item.querySelector('.memory-open'));
  displayPhoto(visiblePhotos.indexOf(button));
  lightbox.showModal();
}));
document.querySelector('.lightbox-close').addEventListener('click', () => lightbox.close());
document.querySelector('.lightbox-prev').addEventListener('click', () => displayPhoto(currentPhoto - 1));
document.querySelector('.lightbox-next').addEventListener('click', () => displayPhoto(currentPhoto + 1));
lightbox.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft') { event.preventDefault(); displayPhoto(currentPhoto - 1); }
  if (event.key === 'ArrowRight') { event.preventDefault(); displayPhoto(currentPhoto + 1); }
});
lightbox.addEventListener('click', event => {
  if (event.target !== lightbox) return;
  const rect = lightbox.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) lightbox.close();
});

// Measure the rendered glyphs so the burst preserves wrapping and crossed-out text.
const fragmentTrigger = document.querySelector('.fragment-trigger');
const fragments = document.querySelector('.about-fragments');
const fragmentPanels = [...fragments.querySelectorAll('.fragment-panel')];
fragmentTrigger.addEventListener('click', async () => {
  if (fragmentTrigger.getAttribute('aria-disabled') === 'true') return;
  const expanded = fragmentTrigger.getAttribute('aria-expanded') !== 'true';
  const outgoing = fragmentPanels[expanded ? 0 : 1];
  const incoming = fragmentPanels[expanded ? 1 : 0];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animations = [];
  const dust = document.createElement('div');
  dust.className = 'fragment-dust';
  dust.setAttribute('aria-hidden', 'true');
  dust.inert = true;
  fragmentTrigger.setAttribute('aria-disabled', 'true');
  fragments.setAttribute('aria-busy', 'true');
  try {
    if (!reducedMotion) {
      fragments.append(dust);
      const bounds = dust.getBoundingClientRect();
      const origin = { x: 10 + Math.random() * (bounds.width - 20), y: 32 + Math.random() * outgoing.offsetHeight };
      const energy = .7 + Math.random() * .7;
      const wind = (Math.random() - .5) * 90;
      const walker = document.createTreeWalker(outgoing, NodeFilter.SHOW_TEXT);
      const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'grapheme' });
      const range = document.createRange();
      const particles = document.createDocumentFragment();
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const style = getComputedStyle(node.parentElement);
        for (const { segment, index } of segmenter.segment(node.textContent)) {
          if (!segment.trim()) continue;
          range.setStart(node, index);
          range.setEnd(node, index + segment.length);
          const rect = range.getBoundingClientRect();
          // Complementary cuts keep the whole glyph visible before its shards separate.
          const cut = 25 + Math.random() * 50;
          const shapes = Math.random() < .45 && !/\p{Extended_Pictographic}/u.test(segment) ? [
            `polygon(0 0, 100% 0, 100% ${cut}%, 0 ${100 - cut}%)`,
            `polygon(0 ${100 - cut}%, 100% ${cut}%, 100% 100%, 0 100%)`
          ] : ['none'];
          for (const clipPath of shapes) {
            const particle = document.createElement('span');
            particle.className = 'fragment-particle';
            particle.textContent = segment;
            Object.assign(particle.style, {
              left: `${rect.left - bounds.left}px`, top: `${rect.top - bounds.top}px`,
              font: style.font, lineHeight: `${rect.height}px`, color: style.color,
              textDecoration: style.textDecoration, clipPath
            });
            particles.append(particle);
          }
        }
      }
      dust.append(particles);
      for (const particle of dust.children) {
        const dx = parseFloat(particle.style.left) - origin.x;
        const dy = parseFloat(particle.style.top) - origin.y;
        const angle = Math.atan2(dy, dx) + (Math.random() - .5) * 1.8;
        const impulse = (60 + Math.random() * 170) * energy;
        const vx = Math.cos(angle) * impulse;
        const vy = Math.sin(angle) * impulse * .35 - 35 - Math.random() * 110;
        const gravity = 650 + Math.random() * 450;
        const rotation = (Math.random() - .5) * 540;
        const duration = .7 + Math.random() * .4;
        const shrink = Math.random() * .3;
        const fadeAt = .25 + Math.random() * .25;
        const keyframes = Array.from({ length: 9 }, (_, step) => {
          const progress = step / 8;
          const time = progress * duration;
          return {
            transform: `translate(${vx * time + wind * time * time}px, ${vy * time + .5 * gravity * time * time}px) rotate(${rotation * progress}deg) scale(${1 - shrink * progress})`,
            opacity: progress <= fadeAt ? 1 : (1 - progress) / (1 - fadeAt),
            offset: progress
          };
        });
        animations.push(particle.animate(keyframes, {
          duration: duration * 1000, delay: Math.hypot(dx, dy) * .12 + Math.random() * 140,
          easing: 'linear', fill: 'both'
        }));
      }
    }
    outgoing.setAttribute('aria-hidden', 'true');
    outgoing.inert = true;
    await Promise.all(animations.map(animation => animation.finished));
  } finally {
    dust.remove();
    animations.forEach(animation => animation.cancel());
    incoming.setAttribute('aria-hidden', 'false');
    incoming.inert = false;
    fragmentTrigger.setAttribute('aria-expanded', String(expanded));
    try {
      if (!reducedMotion) {
        const lines = [...incoming.querySelectorAll('p')].map((line, index) => line.animate([
          { opacity: 0, transform: 'translateY(12px)' },
          { opacity: 1, transform: 'translateY(0)' }
        ], { duration: 620, delay: index * 170, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'both' }));
        await Promise.all(lines.map(animation => animation.finished));
        lines.forEach(animation => animation.cancel());
      }
    } finally {
      fragmentTrigger.removeAttribute('aria-disabled');
      fragments.removeAttribute('aria-busy');
    }
  }
});
