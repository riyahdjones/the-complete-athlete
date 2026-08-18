import * as cheerio from 'cheerio';

const ROLE_PATTERNS = [
  ['assistant_athletic_director', /assistant\s+(?:director of athletics|athletic director)/i],
  ['athletic_director', /(?:director of athletics|athletic director)/i],
  ['district_athletics_administrator', /district\s+(?:athletic|athletics)|(?:athletic|athletics)\s+administrator/i],
  ['athletic_coordinator', /athletic\s+coordinator/i],
  ['student_activities_director', /(?:student activities|activities)\s+director/i],
  ['assistant_principal', /assistant\s+principal/i],
  ['principal', /\bprincipal\b/i],
  ['performance_staff', /(?:strength\s*(?:&|and)\s*conditioning|performance)\s+(?:coach|director|staff)/i],
  ['student_development_staff', /student\s+development/i],
  ['counselor', /\bcounselor\b/i],
  ['head_coach', /head\s+coach/i]
];

const PERSONAL_EMAIL_DOMAINS = new Set([
  'aol.com', 'gmail.com', 'hotmail.com', 'icloud.com', 'live.com',
  'mail.com', 'outlook.com', 'proton.me', 'protonmail.com', 'yahoo.com'
]);

const RESEARCH_LINK_TERMS = /athletic|staff|director|coach|administration|leadership|counsel|activities|directory|contact/i;
const SPORTS = [
  'baseball', 'basketball', 'cheer', 'cross country', 'football', 'golf',
  'gymnastics', 'lacrosse', 'soccer', 'softball', 'swimming', 'tennis',
  'track', 'volleyball', 'wrestling'
];

function cleanText(value = '') {
  return value.replace(/\s+/g, ' ').trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function resolveHttpUrl(value, baseUrl) {
  try {
    const url = new URL(value, baseUrl);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function emailDomain(email) {
  return email.toLowerCase().split('@')[1] || '';
}

export function isProfessionalEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    && !PERSONAL_EMAIL_DOMAINS.has(emailDomain(email));
}

function roleFromText(text) {
  return ROLE_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] || null;
}

function likelyName(text, roleText) {
  const withoutEmail = text.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, ' ');
  const withoutRole = withoutEmail
    .replace(roleText || '', ' ')
    .replace(/\b(?:Email|Office|Phone|Fax|Contact)\b.*$/i, ' ');
  const candidates = withoutRole.match(/\b(?:Dr\.?|Mr\.?|Ms\.?|Mrs\.?)?\s*[A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’.-]+){1,3}\b/g) || [];
  return candidates.map(cleanText).find(isLikelyPersonName) || null;
}

function isLikelyPersonName(name) {
  const words = name.replace(/^(?:Dr\.?|Mr\.?|Ms\.?|Mrs\.?)\s+/i, '').split(/\s+/);
  if (words.length < 2 || words.length > 4 || name.length > 80) return false;
  return !/(?:department|directory|information|program|school|staff|support|website|athletic(?:s)?|contact)/i.test(name);
}

function contactFromContext(context, email, sourceUrl) {
  const roleEntry = ROLE_PATTERNS.find(([, pattern]) => pattern.test(context));
  if (!roleEntry || (email && !isProfessionalEmail(email))) return null;
  const roleMatch = context.match(roleEntry[1]);
  return {
    fullName: likelyName(context, roleMatch?.[0]),
    jobTitle: roleMatch?.[0] ? cleanText(roleMatch[0]) : null,
    contactRole: roleEntry[0],
    professionalEmail: email?.toLowerCase() || null,
    emailStatus: email ? 'unverified' : 'unavailable',
    sourceUrl,
    sourceExcerpt: cleanText(context).slice(0, 500)
  };
}

function linkPriority(label, url) {
  const value = `${label} ${url}`;
  if (/athletic director contact|director of athletics|athletics staff/i.test(value)) return 100;
  if (/athletic/i.test(value) && /staff|director|contact|administration/i.test(value)) return 80;
  if (/athletic/i.test(value)) return 60;
  if (/staff directory|administration|leadership/i.test(value)) return 40;
  if (/coach|counsel|activities|directory|contact/i.test(value)) return 20;
  return 0;
}

