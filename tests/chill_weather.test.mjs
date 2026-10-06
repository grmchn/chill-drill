import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyWeather, sceneWeather, ambientFor } from '../app/js/weather.js';

const days = (y, m) => Array.from({ length: 28 }, (_, i) => `${y}-${String(m).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`);

test('weather is fixed for a day and changes across days', () => {
  assert.equal(dailyWeather('2026-10-05'), dailyWeather('2026-10-05'));
  const kinds = new Set([...days(2026, 10), ...days(2026, 11)].map(dailyWeather));
  assert.ok(kinds.size >= 3, `only ${[...kinds]}`);
});

test('no snow in summer, some snow in winter', () => {
  for (const m of [5, 6, 7, 8, 9, 10]) assert.ok(!days(2026, m).map(dailyWeather).includes('snow'));
  const winter = [...days(2026, 1), ...days(2026, 2), ...days(2027, 1)].map(dailyWeather);
  assert.ok(winter.includes('snow'));
});

test('window views shape the weather', () => {
  assert.equal(sceneWeather('rain', 'snow'), 'snow');
  assert.equal(sceneWeather('clear', 'sakura'), 'petals');
  assert.equal(sceneWeather('cloudy', 'city'), 'cloudy');
});

test('ambience follows the weather', () => {
  assert.equal(ambientFor('rain', 1), 'rain');
  assert.equal(ambientFor('clear', 8), 'insects');
  assert.equal(ambientFor('clear', 1), 'none');
  assert.equal(ambientFor('snow', 12), 'none');
});
