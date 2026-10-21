'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Reminder, ACTIONS, MINUTE } = require('../src/reminder');

function setup(options = {}) {
  let now = 0;
  let nextId = 0;
  const jobs = new Map();
  const notifications = [];
  const enabledChanges = [];
  const clock = {
    now: () => now,
    setTimeout: (callback, delay) => {
      const id = ++nextId;
      jobs.set(id, { at: now + delay, callback });
      return id;
    },
    clearTimeout: (id) => jobs.delete(id)
  };
  const reminder = new Reminder({
    clock, interval: 30,
    notify: (message, actions) => new Promise((resolve) => {
      notifications.push({ message, actions, resolve });
    }),
    onEnabledChange: (enabled) => enabledChanges.push(enabled),
    ...options
  });
  async function advance(minutes) {
    const target = now + minutes * MINUTE;
    let iterations = 0;
    while (true) {
      const next = [...jobs].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > target) break;
      assert.ok(++iterations < 100, 'The scheduler must not spin');
      jobs.delete(next[0]);
      now = next[1].at;
      next[1].callback();
      await Promise.resolve();
    }
    now = target;
    await Promise.resolve();
  }
  async function answer(action, index = notifications.length - 1) {
    notifications[index].resolve(action);
    await Promise.resolve();
    await Promise.resolve();
  }
  return { reminder, notifications, enabledChanges, jobs, advance, answer };
}

test('first reminder waits for the interval; acknowledgement restarts it', async () => {
  const h = setup();
  h.reminder.start();
  await h.advance(29);
  assert.equal(h.notifications.length, 0);
  await h.advance(1);
  assert.equal(h.notifications.length, 1);
  await h.answer(ACTIONS[0]);
  await h.advance(30);
  assert.equal(h.notifications.length, 2);
});

test('snooze is five minutes, then normal reminders resume', async () => {
  const h = setup();
  h.reminder.start();
  await h.advance(30);
  await h.answer(ACTIONS[1]);
  await h.advance(4);
  assert.equal(h.notifications.length, 1);
  await h.advance(1);
  assert.equal(h.notifications.length, 2);
  await h.answer(ACTIONS[0]);
  await h.advance(30);
  assert.equal(h.notifications.length, 3);
});

test('pause from the notification cancels reminders until explicitly resumed', async () => {
  const h = setup();
  h.reminder.start();
  await h.advance(30);
  await h.answer(ACTIONS[2]);
  await h.advance(180);
  assert.equal(h.notifications.length, 1);
  assert.deepEqual(h.enabledChanges, [true, false]);
  h.reminder.start();
  await h.advance(30);
  assert.equal(h.notifications.length, 2);
});

test('a background window waits and emits only one overdue reminder on focus', async () => {
  const h = setup({ focused: false });
  h.reminder.start();
  await h.advance(180);
  assert.equal(h.notifications.length, 0);
  assert.equal(h.jobs.size, 0);
  h.reminder.setFocused(true);
  h.reminder.setFocused(true);
  assert.equal(h.notifications.length, 1);
  await h.answer();
  await h.advance(30);
  assert.equal(h.notifications.length, 2);
});

test('unanswered notifications never stack, including repeated Test commands', async () => {
  const h = setup();
  h.reminder.start();
  await h.advance(30);
  await h.advance(240);
  await h.reminder.test();
  h.reminder.setFocused(true);
  assert.equal(h.notifications.length, 1);
  assert.equal(h.jobs.size, 0);
  await h.answer();
  assert.equal(h.jobs.size, 1);
});

test('a stale snooze response cannot undo a newer Pause command', async () => {
  const h = setup();
  h.reminder.start();
  await h.advance(30);
  h.reminder.pause();
  await h.answer(ACTIONS[1]);
  await h.advance(60);
  assert.equal(h.reminder.state.enabled, false);
  assert.equal(h.notifications.length, 1);
  assert.equal(h.jobs.size, 0);
});

test('changing interval replaces the timer, and invalid values are ignored', async () => {
  const h = setup();
  h.reminder.start();
  await h.advance(10);
  assert.equal(h.reminder.setInterval(15), true);
  for (const value of [0, -1, 241, 2.5, '10', NaN, Infinity]) {
    assert.equal(h.reminder.setInterval(value), false);
  }
  assert.equal(h.jobs.size, 1);
  await h.advance(14);
  assert.equal(h.notifications.length, 0);
  await h.advance(1);
  assert.equal(h.notifications.length, 1);
});

test('changing settings while paused does not resume reminders', async () => {
  const h = setup();
  h.reminder.setInterval(10);
  await h.advance(120);
  assert.equal(h.jobs.size, 0);
  assert.equal(h.notifications.length, 0);
});

test('a stale Pause button cannot overwrite a new interval', async () => {
  const h = setup();
  h.reminder.start();
  await h.advance(30);
  h.reminder.setInterval(10);
  await h.advance(10);
  assert.equal(h.notifications.length, 1);
  await h.answer(ACTIONS[2], 0);
  assert.equal(h.reminder.state.enabled, true);
  assert.equal(h.notifications.length, 2);
});

test('previewing a reminder while paused leaves it paused on dismissal', async () => {
  const h = setup();
  const preview = h.reminder.test();
  assert.equal(h.notifications.length, 1);
  await h.answer();
  await preview;
  await h.advance(60);
  assert.equal(h.reminder.state.enabled, false);
  assert.equal(h.notifications.length, 1);
});

test('repeated Start commands keep only one timer and Snooze can resume', async () => {
  const h = setup();
  h.reminder.start();
  h.reminder.start();
  assert.equal(h.jobs.size, 1);
  h.reminder.pause();
  h.reminder.snooze();
  await h.advance(5);
  assert.equal(h.notifications.length, 1);
});

test('disposing removes timers and ignores a pending notification response', async () => {
  const h = setup();
  h.reminder.start();
  await h.advance(30);
  h.reminder.dispose();
  await h.answer(ACTIONS[1]);
  h.reminder.start();
  h.reminder.setFocused(true);
  await h.advance(120);
  assert.equal(h.jobs.size, 0);
  assert.equal(h.notifications.length, 1);
});
