(() => {
  "use strict";

  const isMac = navigator.platform.toUpperCase().includes("MAC");

  // "mod" = Cmd on Mac, Alt on Windows/Linux
  const DEFAULT_SHORTCUT = { key: "u", mod: true, ctrlKey: false, shiftKey: true };
  let shortcut = DEFAULT_SHORTCUT;

  chrome.storage.sync.get({ shortcut: DEFAULT_SHORTCUT }, (data) => {
    shortcut = data.shortcut;
  });
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.shortcut) {
      shortcut = changes.shortcut.newValue;
    }
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

  async function getCSRFToken() {
    const reviewForms = document.querySelectorAll('form[action$="/reviews"]');
    for (const form of reviewForms) {
      const token = form.querySelector('input[name="authenticity_token"]');
      if (token) return token.value;
    }

    const resp = await fetch(window.location.href, { credentials: "same-origin" });
    const html = await resp.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const tokenEl = doc.querySelector('form[action$="/reviews"] input[name="authenticity_token"]');
    if (tokenEl) return tokenEl.value;

    return null;
  }

  function getReviewFormAction() {
    const form = document.querySelector('form[action$="/reviews"]');
    if (form) return form.getAttribute("action");

    const match = window.location.pathname.match(/^(\/[^/]+\/[^/]+\/pull\/\d+)/);
    if (match) return match[1] + "/reviews";
    return null;
  }

  async function approvePR() {
    if (!isPRPage()) {
      showToast("Not on a PR page", false);
      return;
    }

    const action = getReviewFormAction();
    if (!action) {
      showToast("Could not find review endpoint", false);
      return;
    }

    const token = await getCSRFToken();
    if (!token) {
      showToast("Could not get CSRF token", false);
      return;
    }

    const formData = new FormData();
    formData.append("authenticity_token", token);
    formData.append("pull_request_review[event]", "approve");
    formData.append("pull_request_review[body]", "");

    try {
      const resp = await fetch(action, {
        method: "POST",
        credentials: "same-origin",
        body: formData,
      });

      if (resp.ok) {
        showToast("PR Approved!");
        setTimeout(() => window.location.reload(), 800);
      } else {
        showToast(`Approve failed (${resp.status})`, false);
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
