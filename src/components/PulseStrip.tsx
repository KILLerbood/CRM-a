import { type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import type { Bootstrap } from '../api/schemas';
import { useI18n } from '../i18n';
import { useNow } from '../lib/hooks';
import { compactMoney, computePulse } from '../lib/pulse';
import { fTime, money } from '../lib/format';
import { Tip } from './ui';

/**
 * The live strip under the header on every screen: what is coming, what is late, how much money is moving.
 * Real numbers from the same data as the rest of the app; the dot on the left is the sync button.
 */
export function PulseStrip({ boot, refreshing, onRefresh, children }: { boot: Bootstrap; refreshing: boolean; onRefresh: () => void; children?: ReactNode }) {
  const { t, lang } = useI18n();
  const now = useNow(30_000);
  const p = computePulse(boot, now, boot.settings.staleDays);
  const mins = p.nextMeetingAt ? Math.round((p.nextMeetingAt - now) / 60000) : null;
  const next = p.nextMeetingAt ? (mins != null && mins <= 0 ? t('شغال دلوقتي', 'live now') : mins != null && mins < 60 ? t('بعد ', 'in ') + mins + t(' د', ' min') : t('الجاي ', 'next ') + fTime(new Date(p.nextMeetingAt), lang)) : t('مفيش اجتماع جاي', 'nothing booked');
  return (
    <section className="pulse" aria-label={t('نبض اليوم', 'Today’s pulse')}>
      <Tip label={refreshing ? t('بيتحدّث…', 'Syncing…') : t('البيانات حيّة. اضغط للتحديث', 'Live data. Press to refresh')}>
        <button type="button" className={'pulse__live' + (refreshing ? ' is-sync' : '')} onClick={onRefresh} aria-label={t('تحديث البيانات', 'Refresh data')}><i /></button>
      </Tip>
      <div className="pulse__cells">
        <NavLink to="/schedule" className="pcell">
          <b className="num">{p.meetingsToday}</b>
          <span>{t(p.meetingsToday === 1 ? 'اجتماع النهارده' : 'اجتماعات النهارده', p.meetingsToday === 1 ? 'meeting today' : 'meetings today')}<small>{next}</small></span>
        </NavLink>
        <NavLink to="/tasks" className={'pcell' + (p.overdue ? ' pcell--bad' : '')}>
          <b className="num">{p.overdue}</b>
          <span>{t(p.overdue === 1 ? 'مهمة متأخرة' : 'مهام متأخرة', p.overdue === 1 ? 'overdue task' : 'overdue tasks')}<small>{p.overdue ? t('محتاجة تتقفل', 'needs closing') : t('كله في معاده', 'all on time')}</small></span>
        </NavLink>
        <NavLink to="/contacts?view=prospects" className={'pcell' + (p.unanswered ? ' pcell--warn' : '')}>
          <b className="num">{p.unanswered}</b>
          <span>{t('عملاء مستنيين رد', 'leads awaiting a reply')}<small>{p.waiting} {t('في قايمة «اعمل دلوقتي»', 'in Do this now')}</small></span>
        </NavLink>
        <NavLink to="/sales-tools/pipeline" className="pcell pcell--money" title={money(p.moneyInPlay) + ' ' + t('ر.س', 'SAR')}>
          <b className="num">{compactMoney(p.moneyInPlay)}</b>
          <span>{t('فلوس في اللعب (ر.س)', 'money in play (SAR)')}<small>{p.dealsInPlay} {t('صفقة مفتوحة', 'open deals')}</small></span>
        </NavLink>
      </div>
      <div className="pulse__day">{children}</div>
    </section>
  );
}
