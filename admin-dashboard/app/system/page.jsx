import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAdminAuthed } from '../../lib/admin-auth';
import { getDashboardData } from '../../lib/dashboard-data';

export const dynamic = 'force-dynamic';

function Metric({ label, value, detail }) {
  return <article className="analytics-card"><span>{label}</span><strong>{value}</strong><em>{detail}</em></article>;
}

export default async function SystemPage() {
  if (!(await isAdminAuthed())) redirect('/');
  const { analytics, errors } = await getDashboardData();
  const errorEvents = analytics.recentEvents.filter((event) => ['error', 'critical'].includes(event.severity));

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Backend</p>
          <h1>System Health</h1>
          <span>Operational logs, account events, backend warnings, and app health.</span>
        </div>
        <Link className="ghost-link" href="/">Overview</Link>
      </header>

      {errors.length > 0 && (
        <section className="warning-panel">
          <strong>Dashboard warning</strong>
          <p>{errors[0].message}</p>
        </section>
      )}

      <section className="dashboard-section">
        <div className="section-head">
          <p className="eyebrow">Health</p>
          <h2>Issue Snapshot</h2>
          <p>Signals that help you know whether the backend needs attention.</p>
        </div>
        <div className="analytics-grid overview-grid">
          <Metric label="Issues 7 Days" value={analytics.monitoredIssues7Days} detail="Errors and critical events" />
          <Metric label="Recent Errors" value={errorEvents.length} detail="In latest event log" />
          <Metric label="Safety Signals" value={analytics.safetyEvents.length} detail="Recent high-priority signals" />
          <Metric label="Events Logged" value={analytics.recentEvents.length} detail="Latest app events" />
        </div>
      </section>

      <section className="dashboard-section">
        <div className="section-head">
          <p className="eyebrow">Logs</p>
          <h2>Recent System Events</h2>
          <p>Private operational events. Message content and journal text are not shown here.</p>
        </div>
        <div className="table-card event-table">
          {analytics.recentEvents.length ? analytics.recentEvents.map((event) => (
            <div className={`table-row event-row ${event.severity}`} key={event.id}>
              <span><b>{event.area}</b>{event.event_type.replaceAll('_', ' ')}</span>
              <strong>{event.severity}</strong>
              <em>{new Date(event.created_at).toLocaleString()}</em>
            </div>
          )) : <div className="empty-row">No system events recorded yet.</div>}
        </div>
      </section>
    </main>
  );
}
