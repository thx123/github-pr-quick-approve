# GitHub PR Quick Approve

A Chromium extension that lets you approve GitHub pull requests with a single keyboard shortcut.

## Features

- **One-keystroke PR approval** — no clicking through review menus
- **Works from any PR tab** — Conversation, Commits, Checks, or Files Changed
- **Configurable keybinding** — set any modifier+key combo you prefer
- **Custom approval message** — add "LGTM!", a custom note, or leave blank for silent approval
- **Platform-aware defaults** — `⌘+⇧+U` on Mac, `Alt+Shift+U` on Windows/Linux
- **Token validation** — verifies your GitHub token and scopes on save
- **Guided setup** — one-click fine-grained token creation with pre-filled permissions
- **Safe approvals** — approves only the commit you loaded; refuses if new commits were pushed since
- **Visual feedback** — green toast notification on success

## Setup

1. Install the extension (see [Install](#install) below)
2. Open extension options (right-click icon → **Options**)
3. Click **Create token** — this opens GitHub with a pre-filled fine-grained token (Pull requests: Read and write, 90-day expiry). Set **Resource owner** to the org whose PRs you review and choose the repos.
4. Generate the token on GitHub, copy it, and paste it back in the options page
5. The token is validated automatically — you'll see a green confirmation with your username
6. Click **Save**

## Install

### From source (developer mode)

1. Clone this repo:
   ```sh
   git clone https://github.com/be0x74a/github-pr-quick-approve.git
   ```
2. Open `chrome://extensions` in Chrome/Edge/Brave
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the cloned directory

### From releases

1. Download the latest `.zip` from [Releases](https://github.com/be0x74a/github-pr-quick-approve/releases)
2. Unzip it
3. Load unpacked in `chrome://extensions` as above

## Usage

1. Navigate to any GitHub pull request page (any tab)
2. Press the keyboard shortcut (default: `⌘+⇧+U` on Mac / `Alt+Shift+U` on Windows)
3. The PR is approved — you'll see a green confirmation toast

## Configuration

Right-click the extension icon → **Options**, or go to:

`chrome://extensions` → GitHub PR Quick Approve → **Details** → **Extension options**

- **GitHub Token** — required. Fine-grained PAT with `Pull requests: Read and write` (recommended), or a classic PAT with `repo` scope (works, but grants full access to all your repos). Click "Create token" for guided setup.
- **Shortcut** — click the input field, press your desired key combination (must include at least one modifier key)
- **Approval message** — optionally set a review body (e.g. "LGTM!"). Leave empty for a silent approval.

Click **Save** to apply. The token is validated before saving.

## How it works

The extension runs a content script on GitHub PR pages (`github.com/*/pull/*`). When triggered, it asks the background service worker to call the [GitHub REST API](https://docs.github.com/en/rest/pulls/reviews#create-a-review-for-a-pull-request) and submit an approval review.

When a PR page loads, the extension records the PR's head commit. The approval is pinned to that commit, and is refused if the PR has received new commits since — reload to review them first.

**Permissions:**
- `storage` — saves your preferences (keybinding, message, token)
- `host_permissions: api.github.com` — needed to call the GitHub API

Your token is stored in Chrome's local (non-synced) storage, restricted so content scripts on github.com cannot read it. Only the background service worker uses it, and only to call `api.github.com`. The extension makes no other external requests. Synthetic keyboard events from page scripts are ignored.

## Development

```sh
# Clone
git clone https://github.com/be0x74a/github-pr-quick-approve.git
cd github-pr-quick-approve

# Load in Chrome as unpacked extension (see Install above)
# Edit files, then reload the extension in chrome://extensions

# Build release zip
zip -r github-pr-quick-approve.zip . -x '.git/*' -x '.github/*' -x 'README.md' -x 'LICENSE'
```

## License

MIT
