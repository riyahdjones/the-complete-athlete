'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const navigation = [
  { label: 'Overview', href: '/', icon: 'grid' },
  { label: 'Users', href: '/users', icon: 'users' },
  { label: 'Athletes', href: '/users#athletes', icon: 'athlete' },
  { label: 'Parents', href: '/users#parents', icon: 'link' },
  { label: 'Engagement', href: '/engagement', icon: 'pulse' },
  { label: 'Performance Plans', href: '/engagement#plans', icon: 'plans' },
  { label: 'AI Coach', href: '/coach', icon: 'coach' },
  { label: 'Goals & Activity', href: '/engagement#goals', icon: 'target' },
  { label: 'Subscriptions', href: '/engagement#subscriptions', icon: 'card' },
  { label: 'Safety', href: '/coach#safety', icon: 'shield' },
  { label: 'System Health', href: '/system', icon: 'system' }
];

function Icon({ name }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    athlete: <><circle cx="12" cy="5" r="2" /><path d="m7 21 3-7 2 2 2-5 3 2M5 12l5-3 4 2 5-1" /></>,
    link: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>,
    pulse: <path d="M3 12h4l2.5-7 5 14 2.5-7h4" />,
    plans: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></>,
    coach: <><path d="M12 2a7 7 0 0 0-7 7v4a4 4 0 0 0 4 4h1" /><path d="M19 13V9a7 7 0 0 0-7-7M15 19c0 1.7-1.3 3-3 3h-1" /><rect x="3" y="10" width="4" height="6" rx="2" /><rect x="17" y="10" width="4" height="6" rx="2" /></>,
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
    card: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></>,
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
    system: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.2.36.55.7 1 .9.35.17.74.25 1.1.24H21v4h-.09A1.7 1.7 0 0 0 19.4 15Z" /></>
  };
  return <svg aria-hidden="true" className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">{paths[name] ?? paths.grid}</svg>;
}

function LiveClock() {
  const [now, setNow] = useState(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const timer = setInterval(tick, 30000);
    return () => clearInterval(timer);
  }, []);
  return (
    <time suppressHydrationWarning>
      {now ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(now) : 'Synchronizing…'}
    </time>
  );
}

export default function AdminShell({ eyebrow, title, description, children }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={collapsed ? 'command-layout sidebar-collapsed' : 'command-layout'}>
      <aside className="command-sidebar">
        <div className="brand-lockup">
          <span className="brand-mark">CA</span>
          <div><strong>The Complete</strong><em>Athlete</em></div>
        </div>
        <button className="sidebar-toggle" type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <span>{collapsed ? '›' : '‹'}</span>
        </button>
        <nav className="command-nav" aria-label="Admin navigation">
          {navigation.map((item) => {
            const active = !item.href.includes('#') && pathname === item.href;
            return <Link className={active ? 'active' : ''} href={item.href} key={item.label} title={item.label}><Icon name={item.icon} /><span>{item.label}</span></Link>;
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="admin-avatar">RJ</div>
          <div><strong>Admin Profile</strong><span>Founder access</span></div>
          <form action="/logout" method="post"><button type="submit" title="Log out">↗</button></form>
        </div>
      </aside>

      <div className="command-main">
        <header className="command-bar">
          <div className="command-title">
            <span>{eyebrow || 'The Complete Athlete'}</span>
            <strong>{title || 'Command Center'}</strong>
          </div>
          <div className="command-controls">
            <span className="system-online"><i /> System Online</span>
            <LiveClock />
            <div className="range-control" aria-label="Analytics date range">
              {['24H', '7D', '30D', '90D', 'ALL'].map((range) => <span className={range === '7D' ? 'active' : ''} key={range} title={range === '7D' ? 'Current analytics window' : 'This data window is not available for every metric'}>{range}</span>)}
            </div>
          </div>
        </header>
        <main className="command-content">
          <div className="page-intro">
            <p className="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            {description && <p>{description}</p>}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
