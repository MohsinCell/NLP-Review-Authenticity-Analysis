import { Link, useLocation, useNavigate } from 'react-router-dom';

const productLinks = [
  { to: '/analyze', label: 'Analyze Review' },
  { to: '/product-analysis', label: 'Product Analysis' },
  { to: '/models', label: 'AI Models' },
  { to: '/chrome-extension', label: 'Chrome Extension' },
];

const companyLinks = [
  { to: '/faq', label: 'FAQ' },
  { to: '/privacy', label: 'Privacy Policy' },
  { to: '/contact', label: 'Contact' },
];

export default function Footer() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (location.pathname === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate('/');
    }
  };

  return (
    <footer className="relative border-t border-white/[0.06] bg-black/60 backdrop-blur-md">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-10 pt-12 pb-8 sm:pt-14 sm:pb-10 md:grid-cols-[1.4fr_1fr_1fr] lg:grid-cols-[1.6fr_1fr_1fr]">

          <div className="space-y-5 text-center md:text-left">
            <a
              href="/"
              onClick={handleLogoClick}
              className="inline-flex items-center gap-3 transition-colors duration-200 hover:opacity-80"
            >
              <img
                src="/R.png"
                alt="ReviewIQ"
                className="h-9 w-9 rounded-lg"
              />
              <span className="text-lg font-semibold text-white">ReviewIQ</span>
            </a>
            <p className="mx-auto max-w-xs text-[13px] leading-relaxed text-white/35 md:mx-0">
              NLP-powered review authenticity analysis platform built with{' '}
              <span className="text-white/50">BERT</span> &{' '}
              <span className="text-white/50">RoBERTa</span> transformer models.
              Detect fake reviews, analyze sentiment, and predict ratings across
              major e-commerce platforms.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1 md:justify-start md:gap-3">
              {['Amazon', 'Flipkart', 'Myntra', 'Ajio', 'Nykaa'].map((p) => (
                <span
                  key={p}
                  className="rounded-md bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-white/25 border border-white/[0.06]"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>

          <div className="text-center md:text-left">
            <h4 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/30">
              Product
            </h4>
            <ul className="space-y-2.5">
              {productLinks.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm text-white/40 transition-colors duration-200 hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="text-center md:text-left">
            <h4 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/30">
              Company
            </h4>
            <ul className="space-y-2.5">
              {companyLinks.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm text-white/40 transition-colors duration-200 hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-white/[0.05] py-5 flex items-center justify-center">
          <p className="text-[11px] text-white/30">
            &copy; {new Date().getFullYear()} ReviewIQ. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
