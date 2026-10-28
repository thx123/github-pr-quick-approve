# GitHub PR Quick Approve

A Chromium extension that approves the GitHub pull request you're reviewing with a single keyboard shortcut. It needs **no GitHub token**: it submits GitHub's own review form using your normal browser login.

## How to use

1. Open a PR's **Files changed** tab and review it.
2. Press the shortcut (default `⌘+⇧+U` on Mac, `Alt+Shift+U` on Windows/Linux).
3. The approval is submitted as if you'd used **Review changes → Approve → Submit review**, and GitHub shows the result.

Anything you've typed in GitHub's review box is kept as the review body; otherwise your configured approval message is used. Pending review comments are submitted with it, just as with the normal button.

## Install

1. Clone this repo
2. Open `chrome://extensions` in Chrome/Edge/Brave and enable **Developer mode**
3. Click **Load unpacked** and select the folder

To update, pull, click the reload icon on the extension, then reload open GitHub tabs.

## Configuration

Right-click the extension icon → **Options**:

- **Shortcut** — click the field and press a key combination (must include a modifier)
- **Approval message** — optional review body, e.g. "LGTM!". Leave empty for a silent approval.

Both sync across your Chrome profiles.

## Messages

| Message | Meaning |
| --- | --- |
| `Open the Files changed tab to approve` | GitHub's review form only exists on that tab. |
| `PR has new commits since you loaded it — reload to review them` | Someone pushed after you opened the page. Reload and review the new commits. |
| `GitHub won't let you approve this PR` | It's your own PR, it's closed or merged, or you lack permission. |
| `Couldn't find GitHub's Approve option` | GitHub changed its page; the extension needs updating. |

## How it works

The content script runs on github.com and acts only on PR pages, so it keeps working when GitHub switches pages without a full reload. On the shortcut it:

1. Ignores synthetic key events, so page scripts and other extensions can't trigger it.
2. Finds GitHub's review form (`#pull_requests_submit_review`) on the Files changed tab. The form carries `head_sha`, the commit the page is showing.
3. Fetches the PR's `/commits` page with your session to read the latest head commit, and refuses if it differs from what you're viewing. If that page can't be read, it relies on the form's `head_sha`.
4. Selects **Approve**, fills the message if the box is empty, and clicks GitHub's **Submit review** button.

**Permissions:** only `storage`, for the shortcut and message. No host permissions, no tokens, and no requests to anything except the github.com page you're on.

## History

Based on [be0x74a/github-pr-quick-approve](https://github.com/be0x74a/github-pr-quick-approve) v2.0.1 (MIT). v3.0.0 replaces the personal access token and REST API with GitHub's own review form, because orgs may not allow personal access tokens. Tokens saved by earlier versions are deleted on update.

## License

MIT — see [LICENSE](LICENSE).
