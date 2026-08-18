#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

function parseEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/).flatMap(line => {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    return match ? [[match[1], match[2].replace(/^['"]|['"]$/g, '')]] : [];
  }));
}

function firstName(fullName) {
  return fullName.replace(/^(dr\.?|mr\.?|ms\.?|mrs\.?)\s+/i, '').split(/\s+/)[0];
}

const projectRoot = new URL('../../', import.meta.url);
const env = parseEnv(await readFile(new URL('.env.admin.local', projectRoot), 'utf8'));
const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error('Missing Supabase admin environment variables.');

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const { data: prospects, error } = await supabase
  .from('outreach_prospects')
  .select('id, outreach_contacts!inner(full_name, professional_email, email_status), outreach_schools!inner(name)')
  .eq('status', 'research_ready')
  .eq('outreach_contacts.email_status', 'valid');
if (error) throw error;

let messageCount = 0;
for (const prospect of prospects) {
  const contact = prospect.outreach_contacts;
  const school = prospect.outreach_schools;
  const greeting = firstName(contact.full_name);
  const footer = `\n\nBest,\nRiyahd Jones\nThe Complete Athlete\n[Business mailing address required before sending]\n\nIf this isn't relevant, reply “no thanks” and I won't follow up.`;
  const messages = [
    {
      message_type: 'initial',
      sequence_number: 0,
      subject: `A mental-performance resource for ${school.name} athletes`,
      body: `Hi ${greeting},\n\nAthletes spend countless hours training physically, but many have far less structure for confidence, focus, responding to mistakes, and staying consistent.\n\nI’m reaching out about a practical speaking session for ${school.name} student-athletes built around those skills. The session introduces tools athletes can use immediately, with The Complete Athlete serving as an optional system for continuing the work through goals, daily priorities, reflection, and accountability.\n\nWould you be open to a 15-minute introductory call to see whether this could support your athletic program?${footer}`
    },
    {
      message_type: 'follow_up',
      sequence_number: 1,
      subject: `Re: A mental-performance resource for ${school.name} athletes`,
      body: `Hi ${greeting},\n\nOne reason I believe this work matters is that mental-performance lessons become more useful when athletes can turn them into repeatable actions—setting a clear target, choosing daily priorities, reflecting after competition, and resetting after mistakes.\n\nThat practical bridge is what the speaking session and The Complete Athlete are designed to provide. Would a brief conversation be worthwhile?${footer}`
    },
    {
      message_type: 'follow_up',
      sequence_number: 2,
      subject: `Closing the loop — ${school.name}`,
      body: `Hi ${greeting},\n\nI wanted to close the loop on the student-athlete mental-performance session I mentioned. If confidence, focus, goal setting, and consistent habits are priorities you’re exploring at ${school.name}, I’d be glad to share the format in a 15-minute call.\n\nIf someone else oversees athlete-development programming, a referral would also be appreciated. Otherwise, I’ll leave it here.${footer}`
    }
  ];

  for (const message of messages) {
    const { error: messageError } = await supabase.from('outreach_messages').upsert({
      prospect_id: prospect.id,
      ...message,
      approval_status: 'draft',
      delivery_status: 'not_sent',
      model_version: 'human-authored-template',
      prompt_version: 'ga-schools-pilot-v1'
    }, { onConflict: 'prospect_id,message_type,sequence_number' });
    if (messageError) throw messageError;
    messageCount += 1;
  }

  const { error: prospectError } = await supabase
    .from('outreach_prospects')
    .update({
      status: 'draft_ready',
      status_reason: 'Three-message sequence drafted; requires human review and missing sender/bio inputs before approval'
    })
    .eq('id', prospect.id);
  if (prospectError) throw prospectError;
}

process.stdout.write(`${JSON.stringify({ prospects: prospects.length, drafts: messageCount, sent: 0 })}\n`);
