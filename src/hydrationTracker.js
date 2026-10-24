'use strict';

const HISTORY_KEY = 'drinkHistory';

function localDateKey(value = Date.now()) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function validMillilitres(value, minimum = 1, maximum = 10000) {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}

function normalizeHistory(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const history = {};
  for (const [date, total] of Object.entries(value)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && validMillilitres(total, 0, Number.MAX_SAFE_INTEGER)) {
      history[date] = total;
    }
  }
  return history;
}

class HydrationTracker {
  constructor(storage, options = {}) {
    this.storage = storage;
    this.now = options.now || (() => Date.now());
    this.history = normalizeHistory(storage.get(HISTORY_KEY, {}));
    this.saving = Promise.resolve();
  }

  totalFor(date = localDateKey(this.now())) {
    return this.history[date] || 0;
  }

  summary(drinkAmount, dailyGoal) {
    const date = localDateKey(this.now());
    return {
      date,
      totalToday: this.totalFor(date),
      drinkAmount,
      dailyGoal
    };
  }

  entries() {
    return Object.entries(this.history)
      .map(([date, totalMl]) => ({ date, totalMl }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  record(amount) {
    if (!validMillilitres(amount, 1, 2000)) {
      return Promise.reject(new RangeError('Drink amount must be a whole number from 1 to 2000 ml.'));
    }
    const date = localDateKey(this.now());
    // A temporary storage failure must not poison every later record attempt.
    this.saving = this.saving.catch(() => {}).then(async () => {
      const next = { ...this.history, [date]: (this.history[date] || 0) + amount };
      await this.storage.update(HISTORY_KEY, next);
      this.history = next;
      return this.totalFor(date);
    });
    return this.saving;
  }
}

module.exports = { HydrationTracker, HISTORY_KEY, localDateKey, normalizeHistory, validMillilitres };
