import React, { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { Currency } from '../types';
import { formatCurrencyPrice } from '../utils/currency';

type PlanService = 'landing-page' | 'business-website';

// Single source of truth for plan pricing (ZAR). Monthly figures are derived, never typed by hand.
const SERVICES: Record<PlanService, { label: string; basePriceZAR: number; updatesPerMonth: number }> = {
  'landing-page': { label: 'Landing page', basePriceZAR: 3500, updatesPerMonth: 1 },
  'business-website': { label: 'Business website', basePriceZAR: 6500, updatesPerMonth: 2 },
};

const PLAN_MARKUP: Record<3 | 6, number> = { 3: 1.1, 6: 1.2 };

function planTotal(basePriceZAR: number, months: 3 | 6): number {
  return Math.round((basePriceZAR * PLAN_MARKUP[months]) / 50) * 50;
}

interface PaymentPlansProps {
  currency: Currency;
  onInquire: (pkg: PlanService, note: string) => void;
}

export default function PaymentPlans({ currency, onInquire }: PaymentPlansProps) {
  const [service, setService] = useState<PlanService>('landing-page');
  const { label, basePriceZAR, updatesPerMonth } = SERVICES[service];
  const updates = `${updatesPerMonth} content ${updatesPerMonth === 1 ? 'update' : 'updates'} a month`;

  const total6 = planTotal(basePriceZAR, 6);
  const total3 = planTotal(basePriceZAR, 3);
  const monthly6 = Math.round(total6 / 6);
  const monthly3 = Math.round(total3 / 3);

  const inquire = (plan: string) =>
    onInquire(service, `I'm interested in the ${label} on the ${plan}. Please send a written scope and quote.`);

  const labelClass = 'text-[11px] font-bold tracking-widest text-[#6e6e73] dark:text-[#9e9ea3] uppercase';
  const featuredLabelClass = 'text-[11px] font-bold tracking-widest text-white/70 dark:text-[#1d1d1f]/60 uppercase';

  return (
    <section id="payment-plans" className="space-y-8 scroll-mt-24" aria-labelledby="payment-plans-heading">
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <p className="text-xs font-semibold text-[#6e6e73] dark:text-[#9e9ea3] uppercase tracking-wider">
          New · Pay your way
        </p>
        <h2
          id="payment-plans-heading"
          className="text-3xl sm:text-5xl font-heading font-extrabold text-[#1d1d1f] dark:text-white leading-tight"
        >
          Spread the cost.<br />Start sooner.
        </h2>
        <p className="text-sm sm:text-base text-[#6e6e73] dark:text-[#9e9ea3] leading-relaxed">
          Pay once, or spread your build over 3 or 6 months. Hosting, a .co.za domain and monthly updates are included while you pay, and your site launches in 7–14 business days.
        </p>
      </div>

      <div className="flex justify-center">
        <div role="group" aria-label="Choose a service" className="inline-flex p-1 rounded-full border border-[#d2d2d7] dark:border-[#2e3037] bg-white dark:bg-[#1c1d22]">
          {(Object.keys(SERVICES) as PlanService[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={service === key}
              onClick={() => setService(key)}
              className={`px-5 py-2.5 min-h-[44px] rounded-full text-sm font-semibold transition-colors cursor-pointer ${
                service === key
                  ? 'bg-[#1d1d1f] text-white dark:bg-white dark:text-[#1d1d1f]'
                  : 'text-[#6e6e73] dark:text-[#9e9ea3] hover:text-[#1d1d1f] dark:hover:text-white'
              }`}
            >
              {SERVICES[key].label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* 6-month: featured */}
        <article className="nearly-tile p-8 flex flex-col space-y-4 !bg-[#1d1d1f] dark:!bg-white !border-[#1d1d1f] dark:!border-white text-white dark:text-[#1d1d1f]">
          <span className={featuredLabelClass}>Lowest monthly</span>
          <h3 className="text-2xl font-heading font-extrabold">6-month plan</h3>
          <p className="text-4xl font-heading font-extrabold">
            {formatCurrencyPrice(monthly6, currency)}
            <span className="text-base font-medium opacity-70"> / month</span>
          </p>
          <p className="text-sm opacity-70">6 payments · about {formatCurrencyPrice(total6, currency)} total</p>
          <ul className="space-y-2 text-sm pt-2">
            {['6 months managed hosting & SSL', 'Year-1 .co.za domain included', updates, '50% off Website Care after your plan'].map((item) => (
              <li key={item} className="flex gap-2"><Check className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />{item}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => inquire('6-month payment plan')}
            className="mt-auto px-6 py-3 rounded-full text-sm font-semibold text-white bg-[#0066cc] hover:bg-[#0077ed] transition-all cursor-pointer"
          >
            Choose 6 months
          </button>
        </article>

        {/* 3-month */}
        <article className="nearly-tile p-8 flex flex-col space-y-4">
          <span className={labelClass}>Faster to finish</span>
          <h3 className="text-2xl font-heading font-extrabold text-[#1d1d1f] dark:text-white">3-month plan</h3>
          <p className="text-4xl font-heading font-extrabold text-[#1d1d1f] dark:text-white">
            {formatCurrencyPrice(monthly3, currency)}
            <span className="text-base font-medium text-[#6e6e73] dark:text-[#9e9ea3]"> / month</span>
          </p>
          <p className="text-sm text-[#6e6e73] dark:text-[#9e9ea3]">3 payments · about {formatCurrencyPrice(total3, currency)} total</p>
          <ul className="space-y-2 text-sm text-[#1d1d1f] dark:text-[#f5f5f7] pt-2">
            {['3 months managed hosting & SSL', 'Year-1 .co.za domain included', updates].map((item) => (
              <li key={item} className="flex gap-2"><Check className="w-4 h-4 mt-0.5 shrink-0 text-[#0066cc] dark:text-[#3898ec]" aria-hidden="true" />{item}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => inquire('3-month payment plan')}
            className="mt-auto text-sm font-semibold text-[#0066cc] dark:text-[#3898ec] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Choose 3 months</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </article>

        {/* once-off */}
        <article className="nearly-tile p-8 flex flex-col space-y-4 bg-[#fbfbfd] dark:bg-[#18191f]">
          <span className={labelClass}>Best total price</span>
          <h3 className="text-2xl font-heading font-extrabold text-[#1d1d1f] dark:text-white">Once-off</h3>
          <p className="text-4xl font-heading font-extrabold text-[#1d1d1f] dark:text-white">{formatCurrencyPrice(basePriceZAR, currency)}</p>
          <p className="text-sm text-[#6e6e73] dark:text-[#9e9ea3]">50% deposit to schedule, 50% before launch</p>
          <ul className="space-y-2 text-sm text-[#1d1d1f] dark:text-[#f5f5f7] pt-2">
            {['Lowest overall cost', '100% ownership on final payment'].map((item) => (
              <li key={item} className="flex gap-2"><Check className="w-4 h-4 mt-0.5 shrink-0 text-[#0066cc] dark:text-[#3898ec]" aria-hidden="true" />{item}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => inquire('once-off schedule')}
            className="mt-auto text-sm font-semibold text-[#0066cc] dark:text-[#3898ec] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Choose once-off</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </article>
      </div>

      <div className="max-w-2xl mx-auto space-y-3 text-center">
        <p className="text-xs text-[#6e6e73] dark:text-[#9e9ea3]">
          Starting prices for standard scope. Your written quotation sets the final scope, price and timeline before any work begins.
        </p>
        <details className="text-left nearly-tile p-5">
          <summary className="cursor-pointer text-sm font-semibold text-[#1d1d1f] dark:text-white">How payment plans work</summary>
          <ul className="mt-3 space-y-2 text-sm text-[#6e6e73] dark:text-[#9e9ea3] leading-relaxed list-disc pl-5">
            <li>Your project is scheduled once you accept the written scope and make the first payment.</li>
            <li>Each payment has a 5-day grace period. If a payment is 7 days overdue the site is paused until it and a R250 reconnection fee are paid.</li>
            <li>You own 100% of your site, code and domain within 5 business days of your final payment.</li>
            <li>You can settle early at any time with no penalty.</li>
          </ul>
        </details>
      </div>
    </section>
  );
}

interface PlansBannerProps {
  onClick: () => void;
}

export function PlansBanner({ onClick }: PlansBannerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full px-4 py-2.5 text-center text-xs sm:text-sm font-medium text-white bg-[#1d1d1f] dark:bg-white dark:text-[#1d1d1f] hover:opacity-90 transition-opacity cursor-pointer"
    >
      New: spread your website over 3 or 6 months, from {formatCurrencyPrice(700)}/month <span aria-hidden="true">→</span>
    </button>
  );
}
