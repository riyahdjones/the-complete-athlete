import { isAdminAuthed } from '../lib/admin-auth';
import { supabaseAdmin } from '../lib/supabase-admin';
import {
  deleteDailyDeposit,
  deletePerformancePlan,
  saveDailyDeposit,
  saveParentMessage,
  savePerformancePlan
} from './actions';

export const dynamic = 'force-dynamic';

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function getDashboardData() {
  const supabase = supabaseAdmin();
  const [deposits, plans, parentMessage, profiles, parentLinks] = await Promise.all([
    supabase.from('daily_deposits').select('*').order('release_date', { ascending: false }).limit(20),
    supabase.from('performance_plans').select('*').order('release_date', { ascending: true }).limit(30),
    supabase.from('parent_messages').select('*').eq('id', 'active').maybeSingle(),
    supabase.from('profiles').select('id, role, full_name, created_at').order('created_at', { ascending: false }).limit(50),
    supabase.from('parent_links').select('parent_user_id, athlete_user_id, created_at').order('created_at', { ascending: false }).limit(50)
  ]);

  return {
    deposits: deposits.data ?? [],
    plans: plans.data ?? [],
    parentMessage: parentMessage.data,
    profiles: profiles.data ?? [],
    parentLinks: parentLinks.data ?? [],
    errors: [deposits.error, plans.error, parentMessage.error, profiles.error, parentLinks.error].filter(Boolean)
  };
}

function LoginScreen() {
  return (
    <main className="login-shell">
      <section className="login-card">
        <p className="eyebrow">The Complete Athlete</p>
        <h1>Admin Dashboard</h1>
        <p>Manage Daily Deposits, Performance Plans, Parent Corner messages, and user access.</p>
        <form action="/login" method="post">
          <label>
            <span>Dashboard password</span>
            <input name="password" type="password" placeholder="Enter private password" />
          </label>
          <button type="submit">Log In</button>
        </form>
      </section>
    </main>
  );
}

function StatCard({ label, value, detail }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <em>{detail}</em>
    </article>
  );
}

function DepositForm({ deposit }) {
  return (
    <form className="editor-card" action={saveDailyDeposit}>
      <input name="id" type="hidden" defaultValue={deposit?.id ?? ''} />
      <label>
        <span>Title</span>
        <input name="title" defaultValue={deposit?.title ?? ''} placeholder="Daily Deposit title" required />
      </label>
      <label>
        <span>Release date</span>
        <input name="releaseDate" type="date" defaultValue={deposit?.release_date ?? todayKey()} />
      </label>
      <label>
        <span>Status</span>
        <select name="status" defaultValue={deposit?.status ?? 'draft'}>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="posted">Posted</option>
        </select>
      </label>
      <label className="wide">
        <span>Message</span>
        <textarea name="body" defaultValue={deposit?.body ?? ''} placeholder="Write the lesson athletes receive." />
      </label>
      <button type="submit">{deposit ? 'Save Deposit' : 'Create Deposit'}</button>
    </form>
  );
}

function PlanForm({ plan }) {
  return (
    <form className="editor-card" action={savePerformancePlan}>
      <input name="id" type="hidden" defaultValue={plan?.id ?? ''} />
      <label>
        <span>Title</span>
        <input name="title" defaultValue={plan?.title ?? ''} placeholder="Performance Plan title" required />
      </label>
      <label>
        <span>Release date</span>
        <input name="releaseDate" type="date" defaultValue={plan?.release_date ?? todayKey()} />
      </label>
      <label>
        <span>Challenge day</span>
        <input name="challengeDay" defaultValue={plan?.challenge_day ?? 'Day 1'} placeholder="Day 1" />
      </label>
      <label>
        <span>Length</span>
        <select name="challengeLength" defaultValue={plan?.challenge_length ?? 7}>
          <option value="3">3 days</option>
          <option value="7">7 days</option>
        </select>
      </label>
      <label className="wide">
        <span>Subject</span>
        <textarea name="subject" defaultValue={plan?.subject ?? ''} placeholder="Main message athletes read." />
      </label>
      <label className="wide">
        <span>Steps</span>
        <textarea name="steps" defaultValue={(plan?.steps ?? []).join('\n')} placeholder="One step per line." />
      </label>
      <button type="submit">{plan ? 'Save Plan' : 'Create Plan'}</button>
    </form>
  );
}

