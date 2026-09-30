// ============================================
// RoleCraft — Cutshort 1-Click Job Copier
// Content Script (Manifest V3)
// ============================================
// Extracts complete job details from Cutshort job postings
// (Title, Company, Location, Experience, Salary/CTC,
//  Equity/ESOPs, Work Type, Notice Period, Skills,
//  clean Job Description, Canonical URL)
// and copies them to the clipboard for RoleCraft ATS.
//
// ARCHITECTURE & ROBUST EXTRACTION:
// 1. Next.js Hydration data (__NEXT_DATA__) as primary full-data source.
// 2. Schema.org JSON-LD (JobPosting) as secondary rich source.
// 3. Auto-expansion of collapsed sections ("Read more", "Show more").
// 4. Granular semantic DOM extractors for dynamically rendered SPA elements.
// 5. Appropriate placement inside job actions container (NO floating fallback).
// ============================================

(function () {
  'use strict';

  // ---- Constants ----
  const PREFIX = '[RoleCraft Cutshort Copier]';
  const BUTTON_ID = 'rc-cutshort-copy-btn';
  const RESET_DELAY_MS = 2500;
  const WATCHDOG_INTERVAL_MS = 1000;

  let lastJobSignature = '';
  let debounceTimer = null;
  let lastURL = window.location.href;

  // Boilerplate phrases to strip from description text
  const BOILERPLATE_PATTERNS = [
    /^apply\s*(now|via cutshort|on company site)?$/i,
    /^save\s*(job)?$/i,
    /^share\s*(job)?$/i,
    /^report\s*(job|this job)?$/i,
    /^refer\s*(a\s*friend|someone)?$/i,
    /^follow\s*(company)?$/i,
    /^message\s*(recruiter)?$/i,
    /^similar jobs$/i,
    /^you might also like$/i,
    /^about the company$/i,
    /^posted (on|by):/i,
    /^cutshort tip:/i,
    /^apply via cutshort$/i,
    /^sign in to apply$/i,
    /^login to apply$/i,
    /^candidate must have/i,
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

  // ---- 2. Page & Job Detection ----

  function isJobPage() {
    const path = window.location.pathname;
    if (
      /^\/job\/[^\/]+/i.test(path) ||
      /^\/company\/[^\/]+\/jobs\/[^\/]+/i.test(path) ||
      /^\/jobs\/[^\/]+/i.test(path) ||
      /^\/candidate\//i.test(path) ||
      /^\/match/i.test(path)
    ) {
      return true;
    }

    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical && canonical.href && /\/job\/[^\/]+/i.test(canonical.href)) {
      return true;
    }

    return false;
  }

  function isGenericHeading(txt) {
    return /^(jobs|search|explore|find|home|about|pricing|cutshort|candidate|company|employers|login|sign\s*in|sign\s*up)/i.test(txt);
  }

  function hasJobOnPage() {
    const titleEl = findTitleElement();
    if (!titleEl) return false;
    const titleText = (titleEl.textContent || '').trim();
    if (titleText.length < 3 || isGenericHeading(titleText)) return false;

    // At least one more supporting signal
    const hasDesc = findDescriptionElement() !== null;
    const hasApply = findApplyButton() !== null;
    const hasCompany = extractCompany().length > 0;
    const hasNext = getNextDataJob() !== null;
    const hasSchema = getJsonLdJobData() !== null;

    return hasDesc || hasApply || hasCompany || hasNext || hasSchema;
  }

  function getJobSignature() {
    try {
      const path = window.location.pathname;
      if (path && path.length > 1) return path;
    } catch (e) {}

    const titleEl = findTitleElement();
    if (titleEl) {
      return (titleEl.textContent || '').trim().slice(0, 80);
    }
    return '';
  }

  // ---- 3. Next.js Hydration & JSON-LD Structured Data ----

  let cachedNextJob = null;
  let cachedNextUrl = '';

  function getNextDataJob() {
    const currentUrl = window.location.href;
    if (cachedNextUrl === currentUrl && cachedNextJob !== null) {
      return cachedNextJob;
    }

    try {
      const script = document.getElementById('__NEXT_DATA__');
      if (!script || !script.textContent) return null;
      const json = JSON.parse(script.textContent);
      const pageProps = json?.props?.pageProps;
      if (!pageProps) return null;

      let found = null;
      if (pageProps.job) found = pageProps.job;
      else if (pageProps.jobDetails) found = pageProps.jobDetails;
      else if (pageProps.jobData) found = pageProps.jobData;
      else if (pageProps.post) found = pageProps.post;
      else if (pageProps.data?.job) found = pageProps.data.job;
      else {
        for (const key of Object.keys(pageProps)) {
          const val = pageProps[key];
          if (val && typeof val === 'object' && !Array.isArray(val)) {
            if ((val.title || val.jobTitle) && (val.description || val.jobDescription || val.jd)) {
              found = val;
              break;
            }
          }
        }
      }

      cachedNextUrl = currentUrl;
      cachedNextJob = found;
      return found;
    } catch (e) {
      return null;
    }
  }

  function getJsonLdJobData() {
    try {
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        const text = script.textContent || '';
        if (!text.includes('JobPosting')) continue;
        const parsed = JSON.parse(text);
        if (parsed['@type'] === 'JobPosting') return parsed;
        if (Array.isArray(parsed['@graph'])) {
          const match = parsed['@graph'].find((i) => i['@type'] === 'JobPosting');
          if (match) return match;
        }
      }
    } catch (e) {}
    return null;
  }

  // ---- 4. Auto-Expansion for Complete Content ----

  async function expandShowMore() {
    try {
      const candidates = document.querySelectorAll(
        'button, a, span[role="button"], div[role="button"], [class*="read-more" i], [class*="show-more" i], [class*="view-more" i], [class*="see-more" i]'
      );
      for (const el of candidates) {
        const txt = (el.textContent || '').trim().toLowerCase();
        const aria = (el.getAttribute('aria-label') || '').toLowerCase();
        if (/apply|save|share|refer|login|sign|follow/i.test(txt) || /apply|save|share/i.test(aria)) continue;
        if (
          /^(read\s*more|show\s*more|view\s*more|see\s*more|\.\.\.\s*more|\+ more|\+\d+\s*more)$/i.test(txt) ||
          aria.includes('read more') ||
          aria.includes('show more') ||
          aria.includes('view more')
        ) {
          log('Expanding collapsed section:', txt);
          el.click();
        }
      }
      await new Promise((r) => setTimeout(r, 150));
    } catch (e) {
      warn('Could not auto-expand sections:', e.message);
    }
  }

  // ---- 5. Field Extractors ----

  function findTitleElement(scope) {
    const root = scope || document;
    const h1s = root.querySelectorAll('h1');
    for (const h of h1s) {
      const txt = (h.textContent || '').trim();
      if (txt.length > 2 && txt.length < 200 && !isGenericHeading(txt) && h.offsetHeight > 0) {
        return h;
      }
    }
    return null;
  }

  function extractJobTitle() {
    const nextJob = getNextDataJob();
    if (nextJob && (nextJob.title || nextJob.jobTitle)) {
      return String(nextJob.title || nextJob.jobTitle).trim();
    }

    const jsonLd = getJsonLdJobData();
    if (jsonLd && jsonLd.title && typeof jsonLd.title === 'string') {
      return jsonLd.title.trim();
    }

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle && ogTitle.content) {
      const t = ogTitle.content.trim();
      const cleaned = t.replace(/\s*[\|\-–]\s*Cutshort.*$/i, '').trim();
      if (cleaned.length > 2) return cleaned;
    }

    const titleEl = findTitleElement();
    if (titleEl) return (titleEl.textContent || '').trim();

    return 'Job Details';
  }

  function extractCompany() {
    const nextJob = getNextDataJob();
    if (nextJob) {
      if (typeof nextJob.company === 'string') return nextJob.company.trim();
      if (nextJob.company?.name) return String(nextJob.company.name).trim();
      if (nextJob.companyName) return String(nextJob.companyName).trim();
    }

    const jsonLd = getJsonLdJobData();
    if (jsonLd && jsonLd.hiringOrganization) {
      if (typeof jsonLd.hiringOrganization === 'string') return jsonLd.hiringOrganization.trim();
      if (jsonLd.hiringOrganization.name) return String(jsonLd.hiringOrganization.name).trim();
    }

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle && ogTitle.content) {
      const m = ogTitle.content.match(/\bat\s+(.+?)\s*(?:[\|\-–]|$)/i);
      if (m && m[1]) return m[1].trim();
    }

    const selectors = [
      '[class*="company-name" i]',
      '[class*="companyName" i]',
      '[class*="company_name" i]',
      'a[href*="/company/"]',
      '[data-testid*="company" i]',
      '[aria-label*="company" i]',
    ];
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el) {
          const txt = (el.textContent || '').trim();
          if (txt.length > 1 && txt.length < 120 && !txt.match(/^(apply|save|share|login|sign|refer)/i)) {
            return txt;
          }
        }
      } catch (e) {}
    }

    const companyLinks = document.querySelectorAll('a[href*="/company/"]');
    for (const link of companyLinks) {
      const txt = (link.textContent || '').trim();
      if (txt.length > 1 && txt.length < 100 && !/^(apply|login|cutshort)/i.test(txt)) return txt;
    }

    return '';
  }

  function extractLocation() {
    const nextJob = getNextDataJob();
    if (nextJob) {
      if (nextJob.locations && Array.isArray(nextJob.locations)) {
        const locs = nextJob.locations.map((l) => (typeof l === 'string' ? l : l.name || l.city)).filter(Boolean);
        if (locs.length > 0) return locs.join(', ');
      }
      if (typeof nextJob.location === 'string') return nextJob.location.trim();
      if (nextJob.cities && Array.isArray(nextJob.cities)) return nextJob.cities.join(', ');
    }

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

    if (jsonLd && jsonLd.applicantLocationRequirements) {
      const req = jsonLd.applicantLocationRequirements;
      if (typeof req === 'string') return req.trim();
      if (req.name) return String(req.name).trim();
    }

    if (jsonLd && jsonLd.jobLocationType === 'TELECOMMUTE') return 'Remote';

    const selectors = [
      '[class*="location" i]',
      '[class*="city" i]',
      '[data-testid*="location" i]',
      '[aria-label*="location" i]',
      'span[class*="place" i]',
    ];
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el && el.offsetHeight > 0) {
          const txt = (el.textContent || '').trim();
          if (txt.length > 1 && txt.length < 100 && !/apply|company|role|job type|share/i.test(txt)) {
            return txt;
          }
        }
      } catch (e) {}
    }

    const ogDesc = document.querySelector('meta[name="description"], meta[property="og:description"]');
    if (ogDesc && ogDesc.content) {
      const m = ogDesc.content.match(/(?:in|at|location[:\s]+)([A-Za-z ,]+(?:India|Remote|Bangalore|Bengaluru|Mumbai|Delhi|Pune|Hyderabad|Chennai|Gurgaon|Noida)[^,\.]*)/i);
      if (m && m[1]) return m[1].trim();
    }

    return '';
  }

  function extractSalary() {
    const nextJob = getNextDataJob();
    if (nextJob) {
      if (nextJob.minSalary && nextJob.maxSalary) {
        return `₹${nextJob.minSalary}–${nextJob.maxSalary} LPA`;
      }
      if (nextJob.salary) return String(nextJob.salary).trim();
      if (nextJob.ctc) return String(nextJob.ctc).trim();
    }

    const jsonLd = getJsonLdJobData();
    if (jsonLd && jsonLd.baseSalary) {
      if (typeof jsonLd.baseSalary === 'string') return jsonLd.baseSalary.trim();
      const val = jsonLd.baseSalary.value;
      if (val) {
        if (typeof val === 'string') return val.trim();
        if (val.minValue && val.maxValue) {
          const currency = jsonLd.baseSalary.currency || 'INR';
          return `${val.minValue}–${val.maxValue} ${currency}`;
        }
        if (val.value) return `${val.value} ${jsonLd.baseSalary.currency || 'INR'}`;
      }
    }

    const selectors = [
      '[class*="salary" i]',
      '[class*="ctc" i]',
      '[class*="compensation" i]',
      '[class*="pay" i]',
    ];
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el && el.offsetHeight > 0) {
          const txt = (el.textContent || '').trim();
          if (txt.length > 1 && (txt.includes('₹') || txt.includes('$') || /\b(lpa|lakh|lac|ctc|pa|per annum|salary)\b/i.test(txt))) {
            return txt;
          }
        }
      } catch (e) {}
    }

    const allText = document.body.innerText;
    const salaryMatch = allText.match(/(?:salary|ctc|compensation)[:\s]+([\₹\$\d,\.]+\s*(?:lpa|lakh|lac|k|per annum)?(?:\s*[-–to]+\s*[\₹\$\d,\.]+\s*(?:lpa|lakh|lac|k)?)?)/i);
    if (salaryMatch) return salaryMatch[1].trim();

    return '';
  }

  function extractEquity() {
    const nextJob = getNextDataJob();
    if (nextJob && (nextJob.equity || nextJob.esops)) {
      return String(nextJob.equity || nextJob.esops).trim();
    }

    const selectors = ['[class*="equity" i]', '[class*="esop" i]', '[data-testid*="equity" i]'];
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el && el.offsetHeight > 0) {
          const txt = (el.textContent || '').trim();
          if (txt.length > 1 && txt.length < 60) return txt;
        }
      } catch (e) {}
    }

    const allText = document.body.innerText;
    const match = allText.match(/(?:equity|esop|esops)[:\s]+([\d\.\s%–\-to]+(?:equity|esop|shares)?)/i);
    if (match) return match[1].trim();

    return '';
  }

  function extractNoticePeriod() {
    const nextJob = getNextDataJob();
    if (nextJob && (nextJob.noticePeriod || nextJob.notice_period)) {
      return String(nextJob.noticePeriod || nextJob.notice_period).trim();
    }

    const selectors = ['[class*="notice" i]', '[data-testid*="notice" i]'];
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el && el.offsetHeight > 0) {
          const txt = (el.textContent || '').trim();
          if (txt.length > 1 && txt.length < 60 && /day|month|immediate|week/i.test(txt)) return txt;
        }
      } catch (e) {}
    }

    const allText = document.body.innerText;
    const match = allText.match(/(?:notice\s*period)[:\s]+([\d\s\-–to]+(?:days?|months?|weeks?)|immediate)/i);
    if (match) return match[1].trim();

    return '';
  }

  function extractExperience() {
    const nextJob = getNextDataJob();
    if (nextJob) {
      if (nextJob.minExp !== undefined && nextJob.maxExp !== undefined) {
        return `${nextJob.minExp}–${nextJob.maxExp} Years`;
      }
      if (nextJob.experience) return String(nextJob.experience).trim();
    }

    const jsonLd = getJsonLdJobData();
    if (jsonLd && jsonLd.experienceRequirements) {
      if (typeof jsonLd.experienceRequirements === 'string') return jsonLd.experienceRequirements.trim();
      if (jsonLd.experienceRequirements.monthsOfExperience) {
        const yrs = Math.floor(jsonLd.experienceRequirements.monthsOfExperience / 12);
        return `${yrs}+ Years`;
      }
    }

    const selectors = [
      '[class*="experience" i]',
      '[class*="exp" i]',
      '[data-testid*="experience" i]',
    ];
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el && el.offsetHeight > 0) {
          const txt = (el.textContent || '').trim();
          if (/\d+.*?(?:yr|year|exp|fresher|experienced)/i.test(txt) && txt.length < 60) return txt;
        }
      } catch (e) {}
    }

    const allText = document.body.innerText;
    const expMatch = allText.match(/(?:experience|exp)[:\s]+([\d,\s\-–]+(?:yr|year|years|yrs|yr\+)?)/i);
    if (expMatch) return expMatch[1].trim();

    return '';
  }

  function extractWorkType() {
    const nextJob = getNextDataJob();
    if (nextJob && (nextJob.workType || nextJob.remoteType || nextJob.employmentType)) {
      return String(nextJob.workType || nextJob.remoteType || nextJob.employmentType).trim();
    }

    const jsonLd = getJsonLdJobData();
    if (jsonLd) {
      if (jsonLd.jobLocationType === 'TELECOMMUTE') return 'Remote';
      if (jsonLd.employmentType) {
        const et = jsonLd.employmentType;
        if (typeof et === 'string') {
          return et.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        }
        if (Array.isArray(et)) return et.map((t) => t.replace(/_/g, ' ')).join(', ');
      }
    }

    const selectors = [
      '[class*="employment-type" i]',
      '[class*="job-type" i]',
      '[class*="work-type" i]',
      '[data-testid*="employment" i]',
    ];
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el && el.offsetHeight > 0) {
          const txt = (el.textContent || '').trim();
          if (/full.?time|part.?time|contract|remote|hybrid|freelance|internship/i.test(txt) && txt.length < 60) return txt;
        }
      } catch (e) {}
    }

    const allText = document.body.innerText;
    const workMatch = allText.match(/\b(full[\s\-]?time|part[\s\-]?time|remote|hybrid|contract|freelance|internship)\b/i);
    if (workMatch) return workMatch[1].trim();

    return '';
  }

  function extractSkills() {
    const skills = [];

    // Next.js job skills
    const nextJob = getNextDataJob();
    if (nextJob) {
      const raw = nextJob.skills || nextJob.requiredSkills || nextJob.primarySkills || nextJob.skillList;
      if (Array.isArray(raw)) {
        raw.forEach((s) => {
          const name = typeof s === 'string' ? s.trim() : (s?.name || s?.title || '').trim();
          if (name && !skills.includes(name)) skills.push(name);
        });
      }
    }

    // JSON-LD
    const jsonLd = getJsonLdJobData();
    if (jsonLd && jsonLd.skills) {
      if (typeof jsonLd.skills === 'string') {
        jsonLd.skills.split(',').forEach((s) => {
          const tr = s.trim();
          if (tr && !skills.includes(tr)) skills.push(tr);
        });
      } else if (Array.isArray(jsonLd.skills)) {
        jsonLd.skills.forEach((s) => {
          const tr = String(s).trim();
          if (tr && !skills.includes(tr)) skills.push(tr);
        });
      }
    }

    // DOM chips/pills
    const skillSelectors = [
      '[class*="skill" i] a',
      '[class*="skill" i] span',
      '[class*="skill" i] li',
      '[class*="tag" i]',
      '[class*="chip" i]',
      '[class*="badge" i]',
      '[class*="tech" i] span',
    ];

    for (const sel of skillSelectors) {
      try {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          if (el.children.length > 1) continue;
          const txt = (el.textContent || '').trim();
          if (
            txt.length > 1 &&
            txt.length < 40 &&
            !/apply|save|share|follow|more|view|filter/i.test(txt) &&
            !skills.some((s) => s.toLowerCase() === txt.toLowerCase())
          ) {
            skills.push(txt);
          }
        }
      } catch (e) {}
    }

    return skills.slice(0, 30).join(', ');
  }

  function findDescriptionElement() {
    const selectors = [
      '[class*="job-description" i]',
      '[class*="jobDescription" i]',
      '[class*="job_description" i]',
      '[class*="description" i]:not(meta)',
      '[class*="jd" i]',
      '[itemprop="description"]',
      'section[class*="desc" i]',
      'div[class*="desc" i]',
      '.prose',
    ];

    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el && el.textContent.trim().length > 80 && el.offsetHeight > 0) return el;
      } catch (e) {}
    }

    // Heading-anchored: find h2/h3 with "description", "responsibilities", "requirements"
    const headings = document.querySelectorAll('h2, h3, h4');
    for (const h of headings) {
      const hTxt = (h.textContent || '').trim();
      if (/job\s*description|about\s*(the\s*)?(role|job)|responsibilities|requirements|what\s*you/i.test(hTxt)) {
        const section = h.closest('section, article, div') || h.parentElement;
        if (section && section.textContent.trim().length > 80) return section;
      }
    }

    // Largest paragraph-rich block
    const blocks = document.querySelectorAll('main div, main section, main article, section, article');
    let best = null;
    let highestScore = 0;
    for (const block of blocks) {
      if (block.querySelector('input, nav, header, button')) continue;
      const txt = (block.textContent || '').trim();
      if (txt.length < 100 || txt.length > 80000) continue;
      if (!/responsibilities|requirements|role|experience|skills|about|what you/i.test(txt)) continue;
      const liCount = block.querySelectorAll('li').length;
      const pCount = block.querySelectorAll('p').length;
      const score = txt.length + liCount * 150 + pCount * 80;
      if (score > highestScore) {
        highestScore = score;
        best = block;
      }
    }
    return best;
  }

  function extractDescription() {
    // 1. Next.js props (pristine un-truncated source)
    const nextJob = getNextDataJob();
    let nextDesc = '';
    if (nextJob) {
      const d = nextJob.description || nextJob.jobDescription || nextJob.jd;
      if (typeof d === 'string' && d.length > 80) {
        nextDesc = d.includes('<') ? cleanHtmlText(d) : d.trim();
      }
    }

    // 2. JSON-LD JobPosting schema
    const jsonLd = getJsonLdJobData();
    let jsonLdDesc = '';
    if (jsonLd && jsonLd.description && typeof jsonLd.description === 'string' && jsonLd.description.length > 80) {
      jsonLdDesc = cleanHtmlText(jsonLd.description);
    }

    // 3. Rendered DOM element (after auto-expanding Show more)
    const descEl = findDescriptionElement();
    let domDesc = '';
    if (descEl) {
      domDesc = cleanElementText(descEl);
    }

    // Prioritize whichever extraction contains the most complete content
    const candidates = [nextDesc, jsonLdDesc, domDesc].filter(Boolean);
    if (candidates.length > 0) {
      candidates.sort((a, b) => b.length - a.length);
      return candidates[0];
    }

    // Fallback: OG description
    const ogDesc = document.querySelector('meta[name="description"], meta[property="og:description"]');
    if (ogDesc && ogDesc.content && ogDesc.content.length > 30) {
      return ogDesc.content.trim();
    }

    return '';
  }

  function extractURL() {
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical && canonical.href && canonical.href.includes('cutshort.io')) {
      return canonical.href;
    }

    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl && ogUrl.content && ogUrl.content.includes('cutshort.io')) {
      return ogUrl.content;
    }

    try {
      const url = new URL(window.location.href);
      ['utm_source', 'utm_medium', 'utm_campaign', 'ref', 'src', 'sid'].forEach((p) => url.searchParams.delete(p));
      return url.toString();
    } catch (e) {
      return window.location.href;
    }
  }

  // ---- 6. Text Cleaning ----

  function cleanHtmlText(html) {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return cleanElementText(temp);
  }

  function cleanElementText(element) {
    const clone = element.cloneNode(true);

    const unneeded = clone.querySelectorAll(
      'button, script, style, svg, input, form, nav, header, [class*="action" i], [class*="footer" i], [class*="share" i], [class*="follow" i]'
    );
    unneeded.forEach((el) => el.remove());

    clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
    clone.querySelectorAll('p, div, li, tr, h1, h2, h3, h4, h5, h6').forEach((block) => {
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

  // ---- 7. Clipboard Formatting ----

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
    if (details.salary) metaParts.push(`Salary/CTC: ${details.salary}`);
    if (details.equity) metaParts.push(`Equity: ${details.equity}`);
    if (details.workType) metaParts.push(`Work Type: ${details.workType}`);
    if (details.noticePeriod) metaParts.push(`Notice Period: ${details.noticePeriod}`);
    if (details.skills) metaParts.push(`Skills: ${details.skills}`);

    if (metaParts.length > 0) {
      output += `JOB DETAILS:\n${metaParts.join(' | ')}\n\n`;
    }

    if (details.url) {
      output += `JOB URL:\n${details.url}\n\n`;
    }

    output += `JOB DESCRIPTION:\n${details.description || details.title || ''}`;

    return output.trim();
  }

  // ---- 8. Clipboard API ----

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      log('Copied via Clipboard API');
      return true;
    } catch (e) {
      warn('Clipboard API failed, trying execCommand:', e.message);
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

  // ---- 9. Button Icons & States ----

  function getCopyIcon() {
    return `<span class="rc-cutshort-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg></span>`;
  }

  function getCheckIcon() {
    return `<span class="rc-cutshort-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg></span>`;
  }

  function getErrorIcon() {
    return `<span class="rc-cutshort-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg></span>`;
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

  // ---- 10. Click Handler ----

  async function handleCopyClick(event) {
    event.preventDefault();
    event.stopPropagation();

    log('Copy Job Details clicked');
    setButtonState('extracting');

    try {
      await expandShowMore();

      const title = extractJobTitle();
      const company = extractCompany();
      const location = extractLocation();
      const experience = extractExperience();
      const salary = extractSalary();
      const equity = extractEquity();
      const workType = extractWorkType();
      const noticePeriod = extractNoticePeriod();
      const skills = extractSkills();
      const url = extractURL();
      const description = extractDescription();

      const formatted = formatForClipboard({
        title,
        company,
        location,
        experience,
        salary,
        equity,
        workType,
        noticePeriod,
        skills,
        url,
        description,
      });

      const success = await copyToClipboard(formatted);
      if (!success) throw new Error('Clipboard write failed');

      log('Cutshort job details copied! Length:', formatted.length);
      log('Fields:', { title, company, location, experience, salary, equity, workType, noticePeriod });
      setButtonState('success');
    } catch (err) {
      logError('Error copying job details:', err.message);
      setButtonState('error');
    }

    setTimeout(() => setButtonState('ready'), RESET_DELAY_MS);
  }

  // ---- 11. Button Creation & Appropriate Placement ----

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

  function findApplyButton() {
    const allButtons = document.querySelectorAll('button, a[href], [role="button"]');
    for (const btn of allButtons) {
      const txt = (btn.textContent || '').trim();
      if (/^apply\b/i.test(txt) && btn.offsetWidth > 10 && btn.offsetHeight > 10) {
        return btn;
      }
    }

    const byAria = document.querySelector('[aria-label*="apply" i]');
    if (byAria && byAria.offsetWidth > 10) return byAria;

    return null;
  }

  /**
   * Multi-strategy in-flow placement inside the active job view:
   * 1. Alongside the Apply button (same action row container)
   * 2. After the apply button element itself
   * 3. Alongside Share / Refer / Save action buttons
   * 4. Inside the job header card (below title / company)
   * 5. Adjacent to Job Title (h1)
   * 6. Before the description section
   * NO FLOATING FALLBACK — if no appropriate place in job view, returns false.
   */
  function injectIntoJob(btn) {
    // Strategy 1: Inject into the apply button's container row
    const applyBtn = findApplyButton();
    if (applyBtn && applyBtn.isConnected) {
      const parent = applyBtn.parentElement;
      if (parent && parent !== document.body && parent.isConnected) {
        const style = window.getComputedStyle(parent);
        if (style.display === 'flex' || style.display === 'inline-flex' || parent.children.length <= 5) {
          parent.appendChild(btn);
          log('Button injected into apply button container');
          return true;
        }
      }
      applyBtn.insertAdjacentElement('afterend', btn);
      log('Button injected after apply button');
      return true;
    }

    // Strategy 2: Place adjacent to Share / Save / Refer action buttons
    const actionBtn = document.querySelector(
      'button[aria-label*="share" i], button[aria-label*="save" i], button[title*="share" i], button[title*="save" i], [data-testid*="share" i], [data-testid*="action" i]'
    );
    if (actionBtn && actionBtn.isConnected) {
      actionBtn.insertAdjacentElement('afterend', btn);
      log('Button injected adjacent to share/action button');
      return true;
    }

    // Strategy 3: Inside job header card after title
    const titleEl = findTitleElement();
    if (titleEl && titleEl.isConnected && titleEl.parentElement) {
      titleEl.insertAdjacentElement('afterend', btn);
      log('Button injected after job title heading');
      return true;
    }

    // Strategy 4: Before the description section
    const descEl = findDescriptionElement();
    if (descEl && descEl.isConnected && descEl.parentElement) {
      descEl.insertAdjacentElement('beforebegin', btn);
      log('Button injected before job description');
      return true;
    }

    // Appropriate place inside job panel/card not found — no floating fallback
    log('Could not find suitable injection point inside job view — button will not be displayed (no floating fallback)');
    return false;
  }

  function injectButton() {
    if (!isJobPage() && !hasJobOnPage()) {
      removeButton();
      return;
    }

    if (!hasJobOnPage()) {
      removeButton();
      return;
    }

    // Already present and visible?
    const existing = document.getElementById(BUTTON_ID);
    if (existing && existing.isConnected && existing.offsetWidth > 0) {
      return;
    }

    removeButton();

    const btn = createButton();
    const injected = injectIntoJob(btn);
    if (injected) {
      lastJobSignature = getJobSignature();
      log('Button ready for job:', lastJobSignature || '(active)');
    } else {
      removeButton();
    }
  }

  function removeButton() {
    const buttons = document.querySelectorAll('#' + BUTTON_ID);
    if (buttons.length > 0) {
      buttons.forEach((b) => b.remove());
      log('Copy button removed');
    }
  }

  // ---- 12. SPA Navigation Watchers ----

  function checkJobSwitch() {
    const currentSig = getJobSignature();
    if (currentSig && currentSig !== lastJobSignature) {
      log('Job/page change detected:', lastJobSignature, '→', currentSig);
      lastJobSignature = currentSig;
      removeButton();
      setTimeout(injectButton, 300);
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
        if (!btn || btn.offsetWidth === 0) {
          injectButton();
        }
      } else {
        removeButton();
      }
    }, 200);
  }

  function setupNavigationDetection() {
    window.addEventListener('popstate', onNavigationChange);

    const observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        checkJobSwitch();
        if (hasJobOnPage()) {
          const btn = document.getElementById(BUTTON_ID);
          if (!btn || btn.offsetWidth === 0) {
            injectButton();
          }
        } else {
          removeButton();
        }
      }, 250);
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
        const btn = document.getElementById(BUTTON_ID);
        if (!btn || btn.offsetWidth === 0) {
          injectButton();
        }
      } else {
        removeButton();
      }
    }, WATCHDOG_INTERVAL_MS);

    log('Navigation & mutation detection initialized');
  }

  // ---- 13. Initialization ----

  function init() {
    log('Initializing RoleCraft Cutshort 1-Click Job Copier...');
    setTimeout(injectButton, 300);
    setTimeout(injectButton, 1200);
    setupNavigationDetection();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
