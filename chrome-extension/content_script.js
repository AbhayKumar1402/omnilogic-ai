// OmniLogic Content Script — Extracts clean readable content from any web page

(function () {
  /**
   * Removes noise elements (nav, header, footer, ads, sidebars, scripts, etc.)
   * and returns clean readable text from the page body.
   */
  function extractCleanText() {
    // Clone the body to avoid mutating the live DOM
    const clone = document.body.cloneNode(true);

    // Remove non-content elements
    const noiseSelectors = [
      'script', 'style', 'noscript', 'iframe', 'svg', 'canvas',
      'nav', 'header', 'footer', 'aside',
      '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
      '[role="complementary"]', '[role="search"]',
      '.nav', '.navbar', '.navigation', '.header', '.footer',
      '.sidebar', '.side-bar', '.widget', '.ad', '.ads', '.advertisement',
      '.cookie', '.cookie-banner', '.popup', '.modal-overlay',
      '.breadcrumb', '.pagination', '.social-share', '.share-buttons',
      '#nav', '#header', '#footer', '#sidebar', '#advertisement',
      'form', 'button', 'input', 'select', 'textarea',
      '[aria-hidden="true"]',
      // Wikipedia and documentation footnote / citation elements
      'sup.reference', '.reference', '.mw-editsection', '.citation',
      '[role="doc-noteref"]', '.footnote', '.reflist', '.navbox'
    ];

    noiseSelectors.forEach(selector => {
      try {
        clone.querySelectorAll(selector).forEach(el => el.remove());
      } catch (e) { /* ignore invalid selectors */ }
    });

    // Try to find the main content area first
    const contentSelectors = [
      'main', 'article', '[role="main"]', '.main-content', '.post-content',
      '.article-body', '.entry-content', '.content-body', '.story-body',
      '#main-content', '#content', '#article', '.post', '.blog-post'
    ];

    let primaryContent = null;
    for (const sel of contentSelectors) {
      const el = clone.querySelector(sel);
      if (el && el.innerText && el.innerText.trim().length > 200) {
        primaryContent = el;
        break;
      }
    }

    const sourceEl = primaryContent || clone;
    let text = sourceEl.innerText || sourceEl.textContent || '';

    // Strip bracketed citations like [1], [13], [b], [a], [edit], [citation needed] and Google AI Mode header noise
    text = text.replace(/AI Mode conversation:.*?Do you want to provide feedback\.?/gi, '');
    text = text.replace(/\b(Article\s+\d+[A-Z]?(?:\s*(?:&|,|and)\s*\d+[A-Z]?)*)\.\s+/g, '$1: ');
    text = text.replace(/\[\s*(?:\d+|[a-zA-Z]{1,3}|citation needed|edit|note|cite_note)\s*\]/gi, '');
    text = text.replace(/\s+([,.;:!?])/g, '$1');

    // Clean up whitespace
    text = text
      .replace(/\t/g, ' ')
      .replace(/[ ]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // Truncate to ~8000 chars (Gemini context window is generous but let's keep it fast)
    if (text.length > 8000) {
      text = text.substring(0, 8000) + '\n\n[Content truncated for summarization...]';
    }

    return text;
  }

  function getPageMeta() {
    return {
      title: document.title || '',
      url: window.location.href,
      description: document.querySelector('meta[name="description"]')?.content || '',
      ogTitle: document.querySelector('meta[property="og:title"]')?.content || '',
      ogDescription: document.querySelector('meta[property="og:description"]')?.content || ''
    };
  }

  // Listen for messages from popup.js
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractContent') {
      try {
        const text = extractCleanText();
        const meta = getPageMeta();
        sendResponse({
          success: true,
          text: text,
          meta: meta,
          charCount: text.length,
          wordCount: text.split(/\s+/).filter(Boolean).length
        });
      } catch (err) {
        sendResponse({
          success: false,
          error: err.message,
          text: document.body.innerText?.substring(0, 4000) || ''
        });
      }
    }
    return true; // keep message channel open for async
  });

  // Signal that content script is ready
  window.__omnilogic_ready = true;
})();
