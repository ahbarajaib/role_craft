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

  // ---- 4. Title Extraction ----

  function extractTitle(panel) {
    if (!panel) return null;

    const strategies = [
      // Strategy 1: Link that points to a job view URL (most reliable)
      () => {
        const links = panel.querySelectorAll('a[href*="/jobs/view/"]');
        for (const link of links) {
          const text = link.textContent.trim();
          // Job titles are usually substantial text in an anchor
          if (text.length > 3 && text.length < 200 && !isUIText(text)) {
            return text;
          }
        }
        return null;
      },

      // Strategy 2: h1 inside the panel
      () => {
        const h1 = panel.querySelector('h1');
        if (h1) {
          const text = h1.textContent.trim();
          if (text.length > 2 && !isUIText(text)) return text;
        }
        return null;
      },

      // Strategy 3: h2 heading inside the panel
      () => {
        const headings = panel.querySelectorAll('h2, h3');
        for (const h of headings) {
          const text = h.textContent.trim();
          if (text.length > 3 && text.length < 200 && !isUIText(text)) {
            return text;
          }
        }
        return null;
      },

      // Strategy 4: The job title link matching current URL's job ID
      () => {
        const jobId = extractJobIdFromURL();
        if (!jobId) return null;
        const link = document.querySelector(`a[href*="/jobs/view/${jobId}"]`);
        if (link) {
          const text = link.textContent.trim();
          if (text.length > 3) return text;
        }
        return null;
      },

      // Strategy 5: Global h1 (direct job URL pages)
      () => {
        const h1 = document.querySelector('h1');
        if (h1) {
          const text = h1.textContent.trim();
          if (text.length > 2 && !isUIText(text)) return text;
        }
        return null;
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

  function extractLocation(panel) {
    if (!panel) return null;

    const strategies = [
      // Strategy 1: Look for location text near the company link.
      // On LinkedIn's current layout, the pattern is:
      //   Title (link) → Company (link) → Location (text) → Workplace type
      // The location is typically a text node near the company link
      // that contains a comma (City, State, Country).
      () => {
        const companyLink = panel.querySelector('a[href*="/company/"]');
        if (!companyLink) return null;

        // Walk up a few levels and scan all text-bearing elements
        let container = companyLink.parentElement;
        for (let i = 0; i < 5 && container; i++) {
          container = container.parentElement;
        }
        if (!container) return null;

        // Get all leaf text elements
        const walker = document.createTreeWalker(
          container,
          NodeFilter.SHOW_ELEMENT,
          {
            acceptNode: (node) => {
              // Only consider elements with direct text (not containers)
              if (node.children.length > 3) return NodeFilter.FILTER_SKIP;
              const text = node.textContent.trim();
              if (text.length > 3 && text.length < 100 && looksLikeLocation(text)) {
                return NodeFilter.FILTER_ACCEPT;
              }
              return NodeFilter.FILTER_SKIP;
            },
          }
        );

        let node;
        while ((node = walker.nextNode())) {
          const text = node.textContent.trim();
          if (looksLikeLocation(text) && !isUIText(text)) {
            return text;
          }
        }
        return null;
      },

      // Strategy 2: Scan the top portion of the panel for location-like text
      () => {
        // The job header section is usually in the first ~30% of the panel
        const allElements = panel.querySelectorAll('span, div, li, p');
        for (const el of allElements) {
          // Skip description area
          if (isInDescriptionArea(el)) continue;

          const text = el.textContent.trim();
          if (
            text.length > 3 &&
            text.length < 100 &&
            looksLikeLocation(text) &&
            !isUIText(text) &&
            el.children.length < 3
          ) {
            // Verify this isn't a large container (should be a leaf-ish element)
            const parentText = el.parentElement?.textContent?.trim() || '';
            if (text.length > parentText.length * 0.3) {
              return text;
            }
          }
        }
        return null;
      },

      // Strategy 3: Check for elements with location-related aria-labels
      () => {
        const els = panel.querySelectorAll(
          '[aria-label*="location"], [aria-label*="Location"]'
        );
        for (const el of els) {
          const text = el.textContent.trim();
          if (text.length > 2 && text.length < 100) return text;
        }
        return null;
      },

      // Strategy 4: Text between company and "About the job" section
      () => {
        const companyLink = panel.querySelector('a[href*="/company/"]');
        const aboutEl = findElementByText('About the job', panel);
        if (!companyLink || !aboutEl) return null;

        // Get the text content between company and About section
        // by scanning elements in document order
        const allEls = panel.querySelectorAll('*');
        let afterCompany = false;
        for (const el of allEls) {
          if (el.contains(companyLink) || companyLink.contains(el)) {
            afterCompany = true;
            continue;
          }
          if (el.contains(aboutEl) || aboutEl.contains(el)) {
            break;
          }
          if (afterCompany) {
            const text = el.textContent.trim();
            if (
              text.length > 3 &&
              text.length < 100 &&
              looksLikeLocation(text) &&
              el.children.length < 3
            ) {
              return text;
            }
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

    output += `JOB TITLE:\n${details.title}\n\n`;
    output += `COMPANY:\n${details.company}\n\n`;

    if (details.location) {
      output += `LOCATION:\n${details.location}\n\n`;
    }

    output += `JOB URL:\n${details.url}\n\n`;
    output += `JOB DESCRIPTION:\n${details.description}`;

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

    // Don't inject duplicates
    if (document.getElementById(BUTTON_ID)) {
      return;
    }

    const button = createButton();
    const injected = injectIntoActionBar(button);

    if (!injected) {
      log('Action bar not found, using floating button');
      button.classList.add('ljc-floating');
      document.body.appendChild(button);
    }

    log('Button injected');
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

  function injectIntoActionBar(button) {
    const applyBtn = document.querySelector(
      'a[aria-label*="Apply"], button[aria-label*="Apply"], [data-easy-apply-button]'
    );
    const saveBtn = document.querySelector(
      'button[aria-label*="Save"], button[aria-label*="Unsave"]'
    );

    // Strategy 1: Find the common parent row/container of Apply and Save buttons
    if (applyBtn && saveBtn) {
      let curr = applyBtn.parentElement;
      while (curr && curr !== document.body) {
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
    if (anchorBtn) {
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

    // Strategy 3: Legacy class-based selectors
    const legacySelectors = [
      '.jobs-unified-top-card__actions',
      '[class*="top-card__actions"]',
      '.jobs-apply-button--top-card',
    ];
    for (const sel of legacySelectors) {
      try {
        const container = document.querySelector(sel);
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
        const container = document.querySelector(sel);
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
      const details = {
        title: extractTitle(panel),
        company: extractCompany(panel),
        location: extractLocation(panel),
        description: extractDescription(panel),
        url: extractURL(),
      };

      log('Extracted details:', {
        title: details.title,
        company: details.company,
        location: details.location,
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

    // Method 1: URL polling
    setInterval(() => {
      const currentURL = window.location.href;
      if (currentURL !== lastURL) {
        log('URL changed:', lastURL, '→', currentURL);
        lastURL = currentURL;
        onNavigationChange();
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

  function looksLikeLocation(text) {
    if (!text || text.length < 3 || text.length > 100) return false;

    const locationIndicators = [
      /,/, // Contains comma (City, State)
      /\b(india|usa|uk|canada|australia|germany|france|remote|hybrid|on-site|onsite)\b/i,
      /\b[A-Z]{2}\b/, // State abbreviations
      /\b(new york|san francisco|london|bangalore|bengaluru|mumbai|delhi|pune|hyderabad|chennai|kolkata|toronto|sydney|berlin|paris|tokyo|singapore|dubai|noida|gurgaon|gurugram)\b/i,
      /greater\s+.+\s+area/i,
      /\bremote\b/i,
    ];

    return locationIndicators.some((pattern) => pattern.test(text));
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
