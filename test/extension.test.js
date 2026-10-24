'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const manifest = require('../package.json');

test('Marketplace identity and repository metadata are publication-ready', () => {
  assert.equal(manifest.publisher, 'JitendraVirkayade');
  assert.equal(manifest.icon, 'images/icon.png');
  assert.equal(manifest.repository.url, 'https://github.com/virkayadejitendra/water-reminder-lite.git');
  assert.match(manifest.bugs.url, /^https:\/\/github\.com\//);
});

function host(savedEnabled) {
  const commands = new Map();
  const settings = { intervalMinutes: 30, drinkAmountMl: 200, dailyGoalMl: 2000 };
  const stored = [];
  const globalValues = { enabled: savedEnabled, drinkHistory: {} };
  const listeners = {};
  const views = new Map();
  const status = { show() {}, dispose() {} };
  const disposable = { dispose() {} };
  const api = {
    StatusBarAlignment: { Right: 2 },
    ConfigurationTarget: { Global: 1 },
    window: {
      state: { focused: true },
      createStatusBarItem: () => status,
      showInformationMessage: async () => undefined,
      showInputBox: async () => '45',
      showQuickPick: async (choices) => choices[0],
      registerWebviewViewProvider: (id, provider) => { views.set(id, provider); return disposable; },
      onDidChangeWindowState: (callback) => { listeners.focus = callback; return disposable; }
    },
    workspace: {
      getConfiguration: () => ({
        get: (key, fallback) => settings[key] ?? fallback,
        update: async (key, value, target) => {
          assert.equal(target, api.ConfigurationTarget.Global);
          settings[key] = value;
          listeners.configuration({ affectsConfiguration: () => true });
        }
      }),
      onDidChangeConfiguration: (callback) => { listeners.configuration = callback; return disposable; }
    },
    commands: {
      registerCommand: (name, handler) => { commands.set(name, handler); return disposable; },
      executeCommand: (name) => commands.get(name)()
    }
  };
  const context = {
    subscriptions: [],
    globalState: {
      get: (key, fallback) => globalValues[key] ?? fallback,
      update: async (key, value) => { globalValues[key] = value; stored.push([key, value]); }
    }
  };
  const sandbox = {
    require: (name) => name === 'vscode' ? api : require(path.join('..', name)),
    module: { exports: {} }, console
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../extension.js'), 'utf8'), sandbox);
  sandbox.module.exports.activate(context);
  return { commands, settings, stored, status, views, globalValues,
    dispose: () => context.subscriptions.forEach((item) => item.dispose()) };
}

test('every manifest command is registered and the status bar opens controls', (t) => {
  const h = host(false);
  t.after(h.dispose);
  assert.deepEqual([...h.commands.keys()].sort(), manifest.contributes.commands.map(c => c.command).sort());
  assert.equal(h.status.command, 'waterReminderLite.menu');
  assert.match(h.status.tooltip, /paused/i);
});

test('the animated hydration view is registered in the Explorer', (t) => {
  const h = host(true);
  t.after(h.dispose);
  assert.equal(manifest.contributes.views.explorer[0].id, 'waterReminderLite.hydrationView');
  assert.ok(h.views.has('waterReminderLite.hydrationView'));
});

test('rapid Start and Pause writes persist in order; paused startup stays paused', async (t) => {
  const h = host(false);
  t.after(h.dispose);
  h.commands.get('waterReminderLite.start')();
  h.commands.get('waterReminderLite.pause')();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(h.stored, [['enabled', true], ['enabled', false]]);
  assert.match(h.status.tooltip, /paused/i);
});

test('interval command saves a user setting and updates an active timer', async (t) => {
  const h = host(true);
  t.after(h.dispose);
  await h.commands.get('waterReminderLite.interval')();
  assert.equal(h.settings.intervalMinutes, 45);
  assert.match(h.status.tooltip, /45 minutes/);
});

test('recording a drink persists the configured amount and updates today total', async (t) => {
  const h = host(false);
  t.after(h.dispose);
  await h.commands.get('waterReminderLite.drink')();
  const total = Object.values(h.globalValues.drinkHistory)[0];
  assert.equal(total, 200);
  assert.match(h.status.text, /200 ml/);
  assert.equal(h.views.get('waterReminderLite.hydrationView').state.totalToday, 200);
});

test('drink amount command offers presets and updates the global setting', async (t) => {
  const h = host(false);
  t.after(h.dispose);
  await h.commands.get('waterReminderLite.amount')();
  assert.equal(h.settings.drinkAmountMl, 150);
  assert.equal(h.views.get('waterReminderLite.hydrationView').state.drinkAmount, 150);
});
