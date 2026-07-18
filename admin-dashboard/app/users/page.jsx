import Link from 'next/link';
import { redirect } from 'next/navigation';
import { deleteUserAccount } from '../actions';
import { isAdminAuthed } from '../../lib/admin-auth';
import { getDashboardData } from '../../lib/dashboard-data';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  if (!(await isAdminAuthed())) redirect('/');
  const { profiles, parentLinks, analytics } = await getDashboardData();

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Accounts</p>
          <h1>Users</h1>
          <span>Names, emails, roles, account IDs, links, and last active dates.</span>
        </div>
        <Link className="ghost-link" href="/">Overview</Link>
      </header>

      <section className="dashboard-section">
        <div className="analytics-grid overview-grid">
          <article className="analytics-card"><span>Total Users</span><strong>{analytics.totalUsers}</strong><em>All accounts</em></article>
          <article className="analytics-card"><span>Athletes</span><strong>{analytics.athleteCount}</strong><em>Athlete accounts</em></article>
          <article className="analytics-card"><span>Parents</span><strong>{analytics.parentCount}</strong><em>Parent accounts</em></article>
          <article className="analytics-card"><span>New This Week</span><strong>{analytics.newUsers7Days}</strong><em>Recent signups</em></article>
        </div>
      </section>

      <section className="dashboard-section">
        <div className="section-head">
          <p className="eyebrow">Directory</p>
          <h2>Account Info</h2>
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
          {profiles.map((profile) => (
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
                    <input type="hidden" name="email" value={profile.email} />
                    <input type="hidden" name="role" value={profile.role} />
                    <label htmlFor={`delete-${profile.id}`}>Type email to confirm</label>
                    <input id={`delete-${profile.id}`} name="confirmation" type="email" placeholder={profile.email} />
                    <button className="danger-button" type="submit">Delete Account</button>
                  </form>
                </details>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="dashboard-section">
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
      </section>
    </main>
  );
}
