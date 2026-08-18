#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const DISTRICT_DIRECTORY = 'https://www.gcpsk12.org/students/athletics/high-school-athletic-director-contact-information';

function parseEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/).flatMap(line => {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) return [];
    return [[match[1], match[2].replace(/^['"]|['"]$/g, '')]];
  }));
}

function domainFor(url) {
  return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
}

function normalized(value) {
  return value.trim().toLowerCase();
}

const projectRoot = new URL('../../', import.meta.url);
const env = parseEnv(await readFile(new URL('.env.admin.local', projectRoot), 'utf8'));
const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing Supabase admin environment variables.');

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const seeds = JSON.parse(await readFile(new URL('pilot-gwinnett-high-schools.json', import.meta.url), 'utf8'));

const { data: campaign, error: campaignError } = await supabase
  .from('outreach_campaigns')
  .select('id')
  .eq('name', 'Georgia Schools Pilot')
  .single();
if (campaignError) throw campaignError;

const summary = { schools: 0, contacts: 0, verifiedEmails: 0, prospects: 0 };

for (const seed of seeds) {
  const score = seed.email ? 75 : 50;
  const schoolPayload = {
    name: seed.name,
    normalized_name: normalized(seed.name),
    school_type: seed.schoolType,
    grade_levels: seed.gradeLevels,
    city: seed.city,
    county: seed.county,
    state: seed.state,
    website_url: seed.websiteUrl,
    website_domain: domainFor(seed.websiteUrl),
    athletics_url: seed.contactSourceUrl || null,
    has_organized_athletics: true,
    priority_signals: {
      metro_atlanta: true,
      established_athletic_department: true,
      athletic_director_publicly_identified: true,
      professional_email_publicly_verified: Boolean(seed.email)
    },
    qualification_status: 'qualified',
    qualification_score: score,
    qualification_reasons: [
      'Georgia public high school',
      'Organized athletics confirmed by official district directory',
      'Athletic Director identified on an official source',
      ...(seed.email ? ['Professional email verified on official school page'] : ['Professional email requires further research'])
    ],
    source_urls: [...new Set([DISTRICT_DIRECTORY, seed.contactSourceUrl].filter(Boolean))],
    last_verified_at: new Date().toISOString()
  };

  const { data: existingSchool, error: schoolLookupError } = await supabase
    .from('outreach_schools')
    .select('id')
    .eq('normalized_name', normalized(seed.name))
    .eq('city', seed.city)
    .eq('state', 'GA')
    .maybeSingle();
  if (schoolLookupError) throw schoolLookupError;

  const schoolQuery = existingSchool
    ? supabase.from('outreach_schools').update(schoolPayload).eq('id', existingSchool.id).select('id').single()
    : supabase.from('outreach_schools').insert(schoolPayload).select('id').single();
  const { data: school, error: schoolError } = await schoolQuery;
  if (schoolError) throw schoolError;
  summary.schools += 1;

  const contactPayload = {
    school_id: school.id,
    full_name: seed.athleticDirector,
    normalized_name: normalized(seed.athleticDirector),
    job_title: 'Athletic Director',
    contact_role: 'athletic_director',
    professional_email: seed.email || null,
    normalized_email: seed.email ? normalized(seed.email) : null,
    professional_phone: seed.phone,
    email_status: seed.email ? 'valid' : 'unavailable',
    is_primary_contact: true,
    source_url: seed.contactSourceUrl || DISTRICT_DIRECTORY,
    source_excerpt: `${seed.athleticDirector} — Athletic Director — ${seed.phone}${seed.email ? ` — ${seed.email}` : ''}`,
    last_verified_at: new Date().toISOString()
  };

  const { data: existingContact, error: contactLookupError } = await supabase
    .from('outreach_contacts')
    .select('id')
    .eq('school_id', school.id)
    .eq('contact_role', 'athletic_director')
    .eq('is_primary_contact', true)
    .maybeSingle();
  if (contactLookupError) throw contactLookupError;

  const contactQuery = existingContact
    ? supabase.from('outreach_contacts').update(contactPayload).eq('id', existingContact.id).select('id').single()
    : supabase.from('outreach_contacts').insert(contactPayload).select('id').single();
  const { data: contact, error: contactError } = await contactQuery;
  if (contactError) throw contactError;
  summary.contacts += 1;
  if (seed.email) summary.verifiedEmails += 1;

  const evidenceRows = [
    {
      school_id: school.id,
      contact_id: contact.id,
      url: DISTRICT_DIRECTORY,
      source_type: 'official_district',
      field_supported: 'athletic_director_name_role_phone',
      captured_text: `${seed.athleticDirector} — Athletic Director — ${seed.phone}`,
      retrieved_at: new Date().toISOString()
    },
    ...(seed.email ? [{
      school_id: school.id,
      contact_id: contact.id,
      url: seed.contactSourceUrl,
      source_type: seed.contactSourceUrl.endsWith('.pdf') ? 'official_athletics' : 'official_school',
      field_supported: 'professional_email',
      captured_text: seed.email,
      retrieved_at: new Date().toISOString()
    }] : [])
  ];
  for (const evidence of evidenceRows) {
    const { data: existingEvidence, error: evidenceLookupError } = await supabase
      .from('outreach_source_evidence')
      .select('id')
      .eq('school_id', evidence.school_id)
      .eq('contact_id', evidence.contact_id)
      .eq('url', evidence.url)
      .eq('field_supported', evidence.field_supported)
      .maybeSingle();
    if (evidenceLookupError) throw evidenceLookupError;
    const evidenceQuery = existingEvidence
      ? supabase.from('outreach_source_evidence').update(evidence).eq('id', existingEvidence.id)
      : supabase.from('outreach_source_evidence').insert(evidence);
    const { error: evidenceError } = await evidenceQuery;
    if (evidenceError) throw evidenceError;
  }

  const { data: existingProspect, error: prospectLookupError } = await supabase
    .from('outreach_prospects')
    .select('status, status_reason')
    .eq('campaign_id', campaign.id)
    .eq('contact_id', contact.id)
    .maybeSingle();
  if (prospectLookupError) throw prospectLookupError;
  const researchStatus = seed.email ? 'research_ready' : 'discovered';
  const preserveWorkflowStatus = existingProspect && !['discovered', 'qualified', 'research_ready'].includes(existingProspect.status);

  const prospectPayload = {
    school_id: school.id,
    contact_id: contact.id,
    campaign_id: campaign.id,
    status: preserveWorkflowStatus ? existingProspect.status : researchStatus,
    priority_score: score,
    personalization_brief: seed.email
      ? `Official school sources identify ${seed.athleticDirector} as the Athletic Director at ${seed.name} and publish a professional school email. Outreach angle to test: position The Complete Athlete as a structured mental-performance resource that can complement the school's existing athletic program. Do not imply a known need, budget, or current initiative.`
      : null,
    personalization_evidence: schoolPayload.source_urls,
    status_reason: preserveWorkflowStatus
      ? existingProspect.status_reason
      : (seed.email ? 'Official school-page email verified' : 'Professional email requires verification')
  };
  const { error: prospectError } = await supabase
    .from('outreach_prospects')
    .upsert(prospectPayload, { onConflict: 'campaign_id,contact_id', ignoreDuplicates: false });
  if (prospectError) throw prospectError;
  summary.prospects += 1;
}

process.stdout.write(`${JSON.stringify(summary)}\n`);
