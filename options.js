"use strict";

const isMac = navigator.platform.toUpperCase().includes("MAC");
const DEFAULT_SHORTCUT = { key: "u", mod: true, ctrlKey: false, shiftKey: true };
const DEFAULT_MESSAGE = "";
// Fine-grained PAT limited to pull requests, with an expiry. Classic tokens with
// "repo" scope grant full access to every repo the user can reach.
const TOKEN_CREATE_URL =
  "https://github.com/settings/personal-access-tokens/new" +
  "?name=PR+Quick+Approve&description=GitHub+PR+Quick+Approve+extension" +
  "&expires_in=90&pull_requests=write";

const welcomeEl = document.getElementById("welcome");
const tokenInput = document.getElementById("token-input");
const tokenStatus = document.getElementById("token-status");
const createTokenBtn = document.getElementById("create-token-btn");
const input = document.getElementById("shortcut-input");
const messageInput = document.getElementById("message-input");
const saveBtn = document.getElementById("save-btn");
const resetBtn = document.getElementById("reset-btn");
const statusEl = document.getElementById("status");

let pendingShortcut = null;

// --- Token validation ---

async function validateToken(token) {
  if (!token) {
    setTokenStatus("", "");
    return;
  }

  setTokenStatus("Checking...", "checking");

  try {
    const resp = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    });

    if (!resp.ok) {
      setTokenStatus("Invalid token — authentication failed", "invalid");
      return false;
    }

    const user = await resp.json();
    const scopes = resp.headers.get("x-oauth-scopes") || "";

    // Classic PAT — check for repo scope
    if (scopes) {
      const scopeList = scopes.split(",").map((s) => s.trim());
      if (!scopeList.includes("repo")) {
        setTokenStatus(
          `Authenticated as ${user.login}, but missing "repo" scope`,
          "invalid"
        );
        return false;
      }
      setTokenStatus(
        `Valid — ${user.login} (classic PAT). Works, but "repo" grants full access to all your repos; a fine-grained token is safer.`,
        "valid"
      );
      return true;
    }

    // Fine-grained PAT — no x-oauth-scopes header. Verify by testing PR access.
    setTokenStatus(`Valid — ${user.login} (fine-grained PAT)`, "valid");
    return true;
  } catch (err) {
    setTokenStatus(`Error: ${err.message}`, "invalid");
    return false;
  }
}

function setTokenStatus(text, className) {
  tokenStatus.textContent = text;
  tokenStatus.className = className;
}

// --- Create token flow ---

createTokenBtn.addEventListener("click", () => {
  window.open(TOKEN_CREATE_URL, "_blank");
  setTokenStatus(
    'After creating the token, paste it above and click Save.',
    "checking"
  );
  tokenInput.focus();
});

// Validate on paste (user pastes token from GitHub)
tokenInput.addEventListener("paste", () => {
  setTimeout(() => validateToken(tokenInput.value.trim()), 100);
});

// Also validate on input (e.g. autofill)
let validateDebounce;
tokenInput.addEventListener("input", () => {
  clearTimeout(validateDebounce);
  validateDebounce = setTimeout(() => validateToken(tokenInput.value.trim()), 500);
});

// --- Shortcut formatting ---

function modLabel() {
  return isMac ? "\u2318" : "Alt";
}

function formatShortcut(s) {
  const parts = [];
  if (s.ctrlKey) parts.push(isMac ? "\u2303" : "Ctrl");
  if (s.mod) parts.push(modLabel());
  if (s.shiftKey) parts.push(isMac ? "\u21E7" : "Shift");
  parts.push(s.key.length === 1 ? s.key.toUpperCase() : s.key);
  return parts.join(" + ");
}

function eventToShortcut(e) {
  const mod = isMac ? e.metaKey : e.altKey;
  return {
    key: e.key.length === 1 ? e.key.toLowerCase() : e.key,
    mod,
    ctrlKey: e.ctrlKey,
    shiftKey: e.shiftKey,
  };
}

function hasModifier(s) {
  return s.mod || s.ctrlKey || s.shiftKey;
}

// --- Load / Save ---

function showSaved() {
  statusEl.classList.add("saved");
  setTimeout(() => statusEl.classList.remove("saved"), 2000);
}

function loadSettings() {
  chrome.storage.sync.get(
    { shortcut: DEFAULT_SHORTCUT, approveMessage: DEFAULT_MESSAGE },
    (data) => {
      pendingShortcut = data.shortcut;
      input.value = formatShortcut(data.shortcut);
      messageInput.value = data.approveMessage;
    }
  );
  // Token is device-local (not synced) and hidden from content scripts.
  chrome.storage.local.get({ githubToken: "" }, ({ githubToken }) => {
    tokenInput.value = githubToken;

    // Hide welcome banner if already configured
    if (githubToken) {
      welcomeEl.style.display = "none";
      validateToken(githubToken);
    }
  });
}

input.addEventListener("focus", () => {
  input.classList.add("recording");
  input.value = "Press a key combination...";
});

input.addEventListener("blur", () => {
  input.classList.remove("recording");
  if (pendingShortcut) {
    input.value = formatShortcut(pendingShortcut);
  }
});

input.addEventListener("keydown", (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;
  const s = eventToShortcut(e);
  if (!hasModifier(s)) return;
  pendingShortcut = s;
  input.value = formatShortcut(pendingShortcut);
  input.classList.remove("recording");
  input.blur();
});

saveBtn.addEventListener("click", async () => {
  if (!pendingShortcut) return;

  const token = tokenInput.value.trim();

  // Validate token before saving
  if (token) {
    const valid = await validateToken(token);
    if (!valid) return;
  }

  await chrome.storage.local.set({ githubToken: token });
  await chrome.storage.sync.set({ shortcut: pendingShortcut, approveMessage: messageInput.value });
  showSaved();
});

resetBtn.addEventListener("click", async () => {
  pendingShortcut = DEFAULT_SHORTCUT;
  input.value = formatShortcut(DEFAULT_SHORTCUT);
  messageInput.value = DEFAULT_MESSAGE;
  tokenInput.value = "";
  setTokenStatus("", "");
  await chrome.storage.local.remove("githubToken");
  await chrome.storage.sync.set({ shortcut: DEFAULT_SHORTCUT, approveMessage: DEFAULT_MESSAGE });
  showSaved();
});

loadSettings();
