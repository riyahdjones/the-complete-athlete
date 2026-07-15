import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAdminAuthed } from '../../lib/admin-auth';
import { getDashboardData } from '../../lib/dashboard-data';

export const dynamic = 'force-dynamic';

function Metric({ label, value, detail }) {
  return <article className="analytics-card"><span>{label}</span><strong>{value}</strong><em>{detail}</em></article>;
}

export default async function CoachPage() {
  if (!(await isAdminAuthed())) redirect('/');
  const { analytics } = await getDashboardData();
  const coachEvents = analytics.recentEvents.filter((event) => event.area === 'coach' || event.event_type.includes('coach')).slice(0, 20);

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">AI + Safety</p>
          <h1>Coach Usage</h1>
          <span>AI coach volume, daily limit pressure, safety signals, and private operational events.</span>
        </div>
        <Link className="ghost-link" href="/">Overview</Link>
      </header>

      <section className="dashboard-section">
        <div className="section-head">
          <p className="eyebrow">AI Coach</p>
          <h2>Usage</h2>
          <p>Message content is not shown here. This tracks volume and health.</p>
        </div>
        <div className="analytics-grid overview-grid">
          <Metric label="Messages Today" value={analytics.coachMessagesToday} detail="AI coach requests today" />
          <Metric label="Messages This Week" value={analytics.coachMessages7Days} detail="Last 7 days" />
          <Metric label="Daily Limit Hits" value={analytics.coachLimitHits} detail="Athletes at 15 messages today" />
          <Metric label="Coach Issues" value={coachEvents.length} detail="Recent coach events" />
        </div>
      </section>

      <section className="dashboard-section">
        <div className="section-head">
          <p className="eyebrow">Safety</p>
          <h2>Safety Signals</h2>
          <p>High-priority coach and app signals that may need human attention.</p>
        </div>
        <div className="table-card event-table">
          {analytics.safetyEvents.length ? analytics.safetyEvents.map((event) => (
            <div className={`table-row event-row ${event.severity}`} key={event.id}>
              <span><b>{event.area}</b>{event.event_type.replaceAll('_', ' ')}</span>
              <strong>{event.severity}</strong>
              <em>{new Date(event.created_at).toLocaleString()}</em>
            </div>
          )) : <div className="empty-row">No safety signals recorded.</div>}
        </div>
      </section>

      <section className="dashboard-section">
        <div className="section-head">
          <p className="eyebrow">Recent</p>
          <h2>Coach Events</h2>
          <p>Backend events related to coach access, limits, moderation, and errors.</p>
        </div>
        <div className="table-card event-table">
          {coachEvents.length ? coachEvents.map((event) => (
            <div className={`table-row event-row ${event.severity}`} key={event.id}>
              <span><b>{event.area}</b>{event.event_type.replaceAll('_', ' ')}</span>
              <strong>{event.severity}</strong>
              <em>{new Date(event.created_at).toLocaleString()}</em>
            </div>
          )) : <div className="empty-row">No coach events recorded.</div>}
        </div>
      </section>
    </main>
  );
}
