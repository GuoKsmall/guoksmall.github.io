// A game-like day/night orbit in Beijing time, independent of the page theme.
const palettes = [
  [0, ['#101b39', '#344566', '#b9c1d1', '#1e293d', '#172e42'], 0],
  [5, ['#1b2747', '#6a657b', '#c39891', '#46465b', '#323a50'], .05],
  [6, ['#7b8ab0', '#deb9ad', '#f7d4a4', '#a2a4ad', '#6c8e93'], .35],
  [8, ['#83bad5', '#c1dfdf', '#e8eed6', '#91b3b2', '#659591'], 1],
  [16, ['#83bad5', '#c1dfdf', '#e8eed6', '#91b3b2', '#659591'], 1],
  [18, ['#777ba8', '#c297a8', '#edb997', '#9990a2', '#6f8294'], .4],
  [20, ['#101b39', '#344566', '#b9c1d1', '#1e293d', '#172e42'], 0],
  [24, ['#101b39', '#344566', '#b9c1d1', '#1e293d', '#172e42'], 0]
];
const names = ['sky-top', 'sky-mid', 'sky-horizon', 'mountain-far', 'mountain-near'];
const rgb = hex => hex.match(/\w\w/g).map(part => parseInt(part, 16));

export function skyState(hour) {
  if (!Number.isFinite(hour)) throw new TypeError('Time must be finite');
  hour = ((hour % 24) + 24) % 24;
  const day = hour >= 6 && hour < 18;
  const progress = day ? (hour - 6) / 12 : ((hour - 18 + 24) % 24) / 12;
  const upper = palettes.findIndex(stop => stop[0] > hour);
  const before = palettes[upper - 1], after = palettes[upper];
  const fraction = (hour - before[0]) / (after[0] - before[0]);
  const colors = Object.fromEntries(names.map((name, index) => {
    const a = rgb(before[1][index]), b = rgb(after[1][index]);
    const value = a.map((part, channel) => Math.round(part + (b[channel] - part) * fraction)).join(',');
    return [name, `rgb(${value})`];
  }));
  return {
    hour, day, progress, colors,
    x: 8 + 84 * progress,
    y: 172 - 112 * Math.sin(Math.PI * progress),
    daylight: before[2] + (after[2] - before[2]) * fraction,
    label: hour < 5 ? '深夜' : hour < 8 ? '清晨' : hour < 17 ? '白昼' : hour < 20 ? '黄昏' : '夜晚'
  };
}

if (typeof document !== 'undefined') {
  const card = document.querySelector('.sky-card');
  const clock = card.querySelector('.world-clock');
  const format = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  });
  function render() {
    const parts = format.format(new Date()).split(':').map(Number);
    const hour = parts[0] + parts[1] / 60 + parts[2] / 3600;
    const state = skyState(hour);
    const minutes = parts[0] * 60 + parts[1];
    const time = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    for (const [name, value] of Object.entries(state.colors)) card.style.setProperty('--' + name, value);
    card.style.setProperty('--star-opacity', String(1 - state.daylight));
    card.style.setProperty('--cloud-opacity', String(.15 + .45 * state.daylight));
    card.style.setProperty('--celestial-x', state.x + '%');
    card.style.setProperty('--celestial-y', state.y + 'px');
    card.dataset.period = state.day ? 'day' : 'night';
    clock.textContent = `${state.day ? '☀' : '☾'} ${time} · ${state.label}`;
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
  render();
  setInterval(render, 30000);
}
