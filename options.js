"use strict";

const isMac = navigator.platform.toUpperCase().includes("MAC");
const DEFAULT_SHORTCUT = { key: "u", mod: true, ctrlKey: false, shiftKey: true };
const DEFAULT_MESSAGE = "";

const input = document.getElementById("shortcut-input");
const messageInput = document.getElementById("message-input");
const saveBtn = document.getElementById("save-btn");
const resetBtn = document.getElementById("reset-btn");
const statusEl = document.getElementById("status");

let pendingShortcut = null;

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
  await chrome.storage.sync.set({ shortcut: pendingShortcut, approveMessage: messageInput.value });
  showSaved();
});

resetBtn.addEventListener("click", async () => {
  pendingShortcut = DEFAULT_SHORTCUT;
  input.value = formatShortcut(DEFAULT_SHORTCUT);
  messageInput.value = DEFAULT_MESSAGE;
  await chrome.storage.sync.set({ shortcut: DEFAULT_SHORTCUT, approveMessage: DEFAULT_MESSAGE });
  showSaved();
});

loadSettings();
