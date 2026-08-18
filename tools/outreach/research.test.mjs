import assert from 'node:assert/strict';
import test from 'node:test';
import { extractResearchPage, isProfessionalEmail, researchSchool } from './research.mjs';

const staffHtml = `
  <html><head><title>Central High Athletics</title></head><body>
    <nav><a href="/athletics/staff">Athletic Staff</a></nav>
    <section>
      <h2>Jordan Taylor</h2>
      <p>Athletic Director</p>
      <a href="mailto:jordan.taylor@centralhs.edu">Email Jordan</a>
    </section>
    <p>Football, Basketball, Volleyball and Track programs</p>
    <p>Personal: example@gmail.com</p>
  </body></html>`;

test('extracts verified-role professional contacts and evidence', () => {
  const result = extractResearchPage(staffHtml, 'https://centralhs.edu/');
  assert.equal(result.contacts.length, 1);
  assert.equal(result.contacts[0].contactRole, 'athletic_director');
  assert.equal(result.contacts[0].professionalEmail, 'jordan.taylor@centralhs.edu');
  assert.equal(result.contacts[0].emailStatus, 'unverified');
  assert.equal(result.contacts[0].sourceUrl, 'https://centralhs.edu/');
  assert.deepEqual(result.sportsOffered.sort(), ['basketball', 'football', 'track', 'volleyball']);
});

test('retains named decision-makers without guessing an email', () => {
  const html = '<main><section><h2>Alex Morgan</h2><p>Athletic Director</p><p>Office: 555-0100</p></section></main>';
  const result = extractResearchPage(html, 'https://centralhs.edu/athletics');
  assert.equal(result.contacts.length, 1);
  assert.equal(result.contacts[0].fullName, 'Alex Morgan');
  assert.equal(result.contacts[0].professionalEmail, null);
  assert.equal(result.contacts[0].emailStatus, 'unavailable');
});

test('rejects common personal email providers', () => {
  assert.equal(isProfessionalEmail('coach@gmail.com'), false);
  assert.equal(isProfessionalEmail('coach@district.k12.ga.us'), true);
});

test('does not turn navigation labels or department copy into people', () => {
  const html = '<nav><a>High School Athletic Director Contact Information</a></nav><p>The School Counseling Department has a counselor at every school.</p>';
  const result = extractResearchPage(html, 'https://district.edu/athletics');
  assert.equal(result.contacts.length, 0);
});

test('crawler remains on the school site and honors a page bound', async () => {
  const pages = new Map([
    ['https://centralhs.edu/robots.txt', { body: '', type: 'text/plain' }],
    ['https://centralhs.edu/', { body: staffHtml, type: 'text/html' }],
    ['https://centralhs.edu/athletics/staff', { body: staffHtml, type: 'text/html' }]
  ]);
  const fetchImpl = async url => {
    const page = pages.get(url);
    if (!page) return { ok: false, status: 404, headers: new Headers(), text: async () => '' };
    return {
      ok: true,
      status: 200,
      url,
      headers: new Headers({ 'content-type': page.type }),
      text: async () => page.body
    };
  };
  const result = await researchSchool(
    { name: 'Central High', state: 'GA', websiteUrl: 'https://centralhs.edu/' },
    { fetchImpl, maxPages: 2, delayMs: 0 }
  );
  assert.equal(result.pagesVisited.length, 2);
  assert.equal(result.contacts.length, 1);
});
