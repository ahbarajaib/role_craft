// ============================================
// RoleCraft — Bayt 1-Click Job Copier
// Content Script (Manifest V3)
// ============================================
// Extracts complete job details from Bayt.com job postings
// (Title, Company, Location, Job Type, Experience,
//  Salary, Full Job Content & Description, and Canonical URL)
// and copies them to the clipboard for RoleCraft ATS.
//
// ROBUST ARCHITECTURE:
// 1. Dual-mode support:
//    - Standalone Bayt job detail pages (/en/international/jobs/..., /en/job/...)
//    - Dynamic split-view search listing pages with active #job_card
// 2. Comprehensive DOM extraction:
//    - Captures the complete rich job card text (#job_card) including
//      roles, responsibilities, requirements, and preferred candidate specs.
//    - Decomposes interactive UI clutter (share, print, report, back-buttons).
// 3. Schema.org JSON-LD (JobPosting) as secondary rich fallback.
// 4. In-flow header / action bar placement beside the Apply button.
// 5. Guaranteed floating fallback button (#rc-bayt-floating-btn) if in-flow is blocked.
// ============================================

(function () {
  'use strict';

  // ---- Constants ----
  const PREFIX = '[RoleCraft Bayt Copier]';
  const BUTTON_ID = 'rc-bayt-copy-btn';
  const FLOATING_ID = 'rc-bayt-floating-btn';
  const RESET_DELAY_MS = 2500;
  const WATCHDOG_INTERVAL_MS = 1000;

  let lastJobSignature = '';
  let debounceTimer = null;
  let lastURL = window.location.href;

  // UI boilerplate phrases to strip from description text
  const BOILERPLATE_PATTERNS = [
    /^back to the job results$/i,
    /^apply\s*(on company site|on website|now)?$/i,
    /^easy apply$/i,
    /^save\s*(job)?$/i,
    /^share\s*(job)?$/i,
    /^print\s*(job)?$/i,
    /^report this job$/i,
    /^send me jobs like this$/i,
    /^job alerts$/i,
    /^read more$/i,
    /^show more$/i,
    /^compare with applicants$/i,
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

  function isJobPage() {
    const host = window.location.hostname.toLowerCase();
    if (!host.includes('bayt.com')) return false;

    const path = window.location.pathname.toLowerCase();
    if (
      path.includes('/jobs/') ||
      path.includes('/job/') ||
      path.startsWith('/en/job') ||
      path.startsWith('/ar/job')
    ) {
      return true;
    }

    if (document.querySelector('#job_card, [data-job-view-content], #job_title')) {
      return true;
    }

    return false;
  }

  function hasJobOnPage() {
    const card = document.querySelector('#job_card, [data-job-view-content]');
    if (card) {
      const titleEl = card.querySelector('#job_title, [data-jb-field="title"], h1');
      if (titleEl && (titleEl.textContent || '').trim().length >= 2) {
        return true;
      }
    }

    const h1 = document.querySelector('h1#job_title, h1[data-jb-field="title"], h1');
    if (h1 && (h1.textContent || '').trim().length >= 2) {
      return true;
    }

    const jsonLd = getJsonLdJobData();
    if (jsonLd && jsonLd.title && jsonLd.title.length >= 2) {
      return true;
    }

    return false;
  }

  function getJobSignature() {
    const card = document.querySelector('#job_card, [data-job-view-content]');
    if (card) {
      const titleEl = card.querySelector('#job_title, [data-jb-field="title"], h1');
      if (titleEl) {
        return (titleEl.textContent || '').trim().slice(0, 80);
      }
    }
    const h1 = document.querySelector('h1#job_title, h1');
    if (h1) return (h1.textContent || '').trim().slice(0, 80);
    return window.location.pathname;
  }

  // ---- 3. JSON-LD Structured Data Extraction ----

  function getJsonLdJobData() {
    try {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        if (!script.textContent) continue;
        try {
          const parsed = JSON.parse(script.textContent);
          const items = Array.isArray(parsed) ? parsed : [parsed];
          for (const item of items) {
            if (item && (item['@type'] === 'JobPosting' || item.type === 'JobPosting')) {
              let comp = '';
              if (typeof item.hiringOrganization === 'string') {
                comp = item.hiringOrganization;
              } else if (item.hiringOrganization && typeof item.hiringOrganization.name === 'string') {
                comp = item.hiringOrganization.name;
              }

              let loc = '';
              if (item.jobLocation) {
                const addr = item.jobLocation.address;
                if (typeof addr === 'string') {
                  loc = addr;
                } else if (addr && typeof addr === 'object') {
                  const parts = [addr.addressLocality, addr.addressRegion, addr.addressCountry].filter(Boolean);
                  loc = parts.join(', ');
                }
              }

              return {
                title: item.title || '',
                company: comp,
                location: loc,
                description: item.description || '',
                jobType: item.employmentType || '',
                salary: item.baseSalary?.value?.value ? `${item.baseSalary.value.value} ${item.baseSalary.currency || ''}`.trim() : '',
                url: item.url || '',
              };
            }
          }
        } catch (e) {}
      }
    } catch (e) {}
    return null;
  }

  // ---- 3b. Title & Location Guards ----

  function isInvalidJobTitle(text) {
    if (!text || typeof text !== "string") return true;
    const s = text.trim();
    if (s.length < 3 || s.length > 250) return true;
    const lower = s.toLowerCase();

    // Workplace modes are NEVER titles
    if (/^(hybrid|remote|on-site|onsite|work from home|wfh|in-office|in office|telecommute)$/i.test(lower)) return true;

    // Employment types are NEVER titles
    if (/^(full-time|part-time|contract|temporary|internship|volunteer|permanent|freelance)$/i.test(lower)) return true;

    // Seniority levels are NEVER titles
    if (/^(entry level|associate|mid-senior level|mid senior level|director|executive|internship)$/i.test(lower)) return true;

    // AI assessment banners, widgets, and prompts
    if (/^(use ai to|assess how you fit|assess your fit|see how you fit|see how you compare|evaluate your fit|evaluate how you fit|how you match|am i a good fit|are you a good fit|ai assessment|fit assessment|job match|match insights|show match details|get ai insights|tailor your resume)/i.test(lower)) return true;
    if (/\b(use ai to assess|assess how you fit|see how you fit|evaluate your fit|how you match|am i a good fit)\b/i.test(lower)) return true;

    // Common action, navigation or UI noise
    if (/^(back to the job results|easy apply|apply|save|saved|share|report|about the company|about the job|company overview|read more|show more)$/i.test(lower)) return true;

    return false;
  }

  function isInvalidLocation(text, currentTitle) {
    if (!text || typeof text !== "string") return true;
    const s = text.trim();
    if (s.length < 2 || s.length > 120) return true;
    const lower = s.toLowerCase();

    // Location CANNOT be or contain the job title
    if (currentTitle && currentTitle.length > 3) {
      const titleLower = currentTitle.toLowerCase().trim();
      if (lower === titleLower || lower.includes(titleLower) || titleLower.includes(lower)) {
        return true;
      }
    }

    // Location CANNOT be a job title or tech stack description
    if (/\b(developer|engineer|manager|architect|lead|analyst|designer|specialist|consultant|programmer|scientist|intern|executive|director|technician|officer|associate|python|react|fastapi|java|javascript|golang|c\+\+|node\.js|angular|vue|aws|azure|devops|full stack|frontend|backend)\b/i.test(lower)) {
      return true;
    }

    // Workplace modes alone are not locations
    if (/^(hybrid|remote|on-site|onsite|wfh|in-office)$/i.test(lower)) return true;

    return false;
  }

  // ---- 4. Complete DOM Job Details Extraction ----

  function extractJobDetails() {
    const jsonLd = getJsonLdJobData() || {};

    const card = document.querySelector('#job_card') ||
                 document.querySelector('[data-job-view-content]') ||
                 document.body;

    // 1. Job Title
    let title = '';
    const titleSelectors = [
      '#job_title',
      'h1[data-jb-field="title"]',
      '[data-jb-field="title"]',
      '#job_card h1',
      'h1',
    ];
    for (const sel of titleSelectors) {
      const els = card.querySelectorAll(sel);
      for (const el of els) {
        const txt = (el.textContent || '').trim();
        if (!isInvalidJobTitle(txt)) {
          title = txt;
          break;
        }
      }
      if (title) break;
    }
    if ((!title || isInvalidJobTitle(title)) && jsonLd.title) {
      const txt = jsonLd.title.trim();
      if (!isInvalidJobTitle(txt)) title = txt;
    }

    // 2. Company Name
    let company = '';
    const companySelectors = [
      '#job_card a[href*="/jobs/"][class*="t-default" i]',
      '#job_card a[href*="/company/"]',
      '#job_card .t-default',
      '#job_card .media-d a:not(#backToJobSearch)',
      'a[data-automation-id="jobCompany"]',
      '.jb-company',
    ];
    for (const sel of companySelectors) {
      const el = card.querySelector(sel);
      if (el) {
        const txt = (el.textContent || '').trim();
        if (txt && !txt.toLowerCase().includes('back to') && txt.length > 1) {
          company = txt;
          break;
        }
      }
    }
    if (!company && jsonLd.company) {
      company = jsonLd.company.trim();
    }

    // 3. Location
    let location = '';
    const locSelectors = [
      '[data-jb-field="location"]',
      '.jb-label-location',
      '.jb-tags',
      '.card-content .t-mute',
    ];
    for (const sel of locSelectors) {
      const el = card.querySelector(sel);
      if (el) {
        const txt = (el.textContent || '').trim();
        if (txt && !isInvalidLocation(txt, title)) {
          location = txt;
          break;
        }
      }
    }
    if ((!location || isInvalidLocation(location, title)) && jsonLd.location) {
      const txt = jsonLd.location.trim();
      if (!isInvalidLocation(txt, title)) location = txt;
    }

    // 4. Job Type / Employment Type
    let jobType = '';
    const typeEl = card.querySelector('[data-jb-field="employment_type"], .jb-label-employmenttype, [class*="employment-type" i]');
    if (typeEl) {
      jobType = (typeEl.textContent || '').trim();
    }
    if (!jobType && jsonLd.jobType) {
      jobType = jsonLd.jobType;
    }

    // 5. Complete Content & Description
    // As specifically required: copy the rich content inside #job_card,
    // preserving roles, requirements, and preferred candidate details.
    let description = '';

    const cloneCard = (card.querySelector('#job_card') || card).cloneNode(true);

    // Decompose interactive buttons, tools, popovers, share menus, print buttons, and alerts
    const noiseSelectors = [
      '.no-print', 'script', 'style', 'nav', 'svg', 'button', 'input', '.popover',
      '.dropdown', '#jobToolsHeader', '#jobToolsFooter', '#backToJobSearch',
      '#applicant-compare-slot', '.bg-lite', '#job-translation-disclaimer',
      '.jobMenuMobile', '.jobMenuDesktop', '[data-gpt-credits-tooltip]',
      '#bellDisableMsg', '#alert-text', '[data-automation-id="readyApplyLink"]',
      `#${BUTTON_ID}`, `#${FLOATING_ID}`, '.rc-bayt-icon'
    ];

    noiseSelectors.forEach((sel) => {
      cloneCard.querySelectorAll(sel).forEach((el) => el.remove());
    });

    const rawText = cloneCard.innerText || cloneCard.textContent || '';
    const lines = rawText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => {
        if (!l) return false;
        for (const pattern of BOILERPLATE_PATTERNS) {
          if (pattern.test(l)) return false;
        }
        return true;
      });

    if (lines.length > 0) {
      description = lines.join('\n');
    }

    // Fallback to explicit description container if cloned text was too sparse
    if (!description || description.length < 50) {
      const explicitDesc = card.querySelector('[data-jb-field="description"], [data-js-view="jobDescription"], .job-description, .card-content');
      if (explicitDesc) {
        description = (explicitDesc.innerText || explicitDesc.textContent || '').trim();
      }
    }

    if (!description && jsonLd.description) {
      // Strip HTML tags from JSON-LD description if needed
      const div = document.createElement('div');
      div.innerHTML = jsonLd.description;
      description = (div.innerText || div.textContent || '').trim();
    }

    // 6. Canonical URL
    let url = getCanonicalUrl();

    return {
      title,
      company,
      location,
      jobType,
      description,
      url,
    };
  }

  function getCanonicalUrl() {
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical && canonical.href) {
      return canonical.href;
    }
    try {
      const u = new URL(window.location.href);
      ['utm_source', 'utm_medium', 'utm_campaign', 'k', 'l', 'jb'].forEach((p) => u.searchParams.delete(p));
      return u.toString();
    } catch (e) {
      return window.location.href;
    }
  }

  // ---- 5. Output Formatting ----

  function formatForClipboard(details) {
    let output = '';

    const safeTitle = (!details.title || isInvalidJobTitle(details.title)) ? 'Job Opportunity' : details.title.trim();
    output += `JOB TITLE:\n${safeTitle}\n\n`;

    if (details.company) {
      output += `COMPANY:\n${details.company}\n\n`;
    }

    if (details.location) {
      output += `LOCATION:\n${details.location}\n\n`;
    }

    if (details.jobType) {
      output += `JOB TYPE:\n${details.jobType}\n\n`;
    }

    output += `JOB DESCRIPTION:\n${details.description || safeTitle || ''}`;

    return output.trim();
  }

  // ---- 6. Clipboard API ----

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      log('Copied successfully via navigator.clipboard');
      return true;
    } catch (e) {
      warn('Modern clipboard failed, attempting execCommand fallback:', e.message);
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
        log('Copied successfully via execCommand fallback');
        return true;
      }
    } catch (e) {
      logError('execCommand copy fallback failed:', e.message);
    }

    return false;
  }

  // ---- 7. SVG Icons ----

  function getCopyIcon() {
    return `<span class="rc-bayt-icon"><svg viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg></span>`;
  }

  function getCheckIcon() {
    return `<span class="rc-bayt-icon"><svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg></span>`;
  }

  function getAlertIcon() {
    return `<span class="rc-bayt-icon"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg></span>`;
  }

  // ---- 8. Button State Controller ----

  function setButtonState(btn, state) {
    if (!btn) return;
    btn.setAttribute('data-state', state);

    if (state === 'ready') {
      btn.innerHTML = `${getCopyIcon()} <span>Copy Job Details</span>`;
    } else if (state === 'extracting') {
      btn.innerHTML = `${getCopyIcon()} <span>Extracting...</span>`;
    } else if (state === 'success') {
      btn.innerHTML = `${getCheckIcon()} <span>Copied!</span>`;
    } else if (state === 'error') {
      btn.innerHTML = `${getAlertIcon()} <span>Copy Failed</span>`;
    }
  }

  // ---- 9. Copy Action Handler ----

  async function handleCopyClick(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }

    const clickedBtn = e?.currentTarget;
    setButtonState(clickedBtn, 'extracting');

    try {
      const details = extractJobDetails();

      // SANITY VALIDATION & CROSS-CORRECTION
      if (isInvalidJobTitle(details.title)) {
        warn(`Extracted title "${details.title}" is invalid. Running fallback...`);
        if (details.location && !isInvalidJobTitle(details.location) && /\b(developer|engineer|manager|architect|lead|analyst|designer|specialist|consultant|programmer|scientist|officer|associate|director)\b/i.test(details.location)) {
          const realTitle = details.location;
          details.location = "";
          details.title = realTitle;
        }
      }

      if (details.location && /\b(developer|engineer|manager|architect|lead|analyst|designer|specialist|consultant|programmer|scientist|python|react|fastapi)\b/i.test(details.location)) {
        if (!details.title || isInvalidJobTitle(details.title)) {
          details.title = details.location;
        }
        details.location = "";
      }

      log('Extracted details:', {
        title: details.title,
        company: details.company,
        location: details.location,
        descLength: details.description.length,
      });

      const formatted = formatForClipboard(details);
      const ok = await copyToClipboard(formatted);

      if (ok) {
        setButtonState(clickedBtn, 'success');
        // If floating button exists, update both
        const otherBtn = clickedBtn?.id === BUTTON_ID ? document.getElementById(FLOATING_ID) : document.getElementById(BUTTON_ID);
        if (otherBtn) setButtonState(otherBtn, 'success');
      } else {
        setButtonState(clickedBtn, 'error');
      }
    } catch (err) {
      logError('Error extracting/copying job details:', err);
      setButtonState(clickedBtn, 'error');
    }

    setTimeout(() => {
      setButtonState(clickedBtn, 'ready');
      const otherBtn = clickedBtn?.id === BUTTON_ID ? document.getElementById(FLOATING_ID) : document.getElementById(BUTTON_ID);
      if (otherBtn) setButtonState(otherBtn, 'ready');
    }, RESET_DELAY_MS);
  }

  // ---- 10. Button Creation & Placement ----

  function createButton(isFloating = false) {
    const btn = document.createElement('button');
    btn.id = isFloating ? FLOATING_ID : BUTTON_ID;
    btn.type = 'button';
    btn.setAttribute('data-state', 'ready');
    btn.title = 'Copy complete job details to clipboard for RoleCraft ATS optimization';
    btn.innerHTML = `${getCopyIcon()} <span>Copy Job Details</span>`;

    const stopEvents = (e) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
    };

    btn.addEventListener('pointerdown', stopEvents, true);
    btn.addEventListener('mousedown', stopEvents, true);
    btn.addEventListener('pointerup', stopEvents, true);
    btn.addEventListener('mouseup', stopEvents, true);
    btn.addEventListener('click', handleCopyClick, true);

    return btn;
  }

  function findInsertionTarget() {
    const card = document.querySelector('#job_card') || document.querySelector('[data-job-view-content]');
    if (!card) return null;

    // 1. Next to the primary apply button inside the job card
    const applyBtn = card.querySelector(
      'a[data-js-aid="apply"], a[href*="/job/apply/"], #applyButton, [data-automation-id="readyApplyLink"], .is-apply-button'
    );
    if (applyBtn && applyBtn.parentElement) {
      return { element: applyBtn, method: 'before' };
    }

    // 2. Inside card header or actions container
    const headerActions = card.querySelector('.card-head, .media-d, [data-job-view-content] > div, #jobToolsHeader');
    if (headerActions) {
      return { element: headerActions, method: 'append' };
    }

    // 3. Right after the job title
    const titleEl = card.querySelector('#job_title, [data-jb-field="title"], h1');
    if (titleEl && titleEl.parentElement) {
      return { element: titleEl.parentElement, method: 'append' };
    }

    return null;
  }

  function injectButton() {
    if (!hasJobOnPage()) {
      return;
    }

    const existingBtn = document.getElementById(BUTTON_ID);
    if (existingBtn && existingBtn.isConnected) {
      return;
    }

    const target = findInsertionTarget();

    if (target && target.element && target.element.isConnected) {
      const btn = createButton(false);
      try {
        if (target.method === 'before') {
          target.element.parentElement.insertBefore(btn, target.element);
        } else if (target.method === 'after') {
          target.element.insertAdjacentElement('afterend', btn);
        } else {
          target.element.appendChild(btn);
        }
        log('Injected in-flow button into Bayt DOM.');
        // Remove floating fallback if in-flow succeeded
        const existingFloating = document.getElementById(FLOATING_ID);
        if (existingFloating) existingFloating.remove();
        return;
      } catch (e) {
        warn('Failed in-flow insertion, falling back to floating:', e.message);
      }
    }

    // Guaranteed Floating Fallback
    const existingFloating = document.getElementById(FLOATING_ID);
    if (!existingFloating || !existingFloating.isConnected) {
      const floatingBtn = createButton(true);
      document.body.appendChild(floatingBtn);
      log('Injected guaranteed floating button into document.body.');
    }
  }

  // ---- 11. Observers & Lifecycle ----

  function onDomMutated() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const currentSignature = getJobSignature();
      const currentURL = window.location.href;

      if (currentSignature !== lastJobSignature || currentURL !== lastURL) {
        lastJobSignature = currentSignature;
        lastURL = currentURL;
        log('Job or URL changed, re-evaluating button injection...');
        const oldInFlow = document.getElementById(BUTTON_ID);
        if (oldInFlow) oldInFlow.remove();
        const oldFloating = document.getElementById(FLOATING_ID);
        if (oldFloating) oldFloating.remove();
      }

      injectButton();
    }, 200);
  }

  function startWatchdog() {
    setInterval(() => {
      if (!isJobPage()) return;
      const inFlow = document.getElementById(BUTTON_ID);
      const floating = document.getElementById(FLOATING_ID);
      if (!inFlow && !floating && hasJobOnPage()) {
        log('Watchdog detected missing button, re-injecting...');
        injectButton();
      }
    }, WATCHDOG_INTERVAL_MS);
  }

  function init() {
    log('Initializing Bayt 1-Click Job Copier extension...');
    if (isJobPage()) {
      injectButton();
    }

    const observer = new MutationObserver(onDomMutated);
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });

    startWatchdog();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
