# GitHub PR Quick Approve

A Chromium extension that approves the GitHub pull request you're reviewing with a single keyboard shortcut, or opens GitHub's review box so you can write a review. It also has shortcuts for switching between a PR's tabs. It needs **no GitHub token**: it submits GitHub's own review form using your normal browser login.

## How to use

1. Open a PR and review it.
2. Press the shortcut (default `Ctrl+Shift+U`, `⌃⇧U` on Mac) on any PR tab.
3. The approval is submitted as if you'd used **Review changes → Approve → Submit review**, and GitHub shows the result.

GitHub's review form only exists on the **Files changed** tab. Pressed anywhere else, the extension notes which commit that tab is showing, switches to Files changed, and finishes the approval there — refusing if Files changed shows a different commit.

Anything you've typed in GitHub's review box is kept as the review body; otherwise your configured approval message is used. Pending review comments are submitted with it, just as with the normal button.

### Writing a review instead

To write a review rather than approve, press the second shortcut (default `Ctrl+Shift+E`, `⌃⇧E` on Mac). It opens **Review changes** with the cursor in the **Write** box, so you can start typing right away. Nothing is selected or submitted; pick Comment, Approve or Request changes yourself. Like the approve shortcut, it works from any PR tab and switches to Files changed first if needed.

### Switching tabs

| Tab | Default (`⌃⇧` on Mac) |
| --- | --- |
| Conversation | `Ctrl+Shift+1` |
| Commits | `Ctrl+Shift+2` |
| Checks | `Ctrl+Shift+3` |
| Files changed | `Ctrl+Shift+4` |

These don't fire while you're typing in a text box. The approve and write review shortcuts do work while typing.

Number keys are matched by position, so they work on any keyboard layout even though Shift turns them into symbols.

## Install

1. Clone this repo
2. Open `chrome://extensions` in Chrome/Edge/Brave and enable **Developer mode**
3. Click **Load unpacked** and select the folder

To update, pull, click the reload icon on the extension, then reload open GitHub tabs.

## Configuration

Right-click the extension icon → **Options**:

- **Approve**, **Write review** and **Switch tab** shortcuts — click a field and press a key combination (must include a modifier, and no two may be the same). Defaults all use Ctrl+Shift on every platform; Ctrl is the Control key (`⌃`) on Mac, not Command. When you update, any shortcut still set to an old default (`⌘⇧U` / `Alt+Shift+U`, `⌘⇧E` / `Alt+Shift+E`) moves to the new one; shortcuts you picked yourself are kept.
- **Approval message** — optional review body, e.g. "LGTM!". Leave empty for a silent approval.

Both sync across your Chrome profiles.

## Messages

| Message | Meaning |
| --- | --- |
| `Switching to Files changed to approve...` | You pressed it on another tab; the approval finishes after the switch. |
| `Switching to Files changed to open your review...` | You pressed the write review shortcut on another tab; the review box opens after the switch. |
| `Switching to Files changed — press the shortcut again there` | The tab you were on didn't show which commit it was displaying, so it won't approve unattended. Press again once Files changed loads. |
| `Couldn't find GitHub's review form on Files changed` | Files changed didn't show the review form within 10 seconds of switching. |
| `PR has new commits since you loaded it — reload to review them` | Someone pushed after you opened the page. Reload and review the new commits. |
| `GitHub won't let you approve this PR` | It's your own PR, it's closed or merged, or you lack permission. |
| `Couldn't find GitHub's Approve option` | GitHub changed its page; the extension needs updating. |
| `Couldn't find GitHub's Review changes button` / `review comment box` | Same: GitHub changed its page. |

## How it works

The content script runs on github.com and acts only on PR pages, so it keeps working when GitHub switches pages without a full reload. On the shortcut it:

1. Ignores synthetic key events, so page scripts and other extensions can't trigger it.
2. Finds GitHub's review form (`#pull_requests_submit_review`) on the Files changed tab. The form carries `head_sha`, the commit the page is showing. On other tabs, it reads the commit from GitHub's embedded page data, saves it in the tab's `sessionStorage` for 30 seconds, and loads Files changed, which resumes the approval and requires that commit to match `head_sha`.
3. Fetches the PR's `/commits` page with your session to read the latest head commit, and refuses if it differs from what you're viewing. If that page can't be read, it relies on the form's `head_sha`.
4. Selects **Approve**, fills the message if the box is empty, and clicks GitHub's **Submit review** button.

The tab shortcuts click GitHub's own tab links, so the switch happens without a full page load; if a link can't be found, they load the tab's address instead.

The write review shortcut uses the same form: it clicks GitHub's **Review changes** button (unless the dialog is already open), switches the comment box back from Preview to Write if needed, and puts the cursor at the end of the box.

**Permissions:** only `storage`, for the shortcuts and message. No host permissions, no tokens, and no requests to anything except the github.com page you're on.

## History

Based on [be0x74a/github-pr-quick-approve](https://github.com/be0x74a/github-pr-quick-approve) v2.0.1 (MIT). v3.0.0 replaces the personal access token and REST API with GitHub's own review form, because orgs may not allow personal access tokens. Tokens saved by earlier versions are deleted on update. v3.1.0 adds the write review shortcut. v3.2.0 adds tab shortcuts and moves every default to Ctrl+Shift (approve was `⌘⇧U` / `Alt+Shift+U`).

## License

MIT — see [LICENSE](LICENSE).
