import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe,
  Send,
  Copy,
  Download,
  Clock,
  ShoppingBag,
  Check,
  X,
  AlertTriangle,
  Loader2,
  Star,
  Bot,
  Shield,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  BarChart3,
  Languages,
  FileText,
  Repeat,
  ScanSearch,
  Package,
  ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getLanguageName, capitalize } from '../../lib/utils';
import { scraperApi } from '../../api/scraper';
import { reviewApi } from '../../api/reviews';
import { useAuth } from '../../context/AuthContext';
import type {
  ScraperDetectResponse,
  ScraperStatusResponse,
  ScrapedReview,
  AnalyzedReview,
  ReviewAnalysisResponse,
  ProductTrustReportResponse,
  ProductMetadata,
} from '../../types';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import ProgressBar from '../../components/ui/ProgressBar';
import SentimentPieChart from '../../components/charts/SentimentPieChart';
import GaugeChart from '../../components/charts/GaugeChart';

const REVIEW_COUNT_OPTIONS = [10, 20, 30, 50, 100];

const ANALYZING_MESSAGES = [
  'Analyzing sentiment patterns...',
  'Detecting writing style markers...',
  'Evaluating authenticity signals...',
  'Predicting star ratings...',
  'Running deep language analysis...',
  'Cross-referencing linguistic patterns...',
  'Assessing review quality...',
  'Processing natural language features...',
];

type Phase = 'idle' | 'detecting' | 'scraping' | 'analyzing' | 'done' | 'error';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen = true,
  badge,
  children,
}: {
  title: string;
  icon: React.ElementType;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-4 hover:bg-white/[0.02] transition-colors duration-200 focus-ring"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05] border border-white/[0.08]">
            <Icon className="h-4 w-4 text-white/70" aria-hidden="true" />
          </div>
          <span className="text-sm font-medium text-white">{title}</span>
          {badge}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-white/50 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  subtext,
  color = 'default',
  children,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subtext: string;
  color?: 'default' | 'success' | 'warning' | 'danger';
  children?: React.ReactNode;
}) {
  const colorClasses = {
    default: 'text-white',
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    danger: 'text-red-400',
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-white/50" aria-hidden="true" />
        <p className="text-xs font-medium text-white/50 uppercase tracking-wide">{label}</p>
      </div>
      <p className={`text-2xl font-bold mb-1 ${colorClasses[color]}`}>{value}</p>
      <p className="text-sm text-white/50">{subtext}</p>
      {children}
    </Card>
  );
}

