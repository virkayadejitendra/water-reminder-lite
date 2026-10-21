'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { HydrationViewProvider, webviewHtml } = require('../src/hydrationView');

test('webview has a restrictive CSP, animation, and reduced-motion support', () => {
  const html = webviewHtml({ cspSource: 'vscode-webview:' }, {
    enabled: true, dueAt: 123, interval: 30, awaitingResponse: false
  });
  assert.match(html, /default-src 'none'/);
  assert.match(html, /@keyframes fall/);
  assert.match(html, /prefers-reduced-motion/);
  assert.match(html, /Hydration timer running/);
});

test('view forwards only known quick actions and receives state updates', async () => {
  const actions = [];
  const messages = [];
  let receive;
  const provider = new HydrationViewProvider((action) => actions.push(action));
  const view = {
    webview: {
      cspSource: 'vscode-webview:',
      options: {},
      html: '',
      onDidReceiveMessage: (listener) => { receive = listener; },
      postMessage: async (message) => { messages.push(message); }
    },
    onDidDispose: () => {}
  };
  provider.resolveWebviewView(view);
  receive({ type: 'action', action: 'drink' });
  receive({ type: 'action', action: 'unknown' });
  provider.update({ enabled: false, dueAt: null, interval: 45, awaitingResponse: false });
  await Promise.resolve();
  assert.deepEqual(actions, ['drink']);
  assert.equal(view.webview.options.enableScripts, true);
  assert.equal(messages[0].state.interval, 45);
});
