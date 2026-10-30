"use strict";

const isMac = navigator.platform.toUpperCase().includes("MAC");
const ctrlShift = (key) => ({ key, mod: false, ctrlKey: true, shiftKey: true });
const DEFAULT_MESSAGE = "";

const messageInput = document.getElementById("message-input");
const saveBtn = document.getElementById("save-btn");
const resetBtn = document.getElementById("reset-btn");
const statusEl = document.getElementById("status");
const errorEl = document.getElementById("shortcut-error");

// Storage key -> field. Keep keys and defaults in sync with content.js.
const shortcutFields = {};
for (const [key, inputId, name, defaults] of [
  ["shortcut", "shortcut-input", "Approve", ctrlShift("u")],
  ["reviewShortcut", "review-shortcut-input", "Write review", ctrlShift("e")],
  ["conversationTabShortcut", "conversation-tab-input", "Conversation", ctrlShift("1")],
  ["commitsTabShortcut", "commits-tab-input", "Commits", ctrlShift("2")],
  ["checksTabShortcut", "checks-tab-input", "Checks", ctrlShift("3")],
  ["filesTabShortcut", "files-tab-input", "Files changed", ctrlShift("4")],
]) {
  shortcutFields[key] = { input: document.getElementById(inputId), name, defaults, pending: null };
}

function defaultSettings() {
  const settings = { approveMessage: DEFAULT_MESSAGE };
  for (const [key, field] of Object.entries(shortcutFields)) settings[key] = field.defaults;
  return settings;
}

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

// Number keys are read by position: with Shift held, e.key is "!", "@"...
// depending on the keyboard layout. Keep in sync with content.js.
function shortcutKey(e) {
  const digit = /^Digit(\d)$/.exec(e.code);
  if (digit) return digit[1];
  return e.key.length === 1 ? e.key.toLowerCase() : e.key;
}

function eventToShortcut(e) {
  const mod = isMac ? e.metaKey : e.altKey;
  return {
    key: shortcutKey(e),
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
  chrome.storage.sync.get(defaultSettings(), (data) => {
    for (const [key, field] of Object.entries(shortcutFields)) setShortcut(field, data[key]);
    messageInput.value = data.approveMessage;
  });
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
  const fields = Object.values(shortcutFields);
  if (fields.some((f) => !f.pending)) return;
  for (let i = 0; i < fields.length; i++) {
    for (let j = i + 1; j < fields.length; j++) {
      if (sameShortcut(fields[i].pending, fields[j].pending)) {
        errorEl.textContent = `${fields[i].name} and ${fields[j].name} use the same shortcut. Pick a different one for one of them.`;
        errorEl.hidden = false;
        return;
      }
    }
  }
  const settings = { approveMessage: messageInput.value };
  for (const [key, field] of Object.entries(shortcutFields)) settings[key] = field.pending;
  await chrome.storage.sync.set(settings);
  showSaved();
});

resetBtn.addEventListener("click", async () => {
  for (const field of Object.values(shortcutFields)) setShortcut(field, field.defaults);
  messageInput.value = DEFAULT_MESSAGE;
  errorEl.hidden = true;
  await chrome.storage.sync.set(defaultSettings());
  showSaved();
});

loadSettings();
