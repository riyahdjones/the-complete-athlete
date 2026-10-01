import Link from 'next/link';
import { redirect } from 'next/navigation';
import { deleteDailyDeposit, saveDailyDeposit } from '../actions';
import { isAdminAuthed } from '../../lib/admin-auth';
import { formatShortDate, todayKey } from '../../lib/dashboard-data';
import { supabaseAdmin } from '../../lib/supabase-admin';
import AdminShell from '../components/AdminShell';

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

function DepositQueueSummary({ deposits, totalCount }) {
  const scheduledCount = deposits.filter((deposit) => deposit.status === 'scheduled').length;
  const draftCount = deposits.filter((deposit) => deposit.status === 'draft').length;
  const publishedCount = deposits.filter((deposit) => deposit.status === 'posted').length;
  const nextDeposit = deposits[0];
  const queueCount = totalCount ?? deposits.length;

  return (
    <div className="deposit-queue-summary">
      <span>
        <strong>{queueCount}</strong>
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

export default async function DailyDepositsPage({ searchParams }) {
  const authed = await isAdminAuthed();
  if (!authed) redirect('/');

  const params = await searchParams;
  const activeView = params?.view === 'past' ? 'past' : 'scheduled';
  const today = todayKey();
  const supabase = supabaseAdmin();

  const [
    { data: pastDeposits = [], error: pastError, count: pastDepositCount },
    { data: futureDeposits = [], error: futureError, count: futureDepositCount }
  ] = await Promise.all([
    supabase
      .from('daily_deposits')
      .select('id, title, body, focus_question, release_date, status, created_at', { count: 'exact' })
      .lte('release_date', today)
      .order('release_date', { ascending: false })
      .range(0, 999),
    supabase
      .from('daily_deposits')
      .select('id, title, body, focus_question, release_date, status, created_at', { count: 'exact' })
      .gt('release_date', today)
      .order('release_date', { ascending: true })
      .range(0, 999)
  ]);

  const error = pastError || futureError;
  return (
    <AdminShell eyebrow="Content Operations" title="Daily Deposits" description="Create, schedule, publish, and review the daily message delivered to athletes.">

      {error && (
        <section className="warning-panel">
          <strong>Daily deposits warning</strong>
          <p>{error.message}</p>
        </section>
      )}

      <nav className="deposit-view-tabs" aria-label="Daily Deposit views">
        <Link className={activeView === 'scheduled' ? 'active' : ''} href="/deposits?view=scheduled">
          <span>Scheduled Deposits</span>
          <strong>{futureDepositCount ?? futureDeposits.length}</strong>
        </Link>
        <Link className={activeView === 'past' ? 'active' : ''} href="/deposits?view=past">
          <span>Past Deposits</span>
          <strong>{pastDepositCount ?? pastDeposits.length}</strong>
        </Link>
      </nav>

      {activeView === 'scheduled' ? (
        <>
          <section className="dashboard-section">
            <div className="section-head">
              <p className="eyebrow">Create</p>
              <h2>Create a Daily Deposit</h2>
              <p>Pick the date, write the deposit, add the focus, then schedule or publish it.</p>
            </div>
            <DepositForm />
          </section>
          <section className="dashboard-section">
            <div className="section-head">
              <p className="eyebrow">Queue</p>
              <h2>Scheduled Deposits</h2>
              <p>Review and edit every deposit scheduled for a future date.</p>
            </div>
            {futureDeposits.length ? (
              <>
                <DepositQueueSummary deposits={futureDeposits} totalCount={futureDepositCount} />
                <div className="deposit-list future-deposit-list">
                  {futureDeposits.map((deposit) => <DepositRow editable key={deposit.id} deposit={deposit} />)}
                </div>
                {futureDepositCount > futureDeposits.length && (
                  <p className="empty-row">Showing the first {futureDeposits.length} scheduled deposits. More are queued in the database.</p>
                )}
              </>
            ) : (
              <p className="empty-state">No future deposits are scheduled yet.</p>
            )}
          </section>
        </>
      ) : (
        <section className="dashboard-section" id="past-deposits">
          <div className="section-head">
            <p className="eyebrow">Archive</p>
            <h2>Past Deposits</h2>
            <p>View and edit every deposit released through today. Select any entry to open its editor.</p>
          </div>
          <div className="deposit-list">
            {pastDeposits.length ? pastDeposits.map((deposit) => <DepositRow editable key={deposit.id} deposit={deposit} />) : <p>No past deposits yet.</p>}
          </div>
          {pastDepositCount > pastDeposits.length && (
            <p className="empty-row">Showing the newest {pastDeposits.length} of {pastDepositCount} past deposits.</p>
          )}
        </section>
      )}
    </AdminShell>
  );
}
