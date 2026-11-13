import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { skyState } from './sky.mjs';
import { sphereMesh } from './emoji.mjs';

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
assert.equal(categories.length, 15);
assert.match(html, /<details class="gallery-disclosure">/);
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
// The sphere must have unit normals, a closed seam, and outward-facing triangles.
const { vertices, indices } = sphereMesh();
const vertex = index => vertices.subarray(index * 3, index * 3 + 3);
assert.equal(vertices.length, 49 * 65 * 3);
assert.equal(indices.length, 48 * 64 * 6);
assert(indices.every(index => index < vertices.length / 3));
for (let index = 0; index < vertices.length / 3; index++) assert(Math.abs(Math.hypot(...vertex(index)) - 1) < 1e-6);
for (let row = 0; row <= 48; row++) {
  const start = vertex(row * 65), end = vertex(row * 65 + 64);
  assert(start.every((value, axis) => Math.abs(value - end[axis]) < 1e-6));
}
for (let index = 0; index < indices.length; index += 3) {
  const a = vertex(indices[index]), b = vertex(indices[index + 1]), c = vertex(indices[index + 2]);
  const u = b.map((value, axis) => value - a[axis]), v = c.map((value, axis) => value - a[axis]);
  const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  assert(normal.reduce((sum, value, axis) => sum + value * a[axis], 0) >= -1e-6);
}
console.log('Passed: assets, anchors, gallery counts, custom domain, all 1,440 sky states, and the closed 3D sphere mesh.');
