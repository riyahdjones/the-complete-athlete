import Link from 'next/link';
import { isAdminAuthed } from '../lib/admin-auth';
import { getDashboardData } from '../lib/dashboard-data';

export const dynamic = 'force-dynamic';

function LoginScreen() {
  return (
    <main className="login-shell">
      <section className="login-card">
        <p className="eyebrow">The Complete Athlete</p>
        <h1>Admin Dashboard</h1>
        <p>View app analytics, account details, usage, and system health.</p>
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

function MetricCard({ label, value, detail }) {
  return (
    <article className="analytics-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <em>{detail}</em>
    </article>
  );
}

function ActionCard({ href, label, title, detail }) {
  return (
    <Link className="admin-action-card" href={href}>
      <span>{label}</span>
      <strong>{title}</strong>
      <em>{detail}</em>
    </Link>
  );
}

export default async function Page() {
  const authed = await isAdminAuthed();
  if (!authed) return <LoginScreen />;

  const { analytics, errors } = await getDashboardData();

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">The Complete Athlete</p>
          <h1>App Dashboard</h1>
          <span>Simple overview first. Deeper details only when you ask for them.</span>
        </div>
        <form action="/logout" method="post">
          <button className="ghost-button" type="submit">Log out</button>
        </form>
      </header>

      {errors.length > 0 && (
        <section className="warning-panel">
          <strong>Dashboard warning</strong>
          <p>{errors[0].message}</p>
        </section>
      )}

      <section className="studio-hero" aria-label="Admin overview">
        <div>
          <span>Live overview</span>
          <h2>{analytics.totalUsers} accounts</h2>
          <p>Track user growth, engagement, AI coach usage, points, parent links, safety, and app health without crowding the screen.</p>
        </div>
        <strong>{analytics.activeAthletes7Days} active this week</strong>
      </section>

      <section className="dashboard-section">
        <div className="section-head">
          <p className="eyebrow">Snapshot</p>
          <h2>Most Important Numbers</h2>
          <p>The quick read on whether the app is healthy and being used.</p>
        </div>
        <div className="analytics-grid overview-grid">
          <MetricCard label="Athletes" value={analytics.athleteCount} detail={`${analytics.newUsers7Days} new users this week`} />
          <MetricCard label="Parents" value={analytics.parentCount} detail={`${analytics.parentLinks} linked accounts`} />
          <MetricCard label="AI Coach" value={analytics.coachMessagesToday} detail={`${analytics.coachMessages7Days} messages this week`} />
          <MetricCard label="Plans" value={analytics.planLessonsCompleted} detail={`${analytics.planCompletionRate}% lesson completion rate`} />
          <MetricCard label="Productivity" value={analytics.completedAllStandardsToday} detail="locked full productivity day" />
          <MetricCard label="Score" value={analytics.totalPoints} detail={`${analytics.points7Days} points earned this week`} />
          <MetricCard label="Safety" value={analytics.safetyEvents.length} detail="recent safety signals" />
          <MetricCard label="System" value={analytics.monitoredIssues7Days} detail="issues in the last 7 days" />
        </div>
      </section>

      <section className="dashboard-section">
        <div className="section-head">
          <p className="eyebrow">Drill In</p>
          <h2>Open What You Need</h2>
          <p>Each page keeps one job in front of you so the dashboard does not become a data wall.</p>
        </div>
        <div className="admin-action-grid">
          <ActionCard href="/deposits" label="Content" title="Daily Deposits" detail="Write the daily message and matching Today's Focus." />
          <ActionCard href="/users" label="Accounts" title="Users" detail="Names, emails, roles, joined dates, last active, account IDs." />
          <ActionCard href="/engagement" label="Core App" title="Engagement" detail="Plans, productivity, goals, points, and parent engagement." />
          <ActionCard href="/coach" label="AI + Safety" title="Coach Usage" detail="AI messages, daily limit pressure, safety signals, and recent coach issues." />
          <ActionCard href="/system" label="Backend" title="System Health" detail="Operational logs, errors, critical events, and account actions." />
        </div>
      </section>
    </main>
  );
}
