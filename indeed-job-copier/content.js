// ============================================
// RoleCraft — Indeed Job Title Copier
// Content Script (Manifest V3)
// ============================================
// Extracts the job title from an Indeed job page
// and copies it to the clipboard with one click.
//
// Indeed's DOM is more stable than LinkedIn's —
// the job title is reliably in a data-testid h1
// or the page <title>. We use a ranked fallback
// system for resilience against DOM changes.
// ============================================

(function () {
  'use strict';

  // ---- Constants ----
  const PREFIX = '[RoleCraft Indeed Copier]';
  const BUTTON_ID = 'rc-indeed-copy-btn';
  const RESET_DELAY_MS = 2500;
  const NAV_CHECK_INTERVAL_MS = 1000;

  // ---- Logger ----

  function log(...args) {
    console.log(PREFIX, ...args);
  }

  function warn(...args) {
    console.warn(PREFIX, ...args);
  }

  function logError(...args) {
    console.error(PREFIX, ...args);
  }

  // ---- 1. Page Detection ----

  function isIndeedJobPage() {
    const url = window.location.href;
    return (
      /indeed\.com\/viewjob/i.test(url) ||
      /indeed\.com\/jobs\/view/i.test(url) ||
      /indeed\.com\/rc\/clk/i.test(url)
    );
  }

  // ---- 2. Title Extraction ----

  /**
   * Extract job title from Indeed using ranked strategies.
   * Strategies ordered from most specific/stable to most generic.
   */
  function extractJobTitle() {
    const strategies = [
      // Strategy 1: Indeed's stable data-testid attribute on the title element
      () => {
        const el = document.querySelector('[data-testid="jobsearch-JobInfoHeader-title"]');
        if (el) {
          // The h1 may contain a nested span with " - job post" suffix — strip it
          const clone = el.cloneNode(true);
          // Remove any child spans that contain " - job post" or similar suffixes
          clone.querySelectorAll('span').forEach(span => {
            if (/job post/i.test(span.textContent) || span.textContent.trim() === '-') {
              span.remove();
            }
          });
          const text = clone.textContent.trim().replace(/\s*-\s*job post\s*$/i, '').trim();
          if (text.length > 2) return text;
        }
        return null;
      },

      // Strategy 2: h1 inside the job header container
      () => {
        const selectors = [
          '[data-testid="jobsearch-JobInfoHeader-title"] h1',
          'h1[class*="jobsearch"]',
          'h1[class*="job-title"]',
          'h1[class*="title"]',
          '.jobsearch-JobInfoHeader-title',
          '.jobTitle h1',
        ];
        for (const sel of selectors) {
          try {
            const el = document.querySelector(sel);
            if (el) {
              const text = el.textContent.trim().replace(/\s*-\s*job post\s*$/i, '').trim();
              if (text.length > 2) {
                log(`Title found via selector: ${sel}`);
                return text;
              }
            }
          } catch (e) { /* skip */ }
        }
        return null;
      },

      // Strategy 3: First h1 on the page (Indeed usually has only 1 on job pages)
      () => {
        const h1 = document.querySelector('h1');
        if (h1) {
          const text = h1.textContent.trim().replace(/\s*-\s*job post\s*$/i, '').trim();
          if (text.length > 2 && text.length < 200) {
            log('Title found via first h1 on page');
            return text;
          }
        }
        return null;
      },

      // Strategy 4: Parse from the browser page <title>
      // Indeed format: "Job Title - Company Name - City, State | Indeed.com"
      () => {
        const pageTitle = document.title;
        if (pageTitle) {
          // Take everything before the first " - "
          const parts = pageTitle.split(' - ');
          if (parts.length >= 2) {
            const candidate = parts[0].trim();
            if (candidate.length > 2 && candidate.length < 150) {
              log('Title extracted from page <title>:', candidate);
              return candidate;
            }
          }
        }
        return null;
      },

      // Strategy 5: og:title meta tag (very stable, SEO-critical)
      () => {
        const og = document.querySelector('meta[property="og:title"]');
        if (og) {
          const content = og.getAttribute('content') || '';
          // Indeed og:title format: "Job Title at Company | Indeed.com"
          const withoutBranding = content.replace(/\s*\|.*$/i, '').trim();
          const withoutAt = withoutBranding.replace(/\s+at\s+.+$/i, '').trim();
          if (withoutAt.length > 2) {
            log('Title extracted from og:title:', withoutAt);
            return withoutAt;
          }
        }
        return null;
      },
    ];

    for (let i = 0; i < strategies.length; i++) {
      try {
        const result = strategies[i]();
        if (result) {
          log(`Job title extracted via strategy ${i + 1}: "${result}"`);
          return result;
        }
      } catch (e) {
        warn(`Strategy ${i + 1} threw:`, e.message);
      }
    }

    warn('All title extraction strategies failed');
    return null;
  }

  // ---- 3. Clipboard ----

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      log('Copied via Clipboard API');
      return true;
    } catch (e) {
      warn('Clipboard API failed, trying execCommand fallback');
    }

    // execCommand fallback
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (success) {
        log('Copied via execCommand fallback');
        return true;
      }
    } catch (e) {
      logError('execCommand fallback failed:', e.message);
    }

    return false;
  }

  // ---- 4. Button Icons ----

  function getCopyIcon() {
    return `<span class="rc-indeed-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg></span>`;
  }

  function getCheckIcon() {
    return `<span class="rc-indeed-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg></span>`;
  }

  function getErrorIcon() {
    return `<span class="rc-indeed-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg></span>`;
  }

  // ---- 5. Button State ----

  function setButtonState(state) {
    const btn = document.getElementById(BUTTON_ID);
    if (!btn) return;
    btn.setAttribute('data-state', state);
    switch (state) {
      case 'ready':
        btn.innerHTML = getCopyIcon() + ' <span>Copy Job Title</span>';
        btn.disabled = false;
        break;
      case 'extracting':
        btn.innerHTML = getCopyIcon() + ' <span>Extracting...</span>';
        btn.disabled = true;
        break;
      case 'success':
        btn.innerHTML = getCheckIcon() + ' <span>Copied!</span>';
        btn.disabled = true;
        break;
      case 'error':
        btn.innerHTML = getErrorIcon() + ' <span>Failed — Retry</span>';
        btn.disabled = false;
        break;
    }
  }

  // ---- 6. Click Handler ----

  async function handleCopyClick(event) {
    event.preventDefault();
    event.stopPropagation();

    log('Button clicked');
    setButtonState('extracting');

    try {
      const title = extractJobTitle();
      if (!title) {
        throw new Error('Could not extract job title from this page');
      }

      const copied = await copyToClipboard(title);
      if (!copied) {
        throw new Error('Clipboard write failed');
      }

      log('Success! Title copied:', title);
      setButtonState('success');
    } catch (err) {
      logError('Failed:', err.message);
      setButtonState('error');
    }

    setTimeout(() => setButtonState('ready'), RESET_DELAY_MS);
  }

  // ---- 7. Button Injection ----

  function createButton() {
    const btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.type = 'button';
    btn.setAttribute('data-state', 'ready');
    btn.innerHTML = getCopyIcon() + ' <span>Copy Job Title</span>';
    btn.addEventListener('click', handleCopyClick);
    return btn;
  }

  function injectButton() {
    if (!isIndeedJobPage()) {
      removeButton();
      return;
    }

    // Don't inject duplicate
    if (document.getElementById(BUTTON_ID)) return;

    const btn = createButton();
    let injected = false;

    // Strategy 1: Insert next to the Apply button
    const applyBtn = document.querySelector(
      '[data-testid="applyButton"], [id*="apply-button"], a[href*="/apply/"], button[aria-label*="Apply"]'
    );
    if (applyBtn && applyBtn.parentElement) {
      applyBtn.parentElement.insertAdjacentElement('afterend', btn);
      log('Button injected after Apply button parent');
      injected = true;
    }

    // Strategy 2: Insert inside the job header action area
    if (!injected) {
      const actionArea = document.querySelector(
        '[data-testid="jobsearch-JobInfoHeader-title"]'
      );
      if (actionArea && actionArea.parentElement) {
        actionArea.parentElement.appendChild(btn);
        log('Button injected in title container');
        injected = true;
      }
    }

    // Strategy 3: Insert after the h1 title
    if (!injected) {
      const h1 = document.querySelector('h1');
      if (h1 && h1.parentElement) {
        h1.insertAdjacentElement('afterend', btn);
        log('Button injected after h1');
        injected = true;
      }
    }

    // Fallback: floating button
    if (!injected) {
      log('Using floating button fallback');
      btn.classList.add('rc-indeed-floating');
      document.body.appendChild(btn);
    }

    log('Button ready');
  }

  function removeButton() {
    const existing = document.getElementById(BUTTON_ID);
    if (existing) {
      existing.remove();
      log('Button removed');
    }
  }

  // ---- 8. SPA Navigation Detection ----

  function onNavigationChange() {
    removeButton();
    setTimeout(() => {
      if (isIndeedJobPage()) {
        injectButton();
      }
    }, 600);
  }

  function setupNavigationDetection() {
    let lastURL = window.location.href;

    // URL polling — catches AJAX navigation
    setInterval(() => {
      const currentURL = window.location.href;
      if (currentURL !== lastURL) {
        log('URL changed:', lastURL, '→', currentURL);
        lastURL = currentURL;
        onNavigationChange();
      }
    }, NAV_CHECK_INTERVAL_MS);

    // History API interception
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      originalPushState.apply(this, args);
      setTimeout(onNavigationChange, 400);
    };

    history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      setTimeout(onNavigationChange, 400);
    };

    window.addEventListener('popstate', () => setTimeout(onNavigationChange, 400));

    log('Navigation detection ready');
  }

  // ---- 9. Init ----

  function init() {
    log('Initializing...');

    if (isIndeedJobPage()) {
      log('Indeed job page detected, injecting button');
      setTimeout(injectButton, 1000);
    } else {
      log('Not an Indeed job page, watching for navigation');
    }

    setupNavigationDetection();
    log('Initialization complete');
  }

  init();
})();
