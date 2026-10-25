const themeToggle = document.querySelector('.theme-toggle');
function updateThemeButton() {
  const dark = document.documentElement.dataset.theme === 'dark';
  themeToggle.setAttribute('aria-pressed', String(dark));
  themeToggle.setAttribute('aria-label', dark ? '切换到浅色模式' : '切换到深色模式');
  document.querySelector('meta[name="theme-color"]').content = dark ? '#18181b' : '#ffffff';
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
