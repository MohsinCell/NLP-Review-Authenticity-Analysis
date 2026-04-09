import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, ArrowRight, Search } from 'lucide-react';
import Button from '../components/ui/Button';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center text-center px-4">
      <motion.div
        className="relative z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <div className="mb-8 mx-auto flex h-24 w-24 items-center justify-center rounded-2xl bg-white/[0.05] border border-white/[0.08]">
          <Search className="h-12 w-12 text-white/60" />
        </div>

        <h1 className="text-8xl font-bold text-gradient">404</h1>

        <p className="mt-4 text-2xl font-semibold text-white">
          Page not found
        </p>

        <p className="mt-3 max-w-md mx-auto text-neutral-500">
          The page you're looking for doesn't exist or has been moved to another location.
        </p>

        <div className="mt-10">
          <Link to="/">
            <Button size="lg" glow>
              <Home className="h-4 w-4" />
              <span>Back to Home</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
