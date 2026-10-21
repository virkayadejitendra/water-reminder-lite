# Validation — 21 October 2026

## Completed automated checks

- All 18 Node.js tests pass using Node.js 24.15.0.
- JavaScript syntax checks pass for all three runtime files.
- Tests cover default timing, acknowledgement, dismissal, five-minute snooze,
  pause/resume, background focus, duplicate prevention, invalid settings,
  changed intervals, stale notification actions and timer disposal.
- Adapter tests check manifest/command agreement, status-bar wiring, ordered
  persistence of Start/Pause, user-level interval updates, Explorer view
  registration, state updates, and quick-action allowlisting.
- The extension has no npm runtime dependencies. Packaging excludes tests,
  development configuration, caches and tool dependencies.

- Packaged with Microsoft `@vscode/vsce` 4.0.0. The VSIX archive integrity,
  manifest XML and exact runtime file contents were checked. The package
  contains eight entries and is 11605 bytes.

## Desktop verification still needed

This environment does not have a desktop VS Code installation. The tests use
a simulated clock and an API stub; they do not prove rendering or behavior in
an actual VS Code window. Use this short check after installation:

1. Run **Water Reminder: Test Reminder Now** and confirm the notification and
   its three buttons appear.
2. Open Explorer and confirm **Hydration Buddy** shows an animated water glass,
   a live countdown, and working Drink, Snooze, and Pause/Start buttons. Drag
   the view above the file tree if that is your preferred position.
3. Dismiss the test, change the interval to **1 minute**, and check that the next
   reminder arrives. Click **I drank water** and check the following interval.
4. Choose **Remind me in 5 minutes** and confirm the next reminder waits five
   minutes.
5. Pause reminders. Reload VS Code and confirm **Water** remains paused.
6. Start again, switch to another application for over a minute, and return.
   Confirm that only one due reminder is shown.
7. Restore your preferred interval, such as **30 minutes**.

Native notifications may be suppressed by VS Code's Do Not Disturb setting.
Timers are independent across multiple VS Code windows.
