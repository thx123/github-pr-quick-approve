// Defaults before v3.2.0 used Cmd/Alt+Shift. Keep in sync with content.js.
const OLD_DEFAULTS = { shortcut: "u", reviewShortcut: "e" };

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
  }
  // Earlier versions stored a GitHub token; it's no longer used.
  chrome.storage.sync.remove("githubToken");
  chrome.storage.local.remove("githubToken");

  // Drop saved shortcuts that are just the old defaults, so the new
  // Ctrl+Shift defaults apply. Shortcuts you picked yourself are kept.
  chrome.storage.sync.get(Object.keys(OLD_DEFAULTS), (data) => {
    const stale = Object.keys(OLD_DEFAULTS).filter((key) => {
      const s = data[key];
      return s && s.key === OLD_DEFAULTS[key] && s.mod && !s.ctrlKey && s.shiftKey;
    });
    if (stale.length) chrome.storage.sync.remove(stale);
  });
});