function ParentMessageForm({ message }) {
  return (
    <form className="editor-card" action={saveParentMessage}>
      <label>
        <span>Title</span>
        <input name="title" defaultValue={message?.title ?? ''} placeholder="Parent Corner title" />
      </label>
      <label>
        <span>Send date</span>
        <input name="sendDate" type="date" defaultValue={message?.send_date ?? todayKey()} />
      </label>
      <label>
        <span>Status</span>
        <select name="status" defaultValue={message?.status ?? 'draft'}>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="sent">Sent</option>
        </select>
      </label>
      <label className="wide">
        <span>Message</span>
        <textarea name="body" defaultValue={message?.body ?? ''} />
      </label>
      <label className="wide">
        <span>Conversation cue</span>
        <input name="conversationCue" defaultValue={message?.conversation_cue ?? ''} />
      </label>
      <label className="wide">
        <span>Avoid saying</span>
        <input name="avoid" defaultValue={message?.avoid ?? ''} />
      </label>
      <button type="submit">Save Parent Message</button>
    </form>
  );
}

export default async function Page() {
  const authed = await isAdminAuthed();
  if (!authed) return <LoginScreen />;

  const { deposits, plans, parentMessage, profiles, parentLinks, errors } = await getDashboardData();
  const postedDeposits = deposits.filter((deposit) => deposit.status === 'posted').length;
  const scheduledPlans = plans.filter((plan) => plan.release_date > todayKey()).length;

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">The Complete Athlete</p>
          <h1>Admin Dashboard</h1>
          <span>Private control panel for scheduled content and access.</span>
        </div>
        <form action="/logout" method="post">
          <button className="ghost-button" type="submit">Log out</button>
        </form>
      </header>

      {errors.length > 0 && (
        <section className="warning-panel">
          <strong>Supabase warning</strong>
          <p>{errors[0].message}</p>
        </section>
      )}

      <section className="stat-grid">
        <StatCard label="Daily Deposits" value={deposits.length} detail={`${postedDeposits} posted`} />
        <StatCard label="Performance Plans" value={plans.length} detail={`${scheduledPlans} scheduled`} />
        <StatCard label="Users" value={profiles.length} detail="Recent accounts" />
        <StatCard label="Parent Links" value={parentLinks.length} detail="Recent links" />
      </section>

      <section className="dashboard-section">
        <div className="section-head">
          <h2>Daily Deposits</h2>
          <p>Create and schedule lessons athletes receive in the app.</p>
        </div>
        <DepositForm />
        <div className="list-grid">
          {deposits.map((deposit) => (
            <article className="content-row" key={deposit.id}>
              <DepositForm deposit={deposit} />
              <form action={deleteDailyDeposit}>
                <input name="id" type="hidden" defaultValue={deposit.id} />
                <button className="danger-button" type="submit">Delete Deposit</button>
              </form>
            </article>
          ))}
        </div>
      </section>

      <section className="dashboard-section">
        <div className="section-head">
          <h2>Performance Plans</h2>
          <p>Preload 3-day or 7-day plan content months ahead.</p>
        </div>
        <PlanForm />
        <div className="list-grid">
          {plans.map((plan) => (
            <article className="content-row" key={plan.id}>
              <PlanForm plan={plan} />
              <form action={deletePerformancePlan}>
                <input name="id" type="hidden" defaultValue={plan.id} />
                <button className="danger-button" type="submit">Delete Plan</button>
              </form>
            </article>
          ))}
        </div>
      </section>

      <section className="dashboard-section">
        <div className="section-head">
          <h2>Parent Corner</h2>
          <p>Control the message parents see inside their dashboard.</p>
        </div>
        <ParentMessageForm message={parentMessage} />
      </section>

      <section className="dashboard-section two-column">
        <div>
          <div className="section-head">
            <h2>Recent Users</h2>
            <p>Accounts created in Supabase.</p>
          </div>
          <div className="table-card">
            {profiles.map((profile) => (
              <div className="table-row" key={profile.id}>
                <span>{profile.full_name || 'Unnamed'}</span>
                <strong>{profile.role}</strong>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="section-head">
            <h2>Parent Links</h2>
            <p>Recent parent-athlete account links.</p>
          </div>
          <div className="table-card">
            {parentLinks.map((link) => (
              <div className="table-row" key={`${link.parent_user_id}-${link.athlete_user_id}`}>
                <span>{link.parent_user_id.slice(0, 8)}...</span>
                <strong>{link.athlete_user_id.slice(0, 8)}...</strong>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
