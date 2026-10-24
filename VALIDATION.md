# Validation — 24 October 2026

## Completed automated checks

- All 26 Node.js tests pass using Node.js 24.15.0.
- JavaScript syntax checks pass for all four runtime files.
- Reminder tests cover default timing, acknowledgement, dismissal, five-minute
  snooze, pause/resume, background focus, duplicate prevention, invalid
  settings, changed intervals, stale notification actions, and timer disposal.
- Adapter tests check manifest/command agreement, status-bar wiring, ordered
  persistence of Start/Pause, user-level settings, Explorer view registration,
  state updates, quick-action allowlisting, publisher identity, repository
  links, and Marketplace icon metadata.
- Hydration tracking tests cover configurable drink amounts, serialized writes,
  local-date rollover, invalid values, corrupted data, retained history, and
  recovery after a temporary storage failure.
- The extension has no npm runtime dependencies. Packaging excludes tests,
  development configuration, caches, and tool dependencies.
- Packaged with Microsoft `@vscode/vsce` 4.0.0. The package contains twelve
  entries and is approximately 148 KB.

## Desktop verification still needed

Use this short check after installation:

1. Run **Water Reminder: Test Reminder Now** and confirm the notification and
   its three buttons appear.
2. Open Explorer and confirm **Hydration Buddy** shows an animated water glass,
   a live countdown, today's intake and goal, and working Drink, History,
   Amount, Snooze, and Pause/Start buttons. Drag the view above the file tree
   if that is your preferred position.
3. Set the drink amount to **150 ml**, record two drinks, and confirm today's
   total becomes **300 ml**. Open History and confirm today's entry appears.
4. Dismiss the test, change the interval to **1 minute**, and check that the next
   reminder arrives. Click **I drank water** and check the following interval.
5. Choose **Remind me in 5 minutes** and confirm the next reminder waits five
   minutes.
6. Pause reminders. Reload VS Code and confirm **Water** remains paused and the
   recorded total remains available.
7. Start again, switch to another application for over a minute, and return.
   Confirm that only one due reminder is shown.
8. Restore your preferred interval, such as **30 minutes**.

Native notifications may be suppressed by VS Code's Do Not Disturb setting.
Timers and hydration histories are independent across VS Code profiles.
