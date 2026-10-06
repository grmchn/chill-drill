// Daily weather (id029). The same day always has the same weather; the
// season changes how likely each kind is. The window view (collection) can
// turn it into its own kind: snow on the snow view, petals under the cherry
// trees.

export const WEATHER_NAME = { clear: 'はれ', cloudy: 'くもり', rain: 'こさめ', snow: 'ゆき', petals: 'はなふぶき' };

// Weights per month (index 0 = January): [clear, cloudy, rain, snow].
const MONTH_WEIGHTS = [
  [4, 3, 1, 3], [4, 3, 1, 3], [4, 3, 2, 1], [4, 3, 3, 0], [4, 3, 3, 0], [2, 3, 5, 0],
  [4, 3, 3, 0], [5, 3, 2, 0], [3, 3, 4, 0], [5, 3, 2, 0], [4, 4, 2, 0], [4, 3, 1, 2],
];
const KINDS = ['clear', 'cloudy', 'rain', 'snow'];

// Small stable hash of the day key ("2026-10-05") to 0..1.
function unit(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

export function dailyWeather(dayKey) {
  const month = Number(dayKey.slice(5, 7)) - 1;
  const w = MONTH_WEIGHTS[month] || MONTH_WEIGHTS[0];
  const total = w.reduce((a, b) => a + b, 0);
  let x = unit(`wx:${dayKey}`) * total;
  for (let i = 0; i < w.length; i++) { x -= w[i]; if (x < 0) return KINDS[i]; }
  return 'clear';
}

// What actually falls outside this window.
export function sceneWeather(weather, view) {
  if (view === 'snow') return weather === 'rain' || weather === 'snow' ? 'snow' : weather;
  if (view === 'sakura') return weather === 'clear' || weather === 'cloudy' ? 'petals' : weather === 'snow' ? 'rain' : weather;
  return weather;
}

// The ambience for the setting "てんきに あわせる": rain on rainy days, insects
// on dry summer and autumn nights, otherwise quiet.
export function ambientFor(weather, month) {
  if (weather === 'rain') return 'rain';
  if (weather === 'snow') return 'none';
  return month >= 6 && month <= 10 ? 'insects' : 'none';
}
