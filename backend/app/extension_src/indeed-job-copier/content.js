// ============================================
// RoleCraft — Indeed 1-Click Job Copier
// Content Script (Manifest V3)
// ============================================
// Extracts complete job details (Title, Company,
// Location, Metadata, Job URL, Description) from
// Indeed job pages and copies them to the clipboard
// formatted for RoleCraft ATS optimization.
// ============================================

(function () {
  'use strict';

  // ---- Constants ----
  const PREFIX = '[RoleCraft Indeed Copier]';
  const BUTTON_ID = 'rc-indeed-copy-btn';
  const RESET_DELAY_MS = 2500;
  const WATCHDOG_INTERVAL_MS = 1200;

  let lastJobSignature = '';
  let lastURL = window.location.href;
  let debounceTimer = null;

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

  // ---- 1. Container & Page Detection ----

  /**
   * Find the container element where the currently selected job is displayed.
   * On search pages (e.g. in.indeed.com/jobs?q=...), Indeed uses a split view
   * with the right pane displaying the active job.
   * On direct job pages (e.g. /viewjob?jk=...), the whole document/JobComponent is used.
   */
  function getJobContainer() {
    // Strategy 1: Split pane in search results view
    const splitPaneSelectors = [
      '#jobsearch-ViewjobPaneWrapper',
      '[data-testid="jobsearch-ViewJobLayout"]',
      '.jobsearch-RightPane',
      '#vjs-container',
      '.fastviewjob',
    ];

    for (const sel of splitPaneSelectors) {
      const el = document.querySelector(sel);
      if (el && el.offsetHeight > 0) {
        return el;
      }
    }

    // Strategy 2: Standalone job component
    const jobComponent = document.querySelector('.jobsearch-JobComponent');
    if (jobComponent && jobComponent.offsetHeight > 0) {
      return jobComponent;
    }

    return document;
  }

  /**
   * Checks if an active job posting is currently visible on the page.
   */
  function hasJobOnPage() {
    const container = getJobContainer();

    // Direct check: job description container is Indeed's most definitive element
    const desc = container.querySelector(
      '#jobDescriptionText, [data-testid="jobsearch-JobComponent-description"], .jobsearch-jobDescriptionText, .jobsearch-JobComponent-description'
    );
    if (desc && desc.textContent.trim().length > 30) {
      return true;
    }

    // Check if job header/title exists
    const title = container.querySelector(
      '[data-testid="jobsearch-JobInfoHeader-title"], h1[data-testid="jobTitle"], h1.jobsearch-JobInfoHeader-title, h1.jobTitle, [data-testid="jobsearch-JobInfoHeader-actions"]'
    );
    if (title) {
      return true;
    }

    // URL indicates job page + any h1 present
    const url = window.location.href;
    const isJobUrl = /viewjob|jobs\/view|rc\/clk|[?&]vjk=|[?&]jk=|\/job\//i.test(url);
    if (isJobUrl && container.querySelector('h1')) {
      return true;
    }

    return false;
  }

  /**
   * Generates a signature for the currently viewed job to detect switches.
   */
  function getJobSignature() {
    try {
      const url = new URL(window.location.href);
      const vjk = url.searchParams.get('vjk') || url.searchParams.get('jk');
      if (vjk) return vjk;
    } catch (e) {}

    const container = getJobContainer();
    const titleEl = container.querySelector(
      '[data-testid="jobsearch-JobInfoHeader-title"], h1[data-testid="jobTitle"], h1'
    );
    return titleEl ? titleEl.textContent.trim() : '';
  }

  // ---- 2. Field Extractors ----

  /**
   * Extract Job Title using multiple prioritized strategies.
   */
  function extractJobTitle(container) {
    const root = container || document;
    const selectors = [
      '[data-testid="jobsearch-JobInfoHeader-title"]',
      'h1[data-testid="jobTitle"]',
      'h1.jobsearch-JobInfoHeader-title',
      'h1.jobTitle',
      '[data-testid="jobsearch-JobInfoHeader-title"] h1',
      '#jobsearch-ViewjobPaneWrapper h1',
      '[data-testid="jobsearch-ViewJobLayout"] h1',
      'h1',
    ];

    for (const sel of selectors) {
      try {
        const el = root.querySelector(sel);
        if (el) {
          const clone = el.cloneNode(true);
          // Strip out "- job post", SVG icons, badges
          clone.querySelectorAll('span, svg, button').forEach((sub) => {
            if (/job post/i.test(sub.textContent) || sub.textContent.trim() === '-') {
              sub.remove();
            }
          });
          const text = clone.textContent.trim().replace(/\s*-\s*job post\s*$/i, '').trim();
          if (text.length > 2 && text.length < 250) {
            log(`Title extracted via selector: ${sel}`);
            return text;
          }
        }
      } catch (e) {}
    }

    // Strategy: Parse browser <title>
    // Indeed format: "Job Title - Company Name - City, State | Indeed.com"
    if (document.title) {
      const parts = document.title.split(' - ');
      if (parts.length >= 2) {
        const candidate = parts[0].trim();
        if (candidate.length > 2 && candidate.length < 200) {
          log('Title extracted from page <title>');
          return candidate;
        }
      }
    }

    // Strategy: og:title meta tag
    const og = document.querySelector('meta[property="og:title"]');
    if (og) {
      const content = og.getAttribute('content') || '';
      const withoutBranding = content.replace(/\s*\|.*$/i, '').trim();
      const withoutAt = withoutBranding.replace(/\s+at\s+.+$/i, '').trim();
      if (withoutAt.length > 2) {
        log('Title extracted from og:title');
        return withoutAt;
      }
    }

    warn('All title extraction strategies failed');
    return null;
  }

  /**
   * Extract Company Name.
   */
  function extractCompany(container) {
    const root = container || document;
    const selectors = [
      '[data-testid="inlineHeader-companyName"]',
      '[data-testid="jobsearch-JobInfoHeader-companyName"]',
      'div[data-company-name="true"]',
      'a[data-testid="jobsearch-CompanyAvatar-button"]',
      'a[href*="/cmp/"]',
      '[data-testid="company-name"]',
      '.jobsearch-CompanyInfoContainer a',
      '.jobsearch-CompanyInfoWithoutReviews',
      '.jobsearch-CompanyReview--heading',
      '[class*="companyName"]',
    ];

    for (const sel of selectors) {
      try {
        const el = root.querySelector(sel);
        if (el) {
          const text = el.textContent.trim();
          if (text.length > 1 && text.length < 150) {
            log(`Company extracted via selector: ${sel}`);
            return text;
          }
        }
      } catch (e) {}
    }

    // Fallback: Parse from page title
    if (document.title) {
      const parts = document.title.split(' - ');
      if (parts.length >= 3 && parts[1].trim().length > 1) {
        return parts[1].trim();
      }
    }

    return null;
  }

  /**
   * Extract Location.
   */
  function extractLocation(container) {
    const root = container || document;
    const selectors = [
      '[data-testid="inlineHeader-companyLocation"]',
      '[data-testid="jobsearch-JobInfoHeader-companyLocation"]',
      'div[data-testid="job-location"]',
      '.jobsearch-JobInfoHeader-companyLocation',
      'div[class*="companyLocation"]',
      '[data-testid="jobsearch-JobInfoHeader-companyLocation"] div',
    ];

    for (const sel of selectors) {
      try {
        const el = root.querySelector(sel);
        if (el) {
          const text = el.textContent.trim();
          if (text.length > 2 && text.length < 150) {
            log(`Location extracted via selector: ${sel}`);
            return text;
          }
        }
      } catch (e) {}
    }

    // Fallback: Parse from page title ("Title - Company - Location | Indeed.com")
    if (document.title) {
      const parts = document.title.split(' - ');
      if (parts.length >= 3) {
        const locPart = parts[2].split('|')[0].trim();
        if (locPart.length > 2) return locPart;
      }
    }

    return null;
  }

  /**
   * Extract Salary, Job Type, or Key Metadata.
   */
  function extractMetadata(container) {
    const root = container || document;
    const items = [];
    const selectors = [
      '#salaryInfoAndJobType',
      '[data-testid="jobsearch-OtherJobDetailsContainer"]',
      '[data-testid="attribute_snippets"]',
      '#jobDetailsSection',
    ];

    for (const sel of selectors) {
      try {
        const el = root.querySelector(sel);
        if (el) {
          const text = (el.innerText || el.textContent || '').trim();
          if (text && !items.includes(text)) {
            items.push(text);
          }
        }
      } catch (e) {}
    }

    return items.length > 0 ? items.join('\n') : null;
  }

  /**
   * Extract or construct canonical Job URL.
   */
  function extractURL() {
    const currentUrl = window.location.href;
    try {
      const parsed = new URL(currentUrl);
      const vjk = parsed.searchParams.get('vjk') || parsed.searchParams.get('jk');
      if (vjk) {
        return `${parsed.origin}/viewjob?jk=${vjk}`;
      }
      if (parsed.pathname.includes('/viewjob')) {
        return parsed.origin + parsed.pathname + (vjk ? `?jk=${vjk}` : parsed.search);
      }
    } catch (e) {}

    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical && canonical.href && canonical.href.includes('indeed.')) {
      return canonical.href;
    }

    return currentUrl;
  }

  /**
   * Clean description element into formatted plain text preserving bullet points.
   */
  function cleanDescription(el) {
    const clone = el.cloneNode(true);

    // Remove non-content elements
    clone.querySelectorAll('script, style, noscript, svg, [aria-hidden="true"]').forEach((n) => n.remove());

    // Format list items with bullet points
    clone.querySelectorAll('li').forEach((li) => {
      li.textContent = '• ' + li.textContent.trim() + '\n';
    });

    // Add newlines after paragraphs, headers, divisions
    clone.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, br').forEach((b) => {
      b.insertAdjacentText('afterend', '\n');
    });

    let text = clone.innerText || clone.textContent || '';
    text = text
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return text;
  }

  /**
   * Extract Job Description text.
   */
  function extractDescription(container) {
    const root = container || document;
    const selectors = [
      '#jobDescriptionText',
      '[data-testid="jobsearch-JobComponent-description"]',
      '.jobsearch-jobDescriptionText',
      '.jobsearch-JobComponent-description',
    ];

    for (const sel of selectors) {
      try {
        const el = root.querySelector(sel);
        if (el && el.textContent.trim().length > 30) {
          log(`Description extracted via selector: ${sel}`);
          return cleanDescription(el);
        }
      } catch (e) {}
    }

    warn('All description extraction selectors failed');
    return null;
  }

  /**
   * Format all extracted details into RoleCraft clipboard format.
   */
  function formatForClipboard(details) {
    let output = '';

    output += `JOB TITLE:\n${details.title || 'Unknown Title'}\n\n`;

    if (details.company) {
      output += `COMPANY:\n${details.company}\n\n`;
    }

    if (details.location) {
      output += `LOCATION:\n${details.location}\n\n`;
    }

    if (details.metadata) {
      output += `JOB DETAILS:\n${details.metadata}\n\n`;
    }

    if (details.url) {
      output += `JOB URL:\n${details.url}\n\n`;
    }

    output += `JOB DESCRIPTION:\n${details.description || details.title || ''}`;

    return output.trim();
  }

  // ---- 3. Clipboard Write ----

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      log('Copied via Clipboard API');
      return true;
    } catch (e) {
      warn('Clipboard API failed, trying execCommand fallback');
    }

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
        btn.innerHTML = getCopyIcon() + ' <span>Copy Job Details</span>';
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

    log('Copy button clicked');
    setButtonState('extracting');

    try {
      const container = getJobContainer();

      const title = extractJobTitle(container);
      const company = extractCompany(container);
      const location = extractLocation(container);
      const metadata = extractMetadata(container);
      const url = extractURL();
      const description = extractDescription(container);

      if (!title && !description) {
        throw new Error('Could not extract job title or description from this page');
      }

      const formatted = formatForClipboard({
        title,
        company,
        location,
        metadata,
        url,
        description,
      });

      const copied = await copyToClipboard(formatted);
      if (!copied) {
        throw new Error('Clipboard write failed');
      }

      log('Success! Job details copied to clipboard. Length:', formatted.length);
      setButtonState('success');
    } catch (err) {
      logError('Failed to copy job details:', err.message);
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
    btn.title = 'Copy complete job details to clipboard for RoleCraft ATS optimization';
    btn.innerHTML = getCopyIcon() + ' <span>Copy Job Details</span>';
    btn.addEventListener('click', handleCopyClick);
    return btn;
  }

  function injectButton() {
    if (!hasJobOnPage()) {
      removeButton();
      return;
    }

    const container = getJobContainer();
    const existingBtn = document.getElementById(BUTTON_ID);

    // If button already exists inside the active container and is visible, keep it
    if (existingBtn && container.contains(existingBtn)) {
      return;
    }

    // If button was attached elsewhere (e.g. previous job pane), clean it up
    if (existingBtn) {
      existingBtn.remove();
    }

    const btn = createButton();
    let injected = false;

    // Strategy 1: Next to Apply button or action container
    const actionContainers = [
      container.querySelector('#applyButtonLinkContainer'),
      container.querySelector('[data-testid="applyButton"]')?.parentElement,
      container.querySelector('.jobsearch-IndeedApplyButton-buttonWrapper'),
      container.querySelector('[data-testid="jobsearch-JobInfoHeader-actions"]'),
      container.querySelector('.jobsearch-JobInfoHeader-actions'),
      container.querySelector('[class*="jobsearch-JobInfoHeader-actions"]'),
      container.querySelector('div[id*="applyButton"]'),
      container.querySelector('[data-testid="applyButton"]'),
    ];

    for (const ac of actionContainers) {
      if (ac && ac.parentElement) {
        ac.parentElement.insertAdjacentElement('afterend', btn);
        log('Button injected next to action container');
        injected = true;
        break;
      }
    }

    // Strategy 2: Directly after job title container
    if (!injected) {
      const titleContainer = container.querySelector(
        '[data-testid="jobsearch-JobInfoHeader-title"], h1[data-testid="jobTitle"], h1.jobsearch-JobInfoHeader-title, h1.jobTitle, .jobsearch-JobInfoHeader-title'
      );
      if (titleContainer && titleContainer.parentElement) {
        titleContainer.parentElement.appendChild(btn);
        log('Button injected inside/after title container');
        injected = true;
      }
    }

    // Strategy 3: Immediately before job description container
    if (!injected) {
      const descContainer = container.querySelector(
        '#jobDescriptionText, [data-testid="jobsearch-JobComponent-description"]'
      );
      if (descContainer && descContainer.parentElement) {
        descContainer.parentElement.insertAdjacentElement('beforebegin', btn);
        log('Button injected before description container');
        injected = true;
      }
    }

    // Strategy 4: Fallback floating button
    if (!injected) {
      log('Using floating button fallback');
      btn.classList.add('rc-indeed-floating');
      document.body.appendChild(btn);
    }

    lastJobSignature = getJobSignature();
    log('Button ready for job:', lastJobSignature || 'Direct');
  }

  function removeButton() {
    const existing = document.getElementById(BUTTON_ID);
    if (existing) {
      existing.remove();
      log('Button removed');
    }
  }

  // ---- 8. Navigation & Job Change Watchers ----

  function checkJobSwitch() {
    const currentSig = getJobSignature();
    if (currentSig && currentSig !== lastJobSignature) {
      log('Job switch detected:', lastJobSignature, '→', currentSig);
      lastJobSignature = currentSig;
      removeButton();
      setTimeout(injectButton, 200);
      return true;
    }
    return false;
  }

  function onNavigationChange() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      checkJobSwitch();
      if (hasJobOnPage() && !document.getElementById(BUTTON_ID)) {
        injectButton();
      }
    }, 300);
  }

  function setupNavigationDetection() {
    // 1. History API interception (catches client-side route changes)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      originalPushState.apply(this, args);
      onNavigationChange();
    };

    history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      onNavigationChange();
    };

    window.addEventListener('popstate', onNavigationChange);

    // 2. MutationObserver: watches for dynamic DOM updates (job card clicks, split pane load)
    const observer = new MutationObserver((mutations) => {
      let shouldCheck = false;

      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const el = /** @type {Element} */ (node);
              if (
                el.id === 'jobDescriptionText' ||
                el.id === 'jobsearch-ViewjobPaneWrapper' ||
                el.id === 'applyButtonLinkContainer' ||
                el.querySelector?.('#jobDescriptionText') ||
                el.querySelector?.('[data-testid="jobsearch-JobInfoHeader-title"]') ||
                el.querySelector?.('[data-testid="applyButton"]') ||
                el.querySelector?.('#jobsearch-ViewjobPaneWrapper')
              ) {
                shouldCheck = true;
                break;
              }
            }
          }
        }
        if (shouldCheck) break;
      }

      if (shouldCheck) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          checkJobSwitch();
          if (hasJobOnPage() && !document.getElementById(BUTTON_ID)) {
            injectButton();
          }
        }, 200);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // 3. Periodic Watchdog: ensures button stays present when jobs are loaded via AJAX
    setInterval(() => {
      const currentURL = window.location.href;
      if (currentURL !== lastURL) {
        lastURL = currentURL;
        onNavigationChange();
        return;
      }

      if (checkJobSwitch()) return;

      if (hasJobOnPage() && !document.getElementById(BUTTON_ID)) {
        injectButton();
      }
    }, WATCHDOG_INTERVAL_MS);

    log('Navigation & mutation detection ready');
  }

  // ---- 9. Initialization ----

  function init() {
    log('Initializing Indeed 1-Click Job Copier...');

    if (hasJobOnPage()) {
      log('Job detected on initial page load');
      setTimeout(injectButton, 600);
    } else {
      log('No job detected on initial load, watching for navigation/clicks');
    }

    setupNavigationDetection();
    log('Initialization complete');
  }

  // Run on load or idle
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
