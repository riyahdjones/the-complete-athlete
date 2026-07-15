'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isAdminAuthed } from '../lib/admin-auth';
import { supabaseAdmin } from '../lib/supabase-admin';

function text(formData, key) {
  return String(formData.get(key) ?? '').trim();
}

function requireTitle(value) {
  if (!value) throw new Error('Title is required.');
  return value;
}

async function requireAdmin() {
  if (!(await isAdminAuthed())) redirect('/');
}

export async function saveDailyDeposit(formData) {
  await requireAdmin();
  const supabase = supabaseAdmin();
  const id = text(formData, 'id');
  const body = text(formData, 'body');
  const focusQuestion = text(formData, 'focusQuestion');
  const releaseDate = text(formData, 'releaseDate') || new Date().toISOString().slice(0, 10);
  const title = text(formData, 'title');
  const status = text(formData, 'status') || 'draft';

  const payload = {
    title,
    body,
    focus_question: focusQuestion,
    release_date: releaseDate,
    status
  };

  const query = id
    ? supabase.from('daily_deposits').update(payload).eq('id', id)
    : supabase.from('daily_deposits').insert(payload);

  const { error } = await query;
  if (error) throw new Error(error.message);

  revalidatePath('/');
  revalidatePath('/deposits');
}

export async function deleteDailyDeposit(formData) {
  await requireAdmin();
  const id = text(formData, 'id');
  if (!id) return;

  const { error } = await supabaseAdmin().from('daily_deposits').delete().eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath('/');
  revalidatePath('/deposits');
}

export async function savePerformancePlan(formData) {
  await requireAdmin();
  const supabase = supabaseAdmin();
  const id = text(formData, 'id');
  const title = requireTitle(text(formData, 'title'));
  const subject = text(formData, 'subject');
  const releaseDate = text(formData, 'releaseDate') || new Date().toISOString().slice(0, 10);
  const challengeDay = text(formData, 'challengeDay');
  const challengeLength = Number(text(formData, 'challengeLength')) || 7;

  const episodeSections = [
    ['Opening', text(formData, 'opening')],
    ['The Lesson', text(formData, 'lesson')],
    ['The Greats', text(formData, 'greats')],
    ['The Shift', text(formData, 'shift')],
    ['Train Today', text(formData, 'trainToday')],
    ['Film Room', text(formData, 'filmRoom')],
    ["Coach's Corner", text(formData, 'coachCorner')],
    ['Complete Athlete Principle', text(formData, 'principle')],
    ['Next Episode', text(formData, 'nextEpisode')]
  ]
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`);

  const legacySteps = text(formData, 'steps')
    .split('\n')
    .map((step) => step.trim())
    .filter(Boolean);
  const steps = episodeSections.length ? episodeSections : legacySteps;

  const payload = {
    title,
    subject,
    steps,
    release_date: releaseDate,
    challenge_day: challengeDay,
    challenge_length: challengeLength
  };

  const query = id
    ? supabase.from('performance_plans').update(payload).eq('id', id)
    : supabase.from('performance_plans').insert(payload);

  const { error } = await query;
  if (error) throw new Error(error.message);

  revalidatePath('/');
}

export async function deletePerformancePlan(formData) {
  await requireAdmin();
  const id = text(formData, 'id');
  if (!id) return;

  const { error } = await supabaseAdmin().from('performance_plans').delete().eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath('/');
}

export async function saveParentMessage(formData) {
  await requireAdmin();
  const status = text(formData, 'status') || 'draft';
  const payload = {
    id: 'active',
    title: text(formData, 'title'),
    body: text(formData, 'body'),
    conversation_cue: text(formData, 'conversationCue'),
    avoid: text(formData, 'avoid'),
    send_date: text(formData, 'sendDate') || new Date().toISOString().slice(0, 10),
    status
  };

  const { error } = await supabaseAdmin().from('parent_messages').upsert(payload);
  if (error) throw new Error(error.message);

  revalidatePath('/');
}
