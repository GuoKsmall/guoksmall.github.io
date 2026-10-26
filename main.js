
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
themeToggle.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('guok-theme', theme); } catch { /* The theme still works without storage. */ }
  updateThemeButton();
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
