'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { HydrationTracker, localDateKey, normalizeHistory } = require('../src/hydrationTracker');

function storageWith(initial = {}) {
  const values = { drinkHistory: initial };
  const writes = [];
  return {
    values,
    writes,
    get: (key, fallback) => Object.hasOwn(values, key) ? values[key] : fallback,
    update: async (key, value) => { values[key] = value; writes.push([key, value]); }
  };
}

test('records multiple drinks in the local calendar day and persists the total', async () => {
  const storage = storageWith({ '2026-10-23': 750 });
  const tracker = new HydrationTracker(storage, { now: () => new Date(2026, 9, 24, 10).getTime() });
  await tracker.record(150);
  await tracker.record(200);
  assert.equal(tracker.totalFor('2026-10-24'), 350);
  assert.equal(storage.values.drinkHistory['2026-10-23'], 750);
  assert.equal(storage.values.drinkHistory['2026-10-24'], 350);
  assert.equal(storage.writes.length, 2);
});

test('starts a new total after local midnight and keeps backdated history', async () => {
  let now = new Date(2026, 9, 24, 23, 59).getTime();
  const tracker = new HydrationTracker(storageWith(), { now: () => now });
  await tracker.record(200);
  now = new Date(2026, 9, 25, 0, 1).getTime();
  await tracker.record(150);
  assert.deepEqual(tracker.entries(), [
    { date: '2026-10-25', totalMl: 150 },
    { date: '2026-10-24', totalMl: 200 }
  ]);
});

test('serializes quick drink records and rejects invalid amounts', async () => {
  const tracker = new HydrationTracker(storageWith(), { now: () => new Date(2026, 9, 24).getTime() });
  await Promise.all([tracker.record(150), tracker.record(200)]);
  assert.equal(tracker.totalFor(), 350);
  for (const amount of [0, -1, 2.5, 2001, '200']) {
    await assert.rejects(tracker.record(amount), RangeError);
  }
});

test('normalizes corrupt stored data and formats dates in local time', () => {
  assert.deepEqual(normalizeHistory({ '2026-10-24': 500, bad: 10, '2026-10-25': -1 }), {
    '2026-10-24': 500
  });
  assert.equal(localDateKey(new Date(2026, 0, 2, 23, 30).getTime()), '2026-01-02');
});

test('a failed storage write does not prevent a later drink from being recorded', async () => {
  let fail = true;
  const storage = storageWith();
  storage.update = async (key, value) => {
    if (fail) { fail = false; throw new Error('temporary failure'); }
    storage.values[key] = value;
  };
  const tracker = new HydrationTracker(storage, { now: () => new Date(2026, 9, 24).getTime() });
  await assert.rejects(tracker.record(150), /temporary failure/);
  await tracker.record(200);
  assert.equal(tracker.totalFor(), 200);
});
