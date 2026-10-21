'use strict';

const VIEW_ID = 'waterReminderLite.hydrationView';
const ALLOWED_ACTIONS = new Set(['drink', 'snooze', 'start', 'pause']);

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function webviewHtml(webview, state) {
  const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const initialState = JSON.stringify(state).replaceAll('<', '\\u003c');
  const cspSource = escapeHtml(webview.cspSource || '');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <style nonce="${nonce}">
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 10px 12px 12px;
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
      font: 13px/1.35 var(--vscode-font-family);
    }
    .buddy {
      display: grid;
      grid-template-columns: 58px minmax(0, 1fr);
      align-items: center;
      gap: 12px;
      min-height: 74px;
    }
    .scene { position: relative; width: 58px; height: 72px; }
    .drop {
      position: absolute;
      left: 25px;
      top: 0;
      width: 9px;
      height: 13px;
      border-radius: 55% 45% 55% 45%;
      background: var(--vscode-charts-blue, #3794ff);
      transform: rotate(45deg);
      animation: fall 2.2s ease-in infinite;
    }
    .glass {
      position: absolute;
      left: 8px;
      bottom: 2px;
      width: 43px;
      height: 53px;
      overflow: hidden;
      border: 2px solid var(--vscode-foreground);
      border-top-width: 3px;
      border-radius: 4px 4px 10px 10px;
      opacity: .9;
      transform-origin: 50% 100%;
      animation: breathe 3.2s ease-in-out infinite;
    }
    .water {
      position: absolute;
      left: -8px;
      right: -8px;
      bottom: -1px;
      height: 70%;
      background: var(--vscode-charts-blue, #3794ff);
      opacity: .78;
    }
    .water::before, .water::after {
      content: '';
      position: absolute;
      top: -7px;
      width: 48px;
      height: 14px;
      border-radius: 50%;
      background: var(--vscode-sideBar-background);
      animation: wave 2.6s linear infinite;
    }
    .water::before { left: -2px; }
    .water::after { left: 29px; animation-delay: -1.3s; }
    .copy { min-width: 0; }
    .status { font-weight: 600; margin-bottom: 3px; }
    .detail {
      color: var(--vscode-descriptionForeground);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    button {
      border: 1px solid var(--vscode-button-border, transparent);
      border-radius: 3px;
      padding: 4px 8px;
      color: var(--vscode-button-secondaryForeground);
      background: var(--vscode-button-secondaryBackground);
      font: inherit;
      cursor: pointer;
    }
    button:hover { background: var(--vscode-button-secondaryHoverBackground); }
    button:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: 2px; }
    button.primary {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
    }
    button.primary:hover { background: var(--vscode-button-hoverBackground); }
    body.paused .drop, body.paused .glass { animation-play-state: paused; }
    body.paused .scene { filter: grayscale(1); opacity: .55; }
    body.due .glass { animation: alert 1s ease-in-out infinite; }
    body.due .drop { animation-duration: .8s; }
    @keyframes fall {
      0%, 25% { transform: translateY(-3px) rotate(45deg); opacity: 0; }
      42% { opacity: 1; }
      70%, 100% { transform: translateY(17px) rotate(45deg); opacity: 0; }
    }
    @keyframes wave { to { transform: translateX(-31px); } }
    @keyframes breathe { 50% { transform: translateY(-2px); } }
    @keyframes alert { 50% { transform: scale(1.06); filter: drop-shadow(0 0 5px var(--vscode-charts-blue, #3794ff)); } }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation: none !important; }
    }
  </style>
</head>
<body>
  <section class="buddy" aria-live="polite">
    <div class="scene" aria-hidden="true">
      <div class="drop"></div>
      <div class="glass"><div class="water"></div></div>
    </div>
    <div class="copy">
      <div class="status" id="status"></div>
      <div class="detail" id="detail"></div>
    </div>
  </section>
  <div class="actions">
    <button class="primary" id="drink" data-action="drink">I drank water</button>
    <button id="snooze" data-action="snooze">Snooze 5m</button>
    <button id="toggle"></button>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let state = ${initialState};

    function duration(ms) {
      const total = Math.max(0, Math.ceil(ms / 1000));
      const minutes = Math.floor(total / 60);
      const seconds = String(total % 60).padStart(2, '0');
      return minutes + ':' + seconds;
    }

    function render() {
      const due = state.awaitingResponse;
      document.body.classList.toggle('paused', !state.enabled);
      document.body.classList.toggle('due', due);
      document.getElementById('status').textContent = !state.enabled
        ? 'Reminders paused'
        : due ? 'Time for some water!' : 'Hydration timer running';
      document.getElementById('detail').textContent = !state.enabled
        ? 'Start when you are ready.'
        : due ? 'Take a few refreshing sips.'
          : state.dueAt ? 'Next break in ' + duration(state.dueAt - Date.now())
            : 'Every ' + state.interval + ' minutes';
      const toggle = document.getElementById('toggle');
      toggle.textContent = state.enabled ? 'Pause' : 'Start';
      toggle.dataset.action = state.enabled ? 'pause' : 'start';
      document.getElementById('snooze').hidden = !state.enabled;
    }

    document.querySelector('.actions').addEventListener('click', (event) => {
      const button = event.target.closest('button');
      const action = button && button.dataset.action;
      if (action) vscode.postMessage({ type: 'action', action });
    });
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'state') { state = event.data.state; render(); }
    });
    render();
    setInterval(() => { if (state.enabled && state.dueAt) render(); }, 1000);
  </script>
</body>
</html>`;
}

class HydrationViewProvider {
  constructor(onAction) {
    this.onAction = onAction;
    this.state = { enabled: false, dueAt: null, interval: 30, awaitingResponse: false };
    this.view = null;
  }

  resolveWebviewView(view) {
    this.view = view;
    view.webview.options = { enableScripts: true, localResourceRoots: [] };
    view.webview.html = webviewHtml(view.webview, this.state);
    view.webview.onDidReceiveMessage((message) => {
      if (message && message.type === 'action' && ALLOWED_ACTIONS.has(message.action)) {
        this.onAction(message.action);
      }
    });
    view.onDidDispose(() => { if (this.view === view) this.view = null; });
  }

  update(state) {
    this.state = { ...state };
    if (this.view) void this.view.webview.postMessage({ type: 'state', state: this.state });
  }
}

module.exports = { HydrationViewProvider, VIEW_ID, webviewHtml };
