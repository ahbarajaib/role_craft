// ============================================
// RoleCraft — Indeed 1-Click Job Copier
// Content Script (Manifest V3)
// ============================================

(function () {
  'use strict';

  // Ignore tiny frames (tracking pixels, ad widgets)
  if (window.self !== window.top) {
    if (window.innerWidth < 250 || window.innerHeight < 250) {
      return;
    }
  }

  // ---- Constants ----
  const PREFIX = '[RoleCraft Indeed Copier]';
  const BUTTON_ID = 'rc-indeed-copy-btn';
  const RESET_DELAY_MS = 2500;
  const WATCHDOG_INTERVAL_MS = 800;

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

  // ---- 1. DOM Locators ----

  /**
   * Locates the primary "Apply" button or action link.
   * On Indeed, this is "Apply on company site", "Apply now", or "Easily apply".
   */
  function findApplyButton(scope) {
    const root = scope || document;

    // 1. Direct text search across all buttons and links
    const elements = root.querySelectorAll('button, a');
    for (const el of elements) {
      const txt = (el.textContent || '').trim();
      if (
        /^apply on company site/i.test(txt) ||
        /^apply now/i.test(txt) ||
        /^easily apply/i.test(txt) ||
        /^apply\b/i.test(txt)
      ) {
        // Exclude small filter pills or left-pane badges
        if (el.offsetWidth > 40 && el.offsetHeight > 20) {
          return el;
        }
      }
    }

    // 2. Attribute-based search
    const byAttr = root.querySelector(
      '#applyButtonLinkContainer, [data-testid*="apply" i], a[aria-label*="apply" i], button[aria-label*="apply" i], .jobsearch-IndeedApplyButton-buttonWrapper'
    );
    if (byAttr) return byAttr;

    return null;
  }

  /**
   * Locates the container element holding the active job details.
   */
  function findJobPanel() {
    // 1. Known Indeed split-view and job container selectors
    const selectors = [
      '#jobsearch-ViewjobPaneWrapper',
      '[data-testid="jobsearch-ViewJobLayout"]',
      '.jobsearch-RightPane',
      '#vjs-container',
      '.fastviewjob',
      'div[class*="jobsearch-ViewJobLayout"]',
      'div[class*="RightPane"]',
      'div[class*="viewjob-pane"]',
      '.jobsearch-JobComponent',
    ];

    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el && el.offsetHeight > 0) {
          return el;
        }
      } catch (e) {}
    }

    // 2. Anchor from Apply button
    const applyBtn = findApplyButton();
    if (applyBtn) {
      let parent = applyBtn.parentElement;
      for (let i = 0; i < 8 && parent && parent !== document.body; i++) {
        if (parent.offsetHeight > 250) {
          return parent;
        }
        parent = parent.parentElement;
      }
      return applyBtn.parentElement;
    }

    // 3. Anchor from #jobDescriptionText
    const desc = document.getElementById('jobDescriptionText');
    if (desc) {
      let parent = desc.parentElement;
      for (let i = 0; i < 8 && parent && parent !== document.body; i++) {
        if (parent.offsetHeight > 250) {
          return parent;
        }
        parent = parent.parentElement;
      }
      return desc.parentElement;
    }

    return document.body;
  }

  /**
   * Finds the Job Title heading element.
   */
  function findTitleElement(panel) {
    const root = panel || findJobPanel() || document;
    const headings = root.querySelectorAll(
      'h1, h2, [data-testid*="title" i], [class*="jobTitle" i], [class*="JobInfoHeader-title" i]'
    );

    for (const h of headings) {
      const txt = (h.textContent || '').trim();
      if (
        txt.length > 2 &&
        txt.length < 150 &&
        !/^(job details|benefits|qualifications|about the job|pay|job type|here's how|full stack developer jobs)$/i.test(txt)
      ) {
        return h;
      }
    }

    return null;
  }

  /**
   * Checks if a job listing is currently visible on the page.
   */
  function hasJobOnPage() {
    // 1. Any Apply button present?
    if (findApplyButton()) {
      return true;
    }

    // 2. Job description container present?
    if (document.getElementById('jobDescriptionText')) {
      return true;
    }

    // 3. Job title heading present?
    if (findTitleElement()) {
      return true;
    }

    // 4. URL contains job key parameter or path
    const url = window.location.href;
    if (/viewjob|jobs\/view|rc\/clk|[?&]vjk=|[?&]jk=/i.test(url)) {
      return true;
    }

    return false;
  }

  /**
   * Unique signature of the currently viewed job to detect card switches.
   */
  function getJobSignature() {
    try {
      const url = new URL(window.location.href);
      const vjk = url.searchParams.get('vjk') || url.searchParams.get('jk');
      if (vjk) return vjk;
    } catch (e) {}

    const titleEl = findTitleElement();
    return titleEl ? titleEl.textContent.trim() : '';
  }

  // ---- 2. Field Extractors ----

  function extractJobTitle() {
    const titleEl = findTitleElement();
    if (titleEl) {
      const clone = titleEl.cloneNode(true);
      clone.querySelectorAll('span, button, svg').forEach((s) => {
        if (/job post/i.test(s.textContent) || s.textContent.trim() === '-') s.remove();
      });
      const txt = clone.textContent.trim().replace(/\s*-\s*job post\s*$/i, '').trim();
      if (txt.length > 2 && txt.length < 180) {
        log('Title extracted from heading:', txt);
        return txt;
      }
    }

    // Fallback: browser <title> ("Job Title - Company - Location | Indeed.com")
    if (document.title) {
      const parts = document.title.split(' - ');
      if (parts.length >= 2 && parts[0].trim().length > 2) {
        return parts[0].trim();
      }
    }

    return 'Job Details';
  }

  function extractCompany() {
    const panel = findJobPanel();

    const selectors = [
      '[data-testid="inlineHeader-companyName"]',
      '[data-testid="jobsearch-JobInfoHeader-companyName"]',
      'div[data-company-name="true"]',
      'a[data-testid="jobsearch-CompanyAvatar-button"]',
      'a[href*="/cmp/"]',
      '[data-testid="company-name"]',
      '.jobsearch-CompanyInfoContainer a',
      '.jobsearch-CompanyInfoWithoutReviews',
    ];

    for (const sel of selectors) {
      const el = panel.querySelector(sel) || document.querySelector(sel);
      if (el) {
        const txt = el.textContent.trim();
        if (txt.length > 1 && txt.length < 120) return txt;
      }
    }

    // Look for any link near title
    const links = panel.querySelectorAll('a');
    for (const l of links) {
      const href = l.getAttribute('href') || '';
      const txt = l.textContent.trim();
      if ((href.includes('/cmp/') || href.includes('/companies/')) && txt.length > 1) {
        return txt;
      }
    }

    return null;
  }

  function extractLocation() {
    const panel = findJobPanel();

    const selectors = [
      '[data-testid="inlineHeader-companyLocation"]',
      '[data-testid="jobsearch-JobInfoHeader-companyLocation"]',
      'div[data-testid="job-location"]',
      '.jobsearch-JobInfoHeader-companyLocation',
      'div[class*="companyLocation"]',
    ];

    for (const sel of selectors) {
      const el = panel.querySelector(sel) || document.querySelector(sel);
      if (el) {
        const txt = el.textContent.trim();
        if (txt.length > 1 && txt.length < 120) return txt;
      }
    }

    return null;
  }

  function extractMetadata() {
    const panel = findJobPanel();
    const items = [];

    const selectors = [
      '#salaryInfoAndJobType',
      '[data-testid="jobsearch-OtherJobDetailsContainer"]',
      '[data-testid="attribute_snippets"]',
      '#jobDetailsSection',
    ];

    for (const sel of selectors) {
      try {
        const el = panel.querySelector(sel) || document.querySelector(sel);
        if (el) {
          const txt = (el.innerText || el.textContent || '').trim();
          if (txt && !items.includes(txt)) {
            items.push(txt);
          }
        }
      } catch (e) {}
    }

    return items.length > 0 ? items.join('\n') : null;
  }

  function cleanDescription(el) {
    const clone = el.cloneNode(true);

    clone.querySelectorAll('script, style, noscript, svg, [aria-hidden="true"]').forEach((n) => n.remove());

    clone.querySelectorAll('li').forEach((li) => {
      li.textContent = '• ' + li.textContent.trim() + '\n';
    });

    clone.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, br').forEach((b) => {
      b.insertAdjacentText('afterend', '\n');
    });

    let text = clone.innerText || clone.textContent || '';
    return text
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function extractDescription() {
    const panel = findJobPanel();

    const selectors = [
      '#jobDescriptionText',
      '[data-testid="jobsearch-JobComponent-description"]',
      '.jobsearch-jobDescriptionText',
      '.jobsearch-JobComponent-description',
    ];

    for (const sel of selectors) {
      const el = panel.querySelector(sel) || document.querySelector(sel);
      if (el && el.textContent.trim().length > 30) {
        return cleanDescription(el);
      }
    }

    return null;
  }

  function extractURL() {
    const currentUrl = window.location.href;
    try {
      const parsed = new URL(currentUrl);
      const vjk = parsed.searchParams.get('vjk') || parsed.searchParams.get('jk');
      if (vjk) {
        return `${parsed.origin}/viewjob?jk=${vjk}`;
      }
    } catch (e) {}

    return currentUrl;
  }

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

  // ---- 3. Clipboard API ----

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      log('Copied via modern Clipboard API');
      return true;
    } catch (e) {
      warn('Clipboard API failed, attempting execCommand fallback');
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
      logError('execCommand failed:', e.message);
    }

    return false;
  }

  // ---- 4. Button Icons & States ----

  function getCopyIcon() {
    return `<span class="rc-indeed-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg></span>`;
  }

  function getCheckIcon() {
    return `<span class="rc-indeed-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg></span>`;
  }

  function getErrorIcon() {
    return `<span class="rc-indeed-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg></span>`;
  }

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

  async function handleCopyClick(event) {
    event.preventDefault();
    event.stopPropagation();

    log('Copy Job Details clicked');
    setButtonState('extracting');

    try {
      const title = extractJobTitle();
      const company = extractCompany();
      const location = extractLocation();
      const metadata = extractMetadata();
      const url = extractURL();
      const description = extractDescription();

      const formatted = formatForClipboard({
        title,
        company,
        location,
        metadata,
        url,
        description,
      });

      const success = await copyToClipboard(formatted);
      if (!success) {
        throw new Error('Clipboard write failed');
      }

      log('Job details copied! Character count:', formatted.length);
      setButtonState('success');
    } catch (err) {
      logError('Error copying job details:', err.message);
      setButtonState('error');
    }

    setTimeout(() => setButtonState('ready'), RESET_DELAY_MS);
  }

  // ---- 5. Button Injection ----

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

    const existing = document.getElementById(BUTTON_ID);
    if (existing && document.body.contains(existing)) {
      // If button already exists and is visible on screen, we're good
      if (existing.offsetParent !== null) {
        return;
      }
      existing.remove();
    }

    const btn = createButton();
    let injected = false;

    // Strategy 1: Place directly adjacent to the primary Apply button
    const applyBtn = findApplyButton();
    if (applyBtn && applyBtn.parentElement) {
      applyBtn.insertAdjacentElement('afterend', btn);
      log('Button injected next to Apply button');
      injected = true;
    }

    // Strategy 2: Place in the action row container
    if (!injected) {
      const actionRow = document.querySelector(
        '#applyButtonLinkContainer, [data-testid="jobsearch-JobInfoHeader-actions"], .jobsearch-JobInfoHeader-actions, div[class*="JobInfoHeader-actions"]'
      );
      if (actionRow) {
        actionRow.appendChild(btn);
        log('Button injected in action row container');
        injected = true;
      }
    }

    // Strategy 3: Place after the job title heading
    if (!injected) {
      const titleEl = findTitleElement();
      if (titleEl && titleEl.parentElement) {
        titleEl.insertAdjacentElement('afterend', btn);
        log('Button injected after job title');
        injected = true;
      }
    }

    // Strategy 4: Place before job description
    if (!injected) {
      const desc = document.getElementById('jobDescriptionText');
      if (desc && desc.parentElement) {
        desc.parentElement.insertAdjacentElement('beforebegin', btn);
        log('Button injected before job description');
        injected = true;
      }
    }

    // Strategy 5: Floating fallback button (always visible)
    if (!injected) {
      log('Injecting fallback floating button');
      btn.classList.add('rc-indeed-floating');
      document.body.appendChild(btn);
    }

    lastJobSignature = getJobSignature();
  }

  function removeButton() {
    const existing = document.getElementById(BUTTON_ID);
    if (existing) {
      existing.remove();
      log('Button removed');
    }
  }

  // ---- 6. Dynamic SPA Watchers ----

  function checkJobSwitch() {
    const currentSig = getJobSignature();
    if (currentSig && currentSig !== lastJobSignature) {
      log('Job change detected:', lastJobSignature, '→', currentSig);
      lastJobSignature = currentSig;
      removeButton();
      setTimeout(injectButton, 150);
      return true;
    }
    return false;
  }

  function onNavigationChange() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      checkJobSwitch();
      if (hasJobOnPage()) {
        const btn = document.getElementById(BUTTON_ID);
        if (!btn || btn.offsetParent === null) {
          injectButton();
        }
      }
    }, 200);
  }

  function setupNavigationDetection() {
    // 1. History API interception
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

    // 2. Global MutationObserver (catches React DOM re-renders without strict ID checks)
    const observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        checkJobSwitch();
        if (hasJobOnPage()) {
          const btn = document.getElementById(BUTTON_ID);
          if (!btn || btn.offsetParent === null) {
            injectButton();
          }
        }
      }, 200);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // 3. Periodic Watchdog (guarantees button stays injected)
    setInterval(() => {
      const currentURL = window.location.href;
      if (currentURL !== lastURL) {
        lastURL = currentURL;
        onNavigationChange();
        return;
      }

      if (checkJobSwitch()) return;

      if (hasJobOnPage()) {
        const btn = document.getElementById(BUTTON_ID);
        if (!btn || btn.offsetParent === null) {
          injectButton();
        }
      }
    }, WATCHDOG_INTERVAL_MS);

    log('Navigation & mutation detection ready');
  }

  // ---- 7. Initialization ----

  function init() {
    log('Initializing Indeed 1-Click Job Copier...');
    setTimeout(injectButton, 400);
    setupNavigationDetection();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