export default function ProductAnalysisPage() {
  const { isAuthenticated } = useAuth();

  const [productUrl, setProductUrl] = useState('');
  const [maxReviews, setMaxReviews] = useState(10);
  const [phase, setPhase] = useState<Phase>('idle');

  const [detection, setDetection] = useState<ScraperDetectResponse | null>(null);
  const detectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [scrapeStatus, setScrapeStatus] = useState<ScraperStatusResponse | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [analyzedReviews, setAnalyzedReviews] = useState<AnalyzedReview[]>([]);
  const [analysisProgress, setAnalysisProgress] = useState({ done: 0, total: 0 });

  const [expandedReview, setExpandedReview] = useState<number | null>(null);
  const [trustReport, setTrustReport] = useState<ProductTrustReportResponse | null>(null);
  const [trustReportLoading, setTrustReportLoading] = useState(false);
  const [productMeta, setProductMeta] = useState<ProductMetadata | null>(null);
  const [analyzingMsg, setAnalyzingMsg] = useState(0);
  const analyzingInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (phase === 'analyzing') {
      setAnalyzingMsg(0);
      analyzingInterval.current = setInterval(() => {
        setAnalyzingMsg((prev) => (prev + 1) % ANALYZING_MESSAGES.length);
      }, 2500);
    } else if (analyzingInterval.current) {
      clearInterval(analyzingInterval.current);
      analyzingInterval.current = null;
    }
    return () => {
      if (analyzingInterval.current) clearInterval(analyzingInterval.current);
    };
  }, [phase]);

  const abortRef = useRef<AbortController | null>(null);

  const isValidUrl = /^https?:\/\/.+/.test(productUrl);

  useEffect(() => {
    if (detectTimerRef.current) clearTimeout(detectTimerRef.current);
    if (!isValidUrl) {
      detectTimerRef.current = setTimeout(() => setDetection(null), 0);
    } else {
      detectTimerRef.current = setTimeout(async () => {
        try {
          const res = await scraperApi.detect(productUrl);
          setDetection(res.data);
        } catch {
          setDetection(null);
        }
      }, 400);
    }
    return () => {
      if (detectTimerRef.current) clearTimeout(detectTimerRef.current);
    };
  }, [productUrl, isValidUrl]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const analyzeReviews = useCallback(async (reviews: ScrapedReview[]) => {
    setPhase('analyzing');
    setAnalysisProgress({ done: 0, total: reviews.length });

    const results: AnalyzedReview[] = [];

    for (let i = 0; i < reviews.length; i++) {
      if (abortRef.current?.signal.aborted) break;

      const review = reviews[i];

      if (!review.text || !review.text.trim()) {
        results.push({
          text: review.text || '',
          scraperRating: review.rating,
          date: review.date,
          sentiment: 'unknown',
          confidence: 0,
          predictedRating: 0,
          aiGeneratedProbability: 0,
          authenticityScore: 0,
          authenticityLabel: 'Skipped',
          detectedLanguage: '',
          error: 'Empty review text',
        });
        setAnalysisProgress({ done: i + 1, total: reviews.length });
        setAnalyzedReviews([...results]);
        continue;
      }

      let analyzed = false;
      for (let attempt = 0; attempt < 3 && !analyzed; attempt++) {
        try {
          if (attempt > 0) await new Promise((r) => setTimeout(r, 1500 * attempt));
          const res = await reviewApi.analyzeReview({ reviewText: review.text });
          const ml: ReviewAnalysisResponse = res.data;
          results.push({
            text: review.text,
            scraperRating: review.rating,
            date: review.date,
            sentiment: ml.sentiment,
            confidence: ml.confidence,
            predictedRating: ml.predictedRating,
            aiGeneratedProbability: ml.aiGeneratedProbability,
            authenticityScore: ml.authenticityScore,
            authenticityLabel: ml.authenticityLabel,
            detectedLanguage: ml.languageName || ml.language,
          });
          analyzed = true;
        } catch {
          if (attempt === 2) {
            results.push({
              text: review.text,
              scraperRating: review.rating,
              date: review.date,
              sentiment: 'unknown',
              confidence: 0,
              predictedRating: 0,
              aiGeneratedProbability: 0,
              authenticityScore: 0,
              authenticityLabel: 'Error',
              detectedLanguage: '',
              error: 'Analysis failed',
            });
          }
        }
      }

      if (i < reviews.length - 1) await new Promise((r) => setTimeout(r, 300));

      setAnalysisProgress({ done: i + 1, total: reviews.length });
      setAnalyzedReviews([...results]);
    }

    setPhase('done');
    toast.success(`Analyzed ${results.filter((r) => !r.error).length} reviews`);

    // Fire product trust report in background
    const validForTrust = results.filter((r) => !r.error);
    if (validForTrust.length >= 3) {
      setTrustReportLoading(true);
      reviewApi.getProductTrustReport(
        validForTrust.map((r) => ({
          text: r.text,
          rating: r.scraperRating,
          date: r.date,
          sentiment: r.sentiment,
          confidence: r.confidence,
          predictedRating: r.predictedRating,
          aiGeneratedProbability: r.aiGeneratedProbability,
          authenticityScore: r.authenticityScore,
        }))
      )
        .then((res) => setTrustReport(res.data))
        .catch(() => {})
        .finally(() => setTrustReportLoading(false));
    }

    if (isAuthenticated) {
      try {
        const valid = results.filter((r) => !r.error);
        const total = valid.length;
        if (total > 0) {
          const positive = valid.filter((r) => r.sentiment === 'positive').length;
          const negative = valid.filter((r) => r.sentiment === 'negative').length;
          const neutral = valid.filter((r) => r.sentiment === 'neutral').length;
          const avgRating = valid.reduce((sum, r) => sum + r.predictedRating, 0) / total;
          const avgAiProb = valid.reduce((sum, r) => sum + r.aiGeneratedProbability, 0) / total * 100;
          const languages = [...new Set(valid.map((r) => r.detectedLanguage).filter(Boolean))];

          await reviewApi.saveLinkAnalysis({
            productUrl,
            totalReviewsAnalyzed: total,
            positivePercentage: Math.round((positive / total) * 1000) / 10,
            negativePercentage: Math.round((negative / total) * 1000) / 10,
            neutralPercentage: Math.round((neutral / total) * 1000) / 10,
            averagePredictedRating: Math.round(avgRating * 10) / 10,
            aiGeneratedPercentage: Math.round(avgAiProb * 10) / 10,
            languagesDetected: languages.join(', '),
          });
        }
      } catch {
        // silently ignore save failure
      }
    }
  }, [isAuthenticated, productUrl]);

  const startPolling = useCallback((id: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const res = await scraperApi.getStatus(id);
        const data = res.data;
        setScrapeStatus(data);

        if (data.product) {
          setProductMeta(data.product);
        }

        if (data.status === 'completed') {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;

          if (data.reviews && data.reviews.length > 0) {
            analyzeReviews(data.reviews);
          } else {
            setPhase('error');
            toast.error('No reviews found');
          }
        } else if (data.status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setPhase('error');
          toast.error(data.error || 'Scraping failed');
        }
      } catch {
        // polling error, will retry on next interval
      }
    }, 2000);
  }, [analyzeReviews]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isValidUrl) return;

    setPhase('scraping');
    setScrapeStatus(null);
    setJobId(null);
    setAnalyzedReviews([]);
    setAnalysisProgress({ done: 0, total: 0 });
    setExpandedReview(null);
    setTrustReport(null);
    setProductMeta(null);
    abortRef.current = new AbortController();

    try {
      const res = await scraperApi.startScrape({
        url: productUrl,
        max_pages: 0,
        max_reviews: maxReviews,
        min_delay: 3,
        max_delay: 6,
        render_js: true,
      });
      const id = res.data.job_id;
      setJobId(id);
      startPolling(id);
    } catch {
      setPhase('error');
      toast.error('Failed to start scraping');
    }
  };

  const aggregates = (() => {
    const valid = analyzedReviews.filter((r) => !r.error);
    if (valid.length === 0) return null;

    const positive = valid.filter((r) => r.sentiment === 'positive').length;
    const negative = valid.filter((r) => r.sentiment === 'negative').length;
    const neutral = valid.filter((r) => r.sentiment === 'neutral').length;
    const total = valid.length;

    const avgRating = valid.reduce((sum, r) => sum + r.predictedRating, 0) / total;
    const avgAiProb = valid.reduce((sum, r) => sum + r.aiGeneratedProbability, 0) / total;
    const avgAuth = valid.reduce((sum, r) => sum + r.authenticityScore, 0) / total;
    const languages = [...new Set(valid.map((r) => r.detectedLanguage).filter(Boolean))];

    return {
      total,
      positivePercent: (positive / total) * 100,
      negativePercent: (negative / total) * 100,
      neutralPercent: (neutral / total) * 100,
      avgRating,
      avgAiProb: avgAiProb * 100,
      avgAuth,
      languages,
      authenticityLabel:
        avgAuth <= 40 ? 'Likely Genuine' : avgAuth <= 70 ? 'Suspicious' : 'Highly Suspicious',
    };
  })();

  const copyResults = () => {
    if (!aggregates) return;
    const lines = [
      `Product: ${productUrl}`,
      `Reviews: ${aggregates.total}`,
      `Positive: ${aggregates.positivePercent.toFixed(1)}%`,
      `Negative: ${aggregates.negativePercent.toFixed(1)}%`,
      `Avg Rating: ${aggregates.avgRating.toFixed(1)}/5`,
      `AI Generated: ${aggregates.avgAiProb.toFixed(1)}%`,
      `Authenticity: ${aggregates.authenticityLabel}`,
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Copied');
  };

  const exportCSV = () => {
    if (analyzedReviews.length === 0) return;
    const header = 'text,rating,sentiment,confidence,predicted_rating,ai_probability,authenticity';
    const rows = analyzedReviews.map((r) =>
      [
        `"${r.text.replace(/"/g, '""')}"`,
        r.scraperRating,
        r.sentiment,
        r.confidence.toFixed(3),
        r.predictedRating,
        r.aiGeneratedProbability.toFixed(3),
        r.authenticityScore.toFixed(1),
      ].join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analysis-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadRawCSV = () => {
    if (!jobId) return;
    window.open(scraperApi.getDownloadUrl(jobId), '_blank');
  };

  const getSentimentBadgeVariant = (sentiment: string) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive': return 'success' as const;
      case 'negative': return 'danger' as const;
      case 'neutral': return 'warning' as const;
      default: return 'default' as const;
    }
  };

  const getAuthenticityVariant = (label: string) => {
    switch (label?.toLowerCase()) {
      case 'likely genuine': return 'success' as const;
      case 'suspicious': return 'warning' as const;
      case 'highly suspicious': return 'danger' as const;
      default: return 'default' as const;
    }
  };

  const getAuthenticityColor = (label: string): 'success' | 'warning' | 'danger' | 'default' => {
    switch (label?.toLowerCase()) {
      case 'likely genuine': return 'success';
      case 'suspicious': return 'warning';
      case 'highly suspicious': return 'danger';
      default: return 'default';
    }
  };

  const isProcessing = phase === 'scraping' || phase === 'analyzing';

  return (
    <div className="relative min-h-screen">
      <motion.div
        className="relative mx-auto max-w-5xl space-y-6 py-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >

        <motion.header variants={itemVariants}>
          <div className="flex items-center gap-3 mb-2">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] border border-white/[0.08]"
              aria-hidden="true"
            >
              <Globe className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Product Analysis</h1>
              <p className="text-sm text-white/50">
                Scrape product reviews and analyze authenticity
              </p>
            </div>
          </div>
        </motion.header>

        <motion.section variants={itemVariants} aria-label="Product URL input">
          <Card glow>
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                id="productUrl"
                label="Product URL"
                type="url"
                placeholder="https://www.amazon.in/dp/..."
                value={productUrl}
                onChange={(e) => setProductUrl(e.target.value)}
                error={productUrl && !isValidUrl ? 'Enter a valid URL' : undefined}
                leftIcon={<Globe className="h-4 w-4" />}
                disabled={isProcessing}
              />

              <AnimatePresence>
                {detection && detection.detected && (
                  <motion.div
                    className="flex flex-wrap items-center gap-2"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    role="status"
                    aria-live="polite"
                  >
                    <Badge variant="success" className="capitalize">
                      <ShoppingBag className="mr-1 h-3 w-3" aria-hidden="true" />
                      {detection.site} detected
                    </Badge>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <fieldset className="space-y-2">
                  <legend className="block text-xs font-medium text-white/60 uppercase tracking-wide">
                    Reviews to Analyze
                  </legend>
                  <div className="flex flex-wrap gap-2" role="radiogroup">
                    {REVIEW_COUNT_OPTIONS.map((count) => (
                      <button
                        key={count}
                        type="button"
                        role="radio"
                        aria-checked={maxReviews === count}
                        onClick={() => setMaxReviews(count)}
                        disabled={isProcessing}
                        className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors duration-200 focus-ring ${
                          maxReviews === count
                            ? 'border-white/50 bg-white text-black'
                            : 'border-white/10 bg-white/5 text-white/60 hover:border-white/30 hover:text-white hover:bg-white/10'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <Button
                  type="submit"
                  glow
                  isLoading={isProcessing}
                  disabled={!isValidUrl || isProcessing}
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  {phase === 'scraping' ? 'Scraping...' : phase === 'analyzing' ? 'Analyzing...' : 'Start Analysis'}
                </Button>
              </div>
            </form>
          </Card>
        </motion.section>

        <AnimatePresence mode="wait">
          {phase === 'scraping' && (
            <motion.section
              key="scraping-status"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              aria-label="Scraping progress"
              role="status"
              aria-live="polite"
            >
              <Card>
                <div className="space-y-4">
                  {scrapeStatus ? (
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <Loader2 className="h-5 w-5 shrink-0 text-white animate-spin" aria-hidden="true" />
                          <div className="min-w-0">
                            <p className="font-medium text-white">Scraping Reviews</p>
                            <p className="text-sm text-white/50 truncate">
                              {scrapeStatus.total_reviews > 0
                                ? `Found ${scrapeStatus.total_reviews} reviews so far...`
                                : 'Searching for reviews...'}
                            </p>
                          </div>
                        </div>
                        <div className="text-left sm:text-right flex sm:block items-center gap-2">
                          <p className="text-2xl sm:text-3xl font-bold text-white">{scrapeStatus.total_reviews}</p>
                          <p className="text-xs text-white/50">reviews found</p>
                        </div>
                      </div>

                      {scrapeStatus.total_reviews > 0 && (
                        <ProgressBar
                          value={Math.min(scrapeStatus.total_reviews, maxReviews)}
                          max={maxReviews}
                          color="primary"
                        />
                      )}

                      <div className="flex items-center gap-2 text-xs text-white/50">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        This may take a moment. Collecting reviews carefully...
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-4 py-8">
                      <Spinner size="md" />
                      <p className="text-sm text-white/50">Starting up...</p>
                    </div>
                  )}
                </div>
              </Card>
            </motion.section>
          )}

          {phase === 'analyzing' && (
            <motion.section
              key="analyzing"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              aria-label="Analysis progress"
              role="status"
              aria-live="polite"
            >
              <Card>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-5 w-5 text-white animate-spin" aria-hidden="true" />
                      <div>
                        <p className="font-medium text-white">Analyzing Reviews</p>
                        <p key={analyzingMsg} className="text-sm text-white/50 animate-fade-in">{ANALYZING_MESSAGES[analyzingMsg]}</p>
                      </div>
                    </div>
                    <p className="text-lg font-semibold text-white">
                      {analysisProgress.done} / {analysisProgress.total}
                    </p>
                  </div>
                  <ProgressBar
                    value={analysisProgress.done}
                    max={analysisProgress.total}
                    color="primary"
                    showLabel
                  />
                </div>
              </Card>
            </motion.section>
          )}

          {phase === 'error' && (
            <motion.section
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              aria-label="Error message"
              role="alert"
            >
              <Card className="border-red-500/30 bg-red-500/5">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/20">
                    <X className="h-6 w-6 text-red-400" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-medium text-red-400">Unable to fetch reviews</p>
                    <p className="text-sm text-red-400/70">{scrapeStatus?.message || 'Check the URL and try again.'}</p>
                  </div>
                </div>
              </Card>
            </motion.section>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {productMeta && productMeta.name && (phase === 'done' || phase === 'analyzing' || phase === 'scraping') && (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              aria-label="Product information"
            >
              <Card>
                <div className="flex gap-4">
                  {productMeta.image_url && (
                    <div className="shrink-0">
                      <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
                        <img
                          src={productMeta.image_url}
                          alt={productMeta.name}
                          className="h-full w-full object-contain p-1"
                          loading="lazy"
                        />
                      </div>
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {productMeta.brand && (
                          <p className="text-xs font-medium text-white/40 uppercase tracking-wide mb-0.5">{productMeta.brand}</p>
                        )}
                        <h3 className="text-sm sm:text-base font-semibold text-white leading-snug line-clamp-2">{productMeta.name}</h3>
                      </div>
                      <a
                        href={productMeta.url || productUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
                        aria-label="Open product page"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-white/50" />
                      </a>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="default" size="sm" className="capitalize">
                        <Package className="mr-1 h-3 w-3" />
                        {productMeta.platform}
                      </Badge>
                      {productMeta.price && (
                        <Badge variant="default" size="sm">{productMeta.price}</Badge>
                      )}
                      {productMeta.overall_rating !== null && (
                        <Badge variant="default" size="sm">
                          <Star className="mr-0.5 h-3 w-3 fill-amber-400 text-amber-400" />
                          {productMeta.overall_rating.toFixed(1)}
                        </Badge>
                      )}
                      {productMeta.total_ratings > 0 && (
                        <span className="text-xs text-white/40">{productMeta.total_ratings.toLocaleString()} ratings</span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </motion.section>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {(phase === 'done' || (phase === 'analyzing' && analyzedReviews.length > 0)) && aggregates && (
            <motion.div
              className="space-y-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.35 }}
            >

              {phase === 'done' && (
                <motion.div
                  className="sticky top-16 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-black/80 backdrop-blur-xl p-2 sm:p-3"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" aria-hidden="true" />
                    <span className="text-xs sm:text-sm font-medium text-white truncate">Analysis Complete</span>
                    <Badge variant="default" size="sm">{aggregates.total} reviews</Badge>
                  </div>
                  <div className="flex gap-1 sm:gap-2">
                    <Button variant="ghost" size="sm" onClick={copyResults} aria-label="Copy results">
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="hidden sm:inline">Copy</span>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={exportCSV} aria-label="Export CSV">
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="hidden sm:inline">Export</span>
                    </Button>
                  </div>
                </motion.div>
              )}

              <CollapsibleSection
                title="Summary Overview"
                icon={BarChart3}
                defaultOpen={true}
              >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <MetricCard
                    icon={BarChart3}
                    label="Reviews"
                    value={aggregates.total}
                    subtext="analyzed"
                  />
                  <MetricCard
                    icon={Star}
                    label="Avg Rating"
                    value={aggregates.avgRating.toFixed(1)}
                    subtext={'\u2605'.repeat(Math.round(aggregates.avgRating)) + '\u2606'.repeat(5 - Math.round(aggregates.avgRating))}
                  />
                  <MetricCard
                    icon={Bot}
                    label="AI Generated"
                    value={`${aggregates.avgAiProb.toFixed(1)}%`}
                    subtext={aggregates.avgAiProb > 50 ? 'High AI content' : 'Low AI content'}
                    color={aggregates.avgAiProb > 50 ? 'danger' : 'success'}
                  >
                    <ProgressBar
                      value={aggregates.avgAiProb}
                      max={100}
                      color={aggregates.avgAiProb > 50 ? 'danger' : aggregates.avgAiProb > 25 ? 'warning' : 'success'}
                      className="mt-3"
                      size="sm"
                    />
                  </MetricCard>
                  <MetricCard
                    icon={Shield}
                    label="Authenticity"
                    value={aggregates.authenticityLabel}
                    subtext={`Score: ${aggregates.avgAuth.toFixed(1)}/100`}
                    color={getAuthenticityColor(aggregates.authenticityLabel)}
                  />
                </div>
              </CollapsibleSection>

              <CollapsibleSection
                title="Sentiment & Trust Analysis"
                icon={TrendingUp}
                defaultOpen={true}
              >
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingUp className="h-4 w-4 text-white/50" aria-hidden="true" />
                      <h3 className="text-sm font-medium text-white">Sentiment Distribution</h3>
                    </div>
                    <SentimentPieChart
                      positive={aggregates.positivePercent}
                      negative={aggregates.negativePercent}
                      neutral={aggregates.neutralPercent}
                    />
                  </div>

                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 flex flex-col">
                    <div className="flex items-center gap-2 mb-4 self-start">
                      <Shield className="h-4 w-4 text-white/50" aria-hidden="true" />
                      <h3 className="text-sm font-medium text-white">Authenticity Score</h3>
                    </div>
                    <div className="flex flex-1 items-center justify-center">
                      <GaugeChart
                        value={aggregates.avgAuth}
                        max={100}
                        label={aggregates.authenticityLabel}
                        size={180}
                      />
                    </div>
                  </div>
                </div>
              </CollapsibleSection>

              {aggregates.languages.length > 0 && (
                <CollapsibleSection
                  title="Languages Detected"
                  icon={Languages}
                  defaultOpen={false}
                  badge={<Badge variant="info" size="sm">{aggregates.languages.length}</Badge>}
                >
                  <div className="flex flex-wrap gap-2">
                    {aggregates.languages.map((lang) => (
                      <Badge key={lang} variant="info">{getLanguageName(lang)}</Badge>
                    ))}
                  </div>
                </CollapsibleSection>
              )}

              {(trustReportLoading || trustReport) && (
                <CollapsibleSection
                  title="Product Trust Report"
                  icon={ScanSearch}
                  defaultOpen={true}
                  badge={
                    trustReport ? (
                      <Badge
                        variant={trustReport.trustScore >= 70 ? 'success' : trustReport.trustScore >= 45 ? 'warning' : 'danger'}
                        size="sm"
                      >
                        {trustReport.trustLabel}
                      </Badge>
                    ) : undefined
                  }
                >
                  {trustReportLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <div className="text-center space-y-3">
                        <Loader2 className="h-8 w-8 text-white animate-spin mx-auto" />
                        <p className="text-sm text-white/50">Generating trust report...</p>
                      </div>
                    </div>
                  ) : trustReport ? (
                    <div className="space-y-6">
                      {/* Trust Score Overview */}
                      <div className="flex flex-col sm:flex-row items-center gap-6">
                        <div className="flex flex-col items-center">
                          <GaugeChart
                            value={trustReport.trustScore}
                            max={100}
                            label={trustReport.trustLabel}
                          />
                        </div>
                        <div className="flex-1 text-center sm:text-left space-y-2">
                          <p className="text-2xl font-bold text-white">{trustReport.trustScore}/100</p>
                          <p className="text-sm text-white/50">
                            Based on {trustReport.totalReviews} reviews across 6 detection methods
                          </p>
                          <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                            {Object.values(trustReport.detections).filter((d) => d.detected).length === 0 ? (
                              <span className="text-sm text-emerald-400 flex items-center gap-1.5">
                                <Check className="h-4 w-4" /> No suspicious patterns detected
                              </span>
                            ) : (
                              <span className="text-sm text-amber-400 flex items-center gap-1.5">
                                <AlertTriangle className="h-4 w-4" />
                                {Object.values(trustReport.detections).filter((d) => d.detected).length} issue(s) found
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Detection Cards Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {([
                          { key: 'reviewBurst', label: 'Review Burst', icon: Clock, desc: 'Posting date spikes' },
                          { key: 'ratingDistribution', label: 'Rating Distribution', icon: BarChart3, desc: 'Rating pattern analysis' },
                          { key: 'ratingSentimentMismatch', label: 'Rating vs Sentiment', icon: AlertTriangle, desc: 'Star-text contradictions' },
                          { key: 'duplicateContent', label: 'Duplicate Content', icon: Copy, desc: 'Near-identical reviews' },
                          { key: 'lengthUniformity', label: 'Length Uniformity', icon: TrendingUp, desc: 'Suspicious length patterns' },
                          { key: 'phraseRepetition', label: 'Phrase Repetition', icon: Repeat, desc: 'Repeated phrases across reviews' },
                        ] as const).map(({ key, label, icon: DetIcon, desc }) => {
                          const d = trustReport.detections[key as keyof typeof trustReport.detections];
                          if (!d) return null;
                          return (
                            <div
                              key={key}
                              className={`rounded-xl border p-4 space-y-3 ${
                                d.detected
                                  ? d.severity === 'high'
                                    ? 'bg-red-500/5 border-red-500/20'
                                    : d.severity === 'medium'
                                      ? 'bg-amber-500/5 border-amber-500/20'
                                      : 'bg-white/[0.02] border-white/[0.08]'
                                  : 'bg-white/[0.02] border-white/[0.08]'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <DetIcon className="h-4 w-4 text-white/60" />
                                  <span className="text-sm font-medium text-white">{label}</span>
                                </div>
                                {d.detected ? (
                                  <Badge
                                    variant={d.severity === 'high' ? 'danger' : d.severity === 'medium' ? 'warning' : 'default'}
                                    size="sm"
                                  >
                                    {capitalize(d.severity)}
                                  </Badge>
                                ) : (
                                  <Badge variant="success" size="sm">Clean</Badge>
                                )}
                              </div>
                              <ProgressBar
                                value={d.score}
                                color={d.score >= 70 ? 'success' : d.score >= 40 ? 'warning' : 'danger'}
                                size="sm"
                              />
                              <p className="text-xs text-white/50">{d.details}</p>
                              {d.flaggedIndices && d.flaggedIndices.length > 0 && (
                                <p className="text-xs text-amber-400/80">
                                  {d.flaggedIndices.length} review(s) flagged
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Repeated Phrases Detail */}
                      {trustReport.detections.phraseRepetition?.detected &&
                        trustReport.detections.phraseRepetition.repeatedPhrases &&
                        trustReport.detections.phraseRepetition.repeatedPhrases.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Repeated Phrases</p>
                          <div className="flex flex-wrap gap-2">
                            {trustReport.detections.phraseRepetition.repeatedPhrases.map((p, i) => (
                              <div
                                key={i}
                                className="px-3 py-1.5 bg-amber-500/10 rounded-lg text-sm text-amber-300 border border-amber-500/20"
                              >
                                "{p.phrase}"
                                <span className="ml-2 text-xs text-amber-400/60">x{p.count}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Duplicate Clusters Detail */}
                      {trustReport.detections.duplicateContent?.detected &&
                        trustReport.detections.duplicateContent.clusters &&
                        trustReport.detections.duplicateContent.clusters.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Duplicate Clusters</p>
                          <div className="space-y-2">
                            {trustReport.detections.duplicateContent.clusters.map((c, i) => (
                              <div
                                key={i}
                                className="p-3 bg-red-500/5 rounded-xl border border-red-500/15 text-sm"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-red-300 font-medium">{c.count} similar reviews</span>
                                </div>
                                <p className="text-xs text-white/40 italic">"{c.preview}"</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Rating Distribution */}
                      {trustReport.detections.ratingDistribution?.distribution && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Rating Distribution</p>
                          <div className="flex items-end gap-3 h-32 pt-2">
                            {['1', '2', '3', '4', '5'].map((star) => {
                              const count = trustReport.detections.ratingDistribution.distribution?.[star] || 0;
                              const maxCount = Math.max(1, ...Object.values(trustReport.detections.ratingDistribution.distribution || {}));
                              const height = (count / maxCount) * 100;
                              return (
                                <div key={star} className="flex-1 flex flex-col items-center gap-1.5">
                                  <span className="text-xs text-white/50">{count}</span>
                                  <div className="w-full rounded-t bg-white/[0.06] relative" style={{ height: '80px' }}>
                                    <div
                                      className={`absolute bottom-0 w-full rounded-t transition-all ${
                                        trustReport.detections.ratingDistribution.detected
                                          ? 'bg-amber-500/40'
                                          : 'bg-emerald-500/40'
                                      }`}
                                      style={{ height: `${height}%` }}
                                    />
                                  </div>
                                  <div className="flex items-center gap-0.5">
                                    <span className="text-xs text-white/40">{star}</span>
                                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </CollapsibleSection>
              )}

              <CollapsibleSection
                title="Individual Reviews"
                icon={FileText}
                defaultOpen={false}
                badge={<Badge variant="default" size="sm">{analyzedReviews.length}</Badge>}
              >
                <div className="space-y-2">
                  {analyzedReviews.map((review, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden"
                    >
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 sm:gap-3 p-3 text-left hover:bg-white/[0.03] transition-colors duration-200 focus-ring"
                        onClick={() => setExpandedReview(expandedReview === idx ? null : idx)}
                        aria-expanded={expandedReview === idx}
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/5 border border-white/10 text-xs font-medium text-white/60">
                          {idx + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-white/60">
                          {review.text}
                        </span>
                        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                          <Badge variant={getSentimentBadgeVariant(review.sentiment)} size="sm" className="hidden xs:inline-flex">
                            {capitalize(review.sentiment)}
                          </Badge>
                          <span className="hidden sm:flex items-center gap-1 text-xs text-white/50">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden="true" />
                            {review.scraperRating}
                          </span>
                          {review.aiGeneratedProbability > 0.5 && (
                            <Badge variant="danger" size="sm" className="hidden sm:inline-flex">
                              <Bot className="mr-0.5 h-3 w-3" aria-hidden="true" /> AI
                            </Badge>
                          )}
                          <ChevronRight
                            className={`h-4 w-4 text-white/50 transition-transform duration-200 ${expandedReview === idx ? 'rotate-90' : ''}`}
                            aria-hidden="true"
                          />
                        </div>
                      </button>

                      <AnimatePresence>
                        {expandedReview === idx && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden"
                          >
                            <div className="border-t border-white/5 bg-white/[0.01] px-4 py-4">
                              {review.error ? (
                                <p className="text-sm text-red-400">{review.error}</p>
                              ) : (
                                <div className="space-y-4">

                                  <div>
                                    <p className="text-xs font-medium text-white/50 uppercase tracking-wide mb-2">Full Review</p>
                                    <p className="text-sm text-white/80 leading-relaxed">{review.text}</p>
                                    {review.date && (
                                      <p className="mt-2 text-xs text-white/40">{review.date}</p>
                                    )}
                                  </div>

                                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                                      <div className="flex items-center gap-1.5 text-xs text-white/50 mb-2">
                                        {review.sentiment === 'positive' ? (
                                          <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                                        ) : review.sentiment === 'negative' ? (
                                          <X className="h-3.5 w-3.5 text-red-400" aria-hidden="true" />
                                        ) : (
                                          <AlertTriangle className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                                        )}
                                        Sentiment
                                      </div>
                                      <p className="text-sm font-medium text-white">{capitalize(review.sentiment)}</p>
                                      <p className="text-xs text-white/50 mt-1">{(review.confidence * 100).toFixed(1)}% confidence</p>
                                    </div>

                                    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                                      <div className="flex items-center gap-1.5 text-xs text-white/50 mb-2">
                                        <Star className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                                        Rating
                                      </div>
                                      <p className="text-sm font-medium text-white">{review.scraperRating} / {review.predictedRating}</p>
                                      <p className="text-xs text-white/50 mt-1">Scraped / Predicted</p>
                                    </div>

                                    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                                      <div className="flex items-center gap-1.5 text-xs text-white/50 mb-2">
                                        <Bot className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />
                                        AI Detection
                                      </div>
                                      <p className="text-sm font-medium text-white">{(review.aiGeneratedProbability * 100).toFixed(1)}%</p>
                                      <p className="text-xs text-white/50 mt-1">
                                        {review.aiGeneratedProbability > 0.5 ? 'Likely AI-generated' : 'Likely human'}
                                      </p>
                                      <ProgressBar
                                        value={review.aiGeneratedProbability * 100}
                                        max={100}
                                        color={review.aiGeneratedProbability > 0.5 ? 'danger' : 'success'}
                                        className="mt-2"
                                        size="sm"
                                      />
                                    </div>

                                    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                                      <div className="flex items-center gap-1.5 text-xs text-white/50 mb-2">
                                        <Shield className="h-3.5 w-3.5 text-purple-400" aria-hidden="true" />
                                        Authenticity
                                      </div>
                                      <Badge variant={getAuthenticityVariant(review.authenticityLabel)} size="sm">
                                        {review.authenticityLabel}
                                      </Badge>
                                      <p className="text-xs text-white/50 mt-2">{review.authenticityScore.toFixed(1)}/100</p>
                                    </div>
                                  </div>

                                  {review.detectedLanguage && (
                                    <p className="text-xs text-white/50">
                                      <span className="text-white/40">Language:</span> {review.detectedLanguage}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            </motion.div>
          )}
        </AnimatePresence>

        {phase === 'idle' && !productUrl && (
          <motion.div
            variants={itemVariants}
            className="text-center py-12"
          >
            <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-white/[0.03] border border-white/[0.08] mb-4">
              <Globe className="h-8 w-8 text-white/30" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-medium text-white/70 mb-2">Enter a Product URL</h3>
            <p className="text-sm text-white/40 max-w-md mx-auto">
              Paste an Amazon, Flipkart, Myntra, Ajio, or Nykaa product URL above to analyze its reviews for authenticity and sentiment.
            </p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
