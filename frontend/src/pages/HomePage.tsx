import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, Link2, ArrowRight, Shield, Star, Languages, Cpu, Zap, Brain, ChevronRight, Chrome, Lock } from 'lucide-react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { useAuth } from '../context/AuthContext';

const features = [
  {
    icon: <Brain className="h-5 w-5" />,
    title: 'Sentiment Analysis',
    description: 'Custom BERT classifier with batch normalization layers for binary sentiment classification (positive/negative).',
  },
  {
    icon: <Shield className="h-5 w-5" />,
    title: 'AI Content Detection',
    description: 'RoBERTa-based detector fine-tuned on the OpenAI GPT-2 output dataset for AI-generated text identification.',
  },
  {
    icon: <Star className="h-5 w-5" />,
    title: 'Rating Prediction',
    description: 'BERT sequence classifier trained on 5-class rating prediction (1-5 stars) from review text.',
  },
  {
    icon: <Languages className="h-5 w-5" />,
    title: 'Multi-Language Support',
    description: 'Automatic language detection with LibreTranslate integration for non-English review translation.',
  },
];

const stats = [
  { label: 'ML Models', value: '3', suffix: '' },
  { label: 'Platforms', value: '5', suffix: '' },
  { label: 'Languages', value: '50', suffix: '+' },
  { label: 'Max Tokens', value: '512', suffix: '' },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const titleVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export default function HomePage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="relative min-h-screen overflow-x-hidden">

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative mx-auto max-w-5xl px-4 sm:px-6 py-16 sm:py-24"
      >

        <section className="text-center mb-24 sm:mb-32">
          <motion.h1
            variants={titleVariants}
            className="text-5xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-[1.2] sm:leading-tight"
          >
            <span className="text-white">Detect.</span>
            <span className="text-white/30 mx-1 sm:mx-2 hidden sm:inline">/</span>
            <br className="sm:hidden" />
            <span className="text-white">Analyze.</span>
            <span className="text-white/30 mx-1 sm:mx-2 hidden sm:inline">/</span>
            <br className="sm:hidden" />
            <span className="text-gradient">Trust.</span>
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="mx-auto max-w-xl text-base sm:text-lg text-white/50 leading-relaxed mb-12"
          >
            Three specialized transformer models analyze reviews for sentiment,
            predict ratings, and detect AI-generated content.
          </motion.p>

          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link to="/analyze">
              <Button size="lg" glow className="group">
                Start Analyzing
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Link>
            <Link to="/product-analysis">
              <Button variant="outline" size="lg" className="group">
                <Link2 className="h-4 w-4" />
                Analyze Product URL
                <ChevronRight className="h-4 w-4 text-white/30 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </Link>
          </motion.div>
        </section>

        <motion.section variants={itemVariants} className="mb-24 sm:mb-32">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const }}
                className="group relative text-center py-8 px-4 rounded-2xl border border-white/[0.06] bg-white/[0.02]"
              >
                <p className="text-3xl sm:text-5xl font-bold text-white mb-1 tracking-tight">
                  {stat.value}
                  <span className="text-white/30">{stat.suffix}</span>
                </p>
                <p className="text-[11px] text-white/40 uppercase tracking-[0.2em] font-medium">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        <section className="mb-24 sm:mb-32">
          <motion.div variants={itemVariants} className="text-center mb-14">
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40 mb-4">
              <Zap className="h-3.5 w-3.5" />
              Capabilities
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">Powerful Analysis</h2>
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-2">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const }}
              >
                <Card className="h-full">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] border border-white/[0.08] text-white">
                      {feature.icon}
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white mb-2">
                        {feature.title}
                      </h3>
                      <p className="text-sm text-white/40 leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        <motion.section variants={itemVariants} className="mb-24 sm:mb-32">
          <div className="text-center mb-14">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40 mb-4 block">
              Supported Platforms
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">E-Commerce Integration</h2>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {['Amazon', 'Flipkart', 'Myntra', 'Ajio', 'Nykaa'].map((platform, i) => (
              <motion.span
                key={platform}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 + i * 0.05, duration: 0.4 }}
                className="px-6 py-3 text-sm font-medium text-white/50 border border-white/[0.06] rounded-xl bg-white/[0.02]"
              >
                {platform}
              </motion.span>
            ))}
          </div>
        </motion.section>

        <motion.section variants={itemVariants} className="mb-24 sm:mb-32">
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-8 md:p-10">
            <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/[0.05] border border-white/[0.08]">
                <Chrome className="h-7 w-7 text-white" />
              </div>
              <div className="text-center sm:text-left flex-1">
                <h3 className="text-lg sm:text-xl font-bold text-white mb-2">Chrome Extension</h3>
                {isAuthenticated ? (
                  <>
                    <p className="text-sm text-white/40 mb-4">
                      Analyze reviews directly from product pages on Amazon, Flipkart, Myntra, Ajio, and Nykaa without leaving the site.
                    </p>
                    <Link to="/chrome-extension">
                      <Button size="sm" variant="outline" className="group">
                        <Chrome className="h-3.5 w-3.5" />
                        Get the Extension
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </Button>
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-white/40 mb-4">
                      Analyze product reviews directly from e-commerce sites with our Chrome extension.
                      Sign in to access the extension and installation instructions.
                    </p>
                    <Link to="/signup">
                      <Button size="sm" variant="outline" className="group">
                        <Lock className="h-3.5 w-3.5" />
                        Sign Up to Access
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section
          variants={itemVariants}
          className="relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.04)_0%,transparent_70%)]" />
          <div className="relative rounded-3xl border border-white/[0.08] bg-white/[0.02] p-8 sm:p-10 md:p-14 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/[0.06] border border-white/[0.1] mb-6 sm:mb-8">
              <Cpu className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
            </div>

            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 sm:mb-4 tracking-tight">
              Ready to uncover the truth?
            </h2>
            <p className="text-white/45 mb-8 sm:mb-10 max-w-md mx-auto text-sm sm:text-base">
              {isAuthenticated
                ? 'Start analyzing reviews instantly with your account.'
                : 'Start analyzing reviews instantly. Create an account to save history and unlock advanced features.'}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <Link to="/analyze">
                <Button size="lg" glow className="group w-full sm:w-auto">
                  <FileText className="h-4 w-4" />
                  Start Analysis
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Button>
              </Link>
              {!isAuthenticated && (
                <Link to="/signup">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto">
                    Create Account
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </motion.section>
      </motion.div>
    </div>
  );
}
