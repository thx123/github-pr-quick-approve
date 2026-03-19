(() => {
  "use strict";

  const isMac = navigator.platform.toUpperCase().includes("MAC");

  // "mod" = Cmd on Mac, Alt on Windows/Linux
  const DEFAULT_SHORTCUT = { key: "u", mod: true, ctrlKey: false, shiftKey: true };
  let shortcut = DEFAULT_SHORTCUT;
  let approveMessage = "";
  let githubToken = "";

  chrome.storage.sync.get({ shortcut: DEFAULT_SHORTCUT, approveMessage: "", githubToken: "" }, (data) => {
    shortcut = data.shortcut;
    approveMessage = data.approveMessage;
    githubToken = data.githubToken;
  });
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.shortcut) shortcut = changes.shortcut.newValue;
    if (changes.approveMessage) approveMessage = changes.approveMessage.newValue;
    if (changes.githubToken) githubToken = changes.githubToken.newValue;
  });

  function isPRPage() {
    return /^\/[^/]+\/[^/]+\/pull\/\d+/.test(window.location.pathname);
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
    }, 2500);
  }

  function parsePR() {
    const match = window.location.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    if (!match) return null;
    return { owner: match[1], repo: match[2], number: match[3] };
  }

  async function approvePR() {
    if (!isPRPage()) {
      showToast("Not on a PR page", false);
      return;
    }

    if (!githubToken) {
      showToast("Set a GitHub token in extension options", false);
      return;
    }

    const pr = parsePR();
    if (!pr) {
      showToast("Could not parse PR from URL", false);
      return;
    }

    showToast("Approving...");

    try {
      const resp = await fetch(
        `https://api.github.com/repos/${pr.owner}/${pr.repo}/pulls/${pr.number}/reviews`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            event: "APPROVE",
            body: approveMessage || undefined,
          }),
        }
      );

      if (resp.ok) {
        showToast("PR Approved!");
        setTimeout(() => window.location.reload(), 800);
      } else {
        const data = await resp.json().catch(() => ({}));
        showToast(`Approve failed: ${data.message || resp.status}`, false);
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, false);
    }
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

  document.addEventListener("keydown", (e) => {
    const tag = e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable) {
      return;
    }

    if (matchesShortcut(e)) {
      e.preventDefault();
      approvePR();
    }
  });

  console.log("[PR Quick Approve] Loaded — configure shortcut in extension options");
})();
