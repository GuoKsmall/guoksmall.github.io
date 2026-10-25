import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { skyState } from './sky.mjs';

// Catch broken local assets, in-page navigation, and gallery category counts.
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, 'Duplicate HTML id');
for (const [, id] of html.matchAll(/href="#([^"]+)"/g)) {
  assert(ids.includes(id), `Missing anchor: ${id}`);
}
const styles = ['style.css', 'sky.css'].map(file => readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n');
const resources = [...html.matchAll(/(?:src|href)="([^"#]+)"/g), ...styles.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)];
for (const [, resource] of resources) {
  if (/^(https?:|mailto:)/.test(resource)) continue;
  assert(existsSync(new URL(resource.split('?')[0], import.meta.url)), `Missing resource: ${resource}`);
}
const categories = [...html.matchAll(/<figure class="memory[^"]*" data-category="([^"]+)"/g)].map(match => match[1]);
assert.equal(categories.length, 9);
for (const [, category, count] of html.matchAll(/data-filter="([^"]+)"[^>]*>[^<]+<small>(\d+)<\/small>/g)) {
  assert.equal(category === 'all' ? categories.length : categories.filter(value => value === category).length, Number(count));
}
assert.equal(readFileSync(new URL('./CNAME', import.meta.url), 'utf8').trim(), 'guok.ink');

// Exercise the day/night boundaries, wrapping, and every minute's interpolation.
assert.equal(skyState(5.999).day, false);
assert.equal(skyState(6).day, true);
assert.equal(skyState(17.999).day, true);
assert.equal(skyState(18).day, false);
assert.deepEqual(skyState(-1), skyState(23));
assert.deepEqual(skyState(24), skyState(0));
assert.throws(() => skyState(NaN), TypeError);
assert.throws(() => skyState(Infinity), TypeError);
for (let minute = 0; minute < 1440; minute++) {
  const state = skyState(minute / 60);
  assert(state.x >= 8 && state.x <= 92);
  assert(state.y >= 60 && state.y <= 172);
  assert(state.daylight >= 0 && state.daylight <= 1);
  for (const color of Object.values(state.colors)) {
    assert.match(color, /^rgb\(\d+,\d+,\d+\)$/);
    assert(color.match(/\d+/g).every(channel => Number(channel) <= 255));
  }
}
console.log('Passed: assets, anchors, gallery counts, custom domain, and all 1,440 sky states.');
