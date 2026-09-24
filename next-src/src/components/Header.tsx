'use client';

import { useEffect, useState } from 'react';
import { evaluationAuth } from '@/lib/evaluation';
import { usePathname } from 'next/navigation';

export function Header() {
  const [theme, setTheme] = useState<'dark' | 'light'>('light');

  const [loggedIn, setLoggedIn] = useState(false);
  useEffect(() => {
    const auth = evaluationAuth(); if (!auth) return;
    void auth.auth.getSession().then(({ data }) => setLoggedIn(!!data.session));
    const { data } = auth.auth.onAuthStateChange((_event, session) => setLoggedIn(!!session));
    return () => data.subscription.unsubscribe();
  }, []);
  const pathname = usePathname();
  useEffect(() => {
    let saved: 'dark' | 'light' = 'light';
    try {
      if (localStorage.getItem('va-theme') === 'dark') saved = 'dark';
    } catch { /* Storage can be unavailable in private browsers. */ }
    setTheme(saved);
    document.documentElement.dataset.theme = saved;
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('va-theme', next);
    } catch {
      // ignore
    }
  };

  return (
    <header className="va-header">
      <a href="/" className="va-brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="laisr-pixel-mark" src="/assets/art/laisr-pixel-mark.webp" width="34" height="34" alt="" />
        <span className="va-lab-name">LAISR Lab</span>
        <span className="va-brand-divider" aria-hidden="true" />
        <span className="va-wordmark">
          <span>Value</span>Arena
        </span>
      </a>
      <nav className="va-nav" aria-label="Main navigation">
        <a href="/" aria-current={pathname === '/' ? 'page' : undefined}>Home</a>
        <a href="/research/" aria-current={pathname.startsWith('/research') ? 'page' : undefined}>Research</a>
        <a href="/leaderboard/" aria-current={pathname.startsWith('/leaderboard') ? 'page' : undefined}>Leaderboard</a>
        <a href="/explore/" aria-current={pathname.startsWith('/explore') ? 'page' : undefined}>Explore</a>
        <a href="/experiments/" aria-current={pathname.startsWith('/experiments') ? 'page' : undefined}>Experiments</a>
        {process.env.NEXT_PUBLIC_EVALUATION_API_URL && <a href="/evaluate/" aria-current={pathname.startsWith('/evaluate') ? 'page' : undefined}>{loggedIn ? 'Run evaluation' : 'Log in'}</a>}
        <button
          type="button"
          onClick={toggle}
          className="va-theme-toggle"
          title="Toggle theme"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? '☾' : '☀'}
        </button>
      </nav>
    </header>
  );
}