export function extractResearchPage(html, sourceUrl) {
  const $ = cheerio.load(html);
  $('script, style, noscript, svg').remove();
  const bodyText = cleanText($('body').text());
  const title = cleanText($('title').text());
  const contacts = [];

  $('a[href^="mailto:"]').each((_, element) => {
    const raw = ($(element).attr('href') || '').slice(7).split('?')[0];
    const email = decodeURIComponent(raw).trim().toLowerCase();
    const container = $(element).closest('tr, li, article, section, div, p');
    const context = cleanText(container.text() || $(element).parent().text());
    const contact = contactFromContext(context, email, sourceUrl);
    if (contact) contacts.push(contact);
  });

  const visibleEmails = unique(bodyText.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g) || []);
  for (const email of visibleEmails) {
    if (contacts.some(contact => contact.professionalEmail === email.toLowerCase())) continue;
    const index = bodyText.toLowerCase().indexOf(email.toLowerCase());
    const context = bodyText.slice(Math.max(0, index - 220), index + email.length + 220);
    const contact = contactFromContext(context, email, sourceUrl);
    if (contact) contacts.push(contact);
  }

  $('h1, h2, h3, h4, p, td, li').each((_, element) => {
    const ownText = cleanText($(element).text());
    if (!roleFromText(ownText)) return;
    const context = cleanText($(element).parent().text()).slice(0, 800);
    const container = $(element).parent();
    const mailtoEmail = (container.find('a[href^="mailto:"]').first().attr('href') || '')
      .slice(7).split('?')[0].trim();
    const professionalEmail = [
      mailtoEmail,
      ...(context.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g) || [])
    ].find(isProfessionalEmail);
    const contact = contactFromContext(context, professionalEmail || null, sourceUrl);
    if (contact?.fullName) contacts.push(contact);
  });

  const links = [];
  $('a[href]').each((_, element) => {
    const label = cleanText($(element).text());
    const href = resolveHttpUrl($(element).attr('href'), sourceUrl);
    if (!href || !RESEARCH_LINK_TERMS.test(`${label} ${href}`)) return;
    links.push({ url: href, label, priority: linkPriority(label, href) });
  });

  const sportsOffered = SPORTS.filter(sport => new RegExp(`\\b${sport.replace(' ', '\\s+')}\\b`, 'i').test(bodyText));
  const hasOrganizedAthletics = /athletic|sports|varsity|junior varsity|\bjv\b/i.test(bodyText);

  return {
    title,
    sourceUrl,
    contacts: uniqueByContact(contacts),
    researchLinks: uniqueByUrl(links).sort((a, b) => b.priority - a.priority),
    sportsOffered,
    hasOrganizedAthletics
  };
}

function uniqueByContact(contacts) {
  const seen = new Set();
  return contacts.filter(contact => {
    const key = contact.professionalEmail
      || `${contact.fullName?.toLowerCase()}|${contact.contactRole}|${contact.sourceUrl}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueByUrl(links) {
  const seen = new Set();
  return links.filter(link => {
    const normalized = link.url.split('#')[0];
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    link.url = normalized;
    return true;
  });
}

function sameSite(firstUrl, secondUrl) {
  const first = new URL(firstUrl).hostname.replace(/^www\./, '');
  const second = new URL(secondUrl).hostname.replace(/^www\./, '');
  return first === second || first.endsWith(`.${second}`) || second.endsWith(`.${first}`);
}

function parseRobots(text) {
  const disallowed = [];
  let applies = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    const [key, ...rest] = line.split(':');
    const value = rest.join(':').trim();
    if (key?.toLowerCase() === 'user-agent') applies = value === '*';
    if (applies && key?.toLowerCase() === 'disallow' && value) disallowed.push(value);
  }
  return disallowed;
}

async function robotsAllows(url, fetchImpl) {
  const target = new URL(url);
  const robotsUrl = `${target.origin}/robots.txt`;
  try {
    const response = await fetchImpl(robotsUrl, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return true;
    const disallowed = parseRobots(await response.text());
    return !disallowed.some(path => target.pathname.startsWith(path));
  } catch {
    return true;
  }
}

async function fetchHtml(url, fetchImpl) {
  const response = await fetchImpl(url, {
    headers: { 'user-agent': 'TheCompleteAthleteResearch/1.0 (+manual-review-required)' },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) throw new Error(`Unsupported content type: ${contentType}`);
  return { html: await response.text(), finalUrl: response.url || url };
}

export async function researchSchool(seed, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const maxPages = Math.min(Math.max(options.maxPages || 8, 1), 20);
  const delayMs = Math.max(options.delayMs ?? 750, 0);
  const queue = [{ url: seed.websiteUrl, priority: 1000 }];
  const visited = new Set();
  const pages = [];
  const errors = [];

  while (queue.length && visited.size < maxPages) {
    const { url } = queue.shift();
    if (!url || visited.has(url) || !sameSite(url, seed.websiteUrl)) continue;
    visited.add(url);

    if (!(await robotsAllows(url, fetchImpl))) {
      errors.push({ url, error: 'Blocked by robots.txt' });
      continue;
    }

    try {
      const { html, finalUrl } = await fetchHtml(url, fetchImpl);
      const page = extractResearchPage(html, finalUrl);
      pages.push(page);
      for (const link of page.researchLinks) {
        if (sameSite(link.url, seed.websiteUrl) && !visited.has(link.url)) queue.push(link);
      }
      queue.sort((a, b) => b.priority - a.priority);
    } catch (error) {
      errors.push({ url, error: error.message });
    }

    if (queue.length && delayMs) await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  const contacts = uniqueByContact(pages.flatMap(page => page.contacts))
    .sort((a, b) => ROLE_PATTERNS.findIndex(([role]) => role === a.contactRole)
      - ROLE_PATTERNS.findIndex(([role]) => role === b.contactRole));

  return {
    school: seed,
    researchedAt: new Date().toISOString(),
    pagesVisited: pages.map(page => page.sourceUrl),
    contacts,
    sportsOffered: unique(pages.flatMap(page => page.sportsOffered)),
    hasOrganizedAthletics: pages.some(page => page.hasOrganizedAthletics),
    errors
  };
}
