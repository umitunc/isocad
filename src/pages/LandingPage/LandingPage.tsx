import React from 'react';
import { Link } from 'react-router-dom';
import { Cpu, Layers, Send, ArrowRight, BookOpen, ShieldCheck, HelpCircle } from 'lucide-react';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { ThemeToggle } from '../../components/ThemeToggle';
import { useLocaleStore } from '../../i18n/useLocaleStore';
import { useThemeStore } from '../../store/useThemeStore';

export const LandingPage: React.FC = () => {
  const { t } = useLocaleStore();
  const { theme } = useThemeStore();
  const logoSrc = theme === 'light' ? '/isocad-logo-light.png' : '/isocad-logo.png';

  return (
    <div className="min-h-screen bg-[#060913] bg-tech-grid text-slate-100">
      {/* Top Navbar (uxiGL Liquid Glass) */}
      <nav className="sticky top-0 z-30 border-b border-white/10 liquid-glass">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
          <Link to="/" className="flex items-center gap-2.5 font-bold text-lg tracking-tight">
            <img src={logoSrc} alt="IsoCad Logo" className="h-9 w-auto object-contain" />
          </Link>

          <div className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-300">
            <a href="#features" className="hover:text-cyan-300 transition-colors">
              {t.nav.features}
            </a>
            <a href="#architecture" className="hover:text-cyan-300 transition-colors">
              {t.nav.architecture}
            </a>
            <a href="#faq" className="hover:text-cyan-300 transition-colors">
              {t.nav.faq}
            </a>
            <Link to="/docs" className="hover:text-cyan-300 transition-colors">
              {t.nav.docs}
            </Link>
            <Link to="/demo" className="hover:text-cyan-300 transition-colors">
              {t.nav.liveDemo}
            </Link>
          </div>

          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <LanguageSwitcher />
            <Link
              to="/demo"
              className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-cyan-500 transition-colors shadow-lg shadow-cyan-500/25"
            >
              {t.nav.launchDemo}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <section className="mx-auto max-w-7xl px-6 pt-16 pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div>
                <img
                  src={logoSrc}
                  alt="IsoCad"
                  className="h-32 sm:h-38 w-auto object-contain drop-shadow-[0_0_24px_rgba(0,229,255,0.28)]"
                />
              </div>
              <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight leading-tight text-white">
                {t.hero.title}
              </h1>
              <p className="text-base text-slate-400 leading-relaxed max-w-xl">{t.hero.subtitle}</p>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  to="/demo"
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-6 py-3 text-sm font-semibold text-white hover:bg-cyan-500 shadow-xl shadow-cyan-500/25"
                >
                  {t.hero.ctaDemo}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/docs"
                  className="inline-flex items-center gap-2 rounded-xl liquid-glass px-6 py-3 text-sm font-medium text-slate-200 hover:border-cyan-400/40"
                >
                  <BookOpen className="h-4 w-4 text-cyan-400" />
                  {t.hero.ctaDocs}
                </Link>
              </div>
            </div>

            <div className="[perspective:1200px]">
              <img
                src={theme === 'light' ? '/hero-preview-light.webp' : '/hero-preview-dark.webp'}
                alt="IsoCad Piping Isometric PDF Editor Preview"
                className="w-full h-auto rounded-2xl object-contain drop-shadow-[0_28px_60px_rgba(0,229,255,0.22)] transition-transform duration-500 [transform:rotateY(-10deg)_rotateX(4deg)] hover:[transform:rotateY(-3deg)_rotateX(1deg)]"
              />
            </div>
          </div>
        </section>

        {/* 4-Card Bento Grid */}
        <section id="features" className="mx-auto max-w-7xl px-6 py-16 border-t border-slate-800/70">
          <div className="text-center max-w-2xl mx-auto mb-12 space-y-2">
            <h2 className="font-display text-3xl font-bold">{t.bento.title}</h2>
            <p className="text-sm text-slate-400">{t.bento.subtitle}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: <Layers className="h-5 w-5 text-cyan-400" />, title: t.bento.c1Title, desc: t.bento.c1Desc },
              { icon: <Cpu className="h-5 w-5 text-amber-400" />, title: t.bento.c2Title, desc: t.bento.c2Desc },
              { icon: <ShieldCheck className="h-5 w-5 text-emerald-400" />, title: t.bento.c3Title, desc: t.bento.c3Desc },
              { icon: <Send className="h-5 w-5 text-blue-400" />, title: t.bento.c4Title, desc: t.bento.c4Desc },
            ].map((card, i) => (
              <article key={i} className="rounded-2xl liquid-glass-card p-6">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900/80 border border-white/10">
                  {card.icon}
                </div>
                <h3 className="font-display text-base font-semibold text-white mb-2">{card.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{card.desc}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Architecture Showcase */}
        <section id="architecture" className="mx-auto max-w-7xl px-6 py-16 border-t border-slate-800/70">
          <div className="rounded-2xl liquid-glass-card p-8 grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
            <div className="lg:col-span-2 space-y-3">
              <div className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
                {t.arch.eyebrow}
              </div>
              <h2 className="font-display text-2xl font-bold text-white">{t.arch.title}</h2>
              <p className="text-sm text-slate-400 leading-relaxed">{t.arch.desc}</p>
            </div>
            <div className="flex flex-col gap-2 font-mono text-xs">
              <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3 text-cyan-300">
                ICadEntity &rarr; WebGL2Renderer
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3 text-amber-300">
                IPipingParserStrategy &rarr; Danieli / Linde
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3 text-emerald-300">
                IExporter &rarr; pdf-lib / exceljs / DXF
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-950/70 p-3 text-blue-300">
                IDataSyncAdapter &rarr; ERP / REST / Iframe
              </div>
            </div>
          </div>
        </section>

        {/* GEO-Optimized FAQ Section */}
        <section id="faq" className="mx-auto max-w-7xl px-6 py-16 border-t border-slate-800/70">
          <div className="flex items-center justify-center gap-2 mb-10">
            <HelpCircle className="h-5 w-5 text-cyan-400" />
            <h2 className="font-display text-2xl font-bold text-center">{t.faq.title}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {t.faq.items.map((item, idx) => (
              <article key={idx} className="rounded-2xl liquid-glass-card p-6 space-y-2.5">
                <h3 className="font-display text-sm font-semibold text-cyan-300">{item.q}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{item.a}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800/80 py-8 text-center text-xs text-slate-500 font-mono">
        IsoCad Industrial WebGL2 CAD &amp; Piping PDF Platform • TR / EN / RU
      </footer>
    </div>
  );
};
