import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import Header from './Header';
import Footer from './Footer';
import AnimatedBackground from './AnimatedBackground';

export default function AppLayout() {
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup';

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden">
      <AnimatedBackground />

      <a
        href="#main-content"
        className="skip-to-content"
      >
        Skip to main content
      </a>

      {!isAuthPage && (
        <div className="relative z-10">
          <Header />
        </div>
      )}

      <main
        id="main-content"
        className="relative z-[1] flex-1 p-4 lg:p-8"
        tabIndex={-1}
      >
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
        >
          <Outlet />
        </motion.div>
      </main>

      {!isAuthPage && (
        <div className="relative z-[1]">
          <Footer />
        </div>
      )}
    </div>
  );
}
