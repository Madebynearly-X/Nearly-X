import React, { useState, useEffect } from 'react';
import { ThemeMode, TabType, Currency, ServicePackage, ContactInquiry } from './types';
import Navbar from './components/Navbar';
import LandingPagesPage from './components/LandingPagesPage';
import BusinessWebsitesPage from './components/BusinessWebsitesPage';
import WebsiteCarePage from './components/WebsiteCarePage';
import WhyChooseUsPage from './components/WhyChooseUsPage';
import ConceptViewer from './components/ConceptViewer';
import CalculatorCard from './components/CalculatorCard';
import WebsiteAuditGrader from './components/WebsiteAuditGrader';
import ContactForm from './components/ContactForm';
import InquiriesList from './components/InquiriesList';
import FloatingActionHub from './components/FloatingActionHub';
import PaymentPlans, { PlansBanner } from './components/PaymentPlans';
import { formatCurrencyPrice } from './utils/currency';
import {
  ArrowRight,
  ChevronDown,
  ShieldCheck,
  CheckCircle2,
  Mail,
  ExternalLink,
} from 'lucide-react';

export default function App() {
  // Theme state: defaults to light to match nearly-x.pages.dev, syncs with localStorage
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('nearlyx_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return 'light';
  });

  // Currency state: defaults to ZAR, reads from localStorage
  const [currency, setCurrency] = useState<Currency>(() => {
    const saved = localStorage.getItem('nearlyx_currency');
    if (saved === 'ZAR' || saved === 'USD' || saved === 'EUR' || saved === 'GBP') return saved;
    return 'ZAR';
  });

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedPackage, setSelectedPackage] = useState<ServicePackage>('starter-website');
  const [prefilledDetails, setPrefilledDetails] = useState<string>('');
  const [prefilledTotal, setPrefilledTotal] = useState<number | undefined>(undefined);
  const [inquiryCount, setInquiryCount] = useState<number>(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Sync dark class on document element
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('nearlyx_theme', theme);
  }, [theme]);

  // Sync currency in localStorage
  useEffect(() => {
    localStorage.setItem('nearlyx_currency', currency);
  }, [currency]);

  // Read stored inquiries count
  const refreshInquiryCount = () => {
    try {
      const stored = localStorage.getItem('nearlyx_inquiries');
      if (stored) {
        const list = JSON.parse(stored);
        setInquiryCount(list.length);
      } else {
        setInquiryCount(0);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    refreshInquiryCount();
  }, []);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const handleNavigateToContact = (pkg?: string, note?: string) => {
    if (pkg) {
      if (
        pkg === 'landing-page' ||
        pkg === 'starter-website' ||
        pkg === 'business-website' ||
        pkg === 'care-plan' ||
        pkg === 'custom'
      ) {
        setSelectedPackage(pkg);
      }
    }
    if (note) {
      setPrefilledDetails(note);
    }
    setActiveTab('contact');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleApplyEstimateFromCalc = (pkg: ServicePackage, note: string, totalZAR: number) => {
    setSelectedPackage(pkg);
    setPrefilledDetails(note);
    setPrefilledTotal(totalZAR);
    setActiveTab('contact');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleInquirySubmitted = () => {
    refreshInquiryCount();
  };

  const isDark = theme === 'dark';

  // Banner link: make sure the Overview tab is showing, then scroll to the plans section.
  const handleGoToPlans = () => {
    setActiveTab('overview');
    window.setTimeout(() => {
      document.getElementById('payment-plans')?.scrollIntoView({ behavior: 'smooth' });
    }, 60);
  };

  const homeFaqs = [
    {
      q: 'What will you need from me?',
      a: "You'll provide your business and service information, any brand assets and content you want to use, and feedback during the agreed review rounds. We'll confirm the exact inputs in the written scope.",
    },
    {
      q: 'Who pays for the domain and hosting?',
      a: 'Domain and hosting fees are separate unless your written quote says otherwise. Accounts should be registered in your name so you keep full control of them.',
    },
    {
      q: 'What does Website care include?',
      a: 'Plans start from R500/month and include WordPress, theme and plugin updates, a monthly backup and basic security check, plus up to two hours of small content changes. Hosting, domain renewals and new features are separate.',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f5f7] dark:bg-[#111215] text-[#1d1d1f] dark:text-[#f5f5f7] transition-colors duration-200">
      <PlansBanner onClick={handleGoToPlans} />

      {/* Top Navbar */}
      <Navbar
        theme={theme}
        onToggleTheme={handleToggleTheme}
        currency={currency}
        onSelectCurrency={setCurrency}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        inquiryCount={inquiryCount}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-[1160px] mx-auto px-4 sm:px-6 pt-6 sm:pt-10">
        {/* TAB 1: OVERVIEW (Modeled precisely after nearly-x.pages.dev index) */}
        {activeTab === 'overview' && (
          <div className="space-y-16 animate-fade-in pb-16">
            {/* HERO SECTION */}
            <section className="text-center max-w-3xl mx-auto pt-4 sm:pt-8 space-y-4">
              <p className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium text-[#1d1d1f] dark:text-[#f5f5f7] bg-white dark:bg-[#1c1d22] border border-[#d2d2d7] dark:border-[#2e3037]">
                <span className="w-2 h-2 rounded-full bg-[#34c759] dot-pulse"></span>
                <span>Independent web design · South Africa-based, working worldwide</span>
              </p>

              <h1 className="text-4xl sm:text-6xl md:text-7xl font-heading font-extrabold tracking-tight text-[#1d1d1f] dark:text-white leading-[1.06]">
                Websites for<br />
                <span className="text-[#6e6e73] dark:text-[#9e9ea3]">businesses ready for more.</span>
              </h1>

              <p className="text-base sm:text-xl text-[#6e6e73] dark:text-[#9e9ea3] font-normal leading-relaxed max-w-2xl mx-auto">
                Mobile-first landing pages and business websites that make your services easy to understand and the next step easy to take.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => handleNavigateToContact('starter-website')}
                  className="px-6 py-3 rounded-full text-sm font-semibold text-white bg-[#0066cc] hover:bg-[#0077ed] transition-all shadow-[0_6px_20px_rgba(0,102,204,0.22)] active:scale-[0.98] cursor-pointer"
                >
                  Tell us about your project
                </button>
                <a
                  href="#services"
                  className="px-6 py-3 rounded-full text-sm font-semibold text-[#1d1d1f] dark:text-white border border-[#d2d2d7] dark:border-[#2e3037] hover:bg-black/[0.03] dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
                >
                  Explore services ↓
                </a>
              </div>

              <p className="text-xs text-[#6e6e73] dark:text-[#9e9ea3]">
                Clear scope. Considered design. No surprise invoices.
              </p>
            </section>

            {/* HERO BROWSER STAGE MOCKUP */}
            <div className="max-w-3xl mx-auto">
              <div className="nearly-tile overflow-hidden shadow-2xl border border-[#d2d2d7] dark:border-[#2e3037]">
                {/* Browser bar */}
                <div className="h-9 px-4 bg-[#f5f5f7] dark:bg-[#1a1c22] border-b border-[#d2d2d7] dark:border-[#2e3037] flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#d0d0d5] dark:bg-[#3e424e]"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-[#d0d0d5] dark:bg-[#3e424e]"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-[#d0d0d5] dark:bg-[#3e424e]"></span>
                  </div>
                  <span className="text-[11px] text-[#6e6e73] dark:text-[#9e9ea3] font-medium">
                    Concept preview · yourbusiness.co.za
                  </span>
                  <div className="w-10"></div>
                </div>

                {/* Inside stage content */}
                <div className="p-8 sm:p-14 text-center space-y-4 bg-gradient-to-b from-[#ffffff] to-[#f9f9fb] dark:from-[#1c1d22] dark:to-[#141519]">
                  <small className="text-[11px] font-bold tracking-widest uppercase text-[#0066cc] dark:text-[#3898ec] block">
                    MADE TO MOVE YOU FORWARD
                  </small>
                  <h2 className="text-3xl sm:text-5xl font-heading font-extrabold text-[#1d1d1f] dark:text-white leading-tight">
                    Good work deserves<br />to be seen.
                  </h2>
                  <p className="text-sm sm:text-base text-[#6e6e73] dark:text-[#9e9ea3] max-w-md mx-auto">
                    A considered online home for your next chapter.
                  </p>
                  <div className="pt-2">
                    <button
                      onClick={() => handleNavigateToContact('starter-website')}
                      className="inline-block px-6 py-2.5 rounded-full text-xs font-semibold bg-[#0066cc] text-white shadow-md hover:bg-[#0077ed] transition-colors cursor-pointer"
                    >
                      Tell us about your project
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* SERVICES SECTION */}
            <section id="services" className="space-y-8 scroll-mt-24">
              <div className="text-center max-w-2xl mx-auto space-y-2">
                <p className="text-xs font-semibold text-[#6e6e73] dark:text-[#9e9ea3] uppercase tracking-wider">
                  A good place to start
                </p>
                <h2 className="text-3xl sm:text-5xl font-heading font-extrabold text-[#1d1d1f] dark:text-white leading-tight">
                  Less noise.<br />More of what matters.
                </h2>
                <p className="text-sm sm:text-base text-[#6e6e73] dark:text-[#9e9ea3] leading-relaxed">
                  Whether you need one sharp page or a complete online home, we make the process feel clear from day one.
                </p>
              </div>

              {/* 3 Core Tiles */}
              <div className="grid md:grid-cols-3 gap-6">
                {/* Tile 1: Landing Pages */}
                <article className="nearly-tile p-8 flex flex-col justify-between space-y-6">
                  <div className="space-y-3">
                    <span className="text-[11px] font-bold tracking-widest text-[#6e6e73] dark:text-[#9e9ea3] uppercase">
                      01 / FOCUS
                    </span>
                    <h3 className="text-2xl font-heading font-extrabold text-[#1d1d1f] dark:text-white">
                      Landing pages
                    </h3>
                    <p className="text-sm text-[#6e6e73] dark:text-[#9e9ea3] leading-relaxed">
                      One clear message. One next step. A focused page built to turn interest into enquiries.
                    </p>
                    <p className="text-lg font-heading font-bold text-[#1d1d1f] dark:text-white pt-2">
                      From {formatCurrencyPrice(2500, currency)}
                    </p>
                  </div>
                  <div>
                    <button
                      onClick={() => {
                        setActiveTab('landing-pages');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="text-sm font-semibold text-[#0066cc] dark:text-[#3898ec] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>Explore landing pages</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </article>

                {/* Tile 2: Business Websites */}
                <article className="nearly-tile p-8 flex flex-col justify-between space-y-6 bg-[#fbfbfd] dark:bg-[#18191f]">
                  <div className="space-y-3">
                    <span className="text-[11px] font-bold tracking-widest text-[#6e6e73] dark:text-[#9e9ea3] uppercase">
                      02 / FOUNDATION
                    </span>
                    <h3 className="text-2xl font-heading font-extrabold text-[#1d1d1f] dark:text-white">
                      Business websites
                    </h3>
                    <p className="text-sm text-[#6e6e73] dark:text-[#9e9ea3] leading-relaxed">
                      A considered home for your services, your story and the people you want to reach.
                    </p>
                    <p className="text-lg font-heading font-bold text-[#1d1d1f] dark:text-white pt-2">
                      From {formatCurrencyPrice(4500, currency)}
                    </p>
                  </div>
                  <div>
                    <button
                      onClick={() => {
                        setActiveTab('business-websites');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="text-sm font-semibold text-[#0066cc] dark:text-[#3898ec] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>Explore business websites</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </article>

                {/* Tile 3: Website Care */}
                <article className="nearly-tile p-8 flex flex-col justify-between space-y-6">
                  <div className="space-y-3">
                    <span className="text-[11px] font-bold tracking-widest text-[#6e6e73] dark:text-[#9e9ea3] uppercase">
                      03 / LONGEVITY
                    </span>
                    <h3 className="text-2xl font-heading font-extrabold text-[#1d1d1f] dark:text-white">
                      Website care
                    </h3>
                    <p className="text-sm text-[#6e6e73] dark:text-[#9e9ea3] leading-relaxed">
                      Keep your website looked after, updated and ready to keep doing its job.
                    </p>
                    <p className="text-lg font-heading font-bold text-[#1d1d1f] dark:text-white pt-2">
                      From {formatCurrencyPrice(500, currency)}/month
                    </p>
                  </div>
                  <div>
                    <button
                      onClick={() => {
                        setActiveTab('website-care');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="text-sm font-semibold text-[#0066cc] dark:text-[#3898ec] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>Explore website care</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </article>
              </div>
            </section>

            {/* PAYMENT PLANS */}
            <PaymentPlans
              currency={currency}
              onInquire={(pkg, note) => handleNavigateToContact(pkg, note)}
            />

            {/* PROCESS SECTION */}
            <section className="space-y-8">
              <div className="text-center max-w-2xl mx-auto space-y-2">
                <p className="text-xs font-semibold text-[#6e6e73] dark:text-[#9e9ea3] uppercase tracking-wider">
                  How it works
                </p>
                <h2 className="text-3xl sm:text-5xl font-heading font-extrabold text-[#1d1d1f] dark:text-white leading-tight">
                  A clear path from idea to launch.
                </h2>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                <article className="nearly-tile p-7 space-y-3">
                  <span className="text-[11px] font-bold tracking-widest text-[#6e6e73] dark:text-[#9e9ea3] uppercase">
                    01 / SCOPE & DIRECTION
                  </span>
                  <h3 className="text-xl font-heading font-extrabold text-[#1d1d1f] dark:text-white">
                    Clarify the brief
                  </h3>
                  <p className="text-sm text-[#6e6e73] dark:text-[#9e9ea3] leading-relaxed">
                    We talk through your audience and goals, then confirm the pages, deliverables, price and timeline in writing.
                  </p>
                </article>

                <article className="nearly-tile p-7 space-y-3 bg-[#fbfbfd] dark:bg-[#18191f]">
                  <span className="text-[11px] font-bold tracking-widest text-[#6e6e73] dark:text-[#9e9ea3] uppercase">
                    02 / DESIGN & BUILD
                  </span>
                  <h3 className="text-xl font-heading font-extrabold text-[#1d1d1f] dark:text-white">
                    Make it real
                  </h3>
                  <p className="text-sm text-[#6e6e73] dark:text-[#9e9ea3] leading-relaxed">
                    We shape the structure and design, build the site for mobile and desktop, and share it for your feedback.
                  </p>
                </article>

                <article className="nearly-tile p-7 space-y-3">
                  <span className="text-[11px] font-bold tracking-widest text-[#6e6e73] dark:text-[#9e9ea3] uppercase">
                    03 / LAUNCH
                  </span>
                  <h3 className="text-xl font-heading font-extrabold text-[#1d1d1f] dark:text-white">
                    Test and hand over
                  </h3>
                  <p className="text-sm text-[#6e6e73] dark:text-[#9e9ea3] leading-relaxed">
                    We check the key pages and enquiry paths, launch the approved site, then provide a complete client handover.
                  </p>
                </article>
              </div>

              <p className="text-xs text-[#6e6e73] dark:text-[#9e9ea3] text-center max-w-2xl mx-auto">
                Typical timelines: landing pages 1–2 weeks; starter websites 2–4 weeks; business websites 4–6 weeks. Timelines depend on the agreed scope and receiving content and feedback on time.
              </p>
            </section>

            {/* APPROACH SECTION */}
            <section className="grid md:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <p className="text-xs font-semibold text-[#6e6e73] dark:text-[#9e9ea3] uppercase tracking-wider">
                  The NEARLY approach
                </p>
                <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-[#1d1d1f] dark:text-white">
                  Premium doesn't have to mean complicated.
                </h2>
                <p className="text-sm sm:text-base text-[#6e6e73] dark:text-[#9e9ea3] leading-relaxed">
                  Good design should make things feel simpler. We focus on the essentials, agree on the scope upfront and build around what your business actually needs.
                </p>
                <div className="pt-2 flex items-center gap-3">
                  <button
                    onClick={() => handleNavigateToContact('starter-website')}
                    className="px-6 py-2.5 rounded-full text-xs font-semibold text-white bg-[#1d1d1f] hover:bg-black dark:bg-white dark:text-[#1d1d1f] transition-all cursor-pointer"
                  >
                    Tell us about your project
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('why-us');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="px-5 py-2.5 rounded-full text-xs font-semibold text-[#0066cc] dark:text-[#3898ec] hover:underline cursor-pointer"
                  >
                    Why choose us →
                  </button>
                </div>
              </div>

              <div className="nearly-tile p-8 sm:p-10 space-y-4 bg-white dark:bg-[#1c1d22]">
                <span className="text-[11px] font-bold tracking-widest text-[#0066cc] dark:text-[#3898ec] uppercase">
                  YOUR NEXT CHAPTER
                </span>
                <h3 className="text-2xl sm:text-3xl font-heading font-extrabold text-[#1d1d1f] dark:text-white">
                  Make it mean something.
                </h3>
                <p className="text-sm text-[#6e6e73] dark:text-[#9e9ea3] leading-relaxed">
                  A website with purpose, personality and room to grow.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => handleNavigateToContact('starter-website')}
                    className="text-xs font-bold text-[#0066cc] dark:text-[#3898ec] hover:underline"
                  >
                    Tell us about your project ↗
                  </button>
                </div>
              </div>
            </section>

            {/* SELECTED CONCEPTS SHOWCASE */}
            <section className="space-y-8">
              <div className="text-center max-w-2xl mx-auto space-y-2">
                <p className="text-xs font-semibold text-[#6e6e73] dark:text-[#9e9ea3] uppercase tracking-wider">
                  Selected concepts
                </p>
                <h2 className="text-3xl sm:text-5xl font-heading font-extrabold text-[#1d1d1f] dark:text-white leading-tight">
                  Ideas worth seeing.
                </h2>
                <p className="text-sm text-[#6e6e73] dark:text-[#9e9ea3]">
                  Three illustrative directions, each with its own character and purpose.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-6">
                {/* Concept 1: Goodwork */}
                <div className="nearly-tile overflow-hidden flex flex-col justify-between">
                  <div className="p-4 bg-[#f5f5f7] dark:bg-[#1a1c22] border-b border-[#d2d2d7] dark:border-[#2e3037] flex items-center justify-between text-xs text-[#6e6e73] dark:text-[#9e9ea3]">
                    <span className="font-semibold text-[#1d1d1f] dark:text-white">goodwork.home</span>
                    <span className="text-[10px] uppercase font-bold text-[#0066cc] dark:text-[#3898ec]">Home Services</span>
                  </div>
                  <div className="p-6 space-y-2">
                    <h3 className="text-xl font-heading font-bold text-[#1d1d1f] dark:text-white">
                      Trust, at first glance.
                    </h3>
                    <p className="text-xs text-[#6e6e73] dark:text-[#9e9ea3] leading-relaxed">
                      A warm, confident first impression, with clear services and an easy route to a quote.
                    </p>
                  </div>
                  <div className="p-6 pt-0">
                    <button
                      onClick={() => {
                        setActiveTab('concepts');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="text-xs font-semibold text-[#0066cc] dark:text-[#3898ec] hover:underline flex items-center gap-1"
                    >
                      <span>Interact with live demo</span>
                      <span>↗</span>
                    </button>
                  </div>
                </div>

                {/* Concept 2: Forme Studio */}
                <div className="nearly-tile overflow-hidden flex flex-col justify-between">
                  <div className="p-4 bg-[#f5f5f7] dark:bg-[#1a1c22] border-b border-[#d2d2d7] dark:border-[#2e3037] flex items-center justify-between text-xs text-[#6e6e73] dark:text-[#9e9ea3]">
                    <span className="font-semibold text-[#1d1d1f] dark:text-white">formestudio.co</span>
                    <span className="text-[10px] uppercase font-bold text-[#0066cc] dark:text-[#3898ec]">Wellness</span>
                  </div>
                  <div className="p-6 space-y-2">
                    <h3 className="text-xl font-heading font-bold text-[#1d1d1f] dark:text-white">
                      Room to breathe.
                    </h3>
                    <p className="text-xs text-[#6e6e73] dark:text-[#9e9ea3] leading-relaxed">
                      An editorial, considered layout that gives the story, services and booking action space to breathe.
                    </p>
                  </div>
                  <div className="p-6 pt-0">
                    <button
                      onClick={() => {
                        setActiveTab('concepts');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="text-xs font-semibold text-[#0066cc] dark:text-[#3898ec] hover:underline flex items-center gap-1"
                    >
                      <span>Interact with live demo</span>
                      <span>↗</span>
                    </button>
                  </div>
                </div>

                {/* Concept 3: PULSE.live */}
                <div className="nearly-tile overflow-hidden flex flex-col justify-between">
                  <div className="p-4 bg-[#f5f5f7] dark:bg-[#1a1c22] border-b border-[#d2d2d7] dark:border-[#2e3037] flex items-center justify-between text-xs text-[#6e6e73] dark:text-[#9e9ea3]">
                    <span className="font-semibold text-[#1d1d1f] dark:text-white">pulse.live</span>
                    <span className="text-[10px] uppercase font-bold text-[#0066cc] dark:text-[#3898ec]">Live Events</span>
                  </div>
                  <div className="p-6 space-y-2">
                    <h3 className="text-xl font-heading font-bold text-[#1d1d1f] dark:text-white">
                      Feel the room move.
                    </h3>
                    <p className="text-xs text-[#6e6e73] dark:text-[#9e9ea3] leading-relaxed">
                      A bold, atmospheric direction that brings the lineup, event details and ticket journey together.
                    </p>
                  </div>
                  <div className="p-6 pt-0">
                    <button
                      onClick={() => {
                        setActiveTab('concepts');
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="text-xs font-semibold text-[#0066cc] dark:text-[#3898ec] hover:underline flex items-center gap-1"
                    >
                      <span>Interact with live demo</span>
                      <span>↗</span>
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* FAQ SECTION */}
            <section className="max-w-2xl mx-auto space-y-6">
              <div className="text-center space-y-1">
                <p className="text-xs font-semibold text-[#6e6e73] dark:text-[#9e9ea3] uppercase tracking-wider">
                  Good to know
                </p>
                <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-[#1d1d1f] dark:text-white">
                  Before we begin.
                </h2>
              </div>

              <div className="space-y-3">
                {homeFaqs.map((faq, index) => {
                  const isOpen = openFaq === index;
                  return (
                    <div
                      key={index}
                      className="nearly-tile overflow-hidden transition-all duration-200 border border-[#d2d2d7] dark:border-[#2e3037]"
                    >
                      <button
                        onClick={() => setOpenFaq(isOpen ? null : index)}
                        className="w-full p-5 text-left flex items-center justify-between gap-4 font-heading font-bold text-sm sm:text-base text-[#1d1d1f] dark:text-white cursor-pointer"
                      >
                        <span>{faq.q}</span>
                        <ChevronDown
                          className={`w-4 h-4 text-[#6e6e73] dark:text-[#9e9ea3] transition-transform duration-200 shrink-0 ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-[#6e6e73] dark:text-[#9e9ea3] leading-relaxed border-t border-[#d2d2d7]/50 dark:border-[#2e3037]/50 animate-fade-in">
                          {faq.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* CTA BAND */}
            <section className="nearly-tile p-8 sm:p-12 flex flex-col sm:flex-row items-center justify-between gap-6 bg-white dark:bg-[#1c1d22]">
              <div className="space-y-2 text-center sm:text-left">
                <p className="text-xs font-semibold text-[#6e6e73] dark:text-[#9e9ea3] uppercase tracking-wider">
                  Your move
                </p>
                <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-[#1d1d1f] dark:text-white">
                  Your next chapter deserves a better website.
                </h2>
                <p className="text-sm text-[#6e6e73] dark:text-[#9e9ea3]">
                  Tell us where you're going. We'll help you figure out the right next step.
                </p>
              </div>

              <button
                onClick={() => handleNavigateToContact('starter-website')}
                className="px-6 py-3 rounded-full text-sm font-semibold text-white bg-[#0066cc] hover:bg-[#0077ed] transition-all shadow-[0_6px_20px_rgba(0,102,204,0.22)] active:scale-[0.98] shrink-0 cursor-pointer"
              >
                Tell us about your project
              </button>
            </section>
          </div>
        )}

        {/* TAB 2: LANDING PAGES */}
        {activeTab === 'landing-pages' && (
          <LandingPagesPage
            theme={theme}
            currency={currency}
            onInquire={handleNavigateToContact}
            onNavigateToBusiness={() => {
              setActiveTab('business-websites');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {/* TAB 3: BUSINESS WEBSITES */}
        {activeTab === 'business-websites' && (
          <BusinessWebsitesPage
            theme={theme}
            currency={currency}
            onInquire={handleNavigateToContact}
            onNavigateToLanding={() => {
              setActiveTab('landing-pages');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {/* TAB 4: WEBSITE CARE */}
        {activeTab === 'website-care' && (
          <WebsiteCarePage
            theme={theme}
            currency={currency}
            onInquire={handleNavigateToContact}
          />
        )}

        {/* TAB 5: WHY CHOOSE US (User explicitly requested dedicated page) */}
        {activeTab === 'why-us' && (
          <WhyChooseUsPage
            theme={theme}
            currency={currency}
            onNavigate={(tab) => {
              setActiveTab(tab);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onInquire={(note) => handleNavigateToContact('starter-website', note)}
          />
        )}

        {/* TAB 6: SELECTED CONCEPTS INTERACTIVE PLAYGROUND */}
        {activeTab === 'concepts' && (
          <div className="space-y-8 animate-fade-in pb-16">
            <ConceptViewer
              theme={theme}
              onInquire={(pkg) => handleNavigateToContact(pkg)}
            />
          </div>
        )}

        {/* TAB 7: COST ESTIMATOR & TOOLS */}
        {activeTab === 'calculator' && (
          <div className="space-y-12 animate-fade-in pb-16">
            <CalculatorCard
              theme={theme}
              currency={currency}
              onApplyEstimate={handleApplyEstimateFromCalc}
            />

            <WebsiteAuditGrader
              theme={theme}
              currency={currency}
              onApplyAuditToBrief={(note) => handleNavigateToContact('starter-website', note)}
            />
          </div>
        )}

        {/* TAB 8: CONTACT / TELL US ABOUT YOUR PROJECT */}
        {activeTab === 'contact' && (
          <div className="space-y-12 animate-fade-in pb-16">
            {/* Direct contact header bar matching nearly-x.pages.dev/contact.html */}
            <div className="grid md:grid-cols-12 gap-8 items-start">
              <div className="md:col-span-5 space-y-4">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium text-[#0066cc] dark:text-[#3898ec] bg-[#0066cc]/10">
                  <span className="w-2 h-2 rounded-full bg-[#34c759] dot-pulse"></span>
                  <span>No pressure, just a conversation</span>
                </span>

                <h1 className="text-3xl sm:text-5xl font-heading font-extrabold tracking-tight text-[#1d1d1f] dark:text-white leading-tight">
                  Tell us what<br />
                  <span className="text-[#6e6e73] dark:text-[#9e9ea3]">you're building.</span>
                </h1>

                <p className="text-sm text-[#6e6e73] dark:text-[#9e9ea3] leading-relaxed">
                  A few details are all we need to start understanding your business and the kind of website that could help.
                </p>

                <div className="space-y-2 pt-2 text-sm text-[#1d1d1f] dark:text-neutral-200">
                  <a
                    href="mailto:madebynearly@gmail.com"
                    className="block text-[#0066cc] dark:text-[#3898ec] hover:underline font-medium"
                  >
                    madebynearly@gmail.com ↗
                  </a>
                  <a
                    href="https://wa.me/27783940421"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-[#0066cc] dark:text-[#3898ec] hover:underline font-medium"
                  >
                    WhatsApp +27 78 394 0421 ↗
                  </a>
                  <p className="text-xs text-[#6e6e73] dark:text-[#9e9ea3]">
                    Based in South Africa, working with businesses worldwide.
                  </p>
                </div>
              </div>

              {/* Form container */}
              <div className="md:col-span-7">
                <ContactForm
                  theme={theme}
                  currency={currency}
                  initialPackage={selectedPackage}
                  initialDetails={prefilledDetails}
                  initialTotal={prefilledTotal}
                  onInquirySubmitted={handleInquirySubmitted}
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 9: SAVED INQUIRIES */}
        {activeTab === 'inquiries' && (
          <div className="space-y-8 animate-fade-in pb-16">
            <InquiriesList
              theme={theme}
              onNavigateToContact={() => setActiveTab('contact')}
            />
          </div>
        )}
      </main>

      {/* FOOTER (Modeled precisely after nearly-x.pages.dev) */}
      <footer className="border-t border-[#d2d2d7] dark:border-[#2e3037] bg-[#f5f5f7] dark:bg-[#111215] text-[#1d1d1f] dark:text-[#f5f5f7] pt-12 pb-16 mt-16 transition-colors">
        <div className="max-w-[1160px] mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row justify-between gap-10 pb-10 border-b border-[#d2d2d7]/60 dark:border-[#2e3037]/60">
            {/* Brand & Tagline */}
            <div className="space-y-2">
              <button
                onClick={() => {
                  setActiveTab('overview');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="flex items-center gap-2 text-left"
              >
                <span className="w-7 h-7 rounded-[8px] bg-[#1d1d1f] text-white dark:bg-white dark:text-[#1d1d1f] flex items-center justify-center font-bold text-xs tracking-tight">
                  N.
                </span>
                <span className="font-heading font-bold text-base tracking-tight">
                  NEARLY <small className="text-xs font-normal text-[#6e6e73] dark:text-[#9e9ea3]">Studio</small>
                </span>
              </button>
              <p className="text-sm text-[#6e6e73] dark:text-[#9e9ea3] font-medium leading-relaxed">
                Good work deserves<br />to be seen.
              </p>
            </div>

            {/* Links Columns */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-sm">
              <div className="space-y-2">
                <strong className="block text-xs font-bold uppercase tracking-wider text-[#1d1d1f] dark:text-white">
                  Explore
                </strong>
                <button
                  onClick={() => {
                    setActiveTab('landing-pages');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="block text-xs text-[#6e6e73] dark:text-[#9e9ea3] hover:text-[#0066cc] text-left"
                >
                  Landing pages
                </button>
                <button
                  onClick={() => {
                    setActiveTab('business-websites');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="block text-xs text-[#6e6e73] dark:text-[#9e9ea3] hover:text-[#0066cc] text-left"
                >
                  Business websites
                </button>
                <button
                  onClick={() => {
                    setActiveTab('website-care');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="block text-xs text-[#6e6e73] dark:text-[#9e9ea3] hover:text-[#0066cc] text-left"
                >
                  Website care
                </button>
              </div>

              <div className="space-y-2">
                <strong className="block text-xs font-bold uppercase tracking-wider text-[#1d1d1f] dark:text-white">
                  NEARLY
                </strong>
                <button
                  onClick={() => {
                    setActiveTab('why-us');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="block text-xs text-[#6e6e73] dark:text-[#9e9ea3] hover:text-[#0066cc] text-left"
                >
                  Why choose us
                </button>
                <button
                  onClick={() => {
                    setActiveTab('concepts');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="block text-xs text-[#6e6e73] dark:text-[#9e9ea3] hover:text-[#0066cc] text-left"
                >
                  Selected concepts
                </button>
                <button
                  onClick={() => {
                    setActiveTab('calculator');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="block text-xs text-[#6e6e73] dark:text-[#9e9ea3] hover:text-[#0066cc] text-left"
                >
                  Cost estimator
                </button>
                <button
                  onClick={() => {
                    setActiveTab('contact');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="block text-xs text-[#6e6e73] dark:text-[#9e9ea3] hover:text-[#0066cc] text-left"
                >
                  Contact
                </button>
              </div>

              <div className="space-y-2 col-span-2 sm:col-span-1">
                <strong className="block text-xs font-bold uppercase tracking-wider text-[#1d1d1f] dark:text-white">
                  Say hello
                </strong>
                <a
                  href="mailto:madebynearly@gmail.com"
                  className="block text-xs text-[#0066cc] dark:text-[#3898ec] hover:underline"
                >
                  Email NEARLY ↗
                </a>
                <a
                  href="https://wa.me/27783940421"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-xs text-[#0066cc] dark:text-[#3898ec] hover:underline"
                >
                  WhatsApp ↗
                </a>
                <span className="block text-[11px] text-[#6e6e73] dark:text-[#9e9ea3]">
                  South Africa · Working worldwide
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Copyright */}
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#6e6e73] dark:text-[#9e9ea3]">
            <p>© {new Date().getFullYear()} NEARLY Studio. Made with intention.</p>
            <p>Independent web design · South Africa-based, working worldwide</p>
          </div>
        </div>
      </footer>

      {/* Floating Action Hub (WhatsApp, Email & Project Kickoff) */}
      <FloatingActionHub
        theme={theme}
        onNavigateTab={(tab) => {
          setActiveTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    </div>
  );
}
