'use strict';

const vscode = require('vscode');
const { Reminder, validMinutes } = require('./src/reminder');
const { HydrationViewProvider, VIEW_ID } = require('./src/hydrationView');

function activate(context) {
  const section = 'waterReminderLite';
  const config = () => vscode.workspace.getConfiguration(section);
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 10);
  status.name = 'Water Reminder';
  status.command = `${section}.menu`;
  const hydrationView = new HydrationViewProvider((action) => {
    void vscode.commands.executeCommand(`${section}.${action}`);
  });

  function render(state) {
    let description;
    if (!state.enabled) {
      status.text = '$(debug-pause) Water';
      description = 'Reminders paused. Click to start.';
    } else if (state.awaitingResponse) {
      status.text = '$(bell) Water break';
      description = 'Your water reminder is in Notifications. Click for controls.';
    } else {
      const next = state.dueAt === null ? null : new Date(state.dueAt).toLocaleTimeString(
        [], { hour: '2-digit', minute: '2-digit' });
      status.text = '$(watch) Water';
      description = `Every ${state.interval} minutes.${next ? ` Next reminder at ${next}.` : ''} Click for controls.`;
    }
    status.tooltip = `Water Reminder Lite — ${description}`;
    status.accessibilityInformation = { label: `Water Reminder. ${description}` };
    hydrationView.update(state);
  }

  // Serialize writes so a quick Start/Pause sequence persists in the right order.
  let saving = Promise.resolve();
  const reminder = new Reminder({
    interval: config().get('intervalMinutes', 30),
    focused: vscode.window.state.focused,
    notify: (message, actions) => vscode.window.showInformationMessage(message, ...actions),
    onChange: render,
    onEnabledChange: (enabled) => {
      saving = saving.then(() => context.globalState.update('enabled', enabled)).catch((error) => {
        console.error('Water Reminder Lite could not save its pause state:', error);
      });
    }
  });

  async function changeInterval() {
    const input = await vscode.window.showInputBox({
      title: 'Water Reminder: Change Interval',
      prompt: 'How many minutes between water reminders?',
      value: String(reminder.state.interval),
      validateInput: (text) => validMinutes(Number(text.trim()))
        ? undefined : 'Enter a whole number from 1 to 240.'
    });
    if (input === undefined) return;
    const minutes = Number(input.trim());
    if (validMinutes(minutes)) {
      await config().update('intervalMinutes', minutes, vscode.ConfigurationTarget.Global);
    }
  }

  async function showMenu() {
    const choices = [
      reminder.state.enabled
        ? { label: '$(debug-pause) Pause reminders', action: 'pause' }
        : { label: '$(play) Start reminders', action: 'start' },
      { label: '$(check) I drank water', description: 'Restart the normal timer', action: 'drink' },
      { label: '$(clock) Remind me in 5 minutes', action: 'snooze' },
      { label: '$(settings-gear) Change interval', description: `${reminder.state.interval} minutes`, action: 'interval' },
      { label: '$(bell) Test reminder now', action: 'test' }
    ];
    const choice = await vscode.window.showQuickPick(choices, { title: 'Water Reminder Lite' });
    if (choice) await vscode.commands.executeCommand(`${section}.${choice.action}`);
  }

  const commands = {
    menu: showMenu,
    start: () => reminder.start(),
    pause: () => reminder.pause(),
    snooze: () => reminder.snooze(),
    drink: () => reminder.start(),
    test: () => reminder.test(),
    interval: changeInterval
  };
  context.subscriptions.push(
    status,
    reminder,
    vscode.window.registerWebviewViewProvider(VIEW_ID, hydrationView, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );
  for (const [name, handler] of Object.entries(commands)) {
    context.subscriptions.push(vscode.commands.registerCommand(`${section}.${name}`, handler));
  }
  context.subscriptions.push(
    vscode.window.onDidChangeWindowState((state) => reminder.setFocused(state.focused)),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(`${section}.intervalMinutes`)) {
        reminder.setInterval(config().get('intervalMinutes', 30));
      }
    })
  );

  if (context.globalState.get('enabled', true)) reminder.start();
  else render(reminder.state);
  status.show();
}

module.exports = { activate };
