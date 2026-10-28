(() => {
  "use strict";

  const isMac = navigator.platform.toUpperCase().includes("MAC");

  // "mod" = Cmd on Mac, Alt on Windows/Linux
  const DEFAULT_SHORTCUT = { key: "u", mod: true, ctrlKey: false, shiftKey: true };
  let shortcut = DEFAULT_SHORTCUT;
  let approveMessage = "";

  chrome.storage.sync.get({ shortcut: DEFAULT_SHORTCUT, approveMessage: "" }, (data) => {
    shortcut = data.shortcut;
    approveMessage = data.approveMessage;
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    if (changes.shortcut) shortcut = changes.shortcut.newValue;
    if (changes.approveMessage) approveMessage = changes.approveMessage.newValue;
  });

  const PR_PATH = /^\/[^/]+\/[^/]+\/pull\/\d+/;

  function isPRPage() {
    return PR_PATH.test(window.location.pathname);
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
      const prPath = window.location.pathname.match(PR_PATH)[0];
      const resp = await fetch(`${prPath}/commits`, { credentials: "same-origin" });
      if (!resp.ok) return null;
      const match = (await resp.text()).match(/"headSha":"([0-9a-f]{40})"/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  // Submits GitHub's own review form on the Files changed tab. The form
  // carries head_sha — the commit this page is showing — so the approval
  // applies to what you've seen.
  async function approvePR() {
    const form = document.getElementById("pull_requests_submit_review");
    if (!form) {
      showToast("Open the Files changed tab to approve", false);
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
    if (viewedSha && latestSha && viewedSha !== latestSha) {
      showToast("PR has new commits since you loaded it — reload to review them", false);
      return;
    }

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

  function matchesShortcut(e) {
    const mod = isMac ? e.metaKey : e.altKey;
    return (
      e.key.toLowerCase() === shortcut.key &&
      mod === !!shortcut.mod &&
      e.ctrlKey === !!shortcut.ctrlKey &&
      e.shiftKey === !!shortcut.shiftKey
    );
  }

  document.addEventListener(
    "keydown",
    (e) => {
      // Ignore synthetic events dispatched by page scripts or other extensions.
      if (!e.isTrusted) return;

      const hasModifier = e.metaKey || e.altKey || e.ctrlKey;
      if (!hasModifier) {
        const tag = e.target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable) {
          return;
        }
      }

      // Runs on all of github.com so it survives GitHub's in-page navigation,
      // but only acts on PR pages.
      if (isPRPage() && matchesShortcut(e)) {
        e.preventDefault();
        e.stopPropagation();
        approvePR();
      }
    },
    true
  );

  console.log("[PR Quick Approve] Loaded — configure shortcut in extension options");
})();
