import { redirect } from 'next/navigation';
import { deleteUserAccount } from '../actions';
import { isAdminAuthed } from '../../lib/admin-auth';
import { getDashboardData } from '../../lib/dashboard-data';
import AdminShell from '../components/AdminShell';

export const dynamic = 'force-dynamic';

export default async function UsersPage({ searchParams }) {
  if (!(await isAdminAuthed())) redirect('/');
  const { profiles, parentLinks, analytics } = await getDashboardData();
  const params = await searchParams;
  const selectedRole = params?.role === 'parent' || params?.role === 'athlete' ? params.role : '';
  const visibleProfiles = selectedRole ? profiles.filter((profile) => profile.role === selectedRole) : profiles;
  const pageTitle = selectedRole === 'parent' ? 'Parents' : selectedRole === 'athlete' ? 'Athletes' : 'Users';
  const pageDescription = selectedRole === 'parent'
    ? 'Parent accounts, family connections, and last-observed activity.'
    : selectedRole === 'athlete'
      ? 'Athlete accounts, profiles, development signals, and last-observed activity.'
      : 'Account identity, role distribution, athlete profiles, family connections, and last-observed activity.';

  return (
    <AdminShell eyebrow="Account Intelligence" title={pageTitle} description={pageDescription}>

      <section className="dashboard-section" id="athletes">
        <div className="analytics-grid overview-grid">
          <article className="analytics-card"><span>Total Users</span><strong>{analytics.totalUsers}</strong><em>All accounts</em></article>
          <article className="analytics-card"><span>Athletes</span><strong>{analytics.athleteCount}</strong><em>Athlete accounts</em></article>
          <article className="analytics-card"><span>Parents</span><strong>{analytics.parentCount}</strong><em>Parent accounts</em></article>
          <article className="analytics-card"><span>New This Week</span><strong>{analytics.newUsers7Days}</strong><em>Recent signups</em></article>
        </div>
      </section>

      <section className="dashboard-section" id="directory">
        <div className="section-head">
          <p className="eyebrow">Directory</p>
          <h2>{pageTitle} Account Info</h2>
          <p>Use this to quickly identify who is in the app and whether their account is connected.</p>
        </div>
        <div className="user-table">
          <div className="user-table-head">
            <span>Name</span>
            <span>Email</span>
            <span>Role</span>
            <span>Sport</span>
            <span>State/Country</span>
            <span>Last Active</span>
            <span>Score</span>
            <span>Account ID</span>
            <span>Manage</span>
          </div>
          {visibleProfiles.map((profile) => (
            <div className="user-table-row" key={profile.id}>
              <strong>{profile.name}</strong>
              <span>{profile.email}</span>
              <em>{profile.role}</em>
              <span>{profile.sport}</span>
              <span>{profile.location}</span>
              <span>{profile.lastActive ? new Date(profile.lastActive).toLocaleDateString() : '-'}</span>
              <span>{profile.score}</span>
              <code>{profile.id.slice(0, 8)}...</code>
              {profile.role === 'admin' ? (
                <span className="protected-user">Protected</span>
              ) : (
                <details className="delete-user-control">
                  <summary>Delete</summary>
                  <form action={deleteUserAccount} className="delete-user-form">
                    <input type="hidden" name="id" value={profile.id} />
                    <input type="hidden" name="role" value={profile.role} />
                    <p>This permanently removes the account and connected app data.</p>
                    <button className="danger-button" type="submit">Delete Account</button>
                  </form>
                </details>
              )}
            </div>
          ))}
        </div>
      </section>

      {selectedRole !== 'athlete' && <section className="dashboard-section">
        <div className="section-head">
          <p className="eyebrow">Families</p>
          <h2>Parent Links</h2>
          <p>Which parent accounts are connected to athlete accounts.</p>
        </div>
        <div className="table-card">
          {parentLinks.length ? parentLinks.map((link) => (
            <div className="table-row" key={`${link.parent_user_id}-${link.athlete_user_id}`}>
              <span>Parent {link.parent_user_id.slice(0, 8)}...</span>
              <strong>Athlete {link.athlete_user_id.slice(0, 8)}...</strong>
            </div>
          )) : <div className="empty-row">No parent links recorded yet.</div>}
        </div>
      </section>}
    </AdminShell>
  );
}
