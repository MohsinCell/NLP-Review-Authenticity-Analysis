import { useState, useEffect, useRef, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Copy, Check, AlertTriangle, Tag, ShieldAlert, ShieldCheck, Shield, FileText, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { reviewApi } from '../../api/reviews';
import { useApiError } from '../../hooks/useApiError';
import type { ReviewAnalysisResponse, KeywordExtractionResponse, RedFlagsResponse } from '../../types';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Textarea from '../../components/ui/Textarea';
import Badge from '../../components/ui/Badge';
import ProgressBar from '../../components/ui/ProgressBar';
import GaugeChart from '../../components/charts/GaugeChart';
import { getRatingStars, capitalize } from '../../lib/utils';
import api from '../../api/client';

const LOADING_MESSAGES = [
  { title: 'Analyzing sentiment patterns...', sub: 'Understanding emotional tone and context' },
  { title: 'Detecting writing style...', sub: 'Checking for AI-generated content markers' },
  { title: 'Evaluating authenticity signals...', sub: 'Cross-referencing linguistic patterns' },
  { title: 'Predicting star rating...', sub: 'Matching content to rating indicators' },
  { title: 'Running deep language analysis...', sub: 'Processing natural language features' },
  { title: 'Assessing review quality...', sub: 'Identifying red flags and trust signals' },
];

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

export default function AnalyzeReviewPage() {
  const [reviewText, setReviewText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingKeywords, setIsLoadingKeywords] = useState(false);
  const [isLoadingRedFlags, setIsLoadingRedFlags] = useState(false);
  const [result, setResult] = useState<ReviewAnalysisResponse | null>(null);
  const [keywords, setKeywords] = useState<KeywordExtractionResponse | null>(null);
  const [redFlags, setRedFlags] = useState<RedFlagsResponse | null>(null);
  const { getErrorMessage } = useApiError();
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const loadingInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isLoading) {
      setLoadingMsgIndex(0);
      loadingInterval.current = setInterval(() => {
        setLoadingMsgIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 3000);
    } else if (loadingInterval.current) {
      clearInterval(loadingInterval.current);
      loadingInterval.current = null;
    }
    return () => {
      if (loadingInterval.current) clearInterval(loadingInterval.current);
    };
  }, [isLoading]);

  const charCount = reviewText.length;
  const isValid = charCount >= 1 && charCount <= 5000;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setIsLoading(true);
    setResult(null);
    setKeywords(null);
    try {
      const response = await reviewApi.analyzeReview({ reviewText });
      setResult(response.data);

      // Run keyword extraction and red flags in parallel (secondary analyses)
      const secondaryPromises: Promise<void>[] = [];

      setIsLoadingKeywords(true);
      secondaryPromises.push(
        api.post<KeywordExtractionResponse>('/ml-service/extract-keywords', {
          reviews: [response.data.translatedText || reviewText]
        })
          .then((res) => setKeywords(res.data))
          .catch(() => {})
          .finally(() => setIsLoadingKeywords(false))
      );

      setIsLoadingRedFlags(true);
      secondaryPromises.push(
        api.post<RedFlagsResponse>('/ml-service/detect-red-flags', {
          reviewText: response.data.translatedText || reviewText
        })
          .then((res) => setRedFlags(res.data))
          .catch(() => {})
          .finally(() => setIsLoadingRedFlags(false))
      );

      await Promise.all(secondaryPromises);
      toast.success('Analysis complete!');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const copyResults = () => {
    if (!result) return;
    const text = `Sentiment: ${capitalize(result.sentiment)}
Confidence: ${(result.confidence * 100).toFixed(1)}%
Predicted Rating: ${result.predictedRating}/5
AI Generated Probability: ${(result.aiGeneratedProbability * 100).toFixed(1)}%
Authenticity Score: ${result.authenticityScore}/100
Authenticity Label: ${result.authenticityLabel}
Detected Language: ${result.languageName || result.language}`;
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const getSentimentVariant = (sentiment: string) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive': return 'success' as const;
      case 'negative': return 'danger' as const;
      default: return 'warning' as const;
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

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-4">

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] border border-white/[0.1]">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Analyze Review</h1>
            <p className="text-sm text-white/50">
              Sentiment classification, AI detection, and rating prediction
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <Card glow>
          <form onSubmit={handleSubmit} className="space-y-5">
            <Textarea
              id="reviewText"
              label="Review Text"
              placeholder="Paste or type a review here (1-5000 characters)..."
              rows={6}
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              error={charCount > 5000 ? 'Maximum 5000 characters' : undefined}
            />
            <div className="flex flex-col-reverse sm:flex-row items-start sm:items-center justify-between gap-3">
              <span className={`text-xs font-medium transition-colors ${charCount > 5000 ? 'text-red-400' : charCount >= 10 ? 'text-white/40' : 'text-white/20'}`}>
                {charCount.toLocaleString()} / 5,000 characters
              </span>
              <Button type="submit" isLoading={isLoading} disabled={!isValid} glow className="w-full sm:w-auto">
                <Send className="h-4 w-4" />
                {isLoading ? 'Analyzing...' : 'Analyze'}
              </Button>
            </div>
          </form>
        </Card>
      </motion.div>

      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="flex items-center justify-center py-16">
              <div className="text-center space-y-4">
                <div className="mx-auto h-12 w-12 rounded-full border-2 border-white/[0.1] border-t-white animate-spin" />
                <div key={loadingMsgIndex} className="animate-fade-in">
                  <p className="text-white font-medium">{LOADING_MESSAGES[loadingMsgIndex].title}</p>
                  <p className="text-sm text-white/40 mt-1">{LOADING_MESSAGES[loadingMsgIndex].sub}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {result && !isLoading && (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-6"
          >
            <motion.div variants={itemVariants} className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Analysis Results</h2>
              <Button variant="ghost" size="sm" onClick={copyResults}>
                <Copy className="h-3.5 w-3.5" /> Copy
              </Button>
            </motion.div>

            <div className="grid gap-3 sm:gap-4 grid-cols-1 xs:grid-cols-2 lg:grid-cols-4">
              <motion.div variants={itemVariants}>
                <Card className="p-5 h-full">
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Sentiment</p>
                  <div className="mt-3">
                    <Badge variant={getSentimentVariant(result.sentiment)} className="text-sm">
                      {capitalize(result.sentiment)}
                    </Badge>
                  </div>
                  <p className="mt-3 text-xs text-white/30">
                    {(result.confidence * 100).toFixed(1)}% confidence
                  </p>
                </Card>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Card className="p-5 h-full">
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Predicted Rating</p>
                  <p className="mt-3 text-xl text-white">{getRatingStars(result.predictedRating)}</p>
                  <p className="mt-2 text-xs text-white/30">{result.predictedRating} out of 5</p>
                </Card>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Card className="p-5 h-full">
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Language</p>
                  <div className="mt-3 flex items-center gap-2">
                    <Badge variant="info">{result.languageName || result.language}</Badge>
                    {result.wasTranslated && (
                      <span className="text-xs text-white/40">Translated</span>
                    )}
                  </div>
                </Card>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Card className="p-5 h-full">
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Authenticity</p>
                  <div className="mt-3">
                    <Badge variant={getAuthenticityVariant(result.authenticityLabel)}>
                      {result.authenticityLabel}
                    </Badge>
                  </div>
                </Card>
              </motion.div>
            </div>

            {result.wasTranslated && result.translatedText && (
              <motion.div variants={itemVariants}>
                <Card className="p-5">
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">
                    Translated to English
                  </p>
                  <p className="text-sm text-white/70 italic leading-relaxed">
                    "{result.translatedText}"
                  </p>
                </Card>
              </motion.div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <motion.div variants={itemVariants}>
                <Card className="h-full">
                  <h3 className="text-sm font-semibold text-white mb-5">AI Generation Probability</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/50">Probability</span>
                      <span className="text-lg font-bold text-white">
                        {(result.aiGeneratedProbability * 100).toFixed(1)}%
                      </span>
                    </div>
                    <ProgressBar
                      value={result.aiGeneratedProbability * 100}
                      color={result.aiGeneratedProbability > 0.7 ? 'danger' : result.aiGeneratedProbability > 0.4 ? 'warning' : 'success'}
                      size="md"
                    />
                    <div className="flex items-center gap-2 text-sm">
                      {result.aiGeneratedProbability > 0.5 ? (
                        <><AlertTriangle className="h-4 w-4 text-amber-400" /> <span className="text-white/60">Likely AI-generated</span></>
                      ) : (
                        <><Check className="h-4 w-4 text-emerald-400" /> <span className="text-white/60">Likely human-written</span></>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Card className="flex flex-col items-center justify-center h-full">
                  <h3 className="text-sm font-semibold text-white mb-4">Authenticity Score</h3>
                  <GaugeChart
                    value={result.authenticityScore}
                    max={100}
                    label={result.authenticityLabel}
                  />
                </Card>
              </motion.div>
            </div>

            {(isLoadingKeywords || keywords) && (
              <motion.div variants={itemVariants}>
                <Card>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05] border border-white/[0.08]">
                      <Tag className="h-4 w-4 text-white" />
                    </div>
                    <h3 className="text-sm font-semibold text-white">Keywords & Topics</h3>
                    {isLoadingKeywords && (
                      <span className="ml-auto text-xs text-white/40 flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" /> Extracting...
                      </span>
                    )}
                  </div>

                  {keywords && (
                    <div className="space-y-5">
                      <div className="flex flex-wrap gap-2">
                        {keywords.keywords.slice(0, 10).map((kw, idx) => (
                          <div
                            key={idx}
                            className="px-3 py-1.5 bg-white/[0.04] rounded-lg text-sm text-white/80 border border-white/[0.08]"
                          >
                            {kw.keyword}
                            <span className="ml-2 text-xs text-white/40">
                              {(kw.score * 100).toFixed(0)}%
                            </span>
                          </div>
                        ))}
                      </div>

                      {keywords.topics && keywords.topics.length > 0 && (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {keywords.topics.map((topic, idx) => (
                            <div
                              key={idx}
                              className="p-4 bg-white/[0.02] rounded-xl border border-white/[0.06]"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-white">{topic.topic}</span>
                                <span className="text-xs text-white/40 bg-white/[0.05] px-2 py-0.5 rounded">{topic.count}</span>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {topic.keywords.slice(0, 3).map((kw, kwIdx) => (
                                  <span key={kwIdx} className="text-xs text-white/40">{kw}</span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="pt-4 border-t border-white/[0.06]">
                        <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs text-white/40">
                          <span>{keywords.wordCount} words</span>
                          <span>{keywords.keywords.length} keywords extracted</span>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              </motion.div>
            )}

            {(isLoadingRedFlags || redFlags) && (
              <motion.div variants={itemVariants}>
                <Card>
                  <div className="flex items-center gap-3 mb-5">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
                      redFlags && redFlags.totalFlags > 0
                        ? 'bg-amber-500/10 border-amber-500/20'
                        : redFlags
                          ? 'bg-emerald-500/10 border-emerald-500/20'
                          : 'bg-white/[0.05] border-white/[0.08]'
                    }`}>
                      {redFlags && redFlags.totalFlags > 0 ? (
                        <ShieldAlert className="h-4 w-4 text-amber-400" />
                      ) : redFlags ? (
                        <ShieldCheck className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Shield className="h-4 w-4 text-white/50" />
                      )}
                    </div>
                    <h3 className="text-sm font-semibold text-white">Red Flags Analysis</h3>
                    {isLoadingRedFlags && (
                      <span className="ml-auto text-xs text-white/40 flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" /> Analyzing...
                      </span>
                    )}
                    {redFlags && (
                      <Badge
                        variant={redFlags.suspicionLevel === 'high' ? 'danger' : redFlags.suspicionLevel === 'medium' ? 'warning' : 'success'}
                        className="ml-auto"
                      >
                        {redFlags.suspicionLevel === 'high' ? 'Suspicious' : redFlags.suspicionLevel === 'medium' ? 'Moderate' : 'Clean'}
                      </Badge>
                    )}
                  </div>

                  {redFlags && (
                    <div className="space-y-4">
                      {redFlags.totalFlags === 0 ? (
                        <p className="text-sm text-emerald-400 flex items-center gap-2">
                          <Check className="h-4 w-4" /> No red flags detected
                        </p>
                      ) : (
                        <>
                          <div>
                            <div className="flex justify-between text-xs mb-2">
                              <span className="text-white/50">Suspicion Score</span>
                              <span className="text-white font-medium">{redFlags.score}/100</span>
                            </div>
                            <ProgressBar
                              value={redFlags.score}
                              color={redFlags.score >= 60 ? 'danger' : redFlags.score >= 30 ? 'warning' : 'success'}
                              size="md"
                            />
                          </div>

                          <div className="space-y-3">
                            {redFlags.redFlags.map((flag, idx) => (
                              <div
                                key={idx}
                                className={`p-4 rounded-xl border ${
                                  flag.severity === 'high' ? 'bg-red-500/5 border-red-500/20' :
                                  flag.severity === 'medium' ? 'bg-amber-500/5 border-amber-500/20' :
                                  'bg-white/[0.02] border-white/[0.06]'
                                }`}
                              >
                                <p className="text-sm text-white/80">{flag.description}</p>
                                <p className="text-xs text-white/40 mt-2">{flag.evidence}</p>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </Card>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
