# Water Reminder Lite

A small, offline VS Code extension that reminds you to take a water break.
It uses plain JavaScript, native VS Code notifications, a status-bar control
and one scheduled timer. There are **no runtime dependencies**, accounts,
network requests, telemetry, webviews or build steps.

## Install and use

1. Download `water-reminder-lite-0.1.0.vsix`.
2. Open VS Code and press **Ctrl+Shift+P** (macOS: **Cmd+Shift+P**).
3. Run **Extensions: Install from VSIX...** and choose the downloaded file.
4. If VS Code asks, reload the window. **Water** appears on the right of the status bar.
5. Run **Water Reminder: Test Reminder Now** to see the notification immediately.

Automatic reminders start after **30 minutes**. The animated **Hydration Buddy**
appears in the Explorer sidebar beside your files, with quick buttons to record
a drink, snooze, pause, or start. You can drag its title to place the view above
or below the file tree. Click **Water** in the status bar for the full controls,
or search for **Water Reminder** in the Command Palette.

The notification says:

> Time for a water break. Take a few sips.

Its buttons are **I drank water**, **Remind me in 5 minutes**, and **Pause reminders**.

## Change the interval

Run **Water Reminder: Change Interval** and enter a whole number from 1 to 240.
Alternatively, search for **Water Reminder Lite** in Settings, or add this to
your user `settings.json`:

```json
"waterReminderLite.intervalMinutes": 30
```

Changing the interval restarts an active timer. It leaves a paused timer paused.
**I Drank Water (Restart Timer)** starts a fresh normal interval, including when
you use it while reminders are paused. **Remind Me in 5 Minutes** also resumes
reminders if they were paused.

## Reminder behavior

- Reminders run only while desktop VS Code is open. They are notifications
  inside VS Code, not phone alarms or operating-system background notifications.
- If VS Code is in the background when a reminder is due, it waits until that
  window receives focus. Missed intervals do not create a backlog.
- Only one notification can be pending per window. **Click a button or dismiss
  the notification to begin the next interval.** If the toast has disappeared,
  find the reminder in VS Code's notification center, using its bell icon.
- Pause is remembered locally for the next activation in the same VS Code
  profile. Reloading while enabled starts a fresh interval; elapsed time is
  not carried over from a closed window.
- Each VS Code window has its own timer. Live pause and snooze actions apply
  to that window. Switching among several overdue windows can show one reminder
  in each. There is no cross-window coordinator.
- **Test Reminder Now** does not enable a paused schedule. While enabled,
  the next interval begins when the test notification is answered or dismissed.
- If you use a command to change the schedule while an old notification remains
  open, the old notification's buttons cannot overwrite your newer choice.
- VS Code's Do Not Disturb mode can suppress reminder toasts.

## Open and edit the source

1. Extract `water-reminder-lite-source.zip`.
2. In VS Code, open the extracted **water-reminder-lite** folder itself.
3. Press **F5**, then choose **Run Water Reminder** if prompted. This opens an
   **Extension Development Host** window with the extension loaded.
4. In that new window, run **Water Reminder: Test Reminder Now**.
5. Edit the source, then reload the development window to see your changes.

No `npm install` or compilation is needed to run the extension. To avoid
confusing two versions, disable an installed copy of this extension in the
development window before testing your source copy if necessary.

| File | Purpose |
| --- | --- |
| `package.json` | VS Code metadata, commands and the interval setting |
| `extension.js` | Connects commands, notifications, settings and the status bar |
| `src/reminder.js` | Handles timer, focus, snooze and pause behavior |
| `src/hydrationView.js` | Renders the animated Explorer sidebar view and its quick actions |
| `test/reminder.test.js` | Tests timing and notification interactions without waiting in real time |
| `test/extension.test.js` | Checks command registration, settings and persistence with a VS Code API stub |
| `.vscode/launch.json` | Makes F5 launch the development window |

The timer uses JavaScript's `setTimeout`, broadly similar to scheduling a
one-shot timer in C#. VS Code's `context.subscriptions` disposes the timer and
event handlers when the extension shuts down.

## Test and package your changes

With Node.js 22 or newer installed, run these commands from the project folder:

```sh
npm test
npm run package
```

The packaging command downloads Microsoft's `@vscode/vsce` tool if necessary;
that development tool is **not included in the installed extension**.
The resulting `.vsix` can be installed using the instructions above.

`jitendra-local` is a local packaging identifier. Publishing to the Marketplace
requires your own registered publisher ID in `package.json`, and a new version
number when releasing changes. No Marketplace account is needed to use this
local VSIX. Minimum supported desktop VS Code version: 1.85.

## Verification

See `VALIDATION.md` in the source archive for the completed automated checks
and the desktop smoke-check steps. This project was prepared in an environment
without a desktop VS Code installation; native UI behavior has not been
verified there.

## References

- [VS Code extension manifest](https://code.visualstudio.com/api/references/extension-manifest)
- [VS Code notification API](https://code.visualstudio.com/api/references/vscode-api#window.showInformationMessage)
- [Packaging and installing VSIX extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#packaging-extensions)

MIT licensed.
