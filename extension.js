'use strict';

const vscode = require('vscode');
const { Reminder, ACTIONS, validMinutes } = require('./src/reminder');
const { HydrationViewProvider, VIEW_ID } = require('./src/hydrationView');
const { HydrationTracker, validMillilitres } = require('./src/hydrationTracker');

function activate(context) {
  const section = 'waterReminderLite';
  const config = () => vscode.workspace.getConfiguration(section);
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 10);
  status.name = 'Water Reminder';
  status.command = `${section}.menu`;
  const tracker = new HydrationTracker(context.globalState);
  const hydrationView = new HydrationViewProvider((action) => {
    void vscode.commands.executeCommand(`${section}.${action}`);
  });

  function trackingState() {
    return tracker.summary(
      config().get('drinkAmountMl', 200),
      config().get('dailyGoalMl', 2000)
    );
  }

  function render(state) {
    const tracking = trackingState();
    let description;
    if (!state.enabled) {
      status.text = `$(debug-pause) Water ${tracking.totalToday} ml`;
      description = 'Reminders paused. Click to start.';
    } else if (state.awaitingResponse) {
      status.text = `$(bell) Water ${tracking.totalToday} ml`;
      description = 'Your water reminder is in Notifications. Click for controls.';
    } else {
      const next = state.dueAt === null ? null : new Date(state.dueAt).toLocaleTimeString(
        [], { hour: '2-digit', minute: '2-digit' });
      status.text = `$(watch) Water ${tracking.totalToday} ml`;
      description = `Every ${state.interval} minutes.${next ? ` Next reminder at ${next}.` : ''} Click for controls.`;
    }
    status.tooltip = `Water Reminder Lite — ${tracking.totalToday} of ${tracking.dailyGoal} ml today. ${description}`;
    status.accessibilityInformation = { label: `Water Reminder. ${description}` };
    hydrationView.update({ ...state, ...tracking });
  }

  // Serialize writes so a quick Start/Pause sequence persists in the right order.
  let saving = Promise.resolve();
  let reminder;

  async function recordDrink() {
    const amount = config().get('drinkAmountMl', 200);
    try {
      await tracker.record(amount);
    } catch (error) {
      console.error('Water Reminder Lite could not save the drink history:', error);
    }
    render(reminder.state);
  }

  reminder = new Reminder({
    interval: config().get('intervalMinutes', 30),
    focused: vscode.window.state.focused,
    notify: async (message, actions) => {
      const action = await vscode.window.showInformationMessage(message, ...actions);
      if (action === ACTIONS[0]) await recordDrink();
      return action;
    },
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

  async function changeDrinkAmount() {
    const presets = [150, 200, 250, 300, 500].map((value) => ({
      label: `${value} ml`, value
    }));
    presets.push({ label: '$(edit) Custom amount…', custom: true });
    const choice = await vscode.window.showQuickPick(presets, {
      title: 'Water Reminder: Amount per Drink',
      placeHolder: `Current amount: ${config().get('drinkAmountMl', 200)} ml`
    });
    if (!choice) return;
    let amount = choice.value;
    if (choice.custom) {
      const input = await vscode.window.showInputBox({
        title: 'Water Reminder: Custom Drink Amount',
        prompt: 'How many millilitres do you normally drink at a time?',
        value: String(config().get('drinkAmountMl', 200)),
        validateInput: (text) => validMillilitres(Number(text.trim()), 50, 2000)
          ? undefined : 'Enter a whole number from 50 to 2000 ml.'
      });
      if (input === undefined) return;
      amount = Number(input.trim());
    }
    if (validMillilitres(amount, 50, 2000)) {
      await config().update('drinkAmountMl', amount, vscode.ConfigurationTarget.Global);
    }
  }

  async function changeDailyGoal() {
    const input = await vscode.window.showInputBox({
      title: 'Water Reminder: Daily Goal',
      prompt: 'What is your daily water goal in millilitres?',
      value: String(config().get('dailyGoalMl', 2000)),
      validateInput: (text) => validMillilitres(Number(text.trim()), 250, 10000)
        ? undefined : 'Enter a whole number from 250 to 10000 ml.'
    });
    if (input === undefined) return;
    const goal = Number(input.trim());
    if (validMillilitres(goal, 250, 10000)) {
      await config().update('dailyGoalMl', goal, vscode.ConfigurationTarget.Global);
    }
  }

  async function showHistory() {
    const entries = tracker.entries();
    if (entries.length === 0) {
      await vscode.window.showInformationMessage('No water intake has been recorded yet.');
      return;
    }
    const goal = config().get('dailyGoalMl', 2000);
    const choices = entries.map(({ date, totalMl }) => ({
      label: `$(calendar) ${new Date(`${date}T00:00:00`).toLocaleDateString()}`,
      description: `${totalMl} ml`,
      detail: `${Math.round((totalMl / goal) * 100)}% of the current ${goal} ml goal`
    }));
    await vscode.window.showQuickPick(choices, {
      title: 'Water Reminder: Hydration History',
      placeHolder: 'Daily totals stored locally in this VS Code profile'
    });
  }

  async function showMenu() {
    const choices = [
      reminder.state.enabled
        ? { label: '$(debug-pause) Pause reminders', action: 'pause' }
        : { label: '$(play) Start reminders', action: 'start' },
      { label: '$(check) I drank water', description: `Add ${config().get('drinkAmountMl', 200)} ml`, action: 'drink' },
      { label: '$(clock) Remind me in 5 minutes', action: 'snooze' },
      { label: '$(graph) View hydration history', description: `${tracker.totalFor()} ml today`, action: 'history' },
      { label: '$(symbol-numeric) Change drink amount', description: `${config().get('drinkAmountMl', 200)} ml`, action: 'amount' },
      { label: '$(target) Change daily goal', description: `${config().get('dailyGoalMl', 2000)} ml`, action: 'goal' },
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
    drink: async () => { await recordDrink(); reminder.start(); },
    test: () => reminder.test(),
    interval: changeInterval,
    amount: changeDrinkAmount,
    goal: changeDailyGoal,
    history: showHistory
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
      if (event.affectsConfiguration(`${section}.drinkAmountMl`) ||
          event.affectsConfiguration(`${section}.dailyGoalMl`)) {
        render(reminder.state);
      }
    })
  );

  if (context.globalState.get('enabled', true)) reminder.start();
  else render(reminder.state);
  status.show();
}

module.exports = { activate };
