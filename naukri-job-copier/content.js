// ============================================
// RoleCraft — Naukri 1-Click Job Copier
// Content Script (Manifest V3)
// ============================================
// Extracts job details from Naukri job postings
// (Title, Company, Location, Experience, Salary,
//  clean Job Description, and Canonical URL)
// and copies them to the clipboard for RoleCraft ATS.
//
// DESIGN PRINCIPLE:
// The copy button is strictly rendered in-flow inside
// the active job's action bar or header. It NEVER floats
// around the viewport (no position:fixed fallback).
// If an appropriate place cannot be found or if no job
// is currently active, the button is not displayed.
// ============================================

(function () {
  'use strict';

  // ---- Constants ----
  const PREFIX = '[RoleCraft Naukri Copier]';
  const BUTTON_ID = 'rc-naukri-copy-btn';
  const RESET_DELAY_MS = 2500;
  const WATCHDOG_INTERVAL_MS = 1000;

  let lastJobSignature = '';
  let debounceTimer = null;
  let lastURL = window.location.href;

  // UI boilerplate phrases to strip from description
  const BOILERPLATE_PATTERNS = [
    /^apply\s*(on company site)?$/i,
    /^save\s*(job)?$/i,
    /^share\s*(job)?$/i,
    /^report this job$/i,
    /^send me jobs like this$/i,
    /^posted:\s*.*$/i,
    /^openings:\s*.*$/i,
    /^job applicants:\s*.*$/i,
    /^send jobs like this to my email$/i,
    /^role:\s*$/i,
    /^industry type:\s*$/i,
    /^department:\s*$/i,
    /^employment type:\s*$/i,
    /^role category:\s*$/i,
    /^education\s*$/i,
    /^key skills\s*$/i,
    /^about company\s*$/i,
    /^company info\s*$/i,
    /^follow\s*$/i,
  ];

  // ---- 1. Logging Helpers ----

  function log(...args) {
    console.log(PREFIX, ...args);
  }

  function warn(...args) {
    console.warn(PREFIX, ...args);
  }

  function logError(...args) {
    console.error(PREFIX, ...args);
  }

  // ---- 2. Page & Panel Detection ----

  /**
   * Checks if current URL or page structure represents a Naukri job page.
   */
  function isJobPage() {
    const url = window.location.href;
    return /naukri\.com\/(job-listings|job-detail|jobs-|[a-zA-Z0-9-]+-jobs)/i.test(url);
  }

  /**
   * Locates the active job container on the page.
   * Handles standalone job pages, quick-view panes, or modal views.
   */
  function findJobPanel() {
    // 1. Direct standalone job view containers
    const standaloneSelectors = [
      'main.styles_main-container__content__content-wrapper',
      'main[class*="content-wrapper" i]',
      'section[class*="jd-header" i]',
      'div[class*="styles_jdc__" i]',
      'div[class*="job-desc" i]',
      'section[class*="job-desc" i]',
      'main',
      'article[class*="jobTuple" i]',
      '#root',
    ];

    for (const sel of standaloneSelectors) {
      try {
        const el = document.querySelector(sel);
        if (el && el.isConnected && (el.offsetWidth > 0 || el.offsetHeight > 0)) {
          const hasTitle = el.querySelector('h1, [class*="jd-header-title" i], [class*="title" i]');
          const hasDesc = el.querySelector('[class*="dang-inner-html" i], [class*="job-desc" i], [itemprop="description"]');
          if (hasTitle || hasDesc) {
            return el;
          }
        }
      } catch (e) {}
    }

    // 2. Look for any visible container with an h1 heading and job description
    const h1 = document.querySelector('h1');
    if (h1 && h1.isConnected && h1.offsetWidth > 0) {
      const container = h1.closest('main, article, section, [class*="wrapper" i], div');
      if (container && container !== document.body && (container.offsetWidth > 0 || container.offsetHeight > 0)) {
        return container;
      }
    }

    // CRITICAL: NEVER return document.body! Return null if no active job panel.
    return null;
  }

  /**
   * Checks if an active job listing is currently visible on the page.
   */
  function hasJobOnPage(panel) {
    const jobPanel = panel || findJobPanel();
    if (!jobPanel) return false;

    if (!jobPanel.isConnected || (jobPanel.offsetWidth === 0 && jobPanel.offsetHeight === 0)) {
      return false;
    }

    const hasTitle = findTitleElement(jobPanel) !== null;
    const hasDesc = findDescriptionElement(jobPanel) !== null;
    const hasApply = findApplyButton(jobPanel) !== null;

    // Check for JSON-LD JobPosting schema
    const hasSchema = getJsonLdJobData() !== null;

    return (hasTitle && (hasDesc || hasApply)) || (hasSchema && (hasTitle || hasApply));
  }

  /**
   * Unique signature of the currently viewed job to detect card switches.
   */
  function getJobSignature() {
    try {
      const url = window.location.href;
      const match = url.match(/job-listings-([a-zA-Z0-9-]+)/i);
      if (match && match[1]) return match[1];
    } catch (e) {}

    const titleEl = findTitleElement();
    if (titleEl) {
      const titleText = (titleEl.textContent || '').trim();
      const compEl = findCompanyElement();
      const compText = compEl ? (compEl.textContent || '').trim() : '';
      return `${titleText}_${compText}`;
    }

    return '';
  }

  // ---- 3. Field Extractors (JSON-LD + Semantic DOM) ----

  /**
   * Parses schema.org JobPosting from application/ld+json script tags.
   */
  function getJsonLdJobData() {
    try {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        const text = script.textContent || '';
        if (!text.includes('JobPosting')) continue;
        const parsed = JSON.parse(text);

        if (parsed['@type'] === 'JobPosting') {
          return parsed;
        }

        if (Array.isArray(parsed['@graph'])) {
          const match = parsed['@graph'].find((item) => item['@type'] === 'JobPosting');
          if (match) return match;
        }
      }
    } catch (e) {
      // JSON parse error, ignore and fall back to DOM
    }
    return null;
  }

  function findTitleElement(scope) {
    const root = scope || findJobPanel() || document;
    const selectors = [
      'h1.styles_jd-header-title__vgzwS',
      'h1[class*="jd-header-title" i]',
      'h1[class*="job-title" i]',
      'h1[class*="title" i]',
      'h1[title]',
      'h1',
      '[class*="styles_jtitle" i]',
    ];

    for (const sel of selectors) {
      const el = root.querySelector(sel);
      if (el && el.isConnected) {
        const txt = (el.textContent || '').trim();
        if (txt.length > 2 && txt.length < 250 && !isGenericHeading(txt)) {
          return el;
        }
      }
    }
    return null;
  }

  function isGenericHeading(txt) {
    return /^(jobs in|recommended jobs|similar jobs|popular searches|search results|browse jobs|naukri)$/i.test(txt);
  }

  function extractJobTitle() {
    const jsonLd = getJsonLdJobData();
    if (jsonLd && jsonLd.title && typeof jsonLd.title === 'string') {
      return jsonLd.title.trim();
    }

    const titleEl = findTitleElement();
    if (titleEl) {
      return (titleEl.textContent || '').trim();
    }

    return 'Job Details';
  }

  function findCompanyElement(scope) {
    const root = scope || findJobPanel() || document;
    const selectors = [
      'a.styles_jd-header-comp-name__MCLht',
      'a[class*="jd-header-comp-name" i]',
      'div[class*="company-name" i] a',
      'div[class*="company-name" i]',
      'a[class*="comp-name" i]',
      'div[class*="comp-name" i]',
      'a[href*="/company-jobs/"]',
      'a[href*="/company/"]',
      '[data-type="company-name"]',
      '[class*="companyName" i]',
    ];

    for (const sel of selectors) {
      const el = root.querySelector(sel);
      if (el && el.isConnected) {
        const txt = (el.textContent || '').trim();
        if (txt.length > 1 && txt.length < 120 && !txt.toLowerCase().includes('reviews')) {
          return el;
        }
      }
    }
    return null;
  }

  function extractCompany() {
    const jsonLd = getJsonLdJobData();
    if (jsonLd && jsonLd.hiringOrganization) {
      if (typeof jsonLd.hiringOrganization === 'string') {
        return jsonLd.hiringOrganization.trim();
      }
      if (jsonLd.hiringOrganization.name) {
        return String(jsonLd.hiringOrganization.name).trim();
      }
    }

    const compEl = findCompanyElement();
    if (compEl) {
      let txt = (compEl.textContent || '').trim();
      // Remove trailing rating like "4.2 (100 Reviews)"
      txt = txt.replace(/\s*\d+(\.\d+)?\s*\(\d+.*?\)$/i, '').trim();
      return txt;
    }

    return '';
  }

  function extractLocation() {
    const jsonLd = getJsonLdJobData();
    if (jsonLd && jsonLd.jobLocation) {
      if (typeof jsonLd.jobLocation === 'string') return jsonLd.jobLocation.trim();
      const addr = jsonLd.jobLocation.address;
      if (addr) {
        if (typeof addr === 'string') return addr.trim();
        const parts = [addr.addressLocality, addr.addressRegion, addr.addressCountry].filter(Boolean);
        if (parts.length > 0) return parts.join(', ');
      }
    }

    const panel = findJobPanel() || document;
    const selectors = [
      'span.styles_jhc__location__r_nzA',
      'span[class*="jhc__location" i]',
      'span[class*="location" i]',
      'div[class*="location" i]',
      'a[href*="-jobs-in-"]',
      '[data-testid*="location" i]',
    ];

    for (const sel of selectors) {
      const el = panel.querySelector(sel);
      if (el) {
        const txt = (el.textContent || '').trim();
        if (txt.length > 1 && txt.length < 100) return txt;
      }
    }

    return '';
  }

  function extractExperience() {
    const jsonLd = getJsonLdJobData();
    if (jsonLd && jsonLd.experienceRequirements) {
      if (typeof jsonLd.experienceRequirements === 'string') return jsonLd.experienceRequirements.trim();
      if (jsonLd.experienceRequirements.monthsOfExperience) {
        const yrs = Math.floor(jsonLd.experienceRequirements.monthsOfExperience / 12);
        return `${yrs}+ Yrs`;
      }
    }

    const panel = findJobPanel() || document;
    const selectors = [
      'span.styles_jhc__exp__54Grid',
      'span[class*="jhc__exp" i]',
      'span[class*="exp" i]',
      'div[class*="exp" i]',
    ];

    for (const sel of selectors) {
      const el = panel.querySelector(sel);
      if (el) {
        const txt = (el.textContent || '').trim();
        if (/\d+.*?(?:yr|year|exp)/i.test(txt)) return txt;
      }
    }

    return '';
  }

  function extractSalary() {
    const jsonLd = getJsonLdJobData();
    if (jsonLd && jsonLd.baseSalary) {
      if (typeof jsonLd.baseSalary === 'string') return jsonLd.baseSalary.trim();
      if (jsonLd.baseSalary.value) {
        const val = jsonLd.baseSalary.value;
        if (typeof val === 'string') return val.trim();
        if (val.value) return `${val.value} ${jsonLd.baseSalary.currency || 'INR'}`;
      }
    }

    const panel = findJobPanel() || document;
    const selectors = [
      'span.styles_jhc__salary__jdfEC',
      'span[class*="jhc__salary" i]',
      'span[class*="salary" i]',
      'div[class*="salary" i]',
    ];

    for (const sel of selectors) {
      const el = panel.querySelector(sel);
      if (el) {
        const txt = (el.textContent || '').trim();
        if (txt.length > 1 && (txt.includes('₹') || /pa|lacs|lakh|disclosed/i.test(txt))) {
          return txt;
        }
      }
    }

    return '';
  }

  function extractSkills() {
    const panel = findJobPanel() || document;
    const skillEls = panel.querySelectorAll(
      'div[class*="key-skill" i] a, div[class*="styles_key-skill" i] a, div[class*="chip" i], a[class*="chip" i]'
    );
    const skills = [];
    for (const el of skillEls) {
      const txt = (el.textContent || '').trim();
      if (txt.length > 1 && txt.length < 40 && !skills.includes(txt)) {
        skills.push(txt);
      }
    }
    return skills.join(', ');
  }

  function findDescriptionElement(scope) {
    const root = scope || findJobPanel() || document;
    const selectors = [
      'div.styles_JDC__dang-inner-html__h0K4t',
      'div[class*="dang-inner-html" i]',
      'section.styles_job-desc-container__pv-8x',
      'section[class*="job-desc" i]',
      'div[class*="job-desc" i]',
      'div[class*="job-description" i]',
      '[itemprop="description"]',
      '#job-desc',
    ];

    for (const sel of selectors) {
      const el = root.querySelector(sel);
      if (el && el.textContent.trim().length > 40) {
        return el;
      }
    }
    return null;
  }

  function extractDescription() {
    const jsonLd = getJsonLdJobData();
    if (jsonLd && jsonLd.description && typeof jsonLd.description === 'string' && jsonLd.description.length > 50) {
      return cleanHtmlText(jsonLd.description);
    }

    const descEl = findDescriptionElement();
    if (descEl) {
      return cleanElementText(descEl);
    }

    return '';
  }

  function cleanHtmlText(html) {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return cleanElementText(temp);
  }

  function cleanElementText(element) {
    const clone = element.cloneNode(true);

    // Remove buttons, scripts, styles, svgs
    const unneeded = clone.querySelectorAll('button, script, style, svg, input, form, [class*="action" i]');
    unneeded.forEach((el) => el.remove());

    // Replace <br>, <p>, <li> with newlines for readability
    clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
    clone.querySelectorAll('p, div, li, tr').forEach((block) => {
      block.prepend(document.createTextNode('\n'));
      block.append(document.createTextNode('\n'));
    });

    const lines = (clone.textContent || '').split('\n');
    const cleaned = [];

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      let isBoilerplate = false;
      for (const pat of BOILERPLATE_PATTERNS) {
        if (pat.test(line)) {
          isBoilerplate = true;
          break;
        }
      }
      if (!isBoilerplate) {
        cleaned.push(line);
      }
    }

    return cleaned.join('\n\n').trim();
  }

  function extractURL() {
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical && canonical.href && canonical.href.includes('naukri.com')) {
      return canonical.href;
    }

    try {
      const url = new URL(window.location.href);
      // Strip tracking parameters
      const paramsToRemove = ['src', 'sid', 'xp', 'px', 'utm_source', 'utm_medium', 'utm_campaign', 'k'];
      paramsToRemove.forEach((p) => url.searchParams.delete(p));
      return url.toString();
    } catch (e) {
      return window.location.href;
    }
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

    const metaParts = [];
    if (details.experience) metaParts.push(`Experience: ${details.experience}`);
    if (details.salary) metaParts.push(`Salary: ${details.salary}`);
    if (details.skills) metaParts.push(`Key Skills: ${details.skills}`);

    if (metaParts.length > 0) {
      output += `JOB DETAILS:\n${metaParts.join(' | ')}\n\n`;
    }

    if (details.url) {
      output += `JOB URL:\n${details.url}\n\n`;
    }

    output += `JOB DESCRIPTION:\n${details.description || details.title || ''}`;

    return output.trim();
  }

  // ---- 4. Clipboard API ----

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      log('Copied via modern Clipboard API');
      return true;
    } catch (e) {
      warn('Clipboard API failed, attempting execCommand fallback:', e.message);
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

  // ---- 5. Button Icons & States ----

  function getCopyIcon() {
    return `<span class="rc-naukri-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg></span>`;
  }

  function getCheckIcon() {
    return `<span class="rc-naukri-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg></span>`;
  }

  function getErrorIcon() {
    return `<span class="rc-naukri-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg></span>`;
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
      const experience = extractExperience();
      const salary = extractSalary();
      const skills = extractSkills();
      const url = extractURL();
      const description = extractDescription();

      const formatted = formatForClipboard({
        title,
        company,
        location,
        experience,
        salary,
        skills,
        url,
        description,
      });

      const success = await copyToClipboard(formatted);
      if (!success) {
        throw new Error('Clipboard write failed');
      }

      log('Naukri job details copied! Length:', formatted.length);
      setButtonState('success');
    } catch (err) {
      logError('Error copying job details:', err.message);
      setButtonState('error');
    }

    setTimeout(() => setButtonState('ready'), RESET_DELAY_MS);
  }

  // ---- 6. Button Injection (Appropriate In-Flow Placement ONLY) ----

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

  function findApplyButton(scope) {
    const root = scope || findJobPanel() || document;
    const selectors = [
      'button.styles_apply-button__L2Q_2',
      'button[id*="apply" i]',
      'button[class*="apply-button" i]',
      'button[class*="apply" i]',
      'a[id*="apply" i]',
      'a[class*="apply" i]',
      '[data-testid*="apply" i]',
      'button[title*="apply" i]',
    ];

    for (const sel of selectors) {
      const el = root.querySelector(sel);
      if (el && el.isConnected && el.offsetWidth > 20 && el.offsetHeight > 15) {
        return el;
      }
    }

    // Text matching
    const buttons = root.querySelectorAll('button, a');
    for (const b of buttons) {
      const txt = (b.textContent || '').trim();
      if (/^apply\s*(on company site)?$/i.test(txt) || /^i am interested$/i.test(txt)) {
        if (b.offsetWidth > 20 && b.offsetHeight > 15) {
          return b;
        }
      }
    }

    return null;
  }

  /**
   * Strictly injects the button into the active job panel's action bar or header.
   * Returns true if placed at an appropriate place; returns false otherwise.
   * NEVER falls back to a floating or viewport-fixed button.
   */
  function injectIntoJob(panel, btn) {
    // Strategy 1: Dedicated apply / action button container in job header
    const actionContainer = panel.querySelector(
      'div.styles_apply-button-container__o_W_M, div[class*="apply-button-container" i], div[class*="jd-header-actions" i], div[class*="header-actions" i], div[class*="action-container" i]'
    );
    if (actionContainer && panel.contains(actionContainer)) {
      actionContainer.appendChild(btn);
      log('Button injected into header action container');
      return true;
    }

    // Strategy 2: Place adjacent to primary Apply button or its immediate wrapper
    const applyBtn = findApplyButton(panel);
    if (applyBtn && panel.contains(applyBtn)) {
      let target = applyBtn;
      if (target.parentElement && target.parentElement !== panel && target.parentElement.children.length === 1) {
        target = target.parentElement;
      }
      target.insertAdjacentElement('afterend', btn);
      log('Button injected adjacent to apply button wrapper');
      return true;
    }

    // Strategy 3: Place adjacent to Save/Interested button in job header
    const saveBtn = panel.querySelector('button[class*="save" i], div[class*="save" i], button[title*="save" i]');
    if (saveBtn && panel.contains(saveBtn)) {
      saveBtn.insertAdjacentElement('afterend', btn);
      log('Button injected adjacent to save button');
      return true;
    }

    // Strategy 4: Place directly inside header card after company / stats row
    const headerCard = panel.querySelector('section[class*="jd-header" i], div[class*="jd-header" i], header[class*="jd-header" i]');
    if (headerCard && panel.contains(headerCard)) {
      const wrapper = document.createElement('div');
      wrapper.style.display = 'inline-flex';
      wrapper.style.marginTop = '8px';
      wrapper.appendChild(btn);
      headerCard.appendChild(wrapper);
      log('Button injected into header card');
      return true;
    }

    // No appropriate in-flow position found — DO NOT INJECT!
    return false;
  }

  function injectButton() {
    if (!isJobPage()) {
      removeButton();
      return;
    }

    const panel = findJobPanel();
    if (!panel || !hasJobOnPage(panel)) {
      removeButton();
      return;
    }

    // Clean up any button outside active panel or duplicates
    const allButtons = document.querySelectorAll('#' + BUTTON_ID);
    for (const b of allButtons) {
      if (panel.contains(b) && b.offsetParent !== null) {
        if (b === allButtons[0]) {
          return;
        }
      }
      b.remove();
    }

    const btn = createButton();
    const injected = injectIntoJob(panel, btn);
    if (!injected) {
      log('Appropriate place inside job panel not found — button will NOT be displayed (no floating fallback)');
      removeButton();
      return;
    }

    lastJobSignature = getJobSignature();
    log('Button successfully injected into Naukri job header');
  }

  function removeButton() {
    const buttons = document.querySelectorAll('#' + BUTTON_ID);
    if (buttons.length > 0) {
      buttons.forEach((b) => b.remove());
      log('All instances of Naukri copy button removed');
    }
  }

  // ---- 7. Dynamic SPA Watchers ----

  function checkJobSwitch() {
    const currentSig = getJobSignature();
    if (currentSig && currentSig !== lastJobSignature) {
      log('Job change detected:', lastJobSignature, '→', currentSig);
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
      if (hasJobOnPage()) {
        const panel = findJobPanel();
        const btn = document.getElementById(BUTTON_ID);
        if (!btn || !panel || !panel.contains(btn) || btn.offsetParent === null) {
          injectButton();
        }
      } else {
        removeButton();
      }
    }, 200);
  }

  function setupNavigationDetection() {
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

    const observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        checkJobSwitch();
        if (hasJobOnPage()) {
          const panel = findJobPanel();
          const btn = document.getElementById(BUTTON_ID);
          if (!btn || !panel || !panel.contains(btn) || btn.offsetParent === null) {
            injectButton();
          }
        } else {
          removeButton();
        }
      }, 200);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    setInterval(() => {
      const currentURL = window.location.href;
      if (currentURL !== lastURL) {
        lastURL = currentURL;
        onNavigationChange();
        return;
      }

      if (checkJobSwitch()) return;

      if (hasJobOnPage()) {
        const panel = findJobPanel();
        const btn = document.getElementById(BUTTON_ID);
        if (!btn || !panel || !panel.contains(btn) || btn.offsetParent === null) {
          injectButton();
        }
      } else {
        removeButton();
      }
    }, WATCHDOG_INTERVAL_MS);

    log('Navigation & mutation detection initialized');
  }

  // ---- 8. Initialization ----

  function init() {
    log('Initializing RoleCraft Naukri 1-Click Job Copier...');
    setTimeout(injectButton, 400);
    setupNavigationDetection();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
