chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
  }
  // Earlier versions stored a GitHub token; it's no longer used.
  chrome.storage.sync.remove("githubToken");
  chrome.storage.local.remove("githubToken");
});
