"use strict";

const isMac = navigator.platform.toUpperCase().includes("MAC");
const DEFAULT_SHORTCUT = { key: "u", mod: true, ctrlKey: false, shiftKey: true };
const DEFAULT_REVIEW_SHORTCUT = { key: "e", mod: true, ctrlKey: false, shiftKey: true };
const DEFAULT_MESSAGE = "";

const messageInput = document.getElementById("message-input");
const saveBtn = document.getElementById("save-btn");
const resetBtn = document.getElementById("reset-btn");
const statusEl = document.getElementById("status");
const errorEl = document.getElementById("shortcut-error");

// Storage key -> { input, defaults, pending }
const shortcutFields = {
  shortcut: { input: document.getElementById("shortcut-input"), defaults: DEFAULT_SHORTCUT, pending: null },
  reviewShortcut: {
    input: document.getElementById("review-shortcut-input"),
    defaults: DEFAULT_REVIEW_SHORTCUT,
    pending: null,
  },
};

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

function sameShortcut(a, b) {
  return a.key === b.key && !!a.mod === !!b.mod && !!a.ctrlKey === !!b.ctrlKey && !!a.shiftKey === !!b.shiftKey;
}

// --- Load / Save ---

function showSaved() {
  statusEl.classList.add("saved");
  setTimeout(() => statusEl.classList.remove("saved"), 2000);
}

function setShortcut(field, s) {
  field.pending = s;
  field.input.value = formatShortcut(s);
}

function loadSettings() {
  chrome.storage.sync.get(
    { shortcut: DEFAULT_SHORTCUT, reviewShortcut: DEFAULT_REVIEW_SHORTCUT, approveMessage: DEFAULT_MESSAGE },
    (data) => {
      for (const [key, field] of Object.entries(shortcutFields)) setShortcut(field, data[key]);
      messageInput.value = data.approveMessage;
    }
  );
}

for (const field of Object.values(shortcutFields)) {
  const { input } = field;

  input.addEventListener("focus", () => {
    input.classList.add("recording");
    input.value = "Press a key combination...";
  });

  input.addEventListener("blur", () => {
    input.classList.remove("recording");
    if (field.pending) input.value = formatShortcut(field.pending);
  });

  input.addEventListener("keydown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;
    const s = eventToShortcut(e);
    if (!hasModifier(s)) return;
    setShortcut(field, s);
    errorEl.hidden = true;
    input.classList.remove("recording");
    input.blur();
  });
}

saveBtn.addEventListener("click", async () => {
  const { shortcut, reviewShortcut } = shortcutFields;
  if (!shortcut.pending || !reviewShortcut.pending) return;
  if (sameShortcut(shortcut.pending, reviewShortcut.pending)) {
    errorEl.hidden = false;
    return;
  }
  await chrome.storage.sync.set({
    shortcut: shortcut.pending,
    reviewShortcut: reviewShortcut.pending,
    approveMessage: messageInput.value,
  });
  showSaved();
});

resetBtn.addEventListener("click", async () => {
  for (const field of Object.values(shortcutFields)) setShortcut(field, field.defaults);
  messageInput.value = DEFAULT_MESSAGE;
  errorEl.hidden = true;
  await chrome.storage.sync.set({
    shortcut: DEFAULT_SHORTCUT,
    reviewShortcut: DEFAULT_REVIEW_SHORTCUT,
    approveMessage: DEFAULT_MESSAGE,
  });
  showSaved();
});

loadSettings();
