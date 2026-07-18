import Link from 'next/link';
import { redirect } from 'next/navigation';
import { deleteDailyDeposit, saveDailyDeposit } from '../actions';
import { isAdminAuthed } from '../../lib/admin-auth';
import { formatShortDate, todayKey } from '../../lib/dashboard-data';
import { supabaseAdmin } from '../../lib/supabase-admin';

export const dynamic = 'force-dynamic';

function DepositForm({ deposit }) {
  return (
    <form className="editor-card deposit-editor" action={saveDailyDeposit}>
      <input name="id" type="hidden" defaultValue={deposit?.id ?? ''} />
      <label>
        <span>Release date</span>
        <input name="releaseDate" type="date" defaultValue={deposit?.release_date ?? todayKey()} />
      </label>
      <label>
        <span>Status</span>
        <select name="status" defaultValue={deposit?.status ?? 'draft'}>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="posted">Published</option>
        </select>
      </label>
      <div className="editor-spacer" aria-hidden="true" />
      <label className="wide">
        <span>Daily Deposit</span>
        <textarea
          name="body"
          placeholder="Write the message athletes will read today."
          defaultValue={deposit?.body ?? ''}
        />
      </label>
      <label className="wide">
        <span>Today&apos;s Focus</span>
        <textarea
          name="focusQuestion"
          placeholder="Write the focus that pairs with this deposit."
          defaultValue={deposit?.focus_question ?? ''}
        />
      </label>
      <button type="submit">{deposit ? 'Save Deposit' : 'Create Deposit'}</button>
    </form>
  );
}

function DepositRow({ deposit, editable = false }) {
  const dateLabel = deposit.release_date ? formatShortDate(deposit.release_date) : 'No date';

  if (editable) {
    return (
      <details className="deposit-row editable-deposit-row" id={`edit-deposit-${deposit.id}`}>
        <summary className="deposit-row-main">
          <div>
            <span>{dateLabel}</span>
            <strong>{deposit.body || 'Untitled deposit'}</strong>
            {deposit.focus_question && <p>{deposit.focus_question}</p>}
          </div>
          <em>{deposit.status === 'posted' ? 'published' : deposit.status || 'draft'}</em>
          <b>Edit</b>
        </summary>
        <div className="deposit-edit-panel">
          <DepositForm deposit={deposit} />
          <form action={deleteDailyDeposit}>
            <input name="id" type="hidden" value={deposit.id} />
            <button className="danger-button" type="submit">Delete Deposit</button>
          </form>
        </div>
      </details>
    );
  }

  return (
    <article className="deposit-row">
      <div className="deposit-row-main">
        <div>
          <span>{dateLabel}</span>
          <strong>{deposit.body || 'Untitled deposit'}</strong>
          {deposit.focus_question && <p>{deposit.focus_question}</p>}
        </div>
        <em>{deposit.status === 'posted' ? 'published' : deposit.status || 'draft'}</em>
        <form action={deleteDailyDeposit}>
          <input name="id" type="hidden" value={deposit.id} />
          <button className="danger-button" type="submit">Delete</button>
        </form>
      </div>
    </article>
  );
}

function DepositQueueSummary({ deposits }) {
  const scheduledCount = deposits.filter((deposit) => deposit.status === 'scheduled').length;
  const draftCount = deposits.filter((deposit) => deposit.status === 'draft').length;
  const publishedCount = deposits.filter((deposit) => deposit.status === 'posted').length;
  const nextDeposit = deposits[0];

  return (
    <div className="deposit-queue-summary">
      <span>
        <strong>{deposits.length}</strong>
        Future deposits
      </span>
      <span>
        <strong>{scheduledCount}</strong>
        Scheduled
      </span>
      <span>
        <strong>{draftCount}</strong>
        Drafts
      </span>
      <span>
        <strong>{publishedCount}</strong>
        Published ahead
      </span>
      {nextDeposit && (
        <span className="wide">
          <strong>{formatShortDate(nextDeposit.release_date)}</strong>
          Next queued deposit
        </span>
      )}
    </div>
  );
}

export default async function DailyDepositsPage() {
  const authed = await isAdminAuthed();
  if (!authed) redirect('/');

  const today = todayKey();
  const supabase = supabaseAdmin();

  const [
    { data: recentDeposits = [], error: recentError },
    { data: futureDeposits = [], error: futureError }
  ] = await Promise.all([
    supabase
      .from('daily_deposits')
      .select('id, title, body, focus_question, release_date, status, created_at')
      .lte('release_date', today)
      .order('release_date', { ascending: false })
      .limit(30),
    supabase
      .from('daily_deposits')
      .select('id, title, body, focus_question, release_date, status, created_at')
      .gt('release_date', today)
      .order('release_date', { ascending: true })
      .limit(120)
  ]);

  const error = recentError || futureError;
  const latestDeposit = recentDeposits[0];

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Content</p>
          <h1>Daily Deposits</h1>
          <span>Update the daily message and the matching Today&apos;s Focus without managing a title.</span>
        </div>
        <Link className="ghost-link" href="/">Back to Dashboard</Link>
      </header>

      {error && (
        <section className="warning-panel">
          <strong>Daily deposits warning</strong>
          <p>{error.message}</p>
        </section>
      )}

      <section className="dashboard-section">
        <div className="section-head">
          <p className="eyebrow">Queue</p>
          <h2>Future Daily Deposits</h2>
          <p>Review what is already scheduled ahead so you can see the upcoming rhythm at a glance.</p>
        </div>
        {futureDeposits.length ? (
          <>
            <DepositQueueSummary deposits={futureDeposits} />
            <div className="deposit-list future-deposit-list">
              {futureDeposits.map((deposit) => <DepositRow editable key={deposit.id} deposit={deposit} />)}
            </div>
          </>
        ) : (
          <p className="empty-state">No future deposits are queued yet.</p>
        )}
      </section>

      <section className="dashboard-section">
        <div className="section-head">
          <p className="eyebrow">Create</p>
          <h2>Today&apos;s Deposit</h2>
          <p>Pick the date, write the deposit, add the focus, then publish when it is ready.</p>
        </div>
        <DepositForm />
      </section>

      {latestDeposit && (
        <section className="dashboard-section">
          <div className="section-head">
            <p className="eyebrow">Quick Edit</p>
            <h2>Latest Deposit</h2>
            <p>Use this when you want to adjust the newest entry without searching through history.</p>
          </div>
          <DepositForm deposit={latestDeposit} />
        </section>
      )}

      <section className="dashboard-section">
        <div className="section-head">
          <p className="eyebrow">History</p>
          <h2>Recent Deposits</h2>
          <p>The last 30 deposits are shown here for quick review.</p>
        </div>
        <div className="deposit-list">
          {recentDeposits.length ? recentDeposits.map((deposit) => <DepositRow key={deposit.id} deposit={deposit} />) : <p>No deposits yet.</p>}
        </div>
      </section>
    </main>
  );
}
