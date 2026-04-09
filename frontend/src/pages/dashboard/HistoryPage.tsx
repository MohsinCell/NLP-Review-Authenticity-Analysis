import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, FileText, Link2, Search, ChevronLeft, ChevronRight, Eye, History, Calendar, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { userApi } from '../../api/user';
import { useApiError } from '../../hooks/useApiError';
import type { ReviewHistoryResponse, PagedResponse } from '../../types';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import { formatDate, getRatingStars, getLanguageName, capitalize } from '../../lib/utils';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25 },
  },
};

function HistoryCard({
  item,
  type,
  onView,
}: {
  item: ReviewHistoryResponse;
  type: 'REVIEW' | 'LINK';
  onView: () => void;
}) {
  const getSentimentVariant = (sentiment?: string) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive': return 'success' as const;
      case 'negative': return 'danger' as const;
      default: return 'warning' as const;
    }
  };

  const getAuthenticityVariant = (label?: string) => {
    switch (label?.toLowerCase()) {
      case 'likely genuine': return 'success' as const;
      case 'suspicious': return 'warning' as const;
      case 'highly suspicious': return 'danger' as const;
      default: return 'default' as const;
    }
  };

  if (type === 'LINK') {
    return (
      <motion.div
        variants={cardVariants}
        className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-white/50">
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
            {formatDate(item.createdAt)}
          </div>
          {item.domain && (
            <Badge variant="info" size="sm">{item.domain}</Badge>
          )}
        </div>
        <a
          href={item.productUrlPreview}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-sm text-white hover:text-white/80 break-all line-clamp-2 focus-ring rounded"
        >
          {item.productUrlPreview || '-'}
          <ExternalLink className="inline h-3 w-3 ml-1 opacity-50" aria-hidden="true" />
        </a>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={cardVariants}
      className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3"
    >

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-white/50">
          <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
          {formatDate(item.createdAt)}
        </div>
        <button
          onClick={onView}
          className="rounded-lg p-1.5 text-white/50 hover:text-white hover:bg-white/10 transition-colors duration-200 focus-ring"
          aria-label="View details"
        >
          <Eye className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <p className="text-sm text-white/70 line-clamp-2">
        {item.reviewTextPreview || '-'}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {item.sentiment && (
          <Badge variant={getSentimentVariant(item.sentiment)} size="sm">
            {capitalize(item.sentiment)}
          </Badge>
        )}
        {item.authenticityLabel && (
          <Badge variant={getAuthenticityVariant(item.authenticityLabel)} size="sm">
            {item.authenticityLabel}
          </Badge>
        )}
        {item.predictedRating && (
          <span className="text-xs text-white/50">
            {getRatingStars(item.predictedRating)}
          </span>
        )}
      </div>
    </motion.div>
  );
}

