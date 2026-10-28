# Privacy Policy — GitHub PR Quick Approve

**Last updated:** 2026-03-19

## Data collected

This extension stores the following data locally in your browser:

- **GitHub Personal Access Token** — used to authenticate API requests (Chrome local storage, not synced)
- **Keyboard shortcut preference** — your configured keybinding (Chrome synced storage)
- **Approval message** — your configured review body text (Chrome synced storage)

## How data is used

- Your GitHub token is sent **only** to `api.github.com` to submit pull request reviews on your behalf.
- No data is sent to any other server, third party, or analytics service.
- No data is sold, shared, or transferred to third parties.

## Data storage

Your token is stored with Chrome's `storage.local` API: it stays on this device and is not readable by the extension's scripts on github.com pages. Your shortcut and approval message use `storage.sync`, so if you are signed into Chrome they may sync across your devices via your Google account. You can clear all extension data by resetting to defaults in the extension options or by uninstalling the extension.

## Permissions

- **storage** — required to save your preferences and token
- **host_permissions (api.github.com)** — required to call the GitHub API

## Contact

For questions or concerns, open an issue at [github.com/be0x74a/github-pr-quick-approve](https://github.com/be0x74a/github-pr-quick-approve/issues).
