(() => {
  "use strict";

  const isMac = navigator.platform.toUpperCase().includes("MAC");

  // "mod" = Cmd on Mac, Alt on Windows/Linux
  const DEFAULT_SHORTCUT = { key: "u", mod: true, ctrlKey: false, shiftKey: true };
  let shortcut = DEFAULT_SHORTCUT;
  // Head commit of the PR when the page loaded: { key, result }, where result
  // is a promise of { sha } or { error }. Approval is
  // pinned to this commit so new pushes can't be approved unseen.
  let viewed = null;

  chrome.storage.sync.get({ shortcut: DEFAULT_SHORTCUT }, (data) => {
    shortcut = data.shortcut;
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.shortcut) shortcut = changes.shortcut.newValue;
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

  function prKey(pr) {
    return `${pr.owner}/${pr.repo}#${pr.number}`;
  }

  function snapshotHead() {
    // After the extension is reloaded, this orphaned script can't message it.
    if (!chrome.runtime?.id) return;
    const pr = parsePR();
    if (!pr) return;
    const key = prKey(pr);
    if (viewed && viewed.key === key) return;
    const result = chrome.runtime
      .sendMessage({ type: "getHeadSha", pr })
      .then((resp) => (resp?.ok ? { sha: resp.sha } : { error: resp?.error || "unknown error" }))
      .catch((err) => ({ error: err.message }));
    viewed = { key, result };
  }

  async function approvePR() {
    if (!isPRPage()) {
      showToast("Not on a PR page", false);
      return;
    }

    const pr = parsePR();
    if (!pr) {
      showToast("Could not parse PR from URL", false);
      return;
    }

    if (!viewed || viewed.key !== prKey(pr)) {
      showToast("Couldn't confirm which commit you're viewing — reload the page", false);
      return;
    }

    showToast("Approving...");

    // Wait for the page-load lookup if it's still in flight.
    const head = await viewed.result;
    if (head.error) {
      showToast(`Couldn't read PR from GitHub: ${head.error}`, false);
      return;
    }

    try {
      const resp = await chrome.runtime.sendMessage({ type: "approve", pr, sha: head.sha });
      if (resp?.ok) {
        showToast("PR Approved!");
        setTimeout(() => window.location.reload(), 800);
      } else {
        showToast(`Approve failed: ${resp?.error || "unknown error"}`, false);
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

      if (matchesShortcut(e)) {
        e.preventDefault();
        e.stopPropagation();
        approvePR();
      }
    },
    true
  );

  snapshotHead();
  // GitHub switches pages via history.pushState, which fires currententrychange
  // (not navigatesuccess). Poll as a fallback in case an update is missed.
  window.navigation?.addEventListener("currententrychange", snapshotHead);
  setInterval(snapshotHead, 1000);

  console.log("[PR Quick Approve] Loaded — configure shortcut in extension options");
})();
