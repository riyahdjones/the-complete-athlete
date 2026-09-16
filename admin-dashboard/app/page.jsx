import { isAdminAuthed } from '../lib/admin-auth';
import { getDashboardData } from '../lib/dashboard-data';
import AdminShell from './components/AdminShell';
import { ActivityFeed, ActivityHeatmap, AnalyticsChart, FeatureAdoption, Funnel, MetricCard, SectionHeader, StatusIndicator } from './components/DashboardWidgets';

export const dynamic = 'force-dynamic';

function LoginScreen() {
  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-brand"><span>CA</span><div><strong>The Complete Athlete</strong><em>Performance Intelligence</em></div></div>
        <p className="eyebrow">Secure command access</p>
        <h1>Command Center</h1>
        <p>Private operational intelligence for platform growth, athlete engagement, AI systems, and safety.</p>
        <form action="/login" method="post">
          <label><span>Dashboard password</span><input name="password" type="password" placeholder="Enter private password" autoComplete="current-password" /></label>
          <button type="submit">Enter Command Center</button>
        </form>
      </section>
    </main>
  );
}

function IntelligencePanel({ className = '', children }) {
  return <section className={`intelligence-panel ${className}`}>{children}</section>;
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Number(value || 0));
}

export default async function Page() {
  if (!(await isAdminAuthed())) return <LoginScreen />;
  const { analytics, errors } = await getDashboardData();
  const growthValues = analytics.userGrowth.map((point) => point.total);
  const newUserValues = analytics.userGrowth.slice(-14).map((point) => point.newUsers);
  const activityValues = analytics.dailyActivity.map((point) => point.total);
  const funnelStages = [
    { label: 'Signups', value: analytics.signups7Days },
    { label: 'Onboarding Complete', value: analytics.onboardingCompletions7Days },
    { label: 'Trial Started', value: analytics.trialStarts7Days },
    { label: 'Paid Purchase', value: analytics.purchases7Days }
  ];

  return (
    <AdminShell eyebrow="The Complete Athlete" title="Command Center" description="Performance intelligence across growth, product engagement, athlete development, AI systems, and platform health.">
      {errors.length > 0 && <section className="warning-panel"><strong>Telemetry warning</strong><p>{errors[0].message}</p></section>}

      <section className="executive-section">
        <SectionHeader eyebrow="01 / Platform Scale" title="Executive Overview" description="The fastest read on company scale, weekly adoption, and product activity." action="Live production data" />
        <div className="executive-grid">
          <MetricCard label="Total Accounts" value={formatNumber(analytics.totalUsers)} detail={`${analytics.newUsers7Days} new / 7 days`} values={growthValues} />
          <MetricCard label="Active Users" value={formatNumber(analytics.activeEventUsers7Days)} detail="Unique event users / 7 days" values={activityValues} tone="cyan" />
          <MetricCard label="Athletes" value={formatNumber(analytics.athleteCount)} detail={`${analytics.activeAthletes7Days} active / 7 days`} values={analytics.userGrowth.map((point) => point.athletes)} />
          <MetricCard label="Parents" value={formatNumber(analytics.parentCount)} detail={`${analytics.parentLinks} linked accounts`} values={analytics.userGrowth.map((point) => point.parents)} tone="cyan" />
          <MetricCard label="Trial Starts" value={formatNumber(analytics.trialStarts7Days)} detail="Tracked starts / 7 days" values={newUserValues} tone="green" />
          <MetricCard label="Purchases" value={formatNumber(analytics.purchases7Days)} detail="Purchases + restores / 7 days" tone="green" />
          <MetricCard label="Weekly App Opens" value={analytics.appOpens7Days || '—'} detail={analytics.appOpens7Days ? 'Tracked opens / 7 days' : 'Explicit open event unavailable'} />
          <MetricCard label="AI Coach Messages" value={formatNumber(analytics.coachMessages7Days)} detail={`${analytics.coachUniqueUsers7Days} unique athletes / 7 days`} values={activityValues} tone="cyan" />
        </div>
      </section>

      <section className="command-grid growth-layout">
        <IntelligencePanel className="wide-panel">
          <SectionHeader eyebrow="02 / Growth Intelligence" title="User Growth" description="Cumulative account growth across athletes and parents over the last 30 days." action="30-day observed history" />
          <AnalyticsChart data={analytics.userGrowth} />
        </IntelligencePanel>
        <IntelligencePanel>
          <SectionHeader eyebrow="Acquisition" title="Conversion Funnel" description="Tracked acquisition events during the current seven-day window." />
          <Funnel stages={funnelStages} />
          <p className="data-note">Conversion reflects recorded events. Retention and churn are unavailable with the current event model.</p>
        </IntelligencePanel>
      </section>

      <section className="intelligence-section">
        <SectionHeader eyebrow="03 / Product Signal" title="Engagement Intelligence" description="Are athletes returning, taking action, and completing meaningful work?" action={`DAU / MAU ${analytics.dauMauRatio == null ? 'N/A' : `${analytics.dauMauRatio}%`}`} />
        <div className="signal-strip">
          <div><span>DAU</span><strong>{analytics.dailyActiveUsers}</strong><em>unique today</em></div>
          <div><span>WAU</span><strong>{analytics.activeEventUsers7Days}</strong><em>unique / 7d</em></div>
          <div><span>MAU</span><strong>{analytics.monthlyActiveUsers}</strong><em>unique / 30d</em></div>
          <div><span>EVENTS</span><strong>{analytics.appEvents7Days}</strong><em>recorded / 7d</em></div>
          <div><span>GOALS</span><strong>{analytics.goalsAdded7Days}</strong><em>created / 7d</em></div>
          <div><span>LESSONS</span><strong>{analytics.planLessonsCompleted}</strong><em>all-time recorded</em></div>
        </div>
        <div className="command-grid engagement-layout">
          <IntelligencePanel><SectionHeader eyebrow="Utilization" title="Feature Adoption" description="Share of athlete accounts with an observed usage signal." /><FeatureAdoption features={analytics.featureAdoption} /></IntelligencePanel>
          <IntelligencePanel><SectionHeader eyebrow="30-Day Telemetry" title="Activity Rhythm" description="Anonymized app events by UTC day and hour." /><ActivityHeatmap cells={analytics.activityHeatmap} /></IntelligencePanel>
        </div>
      </section>

      <section className="command-grid ai-layout">
        <IntelligencePanel className="ai-panel">
          <SectionHeader eyebrow="04 / AI System" title="AI Coach Intelligence" description="Observed usage and reliability signals without exposing conversation content." action="Private by design" />
          <div className="ai-core">
            <div className="ai-orbit"><span>AI</span><i /><i /><i /></div>
            <div className="ai-stats">
              <div><span>Total messages</span><strong>{formatNumber(analytics.coachMessagesAllTime)}</strong></div>
              <div><span>Messages this week</span><strong>{formatNumber(analytics.coachMessages7Days)}</strong></div>
              <div><span>Unique athletes</span><strong>{analytics.coachUniqueUsers7Days}</strong></div>
              <div><span>Messages / user</span><strong>{analytics.coachMessagesPerUser ?? '—'}</strong></div>
              <div><span>Repeat users</span><strong>{analytics.coachRepeatUsers}</strong></div>
              <div><span>Reply issues</span><strong>{analytics.coachReplyFailures7Days}</strong></div>
            </div>
          </div>
        </IntelligencePanel>
        <IntelligencePanel><SectionHeader eyebrow="Live Telemetry" title="Recent Activity" description="Anonymized product actions across the athlete experience." /><ActivityFeed items={analytics.recentActivity} /></IntelligencePanel>
      </section>

      <section className="command-grid performance-layout" id="plans">
        <IntelligencePanel className="wide-panel">
          <SectionHeader eyebrow="05 / Content Performance" title="Performance Plan Intelligence" description="Observed starts, completions, and lesson momentum across the plan library." />
          <div className="plan-kpis">
            <div><span>Plan starts</span><strong>{analytics.plansStarted}</strong></div><div><span>Plans completed</span><strong>{analytics.plansCompleted}</strong></div><div><span>Lesson completions</span><strong>{analytics.planLessonsCompleted}</strong></div><div><span>Library lessons</span><strong>{analytics.plansAvailable}</strong></div>
          </div>
          <div className="ranking-table">
            <div className="ranking-head"><span>Plan series</span><span>Started</span><span>Completed</span><span>Lessons</span><span>Completion</span></div>
            {analytics.planSeriesStats.slice(0, 8).map((plan, index) => <div className="ranking-row" key={plan.title}><b>{String(index + 1).padStart(2, '0')}</b><strong>{plan.title}</strong><span>{plan.started}</span><span>{plan.completed}</span><span>{plan.lessonsCompleted}</span><em>{plan.completionRate == null ? '—' : `${plan.completionRate}%`}</em></div>)}
          </div>
        </IntelligencePanel>
        <IntelligencePanel>
          <SectionHeader eyebrow="Network Effect" title="Athlete Ecosystem" description="The connection layer between athletes and supporting parents." />
          <div className="ecosystem-visual"><div className="ecosystem-node athlete-node"><span>{analytics.athleteCount}</span><em>Athletes</em></div><div className="ecosystem-links"><i /><i /><i /><b>{analytics.parentLinks} links</b></div><div className="ecosystem-node parent-node"><span>{analytics.parentCount}</span><em>Parents</em></div></div>
          <div className="ecosystem-stats"><span><strong>{analytics.parentLinkRate}%</strong> athlete link rate</span><span><strong>{analytics.unlinkedAthletes}</strong> unlinked athletes</span></div>
        </IntelligencePanel>
      </section>

      <section className="command-grid health-layout">
        <IntelligencePanel className="health-panel">
          <SectionHeader eyebrow="06 / Infrastructure" title="Platform Health" description="Statuses derived from live dashboard queries and recorded operational events." action={`Last sync ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`} />
          <div className="health-list">{analytics.systemStatus.map((item) => <StatusIndicator key={item.label} {...item} />)}</div>
          <div className="health-foot"><span><strong>{analytics.monitoredIssues7Days}</strong> errors / 7d</span><span><strong>{analytics.purchaseIssues7Days}</strong> purchase issues</span><span><strong>{analytics.recentEvents.length}</strong> recent events</span></div>
        </IntelligencePanel>
        <IntelligencePanel className={analytics.safetyEvents.length ? 'safety-panel warning' : 'safety-panel'}>
          <SectionHeader eyebrow="Athlete Infrastructure" title="Safety Status" description="High-priority signals requiring human awareness." />
          <div className="safety-status"><span>{analytics.safetyEvents.length}</span><strong>Active signals</strong><em>{analytics.safetyEvents.length ? 'Review required' : 'All systems normal'}</em></div>
          <div className="safety-rings"><i /><i /><i /></div>
        </IntelligencePanel>
      </section>
    </AdminShell>
  );
}
