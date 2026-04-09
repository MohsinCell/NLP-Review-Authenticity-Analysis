import { useState, useRef, useLayoutEffect, useMemo } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, User, ArrowRight, Menu, X, LayoutDashboard, Users, Mail, Cookie, Home, Search, ShoppingBag, Brain, MessageSquare, History, Chrome } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import Button from '../ui/Button';
import { cn } from '../../lib/utils';

const adminNavItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/contact-messages', icon: Mail, label: 'Messages' },
  { to: '/admin/cookies', icon: Cookie, label: 'Cookies' },
];

const userNavItems = [
  { to: '/', icon: Home, label: 'Home', end: true },
  { to: '/analyze', icon: Search, label: 'Analyze', end: false },
  { to: '/product-analysis', icon: ShoppingBag, label: 'Product Analysis', end: false },
  { to: '/models', icon: Brain, label: 'Models', end: false },
  { to: '/contact', icon: MessageSquare, label: 'Contact', end: false },
];

const authUserNavItems = [
  ...userNavItems,
  { to: '/history', icon: History, label: 'History', end: false },
  { to: '/chrome-extension', icon: Chrome, label: 'Extension', end: false },
];

export default function Header() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navRef = useRef<HTMLElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0, opacity: 0 });

  const navItems = useMemo(() => {
    return isAdmin ? adminNavItems : (isAuthenticated ? authUserNavItems : userNavItems);
  }, [isAdmin, isAuthenticated]);

  // Update indicator position
  useLayoutEffect(() => {
    const updateIndicator = () => {
      if (!navRef.current) return;
      const activeSpan = navRef.current.querySelector<HTMLElement>('[data-active="true"]');
      if (activeSpan) {
        const activeLink = activeSpan.closest('a');
        if (activeLink) {
          const navRect = navRef.current.getBoundingClientRect();
          const linkRect = activeLink.getBoundingClientRect();
          setIndicator({
            left: linkRect.left - navRect.left,
            width: linkRect.width,
            opacity: 1,
          });
        }
      } else {
        setIndicator(prev => ({ ...prev, opacity: 0 }));
      }
    };

    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [location.pathname, isAdmin, isAuthenticated]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleLogoClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (location.pathname === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate('/');
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-black/80 backdrop-blur-xl">
        {/* Top glow line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.15] to-transparent" />

        <div className="flex h-16 items-center justify-between gap-2 px-3 sm:px-4 lg:px-6">

          <a href="/" onClick={handleLogoClick} className="flex items-center gap-3">
            <img src="/R.png" alt="ReviewIQ" className="h-8 w-8 rounded-lg" />
            <span className="text-base font-semibold text-white">ReviewIQ</span>
          </a>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="relative flex items-center justify-center w-10 h-10 rounded-xl text-white/60 hover:text-white hover:bg-white/[0.05] transition-colors duration-200 lg:hidden"
            aria-label="Toggle menu"
          >
            <AnimatePresence mode="wait" initial={false}>
              {mobileMenuOpen ? (
                <motion.div
                  key="close"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <X className="h-5 w-5" />
                </motion.div>
              ) : (
                <motion.div
                  key="menu"
                  initial={{ rotate: 90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -90, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Menu className="h-5 w-5" />
                </motion.div>
              )}
            </AnimatePresence>
          </button>

          {/* Desktop nav with sliding indicator */}
          <nav ref={navRef} className="relative hidden lg:flex lg:items-center lg:gap-1">
            {/* Sliding glow indicator */}
            <motion.div
              className="absolute inset-y-0 rounded-xl bg-white/[0.08] border border-white/[0.1]"
              initial={false}
              animate={{
                left: indicator.left,
                width: indicator.width,
                opacity: indicator.opacity,
              }}
              transition={{
                type: 'spring',
                stiffness: 400,
                damping: 35,
              }}
              style={{ pointerEvents: 'none' }}
            >
              {/* Inner glow */}
              <div className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            </motion.div>

            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => cn(
                  'relative flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-colors duration-200 z-[1]',
                  isActive
                    ? 'text-white'
                    : 'text-white/50 hover:text-white/80'
                )}
                data-active={undefined}
              >
                {({ isActive }) => (
                  <>
                    <span data-active={isActive} className="absolute inset-0 pointer-events-none" aria-hidden="true" />
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-4">
            {isAuthenticated ? (
              <div className="flex items-center gap-1 sm:gap-2">
                {!isAdmin && (
                  <button
                    onClick={() => navigate('/profile')}
                    className="group flex items-center gap-2 sm:gap-3 rounded-xl px-2 sm:px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/[0.05] transition-all duration-200"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.08] border border-white/[0.1] text-white group-hover:bg-white/[0.12] group-hover:border-white/[0.15] transition-all duration-200">
                      <User className="h-4 w-4" />
                    </div>
                    <span className="hidden font-medium sm:inline max-w-[120px] truncate">{user?.fullName}</span>
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="flex items-center justify-center rounded-xl p-2.5 text-white/40 hover:text-white hover:bg-white/[0.05] transition-all duration-200"
                  title="Logout"
                  aria-label="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 sm:gap-3">
                <Button variant="ghost" size="sm" onClick={() => navigate('/login')} className="hidden sm:flex">
                  Sign In
                </Button>
                <Button size="sm" glow onClick={() => navigate('/signup')} className="group">
                  <span>Get Started</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="fixed top-16 inset-x-0 z-20 border-b border-white/[0.06] bg-black/95 backdrop-blur-xl lg:hidden overflow-hidden"
            >
              <nav className="flex flex-col p-3">
                <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                  {isAdmin ? 'Admin' : 'Navigation'}
                </p>
                {navItems.map((item, i) => (
                  <motion.div
                    key={item.to}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.25 }}
                  >
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) => cn(
                        'flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200',
                        isActive
                          ? 'bg-white/[0.08] text-white'
                          : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </NavLink>
                  </motion.div>
                ))}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
