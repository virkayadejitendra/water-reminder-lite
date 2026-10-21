'use strict';

const MINUTE = 60 * 1000;
const ACTIONS = ['I drank water', 'Remind me in 5 minutes', 'Pause reminders'];

function validMinutes(value) {
  return Number.isInteger(value) && value >= 1 && value <= 240;
}

// One timer per window. No polling loop, network calls or background process.
class Reminder {
  constructor(options) {
    this.clock = options.clock || {
      now: () => Date.now(),
      setTimeout: (callback, delay) => setTimeout(callback, delay),
      clearTimeout: (handle) => clearTimeout(handle)
    };
    this.notify = options.notify;
    this.onChange = options.onChange || (() => {});
    this.onEnabledChange = options.onEnabledChange || (() => {});
    this.focused = options.focused !== false;
    this.interval = validMinutes(options.interval) ? options.interval : 30;
    this.enabled = false;
    this.dueAt = null;
    this.timer = null;
    this.revision = 0;
    this.notificationOpen = false;
    this.disposed = false;
  }

  get state() {
    return { enabled: this.enabled, dueAt: this.dueAt, interval: this.interval,
      awaitingResponse: this.notificationOpen && this.dueAt === null && this.enabled };
  }

  clearTimer() {
    if (this.timer !== null) this.clock.clearTimeout(this.timer);
    this.timer = null;
  }

  schedule(minutes) {
    if (this.disposed) return;
    this.revision++;
    this.clearTimer();
    this.dueAt = this.clock.now() + minutes * MINUTE;
    this.arm();
    this.onChange(this.state);
  }

  arm() {
    this.clearTimer();
    if (this.disposed || !this.enabled || this.dueAt === null) return;
    const remaining = this.dueAt - this.clock.now();
    if (remaining <= 0) {
      // Focus events or notification completion will retry; never busy-wait.
      if (this.focused && !this.notificationOpen) void this.deliver();
      return;
    }
    this.timer = this.clock.setTimeout(() => {
      this.timer = null;
      this.arm();
    }, remaining);
  }

  setEnabled(enabled) {
    const changed = this.enabled !== enabled;
    this.enabled = enabled;
    if (changed) this.onEnabledChange(enabled);
  }

  start() {
    if (this.disposed) return;
    this.setEnabled(true);
    this.schedule(this.interval);
  }

  pause() {
    if (this.disposed) return;
    this.revision++;
    this.clearTimer();
    this.dueAt = null;
    this.setEnabled(false);
    this.onChange(this.state);
  }

  snooze() {
    if (this.disposed) return;
    this.setEnabled(true);
    this.schedule(5);
  }

  setInterval(minutes) {
    if (this.disposed || !validMinutes(minutes)) return false;
    this.interval = minutes;
    if (this.enabled) this.schedule(minutes);
    else this.onChange(this.state);
    return true;
  }

  setFocused(focused) {
    if (this.disposed) return;
    this.focused = focused;
    if (focused) this.arm();
  }

  // Preview works while paused without silently enabling automatic reminders.
  test() {
    if (!this.disposed && !this.notificationOpen) return this.deliver();
    return Promise.resolve();
  }

  async deliver() {
    if (this.disposed || this.notificationOpen) return;
    this.clearTimer();
    this.dueAt = null;
    this.notificationOpen = true;
    const revision = this.revision;
    this.onChange(this.state);
    try {
      const action = await this.notify('Time for a water break. Take a few sips.', ACTIONS);
      // An old notification must not override newer Pause/Start/interval actions.
      if (this.disposed || revision !== this.revision) return;
      if (action === ACTIONS[2]) this.pause();
      else if (action === ACTIONS[1]) this.snooze();
      else if (this.enabled) this.schedule(this.interval);
    } catch (error) {
      console.error('Water Reminder Lite could not show a reminder:', error);
      if (!this.disposed && revision === this.revision && this.enabled) {
        this.schedule(this.interval);
      }
    } finally {
      this.notificationOpen = false;
      if (!this.disposed) {
        this.arm();
        this.onChange(this.state);
      }
    }
  }

  dispose() {
    this.disposed = true;
    this.revision++;
    this.clearTimer();
    this.dueAt = null;
  }
}

module.exports = { Reminder, ACTIONS, MINUTE, validMinutes };
