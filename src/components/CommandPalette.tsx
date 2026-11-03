import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { useI18n } from '../i18n';
import { useTheme } from '../app/theme';
import type { Bootstrap } from '../api/schemas';
import { foldAr, leadMatches } from '../lib/format';
import { recentLeads } from '../lib/recent';
import { leadName } from '../lib/rules';
import { Icon } from './Icon';
import { useOpenLead } from '../features/lead/useOpenLead';
import { useActions } from '../app/actions';
import type { Lead } from '../api/schemas';

type Mode = null | 'call' | 'wa' | 'task' | 'meet';

type Cmd = { id: string; group: string; label: string; sub?: string; icon: string; run: () => void; keys?: string };

/** Ctrl/⌘+K: jump to any client or page, or run an action (FR-06). */
export function CommandPalette({ boot, open, onOpenChange, onAction }: { boot: Bootstrap; open: boolean; onOpenChange: (o: boolean) => void; onAction: (a: 'lead' | 'task' | 'message' | 'announcement' | 'tour' | 'keys') => void }) {
  const { t, lang, setLang } = useI18n();
  const { theme, setPref } = useTheme();
  const nav = useNavigate();
  const openLead = useOpenLead();
  const acts = useActions();
  const [mode, setMode] = useState<Mode>(null);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) { setQ(''); setSel(0); setMode(null); } }, [open]);

  const cmds = useMemo<Cmd[]>(() => {
    const go = (path: string) => () => nav(path);
    const pages: Cmd[] = [
      ['/', 'grid', t('مساحة العمل', 'Workspace'), 'g h'], ['/schedule', 'calendar', t('جدولك', 'Your schedule'), 'g s'], ['/contacts', 'contacts', t('جهات الاتصال', 'Contacts'), 'g c'],
      ['/companies', 'building', t('الشركات', 'Companies'), 'g o'], ['/tasks', 'tasks', t('المهام', 'Tasks'), 'g t'], ['/sales-tools/pipeline', 'board', t('المسار', 'Pipeline'), 'g p'],
      ['/sales-tools/reports', 'chart', t('التقارير', 'Reports'), 'g r'], ['/sales-tools/templates', 'template', t('القوالب', 'Templates')], ['/sales-tools/activity', 'activity', t('النشاط', 'Activity')],
      ['/inbox', 'inbox', t('المحادثات', 'Inbox'), 'g i'], ['/announcements', 'megaphone', t('الإعلانات', 'Announcements'), 'g a'], ['/settings', 'settings', t('الإعدادات', 'Settings'), 'g e'], ['/profile', 'user', t('حسابي', 'Profile'), 'g u']
    ].map(([p, ic, l, k]) => ({ id: 'p' + p, group: t('الصفحات', 'Pages'), label: l, icon: ic, keys: k, run: go(p) }));
    const pick = (m: Mode) => () => { setMode(m); setQ(''); };
    const actions: Cmd[] = [
      { id: 'a-call', group: t('إجراءات', 'Actions'), label: t('سجّل مكالمة أو تواصل…', 'Log a call or contact…'), icon: 'phone', run: pick('call') },
      { id: 'a-wa', group: t('إجراءات', 'Actions'), label: t('ابعت واتساب لعميل…', 'WhatsApp a client…'), icon: 'wa', run: pick('wa') },
      { id: 'a-meet', group: t('إجراءات', 'Actions'), label: t('احجز اجتماع…', 'Book a meeting…'), icon: 'calendar', keys: 'B', run: pick('meet') },
      { id: 'a-task2', group: t('إجراءات', 'Actions'), label: t('مهمة لعميل…', 'Task for a client…'), icon: 'tasks', run: pick('task') },
      { id: 'a-lead', group: t('إجراءات', 'Actions'), label: t('عميل جديد', 'New client'), icon: 'plus', keys: 'N', run: () => onAction('lead') },
      { id: 'a-task', group: t('إجراءات', 'Actions'), label: t('مهمة جديدة', 'New task'), icon: 'tasks', keys: 'T', run: () => onAction('task') },
      { id: 'a-msg', group: t('إجراءات', 'Actions'), label: boot.me.isAdmin ? t('رسالة جديدة', 'New message') : t('رسالة للإدارة', 'Message the admins'), icon: 'inbox', keys: 'M', run: () => onAction('message') },
      ...(boot.me.isAdmin ? [{ id: 'a-ann', group: t('إجراءات', 'Actions'), label: t('إعلان جديد', 'New announcement'), icon: 'megaphone', run: () => onAction('announcement') }] : []),
      { id: 'a-tour', group: t('إجراءات', 'Actions'), label: t('جولة سريعة في النظام', 'Take the quick tour'), icon: 'sparkle', run: () => onAction('tour') },
      { id: 'a-keys', group: t('إجراءات', 'Actions'), label: t('اختصارات الكيبورد', 'Keyboard shortcuts'), icon: 'edit', keys: '?', run: () => onAction('keys') },
      { id: 'a-theme', group: t('إجراءات', 'Actions'), label: theme === 'dark' ? t('الوضع الفاتح', 'Light mode') : t('الوضع الغامق', 'Dark mode'), icon: theme === 'dark' ? 'sun' : 'moon', run: () => setPref(theme === 'dark' ? 'light' : 'dark') },
      { id: 'a-lang', group: t('إجراءات', 'Actions'), label: lang === 'ar' ? 'English' : 'العربية', icon: 'globe', run: () => setLang(lang === 'ar' ? 'en' : 'ar') }
    ];
    return [...actions, ...pages];
  }, [boot.me.isAdmin, lang, nav, onAction, setLang, setPref, t, theme]);

  const results = useMemo(() => {
    const s = foldAr(q);
    if (mode) {
      const pickLead = (l: Lead): Cmd => ({ id: 'm' + l.id, group: t('اختار العميل', 'Pick the client'), label: leadName(l), sub: [l.name !== leadName(l) ? l.name : '', l.city].filter(Boolean).join(' · '), icon: 'contacts', run: () => (mode === 'call' ? acts.logActivity(l) : mode === 'wa' ? acts.compose(l, 'واتساب') : mode === 'task' ? acts.newTask(l) : acts.book(l)) });
      const ids = recentLeads();
      const pool = s ? boot.leads.filter((l) => leadMatches(l, q)) : [...ids.map((id) => boot.leads.find((l) => l.id === id)).filter((l): l is Lead => !!l), ...boot.leads.filter((l) => !ids.includes(l.id))];
      return pool.slice(0, 8).map(pickLead);
    }
    const asCmd = (l: Bootstrap['leads'][number], group: string): Cmd => ({ id: group[0] + l.id, group, label: leadName(l), sub: [l.name !== leadName(l) ? l.name : '', l.city].filter(Boolean).join(' · '), icon: 'contacts', run: () => openLead(l.id) });
    // Nothing typed yet: the clients you opened last come first, then actions and pages.
    const recents = !s ? recentLeads().map((id) => boot.leads.find((l) => l.id === id)).filter((l): l is Bootstrap['leads'][number] => !!l).map((l) => asCmd(l, t('آخر اللي فتحته', 'Recent'))) : [];
    const leads: Cmd[] = s ? boot.leads.filter((l) => leadMatches(l, q)).slice(0, 8).map((l) => asCmd(l, t('العملاء', 'Clients'))) : [];
    const other = cmds.filter((c) => !s || foldAr(c.label).includes(s));
    return [...recents, ...leads, ...other];
  }, [q, mode, acts, boot.leads, cmds, openLead, t]);

  useEffect(() => { setSel(0); }, [q, mode]);
  useEffect(() => { listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [sel]);
  const run = (c: Cmd | undefined) => { if (!c) return; if (c.id.startsWith('a-') && ['a-call', 'a-wa', 'a-meet', 'a-task2'].includes(c.id)) { c.run(); return; } onOpenChange(false); setTimeout(c.run, 0); };

  let lastGroup = '';
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="scrim" />
        <Dialog.Content className="cmdk" aria-describedby={undefined}>
          <Dialog.Title className="sr-only">{t('بحث وأوامر', 'Search and commands')}</Dialog.Title>
          <div className="cmdk__bar"><Icon name="search" />{mode ? <button type="button" className="cmdk__mode" onClick={() => setMode(null)} aria-label={t('ارجع للأوامر', 'Back to commands')}>{{ call: t('سجّل تواصل', 'Log contact'), wa: t('واتساب', 'WhatsApp'), task: t('مهمة', 'Task'), meet: t('اجتماع', 'Meeting') }[mode]}<Icon name="close" size={12} /></button> : null}<input className="cmdk__in" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={mode ? t('اكتب اسم العميل أو جواله…', 'Type the client’s name or phone…') : t('دور على عميل أو صفحة أو أمر…', 'Search clients, pages or actions…')}
            role="combobox" aria-expanded="true" aria-controls="cmdk-list" aria-activedescendant={results[sel] ? 'cmd-' + results[sel].id : undefined}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSel((x) => Math.min(results.length - 1, x + 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSel((x) => Math.max(0, x - 1)); }
              if (e.key === 'Enter') { e.preventDefault(); run(results[sel]); }
              if (e.key === 'Backspace' && !q && mode) setMode(null);
            }} /></div>
          <div className="cmdk__list" id="cmdk-list" role="listbox" ref={listRef}>
            {results.length === 0 ? <div className="empty"><b>{t('مفيش نتايج', 'No results')}</b>{t('جرّب اسم تاني أو جزء من رقم الجوال.', 'Try another name or part of the phone number.')}</div> : results.map((c, i) => {
              const head = c.group !== lastGroup ? (lastGroup = c.group) : null;
              return (
                <div key={c.id}>
                  {head ? <div className="cmdk__grp">{head}</div> : null}
                  <div id={'cmd-' + c.id} className="cmdk__item" role="option" aria-selected={i === sel} onMouseEnter={() => setSel(i)} onClick={() => run(c)}>
                    <Icon name={c.icon} /><span>{c.label}{c.sub ? <span className="faint" style={{ fontSize: 12.5 }}> · {c.sub}</span> : null}</span>
                    {c.keys ? <small>{c.keys.split(' ').map((k) => <kbd key={k}>{k}</kbd>)}</small> : null}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="cmdk__foot" aria-hidden="true"><span><kbd>↑</kbd><kbd>↓</kbd> {t('تنقّل', 'move')}</span><span><kbd>Enter</kbd> {t('نفّذ', 'run')}</span><span><kbd>Esc</kbd> {t('إغلاق', 'close')}</span></div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
