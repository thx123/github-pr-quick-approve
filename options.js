"use strict";

const isMac = navigator.platform.toUpperCase().includes("MAC");

// "mod" is the platform primary modifier: Cmd on Mac, Alt on Windows/Linux.
// This is stored as a single flag so shortcuts sync correctly across OSes.
const DEFAULT_SHORTCUT = { key: "u", mod: true, ctrlKey: false, shiftKey: true };

const input = document.getElementById("shortcut-input");
const saveBtn = document.getElementById("save-btn");
const resetBtn = document.getElementById("reset-btn");
const statusEl = document.getElementById("status");

let pendingShortcut = null;

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
  // Map the platform-native modifier to the abstract "mod" flag
  const mod = isMac ? e.metaKey : e.altKey;
  const ctrlKey = e.ctrlKey;
  // On Mac, alt (Option) is not used as "mod", so ignore it to avoid confusion.
  // On Win/Linux, meta (Win key) is not used as "mod", so ignore it.
  return {
    key: e.key.length === 1 ? e.key.toLowerCase() : e.key,
    mod,
    ctrlKey,
    shiftKey: e.shiftKey,
  };
}

function hasModifier(s) {
  return s.mod || s.ctrlKey || s.shiftKey;
}

function loadShortcut() {
  chrome.storage.sync.get({ shortcut: DEFAULT_SHORTCUT }, (data) => {
    pendingShortcut = data.shortcut;
    input.value = formatShortcut(data.shortcut);
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

saveBtn.addEventListener("click", () => {
  if (!pendingShortcut) return;
  chrome.storage.sync.set({ shortcut: pendingShortcut }, () => {
    statusEl.classList.add("saved");
    setTimeout(() => statusEl.classList.remove("saved"), 2000);
  });
});

resetBtn.addEventListener("click", () => {
  pendingShortcut = DEFAULT_SHORTCUT;
  input.value = formatShortcut(DEFAULT_SHORTCUT);
  chrome.storage.sync.set({ shortcut: DEFAULT_SHORTCUT }, () => {
    statusEl.classList.add("saved");
    setTimeout(() => statusEl.classList.remove("saved"), 2000);
  });
});

loadShortcut();