export default function HistoryPage() {
  const [activeTab, setActiveTab] = useState<'REVIEW' | 'LINK'>('REVIEW');
  const [data, setData] = useState<PagedResponse<ReviewHistoryResponse> | null>(null);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ReviewHistoryResponse | null>(null);
  const { getErrorMessage } = useApiError();
  const pageSize = 15;

  useEffect(() => {
    const fetchHistory = async () => {
      setIsLoading(true);
      try {
        const response = await userApi.getHistory(activeTab, page, pageSize);
        setData(response.data);
      } catch (error) {
        toast.error(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();
  }, [page, activeTab, getErrorMessage]);

  const handleTabChange = (tab: 'REVIEW' | 'LINK') => {
    setActiveTab(tab);
    setPage(0);
    setSearch('');
  };

  const filteredContent = data?.content.filter((item) =>
    search
      ? (item.reviewTextPreview?.toLowerCase().includes(search.toLowerCase()) ||
         item.sentiment?.toLowerCase().includes(search.toLowerCase()) ||
         item.domain?.toLowerCase().includes(search.toLowerCase()) ||
         item.authenticityLabel?.toLowerCase().includes(search.toLowerCase()) ||
         item.productUrlPreview?.toLowerCase().includes(search.toLowerCase()))
      : true
  ) ?? [];

  const getSentimentVariant = (sentiment?: string) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive': return 'success' as const;
      case 'negative': return 'danger' as const;
      default: return 'warning' as const;
    }
  };

  const getAuthenticityVariant = (label?: string) => {
    switch (label?.toLowerCase()) {
      case 'likely genuine': return 'success' as const;
      case 'suspicious': return 'warning' as const;
      case 'highly suspicious': return 'danger' as const;
      default: return 'default' as const;
    }
  };

  return (
    <div className="relative min-h-screen">
      <motion.div
        className="relative mx-auto max-w-6xl space-y-6 py-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >

        <motion.header
          variants={itemVariants}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] border border-white/[0.08]"
              aria-hidden="true"
            >
              <History className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Analysis History</h1>
              <p className="text-sm text-white/50">
                {data ? `${data.totalElements} total analyses` : 'Loading...'}
              </p>
            </div>
          </div>

          <div className="w-full sm:w-72">
            <Input
              id="search-history"
              placeholder="Filter results..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>
        </motion.header>

        <motion.div
          variants={itemVariants}
          className="flex space-x-1 p-1 bg-white/5 rounded-xl border border-white/10 w-fit"
          role="tablist"
          aria-label="History type"
        >
          {[
            { key: 'REVIEW', icon: FileText, label: 'Reviews' },
            { key: 'LINK', icon: Link2, label: 'Links' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key as 'REVIEW' | 'LINK')}
              role="tab"
              aria-selected={activeTab === tab.key}
              aria-controls={`tabpanel-${tab.key}`}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors duration-200 focus-ring ${
                activeTab === tab.key
                  ? 'bg-white text-black'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <tab.icon className="h-4 w-4" aria-hidden="true" />
              <span className="hidden xs:inline">{tab.label}</span>
              <span className="xs:hidden">{tab.key === 'REVIEW' ? 'Reviews' : 'Links'}</span>
            </button>
          ))}
        </motion.div>

        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center py-20"
              role="status"
              aria-label="Loading history"
            >
              <Spinner size="lg" />
            </motion.div>
          ) : filteredContent.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <EmptyState
                icon={<Clock className="h-12 w-12" />}
                title="No history found"
                description={search ? 'No results match your filter.' : `Start analyzing ${activeTab === 'REVIEW' ? 'reviews' : 'links'} to build your history.`}
              />
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
              role="tabpanel"
              id={`tabpanel-${activeTab}`}
              aria-label={`${activeTab === 'REVIEW' ? 'Review' : 'Link'} history`}
            >

              <div className="block lg:hidden space-y-3">
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="space-y-3"
                >
                  {filteredContent.map((item) => (
                    <HistoryCard
                      key={item.id}
                      item={item}
                      type={activeTab}
                      onView={() => setSelected(item)}
                    />
                  ))}
                </motion.div>
              </div>

              <Card className="overflow-hidden p-0 hidden lg:block">
                <div className="overflow-x-auto">
                  <table className="w-full" role="table">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/[0.02]">
                        <th scope="col" className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-white/50">
                          Date
                        </th>
                        {activeTab === 'REVIEW' ? (
                          <>
                            <th scope="col" className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-white/50">
                              Preview
                            </th>
                            <th scope="col" className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-white/50">
                              Sentiment
                            </th>
                            <th scope="col" className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-white/50">
                              Rating
                            </th>
                            <th scope="col" className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-white/50">
                              Authenticity
                            </th>
                            <th scope="col" className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-white/50 w-12">
                              <span className="sr-only">Actions</span>
                            </th>
                          </>
                        ) : (
                          <>
                            <th scope="col" className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-white/50">
                              Analyzed Link
                            </th>
                            <th scope="col" className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-white/50">
                              Domain
                            </th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <motion.tbody
                      className="divide-y divide-white/5"
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      {filteredContent.map((item) => (
                        <motion.tr
                          key={item.id}
                          variants={cardVariants}
                          className="group hover:bg-white/[0.03] transition-colors duration-200"
                        >
                          <td className="px-4 py-4 text-sm text-white/60 whitespace-nowrap">
                            {formatDate(item.createdAt)}
                          </td>
                          {activeTab === 'REVIEW' ? (
                            <>
                              <td className="px-4 py-4 text-sm text-white/70 max-w-[200px] truncate">
                                {item.reviewTextPreview || '-'}
                              </td>
                              <td className="px-4 py-4">
                                <Badge variant={getSentimentVariant(item.sentiment)} size="sm">
                                  {item.sentiment ? capitalize(item.sentiment) : '-'}
                                </Badge>
                              </td>
                              <td className="px-4 py-4 text-sm text-white/70 whitespace-nowrap">
                                {item.predictedRating ? getRatingStars(item.predictedRating) : '-'}
                              </td>
                              <td className="px-4 py-4">
                                <Badge variant={getAuthenticityVariant(item.authenticityLabel)} size="sm">
                                  {item.authenticityLabel || '-'}
                                </Badge>
                              </td>
                              <td className="px-4 py-4">
                                <button
                                  onClick={() => setSelected(item)}
                                  className="rounded-lg p-2 text-white/50 opacity-0 group-hover:opacity-100 hover:text-white hover:bg-white/10 transition-all duration-200 focus-ring"
                                  aria-label="View details"
                                >
                                  <Eye className="h-4 w-4" aria-hidden="true" />
                                </button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-4 text-sm text-white/70 max-w-[400px] truncate">
                                <a
                                  href={item.productUrlPreview}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-white hover:text-white/80 hover:underline transition-colors focus-ring rounded"
                                >
                                  {item.productUrlPreview || '-'}
                                </a>
                              </td>
                              <td className="px-4 py-4">
                                {item.domain && (
                                  <Badge variant="info" size="sm">{item.domain}</Badge>
                                )}
                              </td>
                            </>
                          )}
                        </motion.tr>
                      ))}
                    </motion.tbody>
                  </table>
                </div>
              </Card>

              {data && data.totalPages > 1 && (
                <motion.nav
                  variants={itemVariants}
                  className="flex flex-col sm:flex-row items-center justify-between gap-4"
                  aria-label="Pagination"
                >
                  <p className="text-sm text-white/50">
                    Page <span className="text-white font-medium">{data.page + 1}</span> of{' '}
                    <span className="text-white font-medium">{data.totalPages}</span>
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={data.page === 0}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                      <span className="hidden sm:inline">Previous</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={data.last}
                      aria-label="Next page"
                    >
                      <span className="hidden sm:inline">Next</span>
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </motion.nav>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Review Analysis Details">
        {selected && selected.analysisType === 'INDIVIDUAL_REVIEW' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
              {[
                { label: 'Date', value: formatDate(selected.createdAt), show: true },
                { label: 'Sentiment', value: capitalize(selected.sentiment), badge: true, variant: getSentimentVariant(selected.sentiment), show: !!selected.sentiment },
                { label: 'Rating', value: selected.predictedRating ? getRatingStars(selected.predictedRating) : null, show: !!selected.predictedRating },
                { label: 'Authenticity', value: selected.authenticityLabel, badge: true, variant: getAuthenticityVariant(selected.authenticityLabel), show: !!selected.authenticityLabel },
                { label: 'Auth Score', value: selected.authenticityScore != null ? `${selected.authenticityScore.toFixed(1)}/100` : null, show: selected.authenticityScore != null },
                { label: 'Language', value: getLanguageName(selected.detectedLanguage), badge: true, variant: 'info' as const, show: !!selected.detectedLanguage },
              ].filter(item => item.show).map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl bg-white/[0.03] p-4 border border-white/10"
                >
                  <p className="text-xs font-medium text-white/50 mb-1">{item.label}</p>
                  {item.badge ? (
                    <Badge variant={item.variant}>{item.value}</Badge>
                  ) : (
                    <p className="text-sm font-medium text-white">{item.value}</p>
                  )}
                </div>
              ))}
            </div>

            {selected.reviewTextPreview && (
              <div>
                <p className="text-xs font-medium text-white/50 mb-2">Review Preview</p>
                <p className="text-sm leading-relaxed text-white/70 bg-white/[0.03] rounded-xl p-4 border border-white/10">
                  {selected.reviewTextPreview}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
