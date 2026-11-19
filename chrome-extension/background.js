// OmniLogic Background Service Worker
// Handles extension lifecycle events and backend connectivity checks

const BACKEND_URL = 'http://127.0.0.1:8000';

// Check backend health on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[OmniLogic] Extension installed. Checking backend...');
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/health`, { method: 'GET' });
    if (response.ok) {
      console.log('[OmniLogic] Backend is online ✓');
      chrome.storage.local.set({ backendOnline: true, lastChecked: Date.now() });
    }
  } catch (e) {
    console.warn('[OmniLogic] Backend offline at install time:', e.message);
    chrome.storage.local.set({ backendOnline: false, lastChecked: Date.now() });
  }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkBackend') {
    fetch(`${BACKEND_URL}/api/v1/health`)
      .then(r => r.json())
      .then(data => sendResponse({ online: true, data }))
      .catch(err => sendResponse({ online: false, error: err.message }));
    return true;
  }

  if (request.action === 'summarize') {
    const { text, mode, pageTitle, pageUrl } = request;
    fetch(`${BACKEND_URL}/api/v1/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, mode, context: { title: pageTitle, url: pageUrl } })
    })
      .then(r => r.json())
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});
