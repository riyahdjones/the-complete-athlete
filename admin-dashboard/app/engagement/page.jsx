import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAdminAuthed } from '../../lib/admin-auth';
import { getDashboardData } from '../../lib/dashboard-data';

export const dynamic = 'force-dynamic';

function Metric({ label, value, detail }) {
  return <article className="analytics-card"><span>{label}</span><strong>{value}</strong><em>{detail}</em></article>;
}

export default async function EngagementPage() {
  if (!(await isAdminAuthed())) redirect('/');
  const { analytics } = await getDashboardData();

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Core App</p>
          <h1>Engagement</h1>
          <span>Plans, productivity, goals, points, and parent connection.</span>
        </div>
        <Link className="ghost-link" href="/">Overview</Link>
      </header>

      <section className="dashboard-section">
        <div className="section-head">
          <p className="eyebrow">Performance Plans</p>
          <h2>Plan Engagement</h2>
          <p>See whether athletes are starting lessons, finishing lessons, and where attention drops.</p>
        </div>
        <div className="analytics-grid overview-grid">
          <Metric label="Plans Available" value={analytics.plansAvailable} detail="Released lessons in the library" />
          <Metric label="Lessons Completed" value={analytics.planLessonsCompleted} detail="Total lesson completions" />
          <Metric label="Plans Started" value={analytics.plansStarted} detail="Athlete-plan starts" />
          <Metric label="Completion Rate" value={`${analytics.planCompletionRate}%`} detail="All possible lesson completions" />
        </div>
        <div className="analytics-panels">
          <article className="analytics-panel">
            <div className="section-head"><h3>Most Completed Plans</h3><p>Content athletes are reaching most often.</p></div>
            <div className="table-card">
              {analytics.topPlans.length ? analytics.topPlans.map((plan) => (
                <div className="table-row" key={plan.title}><span>{plan.title}</span><strong>{plan.count}</strong></div>
              )) : <div className="empty-row">No plan completions yet.</div>}
            </div>
          </article>
          <article className="analytics-panel">
            <div className="section-head"><h3>Lesson Drop-Off</h3><p>Completion count by lesson.</p></div>
            <div className="table-card">
              {analytics.planDayCounts.slice(0, 12).map((day) => (
                <div className="table-row" key={`${day.title}-${day.label}`}><span>{day.label}: {day.title}</span><strong>{day.completed}</strong></div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="dashboard-section">
        <div className="section-head">
          <p className="eyebrow">Daily Work</p>
          <h2>Productivity, Goals, and Points</h2>
          <p>Whether athletes are doing the daily work that proves growth.</p>
        </div>
        <div className="analytics-grid overview-grid">
          <Metric label="Full Days Today" value={analytics.completedAllStandardsToday} detail="Athletes who locked a full productivity day" />
          <Metric label="Productivity Avg" value={`${analytics.averageStandardsPercent}%`} detail="Last 14 days locked" />
          <Metric label="Goals" value={analytics.goalsCreated} detail={`${analytics.goalsCompleted} completed`} />
          <Metric label="Active Items" value={analytics.activeStandards} detail="Current athlete productivity items" />
          <Metric label="Total Points" value={analytics.totalPoints} detail="All points earned" />
          <Metric label="Points Today" value={analytics.pointsToday} detail="Earned today" />
          <Metric label="Points This Week" value={analytics.points7Days} detail="Earned in 7 days" />
          <Metric label="Top Score" value={analytics.topScore} detail={`Average score ${analytics.averageScore}`} />
        </div>
      </section>

      <section className="dashboard-section">
        <div className="section-head">
          <p className="eyebrow">Parents</p>
          <h2>Parent Engagement</h2>
          <p>How connected parents are to athlete accounts.</p>
        </div>
        <div className="analytics-grid overview-grid">
          <Metric label="Linked Parents" value={analytics.parentLinks} detail={`${analytics.parentLinkRate}% link rate`} />
          <Metric label="Active Parents" value={analytics.activeParents7Days} detail="Activity signals this week" />
          <Metric label="Parent Accounts" value={analytics.parentCount} detail="Total parent users" />
        </div>
      </section>
    </main>
  );
}
