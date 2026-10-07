// ============================================
// RoleCraft — Indeed 1-Click Job Copier
// Content Script (Manifest V3)
// ============================================

(function () {
  'use strict';

  // Strictly run in top window only (never in iframes or embedded ad widgets)
  if (window.self !== window.top) {
    return;
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
   * Locates the active job container holding the full job details.
   * On Indeed, an active job MUST have #jobDescriptionText (or known description container)
   * or be an active right pane with job header and apply button.
   * NEVER returns document.body. Returns null if no active job is displayed.
   */
  function findJobPanel() {
    // 1. Primary anchor: The canonical job description element
    const desc = document.getElementById('jobDescriptionText') ||
      document.querySelector('[data-testid="jobDescriptionText"], .jobsearch-jobDescriptionText');

    if (desc) {
      let curr = desc.parentElement;
      while (curr && curr !== document.body) {
        if (
          curr.id === 'jobsearch-ViewjobPaneWrapper' ||
          curr.getAttribute('data-testid') === 'jobsearch-ViewJobLayout' ||
          curr.classList?.contains('jobsearch-RightPane') ||
          curr.classList?.contains('jobsearch-JobComponent') ||
          curr.id === 'vjs-container' ||
          curr.classList?.contains('fastviewjob') ||
          curr.querySelector?.('#applyButtonLinkContainer, [data-testid="jobsearch-JobInfoHeader-actions"]')
        ) {
          if (!curr.closest('#mosaic-provider-jobcards, .jobsearch-LeftPane')) {
            return curr;
          }
        }
        curr = curr.parentElement;
      }
      if (desc.parentElement && !desc.parentElement.closest('#mosaic-provider-jobcards, .jobsearch-LeftPane')) {
        return desc.parentElement;
      }
    }

    // 2. Fallback: check known pane selectors, verifying it has active job content
    const paneSelectors = [
      '#jobsearch-ViewjobPaneWrapper',
      '[data-testid="jobsearch-ViewJobLayout"]',
      '.jobsearch-RightPane',
      '#vjs-container',
      '.fastviewjob',
      '.jobsearch-JobComponent',
      'div[class*="jobsearch-ViewJobLayout"]',
      'div[class*="RightPane"]',
      'div[class*="viewjob-pane"]',
    ];

    for (const sel of paneSelectors) {
      try {
        const el = document.querySelector(sel);
        if (el && el.offsetHeight > 100) {
          if (el.closest('#mosaic-provider-jobcards, .jobsearch-LeftPane')) continue;
          const hasApply = el.querySelector('#applyButtonLinkContainer, [data-testid*="apply" i], a[aria-label*="apply" i], button[aria-label*="apply" i]');
          const hasTitle = el.querySelector('h1, [data-testid*="title" i], [class*="JobInfoHeader-title" i]');
          if (hasApply || hasTitle || el.querySelector('#jobDescriptionText')) {
            return el;
          }
        }
      } catch (e) {}
    }

    // CRITICAL: Return null if no active job is displayed. NEVER return document.body!
    return null;
  }

  function isGenericHeading(txt) {
    return /^(job details|benefits|qualifications|about the job|pay|job type|here's how|full job description|popular searches|recent searches|find jobs|jobs in .*)$/i.test(txt);
  }

  /**
   * Finds the Job Title heading element strictly within the active job panel.
   */
  function findTitleElement(panel) {
    const root = panel || findJobPanel();
    if (!root) return null;

    const specificSelectors = [
      'h1[data-testid="jobsearch-JobInfoHeader-title"]',
      'h1.jobsearch-JobInfoHeader-title',
      '[data-testid="jobsearch-JobInfoHeader-title"]',
      'h1[class*="JobInfoHeader-title" i]',
      'h1[class*="jobTitle" i]',
      'h1',
    ];

    for (const sel of specificSelectors) {
      const el = root.querySelector(sel);
      if (el) {
        if (el.closest('#mosaic-provider-jobcards, .jobsearch-LeftPane, .job_seen_beacon')) {
          continue;
        }
        const txt = (el.textContent || '').trim();
        if (txt.length > 2 && txt.length < 200 && !isGenericHeading(txt)) {
          return el;
        }
      }
    }

    const headings = root.querySelectorAll('h2, [data-testid*="title" i]');
    for (const h of headings) {
      if (h.closest('#mosaic-provider-jobcards, .jobsearch-LeftPane, .job_seen_beacon')) {
        continue;
      }
      const txt = (h.textContent || '').trim();
      if (txt.length > 2 && txt.length < 200 && !isGenericHeading(txt)) {
        return h;
      }
    }

    return null;
  }

  /**
   * Locates the primary "Apply" button strictly inside the active job panel.
   */
  function findApplyButton(scope) {
    const root = scope || findJobPanel();
    if (!root) return null;

    const applyContainer = root.querySelector(
      '#applyButtonLinkContainer, .jobsearch-IndeedApplyButton-buttonWrapper, [data-testid="jobsearch-JobInfoHeader-actions"]'
    );
    if (applyContainer && !applyContainer.closest('#mosaic-provider-jobcards, .jobsearch-LeftPane, .job_seen_beacon')) {
      const btn = applyContainer.querySelector('button, a');
      if (btn && btn.offsetWidth > 30 && btn.offsetHeight > 20) {
        return btn;
      }
      return applyContainer;
    }

    const elements = root.querySelectorAll('button, a');
    for (const el of elements) {
      if (el.closest('#mosaic-provider-jobcards, .jobsearch-LeftPane, .job_seen_beacon')) {
        continue;
      }
      const txt = (el.textContent || '').trim();
      if (
        /^apply on (company|employer) site/i.test(txt) ||
        /^apply now/i.test(txt) ||
        /^easily apply/i.test(txt) ||
        /^apply\b/i.test(txt)
      ) {
        if (el.offsetWidth > 30 && el.offsetHeight > 20) {
          return el;
        }
      }
    }

    const byAttr = root.querySelector(
      '[data-testid*="apply" i], a[aria-label*="apply" i], button[aria-label*="apply" i]'
    );
    if (byAttr && !byAttr.closest('#mosaic-provider-jobcards, .jobsearch-LeftPane, .job_seen_beacon')) {
      return byAttr;
    }

    return null;
  }

  /**
   * Checks if an active job listing is currently visible on the page.
   */
  function hasJobOnPage(panel) {
    const jobPanel = panel || findJobPanel();
    if (!jobPanel) return false;

    // Must be attached to DOM and have non-zero dimensions
    if (!jobPanel.isConnected || (jobPanel.offsetWidth === 0 && jobPanel.offsetHeight === 0)) {
      return false;
    }

    const hasDesc = jobPanel.querySelector('#jobDescriptionText, [data-testid="jobDescriptionText"], .jobsearch-jobDescriptionText') !== null;
    const hasApply = findApplyButton(jobPanel) !== null;
    const hasTitle = findTitleElement(jobPanel) !== null;

    return hasDesc || (hasTitle && hasApply);
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

    const panel = findJobPanel();
    if (panel) {
      const titleEl = findTitleElement(panel);
      if (titleEl) {
        const companyEl = panel.querySelector('[data-testid*="companyName" i], a[href*="/cmp/"]');
        const companyTxt = companyEl ? companyEl.textContent.trim() : '';
        return `${titleEl.textContent.trim()}_${companyTxt}`;
      }
    }

    return '';
  }

  // ---- 2. Field Extractors ----

  /**
   * Attempt to parse Google Jobs JSON-LD schema if embedded.
   */
  function getJsonLdData() {
    try {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const s of scripts) {
        const raw = s.textContent || '';
        if (!raw.includes('JobPosting')) continue;
        const data = JSON.parse(raw);
        if (data['@type'] === 'JobPosting') return data;
        if (Array.isArray(data['@graph'])) {
          const found = data['@graph'].find((item) => item['@type'] === 'JobPosting');
          if (found) return found;
        }
      }
    } catch (e) {}
    return null;
  }

  function extractJobTitle() {
    const panel = findJobPanel();

    // Prefer DOM inside the active panel so switching jobs on /jobs?q=... is always accurate
    if (panel) {
      const titleEl = findTitleElement(panel);
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
    }

    // Only fallback to JSON-LD if on a direct viewjob page
    if (/viewjob|jobs\/view|rc\/clk/i.test(window.location.href)) {
      const jsonLd = getJsonLdData();
      if (jsonLd && jsonLd.title && jsonLd.title.trim().length > 2) {
        log('Title extracted from JSON-LD:', jsonLd.title);
        return jsonLd.title.trim();
      }
    }

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
    if (!panel) return null;

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
      const el = panel.querySelector(sel);
      if (el) {
        const txt = el.textContent.trim();
        if (txt.length > 1 && txt.length < 120) return txt;
      }
    }

    const links = panel.querySelectorAll('a');
    for (const l of links) {
      const href = l.getAttribute('href') || '';
      const txt = l.textContent.trim();
      if ((href.includes('/cmp/') || href.includes('/companies/')) && txt.length > 1) {
        return txt;
      }
    }

    if (/viewjob|jobs\/view|rc\/clk/i.test(window.location.href)) {
      const jsonLd = getJsonLdData();
      if (jsonLd && jsonLd.hiringOrganization && jsonLd.hiringOrganization.name) {
        log('Company extracted from JSON-LD:', jsonLd.hiringOrganization.name);
        return jsonLd.hiringOrganization.name.trim();
      }
    }

    if (document.title) {
      const parts = document.title.split(' - ');
      if (parts.length >= 3 && parts[1].trim().length > 1) {
        return parts[1].trim();
      }
    }

    return null;
  }

  function extractLocation() {
    const panel = findJobPanel();
    if (!panel) return null;

    // 1. Sibling text right next to / under Company Name inside panel
    const companyEl = panel.querySelector('a[href*="/cmp/"], [data-testid*="companyName" i], [class*="companyName" i]');
    if (companyEl) {
      let next = companyEl.parentElement?.nextElementSibling;
      while (next) {
        const txt = next.textContent.trim();
        // Location is typically "Remote", "City, State", etc., but not salary
        if (txt.length > 2 && txt.length < 80 && !/[₹$€£]|\d{3,}|year|month|hour|full-time/i.test(txt)) {
          log('Location extracted from company sibling:', txt);
          return txt;
        }
        next = next.nextElementSibling;
      }
    }

    // 2. Known location selectors strictly inside panel
    const selectors = [
      '[data-testid="inlineHeader-companyLocation"]',
      '[data-testid="jobsearch-JobInfoHeader-companyLocation"]',
      'div[data-testid="job-location"]',
      '[data-testid*="companyLocation" i]',
      '[data-testid*="location" i]',
      '.jobsearch-JobInfoHeader-companyLocation',
      'div[class*="companyLocation"]',
      'div[class*="jobLocation"]',
    ];

    for (const sel of selectors) {
      const el = panel.querySelector(sel);
      if (el) {
        const txt = el.textContent.trim();
        if (txt.length > 1 && txt.length < 120) return txt;
      }
    }

    // 3. Check JSON-LD if direct viewjob
    if (/viewjob|jobs\/view|rc\/clk/i.test(window.location.href)) {
      const jsonLd = getJsonLdData();
      if (jsonLd && jsonLd.jobLocation) {
        const loc = jsonLd.jobLocation;
        if (loc.address) {
          const parts = [loc.address.addressLocality, loc.address.addressRegion, loc.address.addressCountry].filter(Boolean);
          if (parts.length > 0) return parts.join(', ');
        }
        if (typeof loc === 'string') return loc;
      }
    }

    // 4. Fallback: Parse from page title ("Title - Company - Location | Indeed.com")
    if (document.title) {
      const parts = document.title.split(' - ');
      if (parts.length >= 3) {
        const locPart = parts[2].split('|')[0].trim();
        if (locPart.length > 1 && locPart.length < 100) return locPart;
      }
    }

    return null;
  }

  function extractMetadata() {
    const panel = findJobPanel();
    if (!panel) return null;

    const items = [];
    const selectors = [
      '#salaryInfoAndJobType',
      '[data-testid="jobsearch-OtherJobDetailsContainer"]',
      '[data-testid="attribute_snippets"]',
      '#jobDetailsSection',
    ];

    for (const sel of selectors) {
      try {
        const el = panel.querySelector(sel);
        if (el) {
          const rawLines = (el.innerText || el.textContent || '').split('\n');
          for (let line of rawLines) {
            line = line.trim();
            // Skip noisy conversational Indeed UI text
            if (
              !line ||
              /^job details$/i.test(line) ||
              /^here['’]s how the job details align with your profile.*$/i.test(line)
            ) {
              continue;
            }
            if (!items.includes(line)) {
              items.push(line);
            }
          }
        }
      } catch (e) {}
    }

    return items.length > 0 ? items.join('\n') : null;
  }

  function normalizeJobType(raw) {
    if (!raw || typeof raw !== 'string') return '';
    const s = raw.trim();
    const lower = s.toLowerCase();

    // Workplace mode first
    if (lower.includes('hybrid')) return 'Hybrid';
    if (lower.includes('remote') || lower.includes('telecommute') || lower.includes('work from home') || lower.includes('wfh')) return 'Remote';
    if (lower.includes('on-site') || lower.includes('onsite') || lower.includes('in-office') || lower.includes('in office') || lower.includes('in-person') || lower.includes('in person')) return 'On-site';

    // Employment type
    if (lower.includes('full-time') || lower.includes('full time') || lower.includes('full_time') || lower.includes('permanent')) return 'Full-time';
    if (lower.includes('part-time') || lower.includes('part time') || lower.includes('part_time')) return 'Part-time';
    if (lower.includes('contract') || lower.includes('temporary') || lower.includes('contractual') || lower.includes('freelance')) return 'Contract';
    if (lower.includes('internship') || lower.includes('intern')) return 'Internship';

    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function cleanLocationAndExtractJobType(locationStr, existingJobType) {
    if (!locationStr) return { location: '', jobType: existingJobType || '' };
    let loc = locationStr.trim();
    let jobType = existingJobType || '';

    if (!jobType) {
      const match = loc.match(/\b(hybrid|remote|on-site|onsite|in-person|in-office|wfh)\b/i);
      if (match) {
        jobType = normalizeJobType(match[1]);
      }
    }

    // Strip workplace markers from location string
    loc = loc
      .replace(/[\s·•\-]+\b(hybrid|remote|on-site|onsite|in-person|in-office|wfh)\b.*$/i, '')
      .replace(/^[\s·•\-]*\b(hybrid|remote|on-site|onsite|in-person|in-office|wfh)\b[\s·•\:\-]+/i, '')
      .replace(/\((?:hybrid|remote|on-site|onsite|in-person|in-office|wfh)\)/gi, '')
      .replace(/\[(?:hybrid|remote|on-site|onsite|in-person|in-office|wfh)\]/gi, '')
      .replace(/^[·•,\-\s]+|[·•,\-\s]+$/g, '')
      .trim();

    return { location: loc, jobType: normalizeJobType(jobType) };
  }

  function extractJobType(locationText, metadataText) {
    const panel = findJobPanel() || document;

    // Strategy 1: Check Indeed job type selectors
    const selectors = [
      '#salaryInfoAndJobType',
      '[data-testid="jobsearch-OtherJobDetailsContainer"]',
      '[data-testid="attribute_snippets"]',
      '#jobDetailsSection',
      '[data-testid*="job-type" i]',
      '[class*="jobType" i]',
    ];

    for (const sel of selectors) {
      try {
        const el = panel.querySelector(sel);
        if (el) {
          const txt = (el.innerText || el.textContent || '').trim();
          if (/\b(hybrid|remote|on-site|onsite|in-person)\b/i.test(txt)) {
            const m = txt.match(/\b(hybrid|remote|on-site|onsite|in-person)\b/i);
            if (m) return normalizeJobType(m[1]);
          }
          if (/\b(full-time|part-time|contract|temporary|internship)\b/i.test(txt)) {
            const m = txt.match(/\b(full-time|part-time|contract|temporary|internship)\b/i);
            if (m) return normalizeJobType(m[1]);
          }
        }
      } catch (e) {}
    }

    // Strategy 2: Check JSON-LD
    try {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const s of scripts) {
        const data = JSON.parse(s.textContent || '{}');
        if (data['@type'] === 'JobPosting') {
          if (data.jobLocationType === 'TELECOMMUTE') return 'Remote';
          if (data.employmentType) return normalizeJobType(String(data.employmentType));
        }
      }
    } catch (e) {}

    // Strategy 3: Check metadataText
    if (metadataText) {
      const m = metadataText.match(/\b(hybrid|remote|on-site|onsite|full-time|part-time|contract|internship)\b/i);
      if (m) return normalizeJobType(m[1]);
    }

    // Strategy 4: Check locationText
    if (locationText) {
      const m = locationText.match(/\b(hybrid|remote|on-site|onsite|in-person)\b/i);
      if (m) return normalizeJobType(m[1]);
    }

    return '';
  }

  function cleanDescription(el) {
    const clone = el.cloneNode(true);

    // Remove buttons, scripts, styles, svgs
    clone.querySelectorAll('script, style, noscript, svg, button, nav, [aria-hidden="true"]').forEach((n) => n.remove());

    // Format list items with clean bullet points
    clone.querySelectorAll('li').forEach((li) => {
      li.textContent = '• ' + li.textContent.trim() + '\n';
    });

    // Add clean newlines for blocks
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

  /**
   * Multi-Strategy Job Description Extractor:
   * 1. Heading search ("Full job description", "Job description", "About the job")
   * 2. Embedded JSON-LD schema
   * 3. Embedded mosaic provider script data
   * 4. Known DOM selectors across the entire document
   * 5. Largest rich-text content block in the job panel
   */
  function extractDescription() {
    const panel = findJobPanel();
    if (!panel) return null;

    // Strategy 1: Canonical #jobDescriptionText inside panel or document
    const descEl = panel.querySelector('#jobDescriptionText') ||
      document.getElementById('jobDescriptionText') ||
      panel.querySelector('[data-testid="jobDescriptionText"], .jobsearch-jobDescriptionText');

    if (descEl && descEl.textContent.trim().length > 30) {
      log('Description extracted from #jobDescriptionText');
      return cleanDescription(descEl);
    }

    // Strategy 2: Known Description Selectors inside panel
    const selectors = [
      '[data-testid="jobsearch-JobComponent-description"]',
      '.jobsearch-JobComponent-description',
      '#jobDescriptionSection',
      '[id*="jobDescription" i]',
      '[class*="jobDescription" i]',
      'div[class*="JobComponent-description"]',
    ];

    for (const sel of selectors) {
      const el = panel.querySelector(sel);
      if (el && el.textContent.trim().length > 50) {
        log('Description extracted from selector:', sel);
        return cleanDescription(el);
      }
    }

    // Strategy 3: Find heading "Full job description" or "Job description" inside panel
    const headings = panel.querySelectorAll('h1, h2, h3, h4, h5, h6, div, span, p');
    for (const h of headings) {
      const txt = (h.textContent || '').trim().toLowerCase();
      if (txt === 'full job description' || txt === 'job description' || txt === 'about the job') {
        let sibling = h.nextElementSibling;
        while (sibling) {
          if (sibling.textContent.trim().length > 60) {
            log('Description found via heading nextElementSibling');
            return cleanDescription(sibling);
          }
          sibling = sibling.nextElementSibling;
        }

        if (h.parentElement) {
          let pSibling = h.parentElement.nextElementSibling;
          while (pSibling) {
            if (pSibling.textContent.trim().length > 60) {
              log('Description found via heading parent nextElementSibling');
              return cleanDescription(pSibling);
            }
            pSibling = pSibling.nextElementSibling;
          }
        }
      }
    }

    // Strategy 4: Fallback to JSON-LD if direct viewjob
    if (/viewjob|jobs\/view|rc\/clk/i.test(window.location.href)) {
      const jsonLd = getJsonLdData();
      if (jsonLd && jsonLd.description && jsonLd.description.trim().length > 50) {
        log('Description extracted from JSON-LD schema');
        const temp = document.createElement('div');
        temp.innerHTML = jsonLd.description;
        return cleanDescription(temp);
      }
    }

    // Strategy 5: Largest structured content block in the active job pane
    const candidateDivs = panel.querySelectorAll('div, section, article');
    let bestBlock = null;
    let highestScore = 0;

    for (const block of candidateDivs) {
      if (block.querySelector('input, [data-testid*="header" i]')) continue;
      if (block.closest('.jobsearch-LeftPane, #mosaic-provider-jobcards, header, nav')) continue;

      const txt = block.textContent.trim();
      if (txt.length < 100 || txt.length > 40000) continue;

      const liCount = block.querySelectorAll('li').length;
      const pCount = block.querySelectorAll('p').length;
      const hasKeywords = /requirements|responsibilities|qualifications|experience|skills|about the role|what you'll do|who you are|we are looking for/i.test(txt);

      let score = txt.length;
      if (liCount >= 2) score += 2000;
      if (pCount >= 2) score += 1000;
      if (hasKeywords) score += 3000;

      if (score > highestScore) {
        highestScore = score;
        bestBlock = block;
      }
    }

    if (bestBlock) {
      log('Description extracted via largest content block');
      return cleanDescription(bestBlock);
    }

    warn('All description extraction strategies failed');
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

    const panel = findJobPanel();
    if (panel) {
      const jobLink = panel.querySelector('a[href*="jk="], a[href*="/viewjob"], a[href*="/rc/clk"]');
      if (jobLink && jobLink.href) {
        try {
          const u = new URL(jobLink.href, window.location.origin);
          const jk = u.searchParams.get('jk') || u.searchParams.get('vjk');
          if (jk) {
            return `${window.location.origin}/viewjob?jk=${jk}`;
          }
        } catch (e) {}
      }
    }

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

    if (details.jobType) {
      output += `JOB TYPE:\n${details.jobType}\n\n`;
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
      const rawLocation = extractLocation();
      const metadata = extractMetadata();
      const rawJobType = extractJobType(rawLocation, metadata);
      const locAndType = cleanLocationAndExtractJobType(rawLocation, rawJobType);
      const url = extractURL();
      const description = extractDescription();

      const formatted = formatForClipboard({
        title,
        company,
        location: locAndType.location,
        jobType: locAndType.jobType,
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

  function injectIntoJob(panel, btn) {
    // Strategy 1: Place directly adjacent to #applyButtonLinkContainer or inside action row
    const applyContainer = panel.querySelector(
      '#applyButtonLinkContainer, .jobsearch-IndeedApplyButton-buttonWrapper'
    );
    const actionRow = panel.querySelector(
      '[data-testid="jobsearch-JobInfoHeader-actions"], .jobsearch-JobInfoHeader-actions, #jobsearch-ViewJobButtons-container, div[class*="JobInfoHeader-actions"]'
    );

    if (applyContainer && applyContainer.parentElement && panel.contains(applyContainer)) {
      applyContainer.insertAdjacentElement('afterend', btn);
      log('Button injected adjacent to apply container');
      return true;
    }

    if (actionRow && panel.contains(actionRow)) {
      actionRow.appendChild(btn);
      log('Button injected into action row container');
      return true;
    }

    // Strategy 2: Place adjacent to primary Apply button in panel
    const applyBtn = findApplyButton(panel);
    if (applyBtn && panel.contains(applyBtn)) {
      let target = applyBtn;
      if (target.parentElement && target.parentElement !== panel && target.parentElement.children.length === 1) {
        target = target.parentElement;
      }
      target.insertAdjacentElement('afterend', btn);
      log('Button injected adjacent to apply button');
      return true;
    }

    // Strategy 3: Place after the job title heading inside panel
    const titleEl = findTitleElement(panel);
    if (titleEl && titleEl.parentElement && panel.contains(titleEl)) {
      titleEl.insertAdjacentElement('afterend', btn);
      log('Button injected after job title in panel');
      return true;
    }

    // Strategy 4: Place before job description in panel
    const desc = panel.querySelector('#jobDescriptionText') || document.getElementById('jobDescriptionText');
    if (desc && desc.parentElement && panel.contains(desc)) {
      desc.insertAdjacentElement('beforebegin', btn);
      log('Button injected before job description');
      return true;
    }

    return false;
  }

  function injectButton() {
    const panel = findJobPanel();
    if (!panel || !hasJobOnPage(panel)) {
      removeButton();
      return;
    }

    // Clean up any buttons placed outside the active job panel or duplicate buttons
    const allButtons = document.querySelectorAll('#' + BUTTON_ID);
    for (const b of allButtons) {
      if (panel.contains(b) && b.offsetParent !== null) {
        // Keep the first correctly positioned button inside panel
        if (b === allButtons[0]) {
          return;
        }
      }
      b.remove();
    }

    const btn = createButton();
    const injected = injectIntoJob(panel, btn);
    if (!injected) {
      log('Could not find suitable injection point inside job panel — button will not be displayed');
      removeButton();
      return;
    }

    lastJobSignature = getJobSignature();
    log('Button successfully injected on job');
  }

  function removeButton() {
    const buttons = document.querySelectorAll('#' + BUTTON_ID);
    if (buttons.length > 0) {
      buttons.forEach((b) => b.remove());
      log('All instances of copy button removed');
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
