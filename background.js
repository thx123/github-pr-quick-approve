"use strict";

// The token lives in storage.local, readable only by extension pages and this
// service worker. Content scripts never see it; they ask us to make API calls.
chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });

const PR_PATH = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)/;

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
  }
  migrateTokenFromSync();
});

// Versions <= 2.0.1 kept the token in storage.sync, which content scripts can
// read and which syncs across devices. Move it to storage.local.
function migrateTokenFromSync() {
  chrome.storage.sync.get({ githubToken: "" }, ({ githubToken }) => {
    if (!githubToken) return;
    chrome.storage.local.get({ githubToken: "" }, (local) => {
      const done = () => chrome.storage.sync.remove("githubToken");
      if (local.githubToken) done();
      else chrome.storage.local.set({ githubToken }, done);
    });
  });
}

// Derive the PR from the browser-reported sender URL and require it to match
// what the content script claims, so a message can't target a different PR.
function senderPR(sender, claimed) {
  if (sender.id !== chrome.runtime.id || !sender.url || !claimed) return null;
  const url = new URL(sender.url);
  if (url.origin !== "https://github.com") return null;
  const match = url.pathname.match(PR_PATH);
  if (!match) return null;
  const pr = { owner: match[1], repo: match[2], number: match[3] };
  const same =
    pr.owner === claimed.owner && pr.repo === claimed.repo && pr.number === claimed.number;
  return same ? pr : null;
}

async function githubFetch(path, options = {}) {
  const { githubToken } = await chrome.storage.local.get({ githubToken: "" });
  if (!githubToken) throw new Error("Set a GitHub token in extension options");

  const resp = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
  });
  const data = await resp.json().catch(() => ({}));
  if (resp.status === 404) {
    // GitHub hides private repos the token can't access behind a 404.
    throw new Error(
      "Not Found — your token can't access this repo. Check its resource owner, repo list, and whether the org has approved it"
    );
  }
  if (!resp.ok) throw new Error(data.message || `HTTP ${resp.status}`);
  return data;
}

function pullPath(pr) {
  return `/repos/${pr.owner}/${pr.repo}/pulls/${pr.number}`;
}

async function getHeadSha(pr) {
  const pull = await githubFetch(pullPath(pr));
  return pull.head.sha;
}

async function approve(pr, viewedSha) {
  if (!viewedSha) throw new Error("Unknown commit — reload the page and try again");

  const currentSha = await getHeadSha(pr);
  if (currentSha !== viewedSha) {
    throw new Error("PR has new commits since you loaded it — reload to review them");
  }

  const { approveMessage } = await chrome.storage.sync.get({ approveMessage: "" });
  await githubFetch(`${pullPath(pr)}/reviews`, {
    method: "POST",
    body: JSON.stringify({
      event: "APPROVE",
      // Pin the approval to the commit the user saw, closing the race between
      // the check above and this request.
      commit_id: viewedSha,
      body: approveMessage || undefined,
    }),
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const pr = senderPR(sender, msg.pr);
  if (!pr) {
    sendResponse({ ok: false, error: "Could not verify PR page" });
    return false;
  }

  let work;
  if (msg.type === "getHeadSha") work = getHeadSha(pr).then((sha) => ({ sha }));
  else if (msg.type === "approve") work = approve(pr, msg.sha).then(() => ({}));
  else return false;

  work
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((err) => sendResponse({ ok: false, error: err.message }));
  return true;
});
