(() => {
  "use strict";

  const isMac = navigator.platform.toUpperCase().includes("MAC");

  // "mod" = Cmd on Mac, Alt on Windows/Linux. Defaults use Ctrl+Shift on
  // every platform.
  const ctrlShift = (key) => ({ key, mod: false, ctrlKey: true, shiftKey: true });
  // Storage key -> default. Keep in sync with options.js.
  const DEFAULT_SHORTCUTS = {
    shortcut: ctrlShift("u"), // approve
    reviewShortcut: ctrlShift("e"),
    conversationTabShortcut: ctrlShift("1"),
    commitsTabShortcut: ctrlShift("2"),
    checksTabShortcut: ctrlShift("3"),
    filesTabShortcut: ctrlShift("4"),
  };
  const shortcuts = { ...DEFAULT_SHORTCUTS };
  let approveMessage = "";

  const settingsLoaded = new Promise((resolve) =>
    chrome.storage.sync.get({ ...DEFAULT_SHORTCUTS, approveMessage: "" }, (data) => {
      for (const key in DEFAULT_SHORTCUTS) shortcuts[key] = data[key];
      approveMessage = data.approveMessage;
      resolve();
    })
  );
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    for (const key in DEFAULT_SHORTCUTS) if (changes[key]) shortcuts[key] = changes[key].newValue;
    if (changes.approveMessage) approveMessage = changes.approveMessage.newValue;
  });

  const PR_PATH = /^\/[^/]+\/[^/]+\/pull\/\d+/;
  // Set before switching to Files changed so the approval (or opening the
  // review dialog) can finish there.
  const PENDING_KEY = "prQuickApprove.pending";
  const PENDING_MAX_AGE_MS = 30000;

  function isPRPage() {
    return PR_PATH.test(window.location.pathname);
  }

  function prPath() {
    return window.location.pathname.match(PR_PATH)[0];
  }

  // Head commit shown by tabs without the review form (e.g. Conversation),
  // read from GitHub's embedded page data.
  function headShaOnPage() {
    for (const script of document.querySelectorAll("script")) {
      const match = script.textContent.match(/"headSha":"([0-9a-f]{40})"/);
      if (match) return match[1];
    }
    return null;
  }

  function switchToFilesTab(action = "approve") {
    if (action === "review") {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify({ path: prPath(), action, at: Date.now() }));
      showToast("Switching to Files changed to open your review...");
      window.location.assign(`${prPath()}/files`);
      return;
    }
    const sha = headShaOnPage();
    if (sha) {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify({ path: prPath(), sha, at: Date.now() }));
      showToast("Switching to Files changed to approve...");
    } else {
      // Without the commit you saw, don't approve unattended.
      showToast("Switching to Files changed — press the shortcut again there");
    }
    window.location.assign(`${prPath()}/files`);
  }

  // Resolves with check()'s result once it's truthy, or after timeoutMs.
  function waitFor(check, timeoutMs, intervalMs = 200) {
    return new Promise((resolve) => {
      const started = Date.now();
      const poll = () => {
        const result = check();
        if (result || Date.now() - started > timeoutMs) resolve(result);
        else setTimeout(poll, intervalMs);
      };
      poll();
    });
  }

  function waitForReviewForm(timeoutMs = 10000) {
    return waitFor(() => document.getElementById("pull_requests_submit_review"), timeoutMs);
  }

  function isShown(el) {
    return el.getClientRects().length > 0;
  }

  async function resumePendingApproval() {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return;
    sessionStorage.removeItem(PENDING_KEY);
    let pending;
    try {
      pending = JSON.parse(raw);
    } catch {
      return;
    }
    if (!isPRPage() || pending.path !== prPath() || Date.now() - pending.at > PENDING_MAX_AGE_MS) return;
    if (!(await waitForReviewForm())) {
      showToast("Couldn't find GitHub's review form on Files changed", false);
      return;
    }
    if (pending.action === "review") openReview();
    else approvePR(pending.sha);
  }

  function showToast(message, success = true) {
    const toast = document.createElement("div");
    toast.textContent = message;
    Object.assign(toast.style, {
      position: "fixed",
      bottom: "24px",
      right: "24px",
      padding: "12px 20px",
      borderRadius: "8px",
      background: success ? "#1a7f37" : "#cf222e",
      color: "#fff",
      fontSize: "14px",
      fontWeight: "600",
      zIndex: "999999",
      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
      transition: "opacity 0.3s ease",
    });
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // Latest head commit according to GitHub right now, or null if it can't be
  // read. Uses your existing GitHub session; no token involved.
  async function currentHeadSha() {
    try {
      const resp = await fetch(`${prPath()}/commits`, { credentials: "same-origin" });
      if (!resp.ok) return null;
      const match = (await resp.text()).match(/"headSha":"([0-9a-f]{40})"/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  // Submits GitHub's own review form on the Files changed tab. The form
  // carries head_sha — the commit this page is showing — so the approval
  // applies to what you've seen. `seenSha` is the commit shown on the tab
  // you pressed the shortcut on, when that wasn't Files changed.
  async function approvePR(seenSha = null) {
    const form = document.getElementById("pull_requests_submit_review");
    if (!form) {
      switchToFilesTab();
      return;
    }

    const approve = form.querySelector('input[name="pull_request_review[event]"][value="approve"]');
    if (!approve) {
      showToast("Couldn't find GitHub's Approve option", false);
      return;
    }
    if (approve.disabled) {
      showToast("GitHub won't let you approve this PR (your own, closed, or no permission)", false);
      return;
    }

    const viewedSha = form.querySelector('input[name="head_sha"]')?.value;
    const latestSha = await currentHeadSha();
    const changed =
      (seenSha && viewedSha && seenSha !== viewedSha) ||
      (viewedSha && latestSha && viewedSha !== latestSha);
    if (changed) {
      showToast("PR has new commits since you loaded it — reload to review them", false);
      return;
    }

    await settingsLoaded;
    approve.checked = true;
    approve.dispatchEvent(new Event("change", { bubbles: true }));

    // Keep anything you've typed in the review box; otherwise use the
    // configured message.
    const body = form.querySelector('textarea[name="pull_request_review[body]"]');
    if (body && !body.value.trim() && approveMessage) {
      body.value = approveMessage;
      body.dispatchEvent(new Event("input", { bubbles: true }));
    }

    showToast("Submitting approval...");
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.click();
    else form.requestSubmit();
  }

  // Opens GitHub's Review changes dialog on the Files changed tab with the
  // cursor in its comment box, ready to type. Doesn't select or submit
  // anything.
  async function openReview() {
    const form = document.getElementById("pull_requests_submit_review");
    if (!form) {
      switchToFilesTab("review");
      return;
    }
    const body = form.querySelector('textarea[name="pull_request_review[body]"]');
    if (!body) {
      showToast("Couldn't find GitHub's review comment box", false);
      return;
    }

    // The form is hidden while the dialog is closed.
    if (!isShown(form)) {
      const toggle =
        document.getElementById("overlay-show-review-changes-modal") ||
        document.querySelector(".js-reviews-toggle");
      if (!toggle) {
        showToast("Couldn't find GitHub's Review changes button", false);
        return;
      }
      toggle.click();
    }
    // Switch back from Preview if it was left selected.
    const dialog = form.closest('dialog, [role="dialog"]') || form;
    dialog.querySelector(".js-write-tab")?.click();

    // Focus once the dialog has opened, so its own autofocus doesn't take it.
    await waitFor(() => isShown(body), 1000, 50);
    body.focus();
    body.setSelectionRange(body.value.length, body.value.length);
  }

  // Path under the PR for each tab. Files changed may also be at /changes.
  const TABS = { conversation: "", commits: "/commits", checks: "/checks", files: "/files" };

  function onTab(tab) {
    const rest = window.location.pathname.slice(prPath().length).replace(/\/$/, "");
    if (tab === "files") return /^\/(files|changes)(\/|$)/.test(rest);
    return rest === TABS[tab];
  }

  // Clicks GitHub's own tab link when there is one, so GitHub switches tabs
  // without a full page load.
  function switchTab(tab) {
    if (onTab(tab)) return;
    const targets = [prPath() + TABS[tab]];
    if (tab === "files") targets.push(prPath() + "/changes");
    const link = [...document.querySelectorAll('a.tabnav-tab, a[class*="TabNavLink"]')].find((a) =>
      targets.includes(a.pathname.replace(/\/$/, ""))
    );
    if (link) link.click();
    else window.location.assign(targets[0]);
  }

  const ACTIONS = [
    { setting: "shortcut", run: () => approvePR() },
    { setting: "reviewShortcut", run: () => openReview() },
    { setting: "conversationTabShortcut", run: () => switchTab("conversation"), tab: true },
    { setting: "commitsTabShortcut", run: () => switchTab("commits"), tab: true },
    { setting: "checksTabShortcut", run: () => switchTab("checks"), tab: true },
    { setting: "filesTabShortcut", run: () => switchTab("files"), tab: true },
  ];

  // Number keys are read by position: with Shift held, e.key is "!", "@"...
  // depending on the keyboard layout. Keep in sync with options.js.
  function shortcutKey(e) {
    const digit = /^Digit(\d)$/.exec(e.code);
    if (digit) return digit[1];
    return e.key.length === 1 ? e.key.toLowerCase() : e.key;
  }

  function matchesShortcut(e, s) {
    const mod = isMac ? e.metaKey : e.altKey;
    return (
      shortcutKey(e) === s.key &&
      mod === !!s.mod &&
      e.ctrlKey === !!s.ctrlKey &&
      e.shiftKey === !!s.shiftKey
    );
  }

  document.addEventListener(
    "keydown",
    (e) => {
      // Ignore synthetic events dispatched by page scripts or other extensions.
      if (!e.isTrusted) return;

      const hasModifier = e.metaKey || e.altKey || e.ctrlKey;
      const tag = e.target.tagName;
      const inTextField = tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable;
      if (!hasModifier && inTextField) return;

      // Runs on all of github.com so it survives GitHub's in-page navigation,
      // but only acts on PR pages.
      if (!isPRPage()) return;
      const action = ACTIONS.find((a) => matchesShortcut(e, shortcuts[a.setting]));
      // Tab shortcuts are left alone while typing, so they don't take over
      // editing keys like Cmd+Shift+V (paste as plain text).
      if (!action || (action.tab && inTextField)) return;
      e.preventDefault();
      e.stopPropagation();
      action.run();
    },
    true
  );

  resumePendingApproval();

  console.log("[PR Quick Approve] Loaded — configure shortcut in extension options");
})();
