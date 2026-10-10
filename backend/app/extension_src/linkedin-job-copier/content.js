// ============================================
// LinkedIn Job Copier — Content Script
// ============================================
// Extracts job details from LinkedIn job pages
// and copies them to the clipboard.
//
// IMPORTANT: LinkedIn uses randomized/hashed CSS
// class names. This script relies on:
//   - href patterns (a[href*="/jobs/view/"])
//   - aria-labels
//   - text content matching
//   - DOM structure/relationships
// NOT on CSS class names.
// ============================================

(function () {
  'use strict';

  // ---- Constants ----
  const PREFIX = '[LinkedIn Job Copier]';
  const BUTTON_ID = 'ljc-copy-btn';
  const RESET_DELAY_MS = 2000;
  const SHOW_MORE_WAIT_MS = 600;
  const NAV_CHECK_INTERVAL_MS = 1000;

  // UI text lines to strip from descriptions
  const UI_TEXT_PATTERNS = [
    /^easy apply$/i,
    /^apply$/i,
    /^save$/i,
    /^saved$/i,
    /^share$/i,
    /^report$/i,
    /^show less$/i,
    /^show fewer.*$/i,
    /^see less$/i,
    /^see fewer.*$/i,
    /^show more$/i,
    /^see more$/i,
    /^…\s*more$/i,
    /^\.\.\.\s*more$/i,
    /^more$/i,
    /^try premium.*$/i,
    /^premium$/i,
    /^reposted$/i,
    /^promoted$/i,
    /^people also viewed$/i,
    /^similar jobs$/i,
    /^am i a good fit.*$/i,
    /^are you a good fit.*$/i,
    /^use ai to.*$/i,
    /^assess (how you|your) fit.*$/i,
    /^see how you (fit|compare|match|rank).*$/i,
    /^evaluate (your|how you) fit.*$/i,
    /^how you (match|fit).*$/i,
    /^ai assessment.*$/i,
    /^fit assessment.*$/i,
    /^job match.*$/i,
    /^match insights.*$/i,
    /^show match details.*$/i,
    /^your profile and resume match.*$/i,
    /^get (ai )?insights.*$/i,
    /^tailor your resume.*$/i,
    /^beta\s*•?\s*is this information helpful\??$/i,
    /^is this information helpful\??$/i,
    /^people you can reach out to.*$/i,
    /^meet the hiring team.*$/i,
    /^skills match.*$/i,
    /^qualification(s)? match.*$/i,
    /^set alert.*$/i,
    /^follow$/i,
    /^message$/i,
    /^connect$/i,
    /^about the company$/i,
  ];

  // ---- 1. Logger ----

  function log(...args) {
    console.log(PREFIX, ...args);
  }

  function warn(...args) {
    console.warn(PREFIX, ...args);
  }

  function logError(...args) {
    console.error(PREFIX, ...args);
  }

  // ---- 2. Job Page Detection ----

  function isJobPage() {
    const url = window.location.href;
    return /linkedin\.com\/jobs\/(view|search|collections)/.test(url);
  }

  // ---- 3. Job Detail Panel Locator ----

  /**
   * Finds the currently-selected job detail panel.
   * LinkedIn uses randomized class names, so we locate the panel
   * by finding semantic anchors (job title link, "About the job" text,
   * Apply button) and then walking up to their common container.
   */
  function getJobDetailPanel() {
    // Strategy 1: Find the scrollable container in the right pane
    // that holds the job details. Look for a container that has both
    // a job title link AND an "About the job" section.
    const jobTitleLink = document.querySelector('a[href*="/jobs/view/"]');
    const aboutTheJobEl = findElementByText('About the job');

    if (jobTitleLink && aboutTheJobEl) {
      // Walk up from the title link to find a common ancestor
      // that also contains "About the job"
      let ancestor = jobTitleLink.parentElement;
      for (let i = 0; i < 15 && ancestor; i++) {
        if (ancestor.contains(aboutTheJobEl)) {
          log('Panel found via title+about-the-job common ancestor');
          return ancestor;
        }
        ancestor = ancestor.parentElement;
      }
    }

    // Strategy 2: Find the container holding the Apply button
    const applyButton = document.querySelector(
      'a[aria-label*="Apply"], button[aria-label*="Apply"]'
    );
    if (applyButton && jobTitleLink) {
      let ancestor = applyButton.parentElement;
      for (let i = 0; i < 15 && ancestor; i++) {
        if (ancestor.contains(jobTitleLink)) {
          log('Panel found via apply-button+title common ancestor');
          return ancestor;
        }
        ancestor = ancestor.parentElement;
      }
    }

    // Strategy 3: Find a scrollable div that contains the job title link
    if (jobTitleLink) {
      let parent = jobTitleLink.parentElement;
      for (let i = 0; i < 20 && parent; i++) {
        // Look for a scrollable container or a large container
        const style = window.getComputedStyle(parent);
        const isScrollable =
          style.overflowY === 'auto' ||
          style.overflowY === 'scroll' ||
          parent.getAttribute('scrollable') === 'true';
        const isLarge = parent.scrollHeight > 500;

        if (isScrollable && isLarge) {
          log('Panel found via scrollable ancestor of title link');
          return parent;
        }
        parent = parent.parentElement;
      }
    }

    // Strategy 4: Legacy class-based selectors (fallback for older LinkedIn layouts)
    const legacySelectors = [
      '.job-view-layout',
      '.jobs-search__job-details',
      '.scaffold-layout__detail',
      '#job-details',
      '[class*="jobs-details"]',
      '[class*="job-view"]',
    ];
    for (const sel of legacySelectors) {
      try {
        const el = document.querySelector(sel);
        if (el) {
          log('Panel found via legacy selector:', sel);
          return el;
        }
      } catch (e) { /* skip */ }
    }

    // Strategy 5: Use the job title link's largest reasonable ancestor
    if (jobTitleLink) {
      let best = null;
      let parent = jobTitleLink.parentElement;
      for (let i = 0; i < 20 && parent && parent !== document.body; i++) {
        if (parent.textContent.length > 300) {
          best = parent;
        }
        // Stop if we've reached a very large container (probably the whole page)
        if (parent.textContent.length > 50000) break;
        parent = parent.parentElement;
      }
      if (best) {
        log('Panel found via title link ancestor heuristic');
        return best;
      }
    }

    warn('Could not locate job detail panel');
    return null;
  }

  // ---- 3b. Job Title Validation & AI Filter ----

  function isInsideAiContainer(el) {
    if (!el) return false;
    const aiContainer = el.closest(
      '[class*="ai-" i], [class*="fit-" i], [class*="match-" i], [class*="assessment" i], [aria-label*="fit" i], [aria-label*="ai" i], [aria-label*="match" i]'
    );
    if (aiContainer) {
      const txt = (aiContainer.textContent || '').toLowerCase();
      if (/use ai|assess.*fit|how you (fit|match)|match details|fit assessment/i.test(txt)) {
        return true;
      }
    }
    let curr = el.parentElement;
    for (let i = 0; i < 5 && curr; i++) {
      const t = (curr.textContent || '').toLowerCase();
      if (t.includes('use ai to assess') || t.includes('assess how you fit') || t.includes('see how you fit')) {
        return true;
      }
      curr = curr.parentElement;
    }
    return false;
  }

  function isInvalidJobTitle(text) {
    if (!text || typeof text !== "string") return true;
    const s = text.trim();
    if (s.length < 3 || s.length > 250) return true;
    const lower = s.toLowerCase();

    // AI assessment banners, widgets, and prompts
    if (/^(use ai to|assess how you fit|assess your fit|see how you fit|see how you compare|see how you match|see how you rank|evaluate your fit|evaluate how you fit|how you match|how you fit|am i a good fit|are you a good fit|ai assessment|fit assessment|job match|match insights|show match details|get ai insights|get tailored insights|tailor your resume|profile match|resume match|skills match|qualification(s)? match)/i.test(lower)) return true;
    if (/\b(use ai to assess|assess how you fit|assess your fit|see how you fit|see how you compare|evaluate your fit|how you match|how you fit|am i a good fit|are you a good fit|show match details|match insights)\b/i.test(lower)) return true;

    // Workplace modes are NEVER titles
    if (/^(hybrid|remote|on-site|onsite|work from home|wfh|in-office|in office|telecommute)$/i.test(lower)) return true;

    // Employment types are NEVER titles
    if (/^(full-time|part-time|contract|temporary|internship|volunteer|permanent|freelance)$/i.test(lower)) return true;

    // Seniority levels are NEVER titles
    if (/^(entry level|associate|mid-senior level|mid senior level|director|executive|internship)$/i.test(lower)) return true;

    // Common LinkedIn status, action, and badge labels
    if (/^(promoted|reposted|actively recruiting|responses within \d+ hours?|view verification|matches your job preferences|easy apply|apply|save|saved|share|report|about the company|about the job|company overview|about the role|job details|meet the hiring team|people you can reach out to|why join|why work here)$/i.test(lower)) return true;

    // Applicant counts or timestamps
    if (/^(\d+\s+applicants?|over\s+\d+\s+applicants?|be among the first\s+\d+\s+applicants?|\d+\s+(minute|hour|day|week|month|year)s?\s+ago)$/i.test(lower)) return true;

    // Benefits labels
    if (/^(benefits found in job post|medical insurance|dental insurance|vision insurance|401\(k\)|benefits)$/i.test(lower)) return true;

    if (isUIText(s)) return true;

    return false;
  }

  function extractTitleFromDocTitle() {
    if (!document || !document.title) return null;
    let t = document.title.replace(/^\(\d+\)\s*/, '').trim();
    const hiringMatch = t.match(/hiring\s+(.+?)\s+in\s+/i);
    if (hiringMatch && !isInvalidJobTitle(hiringMatch[1])) {
      return hiringMatch[1].trim();
    }
    const cleanDoc = t.replace(/\s*\|\s*LinkedIn.*$/i, '').trim();
    const parts = cleanDoc.split(/\s+[|\-–—]\s+|\s+at\s+/i);
    for (const part of parts) {
      const cand = part.trim();
      if (cand.length > 3 && !/^(LinkedIn|Jobs)$/i.test(cand) && !isInvalidJobTitle(cand)) {
        return cand;
      }
    }
    return null;
  }

  // ---- 4. Title Extraction ----

  function extractTitle(panel) {
    if (!panel) return null;

    const strategies = [
      // Strategy 1: Explicit job title selectors on LinkedIn (Targeted and authoritative)
      () => {
        const titleSelectors = [
          '.job-details-jobs-unified-top-card__job-title h1',
          '.job-details-jobs-unified-top-card__job-title h2',
          '.job-details-jobs-unified-top-card__job-title a',
          '.job-details-jobs-unified-top-card__job-title',
          '.jobs-unified-top-card__job-title h1',
          '.jobs-unified-top-card__job-title h2',
          '.jobs-unified-top-card__job-title a',
          '.jobs-unified-top-card__job-title',
          'h1[class*="job-title" i]',
          'h2[class*="job-title" i]',
          '[data-job-title]',
          'h1.topcard__title',
          '.jobs-search__job-details--container h1',
          '.jobs-search__job-details--container h2',
        ];
        for (const sel of titleSelectors) {
          const els = panel.querySelectorAll(sel);
          for (const el of els) {
            if (isInsideAiContainer(el)) continue;
            const link = el.querySelector('a');
            const text = (link ? link.textContent : el.textContent).trim();
            if (!isInvalidJobTitle(text)) {
              return text;
            }
          }
        }
        return null;
      },

      // Strategy 2: Link that points to a job view URL in the top header card
      () => {
        const links = panel.querySelectorAll('a[href*="/jobs/view/"]');
        for (const link of links) {
          if (isInsideAiContainer(link)) continue;
          const text = link.textContent.trim();
          if (!isInvalidJobTitle(text) && text.length > 3) {
            if (link.closest('h1, h2, [class*="top-card" i], [class*="header" i], [class*="title" i]')) {
              return text;
            }
          }
        }
        return null;
      },

      // Strategy 3: Targeted job-title class or data attribute across panel
      () => {
        const titleEls = panel.querySelectorAll('[data-job-title], [class*="job-title" i], .topcard__title');
        for (const el of titleEls) {
          if (isInsideAiContainer(el)) continue;
          const text = el.textContent.trim();
          if (!isInvalidJobTitle(text)) {
            return text;
          }
        }
        return null;
      },

      // Strategy 4: The job title link matching current URL job ID
      () => {
        const jobId = extractJobIdFromURL();
        if (!jobId) return null;
        const links = document.querySelectorAll(`a[href*="/jobs/view/${jobId}"]`);
        for (const link of links) {
          if (isInsideAiContainer(link)) continue;
          const text = link.textContent.trim();
          if (!isInvalidJobTitle(text)) return text;
        }
        return null;
      },

      // Strategy 5: Global top-card heading
      () => {
        const docSelectors = [
          '.jobs-unified-top-card h1',
          '.job-details-jobs-unified-top-card h1',
          '.jobs-unified-top-card h2',
          '.job-details-jobs-unified-top-card h2',
        ];
        for (const sel of docSelectors) {
          const els = document.querySelectorAll(sel);
          for (const el of els) {
            if (isInsideAiContainer(el)) continue;
            const text = el.textContent.trim();
            if (!isInvalidJobTitle(text)) return text;
          }
        }
        return null;
      },

      // Strategy 6: Generic h1 fallback in panel
      () => {
        const h1s = panel.querySelectorAll('h1.t-24, h1');
        for (const h1 of h1s) {
          if (isInsideAiContainer(h1)) continue;
          const link = h1.querySelector('a');
          const text = (link ? link.textContent : h1.textContent).trim();
          if (!isInvalidJobTitle(text)) return text;
        }
        return null;
      },

      // Strategy 7: h2, h3 inside the top card
      () => {
        const headings = panel.querySelectorAll('h2, h3');
        for (const h of headings) {
          if (isInsideAiContainer(h)) continue;
          const text = h.textContent.trim();
          if (!isInvalidJobTitle(text) && text.length > 5) {
            return text;
          }
        }
        return null;
      },

      // Strategy 8: document.title fallback
      () => {
        return extractTitleFromDocTitle();
      },
    ];

    for (let i = 0; i < strategies.length; i++) {
      try {
        const result = strategies[i]();
        if (result) {
          log(`Title extracted via strategy ${i + 1}: "${result}"`);
          return result;
        }
      } catch (e) { /* strategy failed, try next */ }
    }

    warn('All title extraction strategies failed');
    return null;
  }

  // ---- 5. Company Extraction ----

  function extractCompany(panel) {
    if (!panel) return null;

    const strategies = [
      // Strategy 1: Link to company page (most reliable on modern LinkedIn)
      () => {
        const links = panel.querySelectorAll('a[href*="/company/"]');
        for (const link of links) {
          const text = link.textContent.trim();
          if (text.length > 1 && text.length < 100 && !isUIText(text)) {
            return text;
          }
        }
        return null;
      },

      // Strategy 2: Element with aria-label mentioning company
      () => {
        const els = panel.querySelectorAll('[aria-label*="company"]');
        for (const el of els) {
          const text = el.textContent.trim();
          if (text.length > 1 && text.length < 100 && !isUIText(text)) {
            return text;
          }
        }
        return null;
      },

      // Strategy 3: Text near the job title that looks like a company name
      // On LinkedIn, the company name typically appears right after the title
      // and before the location. Find the title, then look at the next
      // text elements.
      () => {
        const titleLink = panel.querySelector('a[href*="/jobs/view/"]');
        if (!titleLink) return null;

        // Walk up to the title's container, then look for the next sibling
        // or child elements
        let container = titleLink.parentElement;
        for (let i = 0; i < 5 && container; i++) {
          const companyLink = container.querySelector('a[href*="/company/"]');
          if (companyLink) {
            const text = companyLink.textContent.trim();
            if (text.length > 1) return text;
          }
          container = container.parentElement;
        }
        return null;
      },

      // Strategy 4: Global fallback
      () => {
        const link = document.querySelector('a[href*="/company/"]');
        if (link) {
          const text = link.textContent.trim();
          if (text.length > 1 && !isUIText(text)) return text;
        }
        return null;
      },
    ];

    for (let i = 0; i < strategies.length; i++) {
      try {
        const result = strategies[i]();
        if (result) {
          log(`Company extracted via strategy ${i + 1}: "${result}"`);
          return result;
        }
      } catch (e) { /* strategy failed */ }
    }

    warn('All company extraction strategies failed');
    return null;
  }

  // ---- 6. Location Extraction ----

  function extractLocation(panel, currentTitle) {
    if (!panel) return null;

    const strategies = [
      // Strategy 1: Targeted LinkedIn location selectors in top card
      () => {
        const targetSelectors = [
          '.job-details-jobs-unified-top-card__primary-description-container span',
          '.jobs-unified-top-card__subtitle-primary-grouping span',
          '.job-details-jobs-unified-top-card__bullet',
          '.jobs-unified-top-card__bullet',
          '.topcard__flavor--bullet',
          '.sub-nav-cta__meta-text',
          '.top-card-layout__first-subline .topcard__flavor:not(.topcard__flavor--link)',
          '.topcard__flavor:not(.topcard__flavor--link)',
          '.jobs-unified-top-card__subtitle-secondary-grouping span',
          '[class*="primary-description" i] span',
        ];
        for (const sel of targetSelectors) {
          const els = panel.querySelectorAll(sel);
          for (const el of els) {
            const text = el.textContent.trim();
            if (looksLikeLocation(text, currentTitle)) {
              return text;
            }
          }
        }
        return null;
      },

      // Strategy 2: Near company link within the primary metadata line
      () => {
        const companyLink = panel.querySelector('a[href*="/company/"]');
        if (!companyLink) return null;

        const lineContainer = companyLink.closest(
          '.job-details-jobs-unified-top-card__primary-description-container, .jobs-unified-top-card__subtitle-primary-grouping, .top-card-layout__first-subline, div, p'
        );
        if (lineContainer) {
          const items = lineContainer.querySelectorAll('span, a');
          for (const item of items) {
            if (item.contains(companyLink) || companyLink.contains(item)) continue;
            const text = item.textContent.trim();
            if (looksLikeLocation(text, currentTitle)) {
              return text;
            }
          }
        }
        return null;
      },

      // Strategy 3: Check for elements with location-related aria-labels
      () => {
        const els = panel.querySelectorAll(
          '[aria-label*="location" i]'
        );
        for (const el of els) {
          const text = el.textContent.trim();
          if (looksLikeLocation(text, currentTitle)) return text;
        }
        return null;
      },

      // Strategy 4: Leaf text elements in top-card header
      () => {
        const topCard = panel.querySelector('.jobs-unified-top-card, .job-details-jobs-unified-top-card') || panel;
        const allSpans = topCard.querySelectorAll('span');
        for (const span of allSpans) {
          if (isInDescriptionArea(span)) continue;
          if (span.closest('h1, h2')) continue; // Never pick from title headings!
          const text = span.textContent.trim();
          if (looksLikeLocation(text, currentTitle)) {
            return text;
          }
        }
        return null;
      },
    ];

    for (let i = 0; i < strategies.length; i++) {
      try {
        const result = strategies[i]();
        if (result) {
          log(`Location extracted via strategy ${i + 1}: "${result}"`);
          return result;
        }
      } catch (e) { /* strategy failed */ }
    }

    warn('All location extraction strategies failed');
    return null;
  }

  // ---- 6b. Job Type & Workplace Extraction ----

  function normalizeJobType(raw) {
    if (!raw || typeof raw !== 'string') return '';
    const s = raw.trim();
    const lower = s.toLowerCase();

    // Check workplace mode first (Hybrid / Remote / On-site)
    if (lower.includes('hybrid')) return 'Hybrid';
    if (lower.includes('remote') || lower.includes('telecommute') || lower.includes('work from home') || lower.includes('wfh')) return 'Remote';
    if (lower.includes('on-site') || lower.includes('onsite') || lower.includes('in-office') || lower.includes('in office') || lower.includes('work from office') || lower.includes('in-person') || lower.includes('in person')) return 'On-site';

    // Check employment type
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
      const match = loc.match(/\b(hybrid|remote|on-site|onsite|work from office|in-office|wfh)\b/i);
      if (match) {
        jobType = normalizeJobType(match[1]);
      }
    }

    // Strip workplace markers from location string
    loc = loc
      .replace(/[\s·•\-]+\b(hybrid|remote|on-site|onsite|work from office|in-office|wfh)\b.*$/i, '')
      .replace(/^[\s·•\-]*\b(hybrid|remote|on-site|onsite|work from office|in-office|wfh)\b[\s·•\:\-]+/i, '')
      .replace(/\((?:hybrid|remote|on-site|onsite|work from office|in-office|wfh)\)/gi, '')
      .replace(/\[(?:hybrid|remote|on-site|onsite|work from office|in-office|wfh)\]/gi, '')
      .replace(/^[·•,\-\s]+|[·•,\-\s]+$/g, '')
      .trim();

    return { location: loc, jobType: normalizeJobType(jobType) };
  }

  function extractJobType(panel, locationText) {
    if (!panel) return '';

    // Strategy 1: Check workplace-type and job-insight badges on modern LinkedIn
    const insightSelectors = [
      '.job-details-jobs-unified-top-card__job-insight',
      '.jobs-unified-top-card__job-insight',
      'li.job-details-jobs-unified-top-card__job-insight',
      'li.jobs-unified-top-card__job-insight',
      '[class*="workplace-type" i]',
      '[class*="job-insight" i]',
      'span[class*="workplace" i]',
    ];

    for (const sel of insightSelectors) {
      try {
        const els = panel.querySelectorAll(sel);
        for (const el of els) {
          const txt = (el.textContent || '').trim();
          if (/\b(hybrid|remote|on-site|onsite)\b/i.test(txt)) {
            const m = txt.match(/\b(hybrid|remote|on-site|onsite)\b/i);
            if (m) return normalizeJobType(m[1]);
          }
          if (/\b(full-time|part-time|contract|internship)\b/i.test(txt)) {
            const m = txt.match(/\b(full-time|part-time|contract|internship)\b/i);
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

    // Strategy 3: Check location text for workplace indicators
    if (locationText) {
      const m = locationText.match(/\b(hybrid|remote|on-site|onsite)\b/i);
      if (m) return normalizeJobType(m[1]);
    }

    // Strategy 4: Top card text scan for explicit workplace pill
    const topCard = panel.querySelector('.jobs-unified-top-card, .job-details-jobs-unified-top-card') || panel;
    const topText = (topCard.textContent || '').slice(0, 800);
    const topMatch = topText.match(/\b(hybrid|remote|on-site|onsite)\b/i);
    if (topMatch) return normalizeJobType(topMatch[1]);

    const empMatch = topText.match(/\b(full-time|part-time|contract|internship)\b/i);
    if (empMatch) return normalizeJobType(empMatch[1]);

    return '';
  }

  // ---- 7. Show More Expansion ----

  /**
   * Expands "Show more" / "See more" / "…more" sections
   * before extracting the description.
   */
  async function expandShowMore(panel) {
    if (!panel) return;

    let clicked = false;

    // Scope search strictly to the description area / "About the job"
    const aboutEl = findElementByText('About the job', panel);
    const scope = aboutEl
      ? (aboutEl.parentElement?.parentElement || aboutEl.parentElement || panel)
      : panel;

    // Strategy 1: Find clickable elements with "show more" / "see more" text strictly in description
    const clickables = scope.querySelectorAll(
      'button, a, [role="button"], span[tabindex]'
    );

    for (const el of clickables) {
      const text = (el.textContent || '').trim().toLowerCase();
      const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();

      // Explicitly ignore Apply, Save, Share, Follow, or More Actions buttons
      if (
        ariaLabel.includes('apply') ||
        ariaLabel.includes('save') ||
        ariaLabel.includes('more actions') ||
        ariaLabel.includes('action') ||
        ariaLabel.includes('share') ||
        ariaLabel.includes('follow') ||
        text.includes('apply') ||
        text.includes('save')
      ) {
        continue;
      }

      const isShowMore =
        text === 'show more' ||
        text === 'see more' ||
        text === '…more' ||
        text === '... more' ||
        ariaLabel.includes('show more') ||
        ariaLabel.includes('see more') ||
        ariaLabel.includes('click to see more description');

      if (isShowMore) {
        // Avoid clicking "show more jobs/results"
        const parentText = (el.parentElement?.textContent || '').toLowerCase();
        if (
          parentText.includes('show more jobs') ||
          parentText.includes('show more results') ||
          parentText.includes('load more')
        ) {
          continue;
        }

        log('Clicking expand button:', el.textContent.trim());
        el.click();
        clicked = true;
      }
    }

    // Strategy 2: aria-expanded="false" buttons in description context only
    const collapsedBtns = scope.querySelectorAll(
      'button[aria-expanded="false"]'
    );
    for (const btn of collapsedBtns) {
      const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
      if (ariaLabel.includes('apply') || ariaLabel.includes('save') || ariaLabel.includes('more action')) {
        continue;
      }
      log('Clicking collapsed aria-expanded button in description');
      btn.click();
      clicked = true;
    }

    if (clicked) {
      await sleep(SHOW_MORE_WAIT_MS);
      log('Waited for content expansion');
    }
  }

  // ---- 8. Description Extraction ----

  function extractDescription(panel) {
    if (!panel) return null;

    const strategies = [
      // Strategy 1: Find the "About the job" section and extract
      // everything after it. This is the most reliable approach on
      // modern LinkedIn since it doesn't depend on CSS classes.
      () => {
        const aboutEl = findElementByText('About the job', panel);
        if (!aboutEl) return null;

        // The description is in the element's next sibling(s) or
        // in the parent container after the "About the job" heading
        let descContainer = aboutEl.parentElement;

        // Walk up if needed to find a container that has substantial text
        for (let i = 0; i < 5 && descContainer; i++) {
          const textAfter = getTextAfterElement(descContainer, aboutEl);
          if (textAfter && textAfter.length > 50) {
            return cleanText(textAfter);
          }
          descContainer = descContainer.parentElement;
        }

        // Alternative: get all text content after "About the job" in DOM order
        const descText = extractTextAfterMarker(panel, aboutEl);
        if (descText && descText.length > 50) {
          return cleanText(descText);
        }

        return null;
      },

      // Strategy 2: Find the largest text block that comes after
      // the job title and company info
      () => {
        const titleLink = panel.querySelector('a[href*="/jobs/view/"]');
        if (!titleLink) return null;

        // Find all substantial text blocks in the panel
        const textBlocks = [];
        const divs = panel.querySelectorAll('div, section, article');
        for (const div of divs) {
          const text = div.textContent.trim();
          if (
            text.length > 200 &&
            text.length < panel.textContent.length * 0.9 &&
            !div.contains(titleLink)
          ) {
            textBlocks.push({ el: div, text, length: text.length });
          }
        }

        // Sort by length, get the largest that's not the whole panel
        textBlocks.sort((a, b) => b.length - a.length);

        for (const block of textBlocks) {
          // Validate it looks like a job description
          if (
            block.text.includes('\n') ||
            block.text.includes('•') ||
            block.text.includes('experience') ||
            block.text.includes('requirements') ||
            block.text.includes('responsibilities')
          ) {
            return cleanText(block.text);
          }
        }
        return null;
      },

      // Strategy 3: Legacy class-based selectors
      () => {
        const selectors = [
          '.show-more-less-html__markup',
          '#job-details',
          '[class*="jobs-description-content"]',
          '[class*="description__text"]',
          '[class*="jobs-box__html-content"]',
        ];
        for (const sel of selectors) {
          try {
            const el =
              panel.querySelector(sel) || document.querySelector(sel);
            if (el && el.textContent.trim().length > 50) {
              return cleanDescription(el);
            }
          } catch (e) { /* skip */ }
        }
        return null;
      },

      // Strategy 4: DOM-based extraction — find the description container
      // by looking for the element that contains structured text
      // (paragraphs, lists, bold text)
      () => {
        const richTextContainers = panel.querySelectorAll('div, section');
        for (const container of richTextContainers) {
          // Look for containers that have rich content (lists, paragraphs)
          const hasList = container.querySelector('ul, ol');
          const hasParagraphs = container.querySelectorAll('p').length > 1;
          const hasStrong = container.querySelector('strong, b');

          if ((hasList || hasParagraphs) && hasStrong) {
            const text = container.textContent.trim();
            if (text.length > 200 && text.length < 15000) {
              return cleanDescription(container);
            }
          }
        }
        return null;
      },
    ];

    for (let i = 0; i < strategies.length; i++) {
      try {
        const result = strategies[i]();
        if (result && result.length > 50) {
          log(
            `Description extracted via strategy ${i + 1}, length: ${result.length}`
          );
          return result;
        }
      } catch (e) { /* strategy failed */ }
    }

    warn('All description extraction strategies failed');
    return null;
  }

  // ---- 9. URL Extraction ----

  function extractURL() {
    let url = window.location.href;

    // Clean tracking parameters
    try {
      const parsed = new URL(url);
      if (parsed.pathname.includes('/jobs/view/')) {
        url = parsed.origin + parsed.pathname;
      } else if (parsed.searchParams.has('currentJobId')) {
        // Search results page — construct the direct job URL
        const jobId = parsed.searchParams.get('currentJobId');
        url = `${parsed.origin}/jobs/view/${jobId}/`;
      }
    } catch (e) {
      // URL parsing failed, use as-is
    }

    // Fallback: canonical link
    if (!url || !url.includes('linkedin.com')) {
      const canonical = document.querySelector('link[rel="canonical"]');
      if (canonical) {
        url = canonical.getAttribute('href');
      }
    }

    log('URL extracted:', url);
    return url;
  }

  // ---- 10. Validation ----

  function validateJobDetails(details) {
    const errors = [];

    if (!details.title || details.title.trim().length < 3) {
      errors.push('Job title is empty or too short');
    }

    if (!details.company || details.company.trim().length < 2) {
      errors.push('Company name is empty or too short');
    }

    if (!details.description || details.description.trim().length < 50) {
      errors.push(
        `Description is too short (${
          details.description ? details.description.trim().length : 0
        } chars)`
      );
    }

    if (!details.url || !details.url.includes('linkedin.com')) {
      errors.push('URL does not look like a LinkedIn URL');
    }

    if (!details.location) {
      warn('Location not found — will proceed without it');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // ---- 11. Clipboard Formatting ----

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

  // ---- 12. Clipboard Copy ----

  async function copyToClipboard(text) {
    // Primary: modern Clipboard API
    try {
      await navigator.clipboard.writeText(text);
      log('Copy successful via Clipboard API');
      return true;
    } catch (e) {
      warn('Clipboard API failed, trying fallback:', e.message);
    }

    // Fallback: execCommand
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);

      if (success) {
        log('Copy successful via execCommand fallback');
        return true;
      }
    } catch (e) {
      logError('execCommand fallback also failed:', e.message);
    }

    return false;
  }

  // ---- 13. Button Injection ----

  function injectButton() {
    if (!isJobPage()) {
      removeButton();
      return;
    }

    const panel = getJobDetailPanel();
    if (!panel) {
      removeButton();
      return;
    }

    // Clean up any button not inside the active panel or duplicates
    const existing = document.getElementById(BUTTON_ID);
    if (existing) {
      if (panel.contains(existing)) {
        return;
      }
      existing.remove();
    }

    const button = createButton();
    const injected = injectIntoActionBar(button, panel);

    if (!injected) {
      log('Appropriate place inside job action bar not found; button not displayed (no floating fallback)');
      removeButton();
      return;
    }

    log('Button injected at appropriate place');
  }

  function createButton() {
    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.setAttribute('data-state', 'ready');
    button.innerHTML = getCopyIcon() + ' <span>Copy Job Details</span>';
    button.addEventListener('click', handleCopyClick);
    return button;
  }

  function getCopyIcon() {
    return `<span class="ljc-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg></span>`;
  }

  function injectIntoActionBar(button, panel) {
    const scope = panel || document;
    const applyBtn = scope.querySelector(
      'a[aria-label*="Apply"], button[aria-label*="Apply"], [data-easy-apply-button]'
    );
    const saveBtn = scope.querySelector(
      'button[aria-label*="Save"], button[aria-label*="Unsave"]'
    );

    // Prevent injecting inside left-hand search results list
    if (applyBtn && applyBtn.closest('.jobs-search-results-list, .jobs-search-two-pane__wrapper > div:first-child')) {
      return false;
    }

    // Strategy 1: Find the common parent row/container of Apply and Save buttons inside panel
    if (applyBtn && saveBtn) {
      let curr = applyBtn.parentElement;
      while (curr && curr !== document.body && curr !== panel) {
        if (curr.contains(saveBtn)) {
          // Found the action buttons container row
          // Append as a dedicated sibling element at the end of the row
          curr.appendChild(button);
          log('Button appended to action bar row (after Save)');
          return true;
        }
        curr = curr.parentElement;
      }
    }

    // Strategy 2: If only Save or Apply is found, find the button's outermost wrapper
    const anchorBtn = saveBtn || applyBtn;
    if (anchorBtn && (panel ? panel.contains(anchorBtn) : true)) {
      let buttonWrapper = anchorBtn;
      // Walk up until we find a multi-child container or reach 3 levels
      for (let i = 0; i < 3; i++) {
        if (buttonWrapper.parentElement && buttonWrapper.parentElement.children.length > 1) {
          buttonWrapper.insertAdjacentElement('afterend', button);
          log('Button injected as sibling next to button wrapper');
          return true;
        }
        if (buttonWrapper.parentElement) {
          buttonWrapper = buttonWrapper.parentElement;
        }
      }

      if (anchorBtn.parentElement) {
        anchorBtn.parentElement.insertAdjacentElement('afterend', button);
        log('Button injected after anchor button parent');
        return true;
      }
    }

    // Strategy 3: Legacy class-based selectors within scope
    const legacySelectors = [
      '.jobs-unified-top-card__actions',
      '[class*="top-card__actions"]',
      '.jobs-apply-button--top-card',
    ];
    for (const sel of legacySelectors) {
      try {
        const container = scope.querySelector(sel);
        if (container) {
          container.appendChild(button);
          log('Button injected via legacy selector:', sel);
          return true;
        }
      } catch (e) { /* skip */ }
    }
    
    // Strategy 4: Fallback to the top card container if action buttons are missing (e.g. already applied)
    const fallbackSelectors = [
      '.job-details-jobs-unified-top-card__content--two-pane',
      '.jobs-unified-top-card__content--two-pane'
    ];
    
    for (const sel of fallbackSelectors) {
      try {
        const container = scope.querySelector(sel);
        if (container) {
          const wrapper = document.createElement('div');
          wrapper.style.display = 'flex';
          wrapper.style.flexWrap = 'wrap';
          wrapper.style.gap = '8px';
          wrapper.style.marginTop = '16px';
          wrapper.style.marginBottom = '8px';
          wrapper.appendChild(button);
          container.appendChild(wrapper);
          log('Button injected into top card fallback:', sel);
          return true;
        }
      } catch (e) { /* skip */ }
    }

    return false;
  }

  function removeButton() {
    const existing = document.getElementById(BUTTON_ID);
    if (existing) {
      existing.remove();
      log('Button removed');
    }
  }

  // ---- 14. Button State Management ----

  function setButtonState(state) {
    const button = document.getElementById(BUTTON_ID);
    if (!button) return;

    button.setAttribute('data-state', state);

    switch (state) {
      case 'ready':
        button.innerHTML = getCopyIcon() + ' <span>Copy Job Details</span>';
        break;
      case 'extracting':
        button.innerHTML = getCopyIcon() + ' <span>Extracting...</span>';
        break;
      case 'success':
        button.innerHTML = getCheckIcon() + ' <span>Copied!</span>';
        break;
      case 'error':
        button.innerHTML = getErrorIcon() + ' <span>Extraction Failed</span>';
        break;
    }
  }

  function getCheckIcon() {
    return `<span class="ljc-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg></span>`;
  }

  function getErrorIcon() {
    return `<span class="ljc-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg></span>`;
  }

  // ---- 15. Click Handler ----

  async function handleCopyClick(event) {
    event.preventDefault();
    event.stopPropagation();

    log('Copy button clicked');
    setButtonState('extracting');

    try {
      // Step 1: Find the job detail panel
      const panel = getJobDetailPanel();
      if (!panel) {
        throw new Error('Could not find job detail panel');
      }

      // Step 2: Expand all "Show more" sections
      await expandShowMore(panel);

      // Step 3: Extract all job details
      let rawTitle = extractTitle(panel);
      const rawCompany = extractCompany(panel);
      let rawLocation = extractLocation(panel, rawTitle);
      const rawJobType = extractJobType(panel, rawLocation);
      const locAndType = cleanLocationAndExtractJobType(rawLocation, rawJobType);

      // SANITY VALIDATION & CROSS-CORRECTION:
      if (!rawTitle || isInvalidJobTitle(rawTitle)) {
        warn(`Extracted title "${rawTitle}" is invalid. Running fallback title extraction...`);
        if (rawLocation && !isInvalidJobTitle(rawLocation) && /\b(developer|engineer|manager|architect|lead|analyst|designer|specialist|consultant|programmer|scientist|officer|associate|director)\b/i.test(rawLocation)) {
          rawTitle = rawLocation;
          rawLocation = "";
          locAndType.location = extractLocation(panel, rawTitle) || "";
        } else {
          rawTitle = extractTitleFromDocTitle();
          if (!rawTitle || isInvalidJobTitle(rawTitle)) {
            const headings = panel.querySelectorAll("h1, h2, h3, a[href*='/jobs/view/']");
            for (const h of headings) {
              if (isInsideAiContainer(h)) continue;
              const cand = (h.querySelector('a') ? h.querySelector('a').textContent : h.textContent).trim();
              if (cand && !isInvalidJobTitle(cand)) {
                rawTitle = cand;
                break;
              }
            }
          }
        }
      }

      // If location was erroneously assigned to the job title or tech stack
      if (locAndType.location && /\b(developer|engineer|manager|architect|lead|analyst|designer|specialist|consultant|programmer|scientist|python|react|fastapi)\b/i.test(locAndType.location)) {
        if (!rawTitle || isInvalidJobTitle(rawTitle)) {
          rawTitle = locAndType.location;
        }
        locAndType.location = extractLocation(panel, rawTitle) || "";
      }

      const details = {
        title: rawTitle,
        company: rawCompany,
        location: locAndType.location,
        jobType: locAndType.jobType,
        description: extractDescription(panel),
        url: extractURL(),
      };

      log('Extracted details:', {
        title: details.title,
        company: details.company,
        location: details.location,
        jobType: details.jobType,
        descriptionLength: details.description
          ? details.description.length
          : 0,
        url: details.url,
      });

      // Step 4: Validate
      const validation = validateJobDetails(details);
      if (!validation.valid) {
        logError('Validation failed:', validation.errors);
        throw new Error(
          'Could not extract job details: ' + validation.errors.join(', ')
        );
      }

      // Step 5: Format for clipboard
      const formatted = formatForClipboard(details);

      // Step 6: Copy to clipboard
      const copied = await copyToClipboard(formatted);
      if (!copied) {
        throw new Error('Clipboard write failed');
      }

      // Success!
      log('Copy successful!');
      setButtonState('success');
    } catch (err) {
      logError('Extraction/copy failed:', err.message);
      setButtonState('error');
    }

    // Reset button after delay
    setTimeout(() => {
      setButtonState('ready');
    }, RESET_DELAY_MS);
  }

  // ---- 16. SPA Navigation Detection ----

  function setupNavigationDetection() {
    let lastURL = window.location.href;

    // Method 1: URL polling & panel watchdog
    setInterval(() => {
      const currentURL = window.location.href;
      if (currentURL !== lastURL) {
        log('URL changed:', lastURL, '→', currentURL);
        lastURL = currentURL;
        onNavigationChange();
        return;
      }

      if (isJobPage()) {
        const panel = getJobDetailPanel();
        const btn = document.getElementById(BUTTON_ID);
        if (panel) {
          if (!btn || !panel.contains(btn)) {
            injectButton();
          }
        } else if (btn) {
          removeButton();
        }
      } else {
        removeButton();
      }
    }, NAV_CHECK_INTERVAL_MS);

    // Method 2: History API interception
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      originalPushState.apply(this, args);
      log('pushState detected');
      setTimeout(onNavigationChange, 300);
    };

    history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      log('replaceState detected');
      setTimeout(onNavigationChange, 300);
    };

    window.addEventListener('popstate', () => {
      log('popstate detected');
      setTimeout(onNavigationChange, 300);
    });

    // Method 3: MutationObserver — watch for job content changes
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const el = /** @type {Element} */ (node);
              // Check if a job-relevant element was added
              const hasJobLink = el.querySelector?.('a[href*="/jobs/view/"]');
              const hasAboutJob =
                el.textContent?.includes('About the job');

              if (hasJobLink || hasAboutJob) {
                log('Job content change detected via MutationObserver');
                setTimeout(onNavigationChange, 300);
                return;
              }
            }
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    log('Navigation detection setup complete');
  }

  function onNavigationChange() {
    removeButton();
    setTimeout(() => {
      if (isJobPage()) {
        injectButton();
      }
    }, 500);
  }

  // ---- 17. Initialization ----

  function init() {
    log('Initializing...');

    if (isJobPage()) {
      log('Job page detected, injecting button');
      setTimeout(() => {
        injectButton();
      }, 1000);
    } else {
      log('Not a job page, will watch for navigation');
    }

    setupNavigationDetection();
    log('Initialization complete');
  }

  // ---- Helper Functions ----

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function extractJobIdFromURL() {
    // Try /jobs/view/ID pattern
    let match = window.location.href.match(/\/jobs\/view\/(\d+)/);
    if (match) return match[1];

    // Try currentJobId query param
    try {
      const params = new URLSearchParams(window.location.search);
      const jobId = params.get('currentJobId');
      if (jobId) return jobId;
    } catch (e) { /* skip */ }

    return null;
  }

  function isUIText(text) {
    const normalized = text.trim();
    return UI_TEXT_PATTERNS.some((pattern) => pattern.test(normalized));
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

    // Location CANNOT be a job title or technical stack description
    if (/\b(developer|engineer|manager|architect|lead|analyst|designer|specialist|consultant|programmer|scientist|intern|executive|director|technician|officer|associate|python|react|fastapi|java|javascript|golang|c\+\+|node\.js|angular|vue|aws|azure|devops|full stack|frontend|backend)\b/i.test(lower)) {
      return true;
    }

    // Workplace modes alone are not locations
    if (/^(hybrid|remote|on-site|onsite|wfh|in-office)$/i.test(lower)) return true;

    // Common UI noise
    if (/^(reposted|promoted|actively recruiting|easy apply|apply|save|saved|share|report|over \d+ applicants|\d+ applicants|\d+ (day|week|month|hour)s? ago)$/i.test(lower)) return true;

    if (isUIText(s)) return true;

    return false;
  }

  function looksLikeLocation(text, currentTitle) {
    if (isInvalidLocation(text, currentTitle)) return false;
    const lower = text.toLowerCase().trim();

    // Known geographic indicators
    const geoKeywords = /\b(india|usa|united states|uk|united kingdom|uae|united arab emirates|saudi arabia|oman|muscat|dubai|abu dhabi|qatar|kuwait|canada|australia|germany|france|singapore|bangalore|bengaluru|mumbai|delhi|pune|hyderabad|chennai|kolkata|noida|gurgaon|gurugram|ahmedabad|london|toronto|sydney|berlin|paris|tokyo|new york|san francisco|chicago|seattle|austin|boston)\b/i;
    if (geoKeywords.test(lower)) return true;

    // "Greater ... Area" format
    if (/greater\s+[a-z\s.-]+\s+area/i.test(lower)) return true;

    // Standard "City, State/Country" pattern: alphabetic and standard punctuation only
    if (/^[a-z\s.-]+,\s*[a-z\s.-]+(,\s*[a-z\s.-]+)?(\s*\([a-z\s-]+\))?$/i.test(lower)) return true;

    // Location containing workplace tag (e.g. "Pune, Maharashtra, India (Hybrid)")
    if (/\b(hybrid|remote|on-site|onsite)\b/i.test(lower) && lower.length > 8) return true;

    return false;
  }

  /**
   * Find an element by its visible text content.
   * Returns the most specific (deepest) element that contains the text.
   */
  function findElementByText(searchText, scope) {
    scope = scope || document;
    const walker = document.createTreeWalker(
      scope,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          if (node.textContent.trim() === searchText) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        },
      }
    );

    const textNode = walker.nextNode();
    return textNode ? textNode.parentElement : null;
  }

  /**
   * Checks if an element is inside the job description area.
   */
  function isInDescriptionArea(el) {
    let parent = el;
    for (let i = 0; i < 10 && parent; i++) {
      if (parent.textContent?.includes('About the job')) {
        // Check if this is the description container
        // (contains "About the job" and has substantial text)
        if (parent.textContent.length > 200) {
          return true;
        }
      }
      parent = parent.parentElement;
    }
    return false;
  }

  /**
   * Extract text content that appears after a marker element in DOM order.
   */
  function extractTextAfterMarker(container, markerEl) {
    if (!container || !markerEl) return null;

    let foundMarker = false;
    let descriptionParts = [];

    // Walk the DOM tree in order
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null
    );

    let node;
    while ((node = walker.nextNode())) {
      if (!foundMarker) {
        if (node.parentElement === markerEl || markerEl.contains(node)) {
          foundMarker = true;
        }
        continue;
      }

      const text = node.textContent.trim();
      if (text) {
        // Stop if we hit known end markers
        if (
          text === 'About the company' ||
          text === 'People also viewed' ||
          text === 'Similar jobs' ||
          text === 'Show less'
        ) {
          break;
        }
        if (!isUIText(text)) {
          descriptionParts.push(text);
        }
      }
    }

    return descriptionParts.join('\n');
  }

  /**
   * Get text content that appears after a specific child element
   * within a container.
   */
  function getTextAfterElement(container, afterEl) {
    if (!container || !afterEl) return null;

    const children = Array.from(container.childNodes);
    let foundAfter = false;
    let textParts = [];

    for (const child of children) {
      if (child === afterEl || child.contains?.(afterEl) || afterEl.contains?.(child)) {
        foundAfter = true;
        continue;
      }
      if (foundAfter) {
        const text = (child.nodeType === Node.ELEMENT_NODE ? domToText(child) : child.textContent || '').trim();
        if (text) {
          textParts.push(text);
        }
      }
    }

    return textParts.join('\n\n');
  }

  /**
   * Cleans raw text: collapses whitespace, preserves paragraphs and bullets.
   */
  function cleanText(text) {
    if (!text) return null;

    // Strip trailing "... more" or "… more"
    text = text.replace(/\s*(?:…|\.\.\.)\s*more\s*$/i, '').trim();

    // Split into lines
    let lines = text.split('\n');

    // Filter out UI text lines
    lines = lines.filter((line) => {
      const trimmed = line.trim();
      if (trimmed === '') return true;
      return !isUIText(trimmed);
    });

    // Rejoin
    text = lines.join('\n');

    // Collapse multiple blank lines
    text = text.replace(/\n{3,}/g, '\n\n');

    // Clean up excessive horizontal spaces
    text = text.replace(/[ \t]{2,}/g, ' ');

    return text.trim();
  }

  /**
   * Cleans a DOM element's text for use as a job description.
   * Preserves structure from the DOM (paragraphs, bullet points).
   */
  function cleanDescription(element) {
    if (!element) return null;

    const clone = element.cloneNode(true);

    // Remove UI elements from the clone
    const uiElements = clone.querySelectorAll(
      'button, nav, [role="navigation"], footer, ' +
      '[class*="share"], [class*="report"]'
    );
    uiElements.forEach((el) => el.remove());

    // Convert DOM to text preserving structure
    let text = domToText(clone);

    // Clean the text
    return cleanText(text);
  }

  /**
   * Converts a DOM tree to text, preserving paragraphs and list items.
   */
  function domToText(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const el = /** @type {Element} */ (node);
    const tag = el.tagName.toLowerCase();

    // Skip hidden elements
    try {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') {
        return '';
      }
    } catch (e) { /* skip visibility check if it fails */ }

    const blockTags = [
      'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'section', 'article', 'header', 'footer',
      'blockquote', 'pre', 'table', 'tr',
    ];

    if (tag === 'li') {
      const childText = Array.from(el.childNodes)
        .map((child) => domToText(child))
        .join('');
      return '\n• ' + childText.trim();
    }

    if (tag === 'br') {
      return '\n';
    }

    const childText = Array.from(el.childNodes)
      .map((child) => domToText(child))
      .join('');

    if (blockTags.includes(tag)) {
      return '\n' + childText.trim() + '\n';
    }

    return childText;
  }

  // ---- Start ----
  init();
})();
