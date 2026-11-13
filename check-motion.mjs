import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const element = () => ({
  listeners: {}, attributes: {},
  addEventListener(name, callback) { this.listeners[name] = callback; },
  setAttribute(name, value) { this.attributes[name] = value; },
  removeAttribute(name) { delete this.attributes[name]; },
  hasAttribute(name) { return name in this.attributes; }
});
const summary = element();
const content = { ...element(), getBoundingClientRect: () => ({ height: 0 }) };
const gallery = { open: false, dataset: {}, querySelector: selector => selector === 'summary' ? summary : content };
const targets = Object.fromEntries(['about', 'contact'].map((id, index) => [id, {
  ...element(), getBoundingClientRect: () => ({ top: 1400 + index * 2000 - window.scrollY }),
  focus() { this.focused = true; }
}]));
const navigation = ['about', 'contact'].map(id => ({ ...element(), hash: '#' + id }));
const document = {
  ...element(), documentElement: { scrollHeight: 6000 },
  querySelector: () => gallery, querySelectorAll: () => navigation,
  getElementById: id => targets[id]
};
let now = 0, nextFrame = 0;
const frames = new Map();
const window = { ...element(), scrollY: 0, innerHeight: 800, scrollTo({ top }) { this.scrollY = top; } };
const location = { hash: '' };
const context = {
  document, window, location,
  getComputedStyle: () => ({ scrollPaddingTop: '120px' }),
  performance: { now: () => now },
  history: { pushState(a, b, hash) { location.hash = hash; } },
  requestAnimationFrame(callback) { frames.set(++nextFrame, callback); return nextFrame; },
  cancelAnimationFrame(id) { frames.delete(id); }
};
const source = readFileSync(new URL('./main.js', import.meta.url), 'utf8').split('const themeToggle =')[0];
vm.runInNewContext(source, context);
const tick = time => {
  now = time;
  const callbacks = [...frames.values()];
  frames.clear();
  callbacks.forEach(callback => callback(time));
};
const toggle = () => summary.listeners.click({ preventDefault() {} });
const transitionEnd = () => content.listeners.transitionend({ target: content, propertyName: 'grid-template-rows' });

assert.equal(content.inert, true);
toggle();
assert.equal(gallery.open, true);
assert.equal(content.inert, false);
toggle();
assert.equal(gallery.open, true, 'Native details must stay open while collapsing');
assert.equal(content.inert, true);
toggle();
transitionEnd();
assert.equal(gallery.open, true, 'A reversed close must not hide the reopened gallery');
toggle();
transitionEnd();
assert.equal(gallery.open, false);
assert.equal(summary.attributes['aria-expanded'], 'false');

const click = (id, options = {}) => document.listeners.click({
  target: { closest: () => navigation.find(link => link.hash === '#' + id) },
  button: 0, preventDefault() {}, ...options
});
click('about');
tick(200);
assert(window.scrollY > 0 && window.scrollY < 1280, 'Scroll must pass through intermediate positions');
tick(1200);
assert.equal(window.scrollY, 1280);
assert.equal(targets.about.focused, true);
assert.equal(navigation[0].attributes['aria-current'], 'location');
click('contact');
tick(1400);
const interruptedAt = window.scrollY;
window.listeners.wheel();
tick(2400);
assert.equal(window.scrollY, interruptedAt, 'Manual scrolling must cancel the animation');
click('about', { ctrlKey: true });
assert.equal(frames.size, 0, 'Modified clicks must retain native browser behavior');
click('contact');
tick(2500);
click('about');
tick(4000);
assert.equal(window.scrollY, 1280, 'A new navigation must replace the prior destination');
console.log('Passed: accordion reversal, delayed close, focus, intermediate scroll positions, cancellation, and repeated navigation.');

// Check both theme directions, rapid clicks, and browser/storage fallbacks.
const themeSource = 'const themeToggle =' + readFileSync(new URL('./main.js', import.meta.url), 'utf8')
  .split('const themeToggle =')[1].split('const memories =')[0];
for (const mode of ['animated', 'unsupported', 'reduced', 'storage-failure', 'skipped']) {
  const button = { ...element(), getBoundingClientRect: () => ({ left: 330, top: 16, width: 32, height: 32 }) };
  const classes = new Set(), animations = [], saved = {}, meta = {};
  let release;
  const animationEnd = new Promise(resolve => { release = resolve; });
  const root = {
    dataset: { theme: 'light' },
    classList: { add: name => classes.add(name), remove: name => classes.delete(name) },
    animate(frames, options) { animations.push({ frames, options }); return { finished: animationEnd }; }
  };
  const themeDocument = { documentElement: root, querySelector: selector => selector === '.theme-toggle' ? button : meta };
  if (mode !== 'unsupported') themeDocument.startViewTransition = update => {
    update();
    return { ready: mode === 'skipped' ? Promise.reject(new Error('Snapshot skipped')) : Promise.resolve(), finished: Promise.resolve() };
  };
  vm.runInNewContext(themeSource, {
    document: themeDocument, window: { innerWidth: 390, innerHeight: 844 },
    matchMedia: () => ({ matches: mode === 'reduced' }),
    localStorage: { setItem(key, value) { if (mode === 'storage-failure') throw new Error('Storage blocked'); saved[key] = value; } },
    setTimeout: callback => callback()
  });
  const first = button.listeners.click();
  if (mode !== 'reduced') await button.listeners.click();
  release();
  await first;
  assert.equal(root.dataset.theme, 'dark', mode);
  assert.equal(button.attributes['aria-pressed'], 'true', mode);
  assert.equal(button.attributes['aria-label'], '切换到浅色模式', mode);
  assert.equal(meta.content, '#131313', mode);
  assert.equal(classes.size, 0, mode);
  if (mode !== 'storage-failure') assert.equal(saved['guok-theme'], 'dark', mode);
  if (['animated', 'storage-failure'].includes(mode)) {
    assert.equal(animations.length, 1, mode);
    assert.equal(animations[0].frames.clipPath[0], 'circle(0px at 346px 32px)');
    assert.equal(animations[0].frames.clipPath[1], `circle(${Math.hypot(346, 812)}px at 346px 32px)`);
    assert.equal(animations[0].options.pseudoElement, '::view-transition-new(root)');
    assert.equal(animations[0].options.duration, 650);
  } else assert.equal(animations.length, 0, mode);
  await button.listeners.click();
  assert.equal(root.dataset.theme, 'light', mode);
  assert.equal(button.attributes['aria-label'], '切换到深色模式', mode);
  assert.equal(meta.content, '#ffffff', mode);
}
console.log('Passed: circular theme reveal, viewport coverage, both directions, rapid clicks, reduced motion, unavailable transitions, skipped snapshots, and blocked storage.');
