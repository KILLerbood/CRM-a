import { lazy, Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { useBootstrap, usePulse } from '../api/queries';
import { BootCtx } from './boot';
import { ActionsProvider, useActions } from './actions';
import { useI18n } from '../i18n';
import { useTheme } from './theme';
import { useAuth } from '../auth/AuthProvider';
import { Logo } from '../components/Logo';
import { Icon } from '../components/Icon';
import { Avatar, IconButton, Tip, Skel } from '../components/ui';
import { ScheduleBar } from '../components/ScheduleBar';
import { PulseStrip } from '../components/PulseStrip';
import { NotificationsBell } from '../components/NotificationsPanel';
import { CommandPalette } from '../components/CommandPalette';
import { Shortcuts, Tour, markTourSeen, tourSeen } from '../components/Tour';
import { AnnouncementBanner, UrgentModal } from '../components/Announcements';
import { errorText } from '../api/errors';
import { LostReasonProvider } from '../features/lead/mutations';
import { isLate } from '../lib/rules';
import { useOnline } from '../lib/hooks';
import type { Bootstrap } from '../api/schemas';
import { api } from '../api/endpoints';
import { refreshDevice } from '../lib/push';
import { stepChord, stepIndex, latinKey } from '../lib/keys';

const ROWS = '.now__row, .tbl tbody tr, .item, .kcard, .mcard__main, .ncard--click, .nbA__row, [data-row]';
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

const LeadDrawer = lazy(() => import('../features/lead/LeadView').then((m) => ({ default: m.LeadDrawer })));

export function Shell() {
  const { t, lang } = useI18n();
  const boot = useBootstrap();
  if (boot.isLoading || (!boot.data && !boot.isError)) return <BootSkeleton />;
  if (!boot.data) {
    return (
      <div className="auth" style={{ gridTemplateColumns: '1fr' }}>
        <div className="auth__box" style={{ maxWidth: 480 }}>
          <h1 className="display">{t('الـ CRM مافتحش', 'The CRM didn’t load')}</h1>
          <p>{errorText(boot.error, lang)}</p>
          <button className="btn btn--primary btn--plain" onClick={() => boot.refetch()}>{t('حمّل تاني', 'Reload')}</button>
        </div>
      </div>
    );
  }
  return (
    <BootCtx.Provider value={boot.data}>
      <LostReasonProvider reasons={boot.data.lists['سبب الخسارة'] || []}>
        <ActionsProvider>
          <ShellFrame boot={boot.data} refreshing={boot.isFetching} onRefresh={() => boot.refetch()} />
        </ActionsProvider>
      </LostReasonProvider>
    </BootCtx.Provider>
  );
}

function ShellFrame({ boot, refreshing, onRefresh }: { boot: Bootstrap; refreshing: boolean; onRefresh: () => void }) {
  const { t, lang, setLang } = useI18n();
  const { theme, pref, setPref } = useTheme();
  const { signOut, authed } = useAuth();
  const actions = useActions();
  const nav = useNavigate();
  const loc = useLocation();
  const [params, setParams] = useSearchParams();
  const pulse = usePulse(authed);
  const online = useOnline();
  // A new version of the site is downloaded and waiting (see main.tsx).
  const [update, setUpdate] = useState(false);
  // Keep this device's push subscription known to the server (once a day).
  const pushKey = boot.settings.pushKey;
  useEffect(() => { if (pushKey) void refreshDevice(api, pushKey); }, [pushKey]);
  useEffect(() => { const on = () => setUpdate(true); window.addEventListener('mg-update', on); return () => window.removeEventListener('mg-update', on); }, []);
  const [cmdk, setCmdk] = useState(false);
  const [tour, setTour] = useState(false);
  const [keys, setKeys] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const me = boot.me;
  const lateTasks = boot.tasks.filter(isLate).length;
  const unreadMsgs = pulse.data?.unread.messages ?? boot.inbox?.unread ?? 0;
  const unreadAnns = pulse.data?.unread.announcements ?? boot.announcements.filter((a) => !a.seenAt).length;
  const unreadNotifs = pulse.data?.unread.notifications ?? 0;
  const leadId = params.get('lead');

  // First run: a short tour, once per person per device. It waits until no dialog (e.g. an urgent announcement) is open.
  const myEmail = boot.me.email;
  useEffect(() => {
    if (tourSeen(myEmail)) return;
    let tries = 0;
    const id = window.setInterval(() => {
      tries++;
      if (!document.querySelector('[role="dialog"]')) { window.clearInterval(id); setTour(true); }
      else if (tries > 20) window.clearInterval(id);
    }, 1500);
    return () => window.clearInterval(id);
  }, [myEmail]);
  const closeTour = () => { markTourSeen(myEmail); setTour(false); };
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 6);
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [loc.pathname]);
  // Keyboard: Ctrl/⌘+K or «/» opens the palette, «g» then a letter jumps to a page, j / k walk the rows, Enter opens the row.
  useEffect(() => {
    let armed = false, timer = 0;
    const on = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const typing = !!el && (/INPUT|TEXTAREA|SELECT/.test(el.tagName) || el.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmdk(true); return; }
      if (typing || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('[role="dialog"]')) return;
      const k = latinKey(e.key);
      if (armed || k === 'g') {
        const r = stepChord(armed, e.key);
        window.clearTimeout(timer);
        armed = r.armed;
        if (r.armed) timer = window.setTimeout(() => { armed = false; }, 1500);
        if (r.go) nav(r.go);
        if (r.armed || r.go) { e.preventDefault(); return; }
      }
      if (e.key === '/') { e.preventDefault(); setCmdk(true); }
      else if (k === 'n') { e.preventDefault(); actions.newLead(); }
      else if (k === 't') { e.preventDefault(); actions.newTask(); }
      else if (k === 'm') { e.preventDefault(); actions.newThread(); }
      else if (k === 'b') { e.preventDefault(); actions.book(); }
      else if (e.key === '?' || e.key === '؟') { e.preventDefault(); setKeys(true); }
      else if (k === 'j' || k === 'k') {
        const rows = Array.from(document.querySelectorAll<HTMLElement>('#main ' + ROWS.split(', ').join(', #main '))).filter((r) => r.offsetParent !== null);
        if (!rows.length) return;
        e.preventDefault();
        const cur = rows.findIndex((r) => r === el || r.contains(el));
        const next = rows[stepIndex(rows.length, cur, k === 'j' ? 1 : -1)];
        if (!next.hasAttribute('tabindex')) next.setAttribute('tabindex', '-1');
        next.focus({ preventScroll: true });
        next.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && el && el.matches(ROWS) && !el.matches('button, a, [role="button"]')) { e.preventDefault(); el.click(); }
    };
    window.addEventListener('keydown', on);
    return () => { window.removeEventListener('keydown', on); window.clearTimeout(timer); };
  }, [actions, nav]);

  const NAV: [string, string, string, string, number?][] = [
    ['/', 'grid', t('مساحة العمل', 'Workspace'), 'h'],
    ['/schedule', 'calendar', t('جدولك', 'Schedule'), 's'],
    ['/contacts', 'contacts', t('جهات الاتصال', 'Contacts'), 'c'],
    ['/companies', 'building', t('الشركات', 'Companies'), 'o'],
    ['/tasks', 'tasks', t('المهام', 'Tasks'), 't', lateTasks],
    ['/sales-tools', 'tools', t('أدوات البيع', 'Sales tools'), 'p'],
    ['/inbox', 'inbox', t('المحادثات', 'Inbox'), 'i', unreadMsgs],
    ['/announcements', 'megaphone', t('الإعلانات', 'Announcements'), 'a', unreadAnns]
  ];
  const active = (p: string) => (p === '/' ? loc.pathname === '/' : loc.pathname.startsWith(p));
  const crumb = NAV.find(([p]) => active(p))?.[2] || (loc.pathname.startsWith('/settings') ? t('الإعدادات', 'Settings') : loc.pathname.startsWith('/profile') ? t('حسابي', 'Profile') : loc.pathname.startsWith('/leads') ? t('عميل', 'Client') : loc.pathname.startsWith('/more') ? t('المزيد', 'More') : 'Magmafy');
  const tipSide = document.documentElement.dir === 'rtl' ? 'left' : 'right';

  return (
    <>
      <div className="shell">
        <nav className="shell__rail" aria-label={t('القائمة الرئيسية', 'Main menu')}>
          <NavLink to="/" className="logo-btn rail__logo" aria-label="Magmafy CRM"><Logo size={36} /></NavLink>
          <div className="rail__nav">
            {NAV.map(([p, ic, label, key, n]) => (
              <div className="rail__item" key={p}>
                <Tip label={<span className="tipk">{label}<span><kbd>g</kbd><kbd>{key}</kbd></span></span>} side={tipSide}>
                  <NavLink to={p} end={p === '/'} className="rail__btn" aria-label={label + (n ? ' (' + n + ')' : '')} aria-current={active(p) ? 'page' : undefined}>
                    <Icon name={ic} />{n ? <span className={'cnt' + (p === '/tasks' ? ' cnt--bad' : '')} aria-hidden="true">{n > 9 ? '9+' : n}</span> : null}
                  </NavLink>
                </Tip>
              </div>
            ))}
          </div>
          <div className="rail__foot">
            <IconButton icon="plus" variant="hl" label={t('عميل جديد (N)', 'New client (N)')} onClick={actions.newLead} />
            <Tip label={<span className="tipk">{t('الإعدادات', 'Settings')}<span><kbd>g</kbd><kbd>e</kbd></span></span>} side={tipSide}>
              <NavLink to="/settings" className="rail__btn" aria-label={t('الإعدادات', 'Settings')} aria-current={active('/settings') ? 'page' : undefined}><Icon name="settings" /></NavLink>
            </Tip>
            <IconButton icon={theme === 'dark' ? 'sun' : 'moon'} className="rail__btn" label={theme === 'dark' ? t('الوضع الفاتح', 'Light mode') : t('الوضع الغامق', 'Dark mode')} onClick={() => setPref(theme === 'dark' ? 'light' : 'dark')} />
          </div>
        </nav>

        <header className={'shell__hdr' + (scrolled ? ' is-scrolled' : '')}>
          <NavLink to="/" className="logo-btn show-sm" aria-label="Magmafy CRM"><Logo size={34} /></NavLink>
          <div className="hdr__crumb hide-sm"><b>{crumb}</b></div>
          <button type="button" className="cmdbtn" onClick={() => setCmdk(true)} aria-label={t('بحث وأوامر', 'Search and commands')}>
            <Icon name="search" />
            <span className="cmdbtn__txt">{t('دوّر أو نفّذ أمر…', 'Search or run a command…')}</span>
            <span className="cmdbtn__k hide-sm"><kbd>{isMac ? '⌘' : 'Ctrl'}</kbd><kbd>K</kbd></span>
          </button>
          <NotificationsBell unread={unreadNotifs} />
          <Menu.Root>
            <Menu.Trigger asChild>
              <button className="ibtn hdr__me" aria-label={t('قايمة الحساب', 'Account menu')}><Avatar name={me.name} size="sm" /></button>
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content className="menu" align="end" sideOffset={8}>
                <div style={{ padding: '10px 12px 8px', display: 'flex', gap: 10, alignItems: 'center' }}>
                  <Avatar name={me.name} size="sm" />
                  <div style={{ minWidth: 0 }}><b style={{ display: 'block', fontWeight: 500 }}>{me.name}</b><small className="faint ltr">{me.email}</small></div>
                </div>
                <Menu.Separator className="menu__sep" />
                <Menu.Item className="menu__item" onSelect={() => nav('/profile')}><Icon name="user" />{t('حسابي', 'Profile')}</Menu.Item>
                <Menu.Item className="menu__item" onSelect={() => nav('/settings')}><Icon name="settings" />{t('الإعدادات', 'Settings')}</Menu.Item>
                <Menu.Item className="menu__item" onSelect={() => setTour(true)}><Icon name="sparkle" />{t('جولة سريعة', 'Quick tour')}</Menu.Item>
                <Menu.Item className="menu__item" onSelect={() => setKeys(true)}><Icon name="edit" />{t('اختصارات الكيبورد', 'Keyboard shortcuts')}<kbd style={{ marginInlineStart: 'auto' }}>?</kbd></Menu.Item>
                <Menu.Item className="menu__item" onSelect={onRefresh}><Icon name="refresh" />{refreshing ? t('بيتحدّث…', 'Refreshing…') : t('تحديث البيانات', 'Refresh data')}</Menu.Item>
                <Menu.Separator className="menu__sep" />
                <div className="menu__label">{t('المظهر', 'Appearance')}</div>
                {([['dark', 'moon', t('غامق', 'Dark')], ['light', 'sun', t('فاتح', 'Light')], ['auto', 'monitor', t('حسب الجهاز', 'System')]] as const).map(([k, ic, l]) => (
                  <Menu.Item key={k} className="menu__item" onSelect={() => setPref(k)}><Icon name={ic} />{l}{pref === k ? <Icon name="check" className="faint" /> : null}</Menu.Item>
                ))}
                <Menu.Item className="menu__item" onSelect={() => setLang(lang === 'ar' ? 'en' : 'ar')}><Icon name="globe" />{lang === 'ar' ? 'English' : 'العربية'}</Menu.Item>
                {boot.settings.sheetUrl ? <Menu.Item className="menu__item" onSelect={() => window.open(boot.settings.sheetUrl, '_blank', 'noopener')}><Icon name="template" />{t('افتح الشيت', 'Open the sheet')}</Menu.Item> : null}
                <Menu.Separator className="menu__sep" />
                <Menu.Item className="menu__item" onSelect={() => signOut()}><Icon name="logout" />{t('خروج', 'Sign out')}</Menu.Item>
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        </header>

        <PulseStrip boot={boot} refreshing={refreshing} onRefresh={onRefresh}><ScheduleBar boot={boot} /></PulseStrip>

        <div className="shell__banner">
          {!online ? <div className="banner banner--عاجل" role="alert"><span className="pulse-dot" />{t('مفيش نت دلوقتي. البيانات اللي قدامك للقراية بس لحد ما النت يرجع.', 'You’re offline. What you see is read-only until you’re back online.')}</div> : null}
          {update ? (
            <div className="banner" role="status"><Icon name="sparkle" size={16} /><span className="grow">{t('فيه نسخة جديدة من الموقع.', 'A new version is available.')}</span>
              <button className="btn btn--sm btn--primary btn--plain" onClick={() => { navigator.serviceWorker?.getRegistration().then((r) => (r?.waiting ? r.waiting.postMessage('skip') : location.reload())); }}>{t('حدّث', 'Update')}</button></div>
          ) : null}
          <AnnouncementBanner boot={boot} />
        </div>

        <main className="shell__main" id="main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      <nav className="bnav" aria-label={t('التنقل', 'Navigation')}>
        {([['/', 'grid', t('الرئيسية', 'Home')], ['/contacts', 'contacts', t('العملاء', 'Clients')], ['/tasks', 'tasks', t('المهام', 'Tasks')], ['/inbox', 'inbox', t('المحادثات', 'Chat')], ['/more', 'more', t('المزيد', 'More')]] as const).map(([p, ic, l]) => (
          <NavLink key={p} to={p} end={p === '/'} className="bnav__it" aria-current={active(p) ? 'page' : undefined}>
            <span className="bnav__ic"><Icon name={ic} />{p === '/inbox' && unreadMsgs ? <span className="cnt" aria-hidden="true">{unreadMsgs}</span> : null}{p === '/tasks' && lateTasks ? <span className="cnt cnt--bad" aria-hidden="true">{lateTasks > 9 ? '9+' : lateTasks}</span> : null}</span>
            <span className="bnav__lbl">{l}</span>
          </NavLink>
        ))}
      </nav>
      <Menu.Root>
        <Menu.Trigger asChild><button className="fab show-sm" aria-label={t('إضافة سريعة', 'Quick add')}><Icon name="plus" size={26} /></button></Menu.Trigger>
        <Menu.Portal>
          <Menu.Content className="menu menu--fab" side="top" align="end" sideOffset={12}>
            <Menu.Item className="menu__item" onSelect={actions.newLead}><Icon name="userplus" />{t('عميل جديد', 'New client')}</Menu.Item>
            <Menu.Item className="menu__item" onSelect={() => actions.newTask()}><Icon name="tasks" />{t('مهمة جديدة', 'New task')}</Menu.Item>
            <Menu.Item className="menu__item" onSelect={() => actions.book()}><Icon name="calendar" />{t('احجز اجتماع', 'Book a meeting')}</Menu.Item>
            <Menu.Item className="menu__item" onSelect={actions.newThread}><Icon name="inbox" />{t('رسالة جديدة', 'New message')}</Menu.Item>
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>

      <Suspense fallback={null}>{leadId ? <LeadDrawer id={leadId} onClose={() => setParams((p) => { const n = new URLSearchParams(p); n.delete('lead'); n.delete('ltab'); return n; })} /> : null}</Suspense>
      <CommandPalette boot={boot} open={cmdk} onOpenChange={setCmdk} onAction={(a) => (a === 'lead' ? actions.newLead() : a === 'task' ? actions.newTask() : a === 'message' ? actions.newThread() : a === 'tour' ? setTour(true) : a === 'keys' ? setKeys(true) : actions.editAnnouncement())} />
      <Tour open={tour} onClose={closeTour} />
      <Shortcuts open={keys} onClose={() => setKeys(false)} />
      <UrgentModal pulse={pulse.data} boot={boot} />
    </>
  );
}

function BootSkeleton() {
  return (
    <div className="shell">
      <header className="shell__hdr"><Skel h={40} w="100%" r={8} /></header>
      <nav className="shell__rail"><Logo size={36} />{[0, 1, 2, 3, 4, 5].map((i) => <Skel key={i} h={40} w={40} r={8} />)}</nav>
      <main className="shell__main" aria-busy="true">
        <div className="stack" style={{ gap: 22 }}>
          <Skel h={64} w="46%" r={12} />
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>{[0, 1, 2, 3].map((i) => <Skel key={i} h={180} />)}</div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>{[0, 1, 2].map((i) => <Skel key={i} h={230} />)}</div>
        </div>
      </main>
    </div>
  );
}
