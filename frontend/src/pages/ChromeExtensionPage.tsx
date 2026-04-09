import { motion } from 'framer-motion';
import { Chrome, Scan, BarChart3, ShieldCheck, FileText, Globe, Zap, ArrowRight, MousePointerClick, Eye, Download } from 'lucide-react';
import Card from '../components/ui/Card';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

const features = [
  {
    icon: Scan,
    title: 'Auto-Detection',
    description: 'Automatically detects when you visit a product page on Amazon, Flipkart, Myntra, Ajio, or Nykaa and shows a notification badge.',
  },
  {
    icon: MousePointerClick,
    title: 'One-Click Analysis',
    description: 'Click the extension icon, choose how many reviews to analyze (10, 20, or 50), and hit Analyze. No URLs to copy or paste.',
  },
  {
    icon: BarChart3,
    title: 'Instant Results',
    description: 'View sentiment breakdown, average predicted rating, AI-generated probability, and overall authenticity score directly in the popup.',
  },
  {
    icon: ShieldCheck,
    title: 'Trust Report',
    description: 'Get a product-level trust score with detailed detection results for review bursts, rating anomalies, duplicate content, and more.',
  },
  {
    icon: FileText,
    title: 'Full Report View',
    description: 'Open a detailed full-page report with product info, overview metrics, sentiment charts, trust detections, and a filterable review list.',
  },
  {
    icon: Globe,
    title: 'Multi-Language',
    description: 'Reviews in any of 50+ supported languages are automatically detected and translated before analysis, just like the web app.',
  },
];

const steps = [
  {
    num: '01',
    icon: Download,
    title: 'Install the Extension',
    description: 'Download the ReviewIQ extension from the Chrome Web Store and add it to your browser.',
  },
  {
    num: '02',
    icon: Eye,
    title: 'Visit a Product Page',
    description: 'Navigate to any product page on Amazon, Flipkart, Myntra, Ajio, or Nykaa. The extension icon will show a green badge when a supported page is detected.',
  },
  {
    num: '03',
    icon: MousePointerClick,
    title: 'Click and Analyze',
    description: 'Click the ReviewIQ icon in your toolbar, select the number of reviews, and hit Analyze. Results appear in seconds.',
  },
  {
    num: '04',
    icon: FileText,
    title: 'View Full Report',
    description: 'Click "View Full Report" for a detailed breakdown with filterable reviews, trust detections, and complete metrics.',
  },
];

const platforms = ['Amazon', 'Flipkart', 'Myntra', 'Ajio', 'Nykaa'];

export default function ChromeExtensionPage() {
  return (
    <div className="relative min-h-screen">
      <motion.div
        className="relative mx-auto max-w-5xl space-y-16 sm:space-y-20 py-8 sm:py-12 px-4 lg:px-0"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants} className="text-center space-y-6 max-w-2xl mx-auto">
          <div className="inline-flex items-center justify-center rounded-2xl bg-white/[0.05] p-5 border border-white/[0.08]">
            <Chrome className="h-12 w-12 text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white">
            Chrome <span className="text-gradient">Extension</span>
          </h1>
          <p className="text-base sm:text-lg text-neutral-400 leading-relaxed">Analyze product reviews directly from any supported e-commerce page without leaving the site. All the power of ReviewIQ, one click away.</p>
        </motion.div>

        <section>
          <motion.div variants={itemVariants} className="text-center mb-12">
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40 mb-4">
              <Zap className="h-3.5 w-3.5" />
              Features
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">What You Get</h2>
          </motion.div>

          <motion.div variants={containerVariants} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <motion.div key={feature.title} variants={itemVariants}>
                <Card className="h-full">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] border border-white/[0.08] text-white">
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white mb-1.5">{feature.title}</h3>
                      <p className="text-xs text-white/40 leading-relaxed">{feature.description}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </section>

        <section>
          <motion.div variants={itemVariants} className="text-center mb-12">
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40 mb-4">
              <ArrowRight className="h-3.5 w-3.5" />
              How It Works
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Get Started in Seconds</h2>
          </motion.div>

          <motion.div variants={containerVariants} className="grid gap-4 sm:grid-cols-2">
            {steps.map((step) => (
              <motion.div key={step.num} variants={itemVariants}>
                <div className="relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 h-full transition-colors duration-200 hover:border-white/[0.1]">
                  <span className="text-[40px] font-bold text-white/[0.12] absolute top-4 right-6 select-none">{step.num}</span>
                  <div className="relative">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.05] border border-white/[0.08] text-white mb-4">
                      <step.icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-sm font-semibold text-white mb-2">{step.title}</h3>
                    <p className="text-xs text-white/40 leading-relaxed">{step.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>

        <motion.section variants={itemVariants}>
          <div className="text-center mb-8">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
              Supported Platforms
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {platforms.map((platform) => (
              <div
                key={platform}
                className="text-center py-5 px-4 rounded-2xl border border-white/[0.06] bg-white/[0.02]"
              >
                <p className="text-sm font-semibold text-white">{platform}</p>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section variants={itemVariants} className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.04)_0%,transparent_70%)]" />
          <div className="relative rounded-3xl border border-white/[0.08] bg-white/[0.02] p-8 sm:p-10 md:p-14 text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/[0.06] border border-white/[0.1] mb-6 sm:mb-8">
              <Chrome className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 tracking-tight">
              Ready to try it?
            </h2>
            <p className="text-white/45 mb-8 max-w-md mx-auto text-sm sm:text-base">
              Install the ReviewIQ Chrome extension and start analyzing reviews on any supported product page.
            </p>
            <a
              href="https://chromewebstore.google.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#000000' }}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold transition-all duration-200 hover:bg-white/90 hover:shadow-[0_0_20px_rgba(255,255,255,0.15)] group"
            >
              <Chrome className="h-4 w-4" style={{ color: '#000000' }} />
              Add to Chrome
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" style={{ color: '#000000' }} />
            </a>
          </div>
        </motion.section>
      </motion.div>
    </div>
  );
}
