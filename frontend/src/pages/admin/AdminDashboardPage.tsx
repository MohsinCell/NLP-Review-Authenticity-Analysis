import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, BarChart3, FileText, Link2, Shield, Globe, Eye, UserCheck, UserX, LayoutDashboard } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/admin';
import { useApiError } from '../../hooks/useApiError';
import type { AdminMetricsResponse, AdminVisitsResponse } from '../../types';
import MetricCard from '../../components/ui/MetricCard';
import Spinner from '../../components/ui/Spinner';
import { containerVariants, itemVariants } from '../../lib/motion';

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<AdminMetricsResponse | null>(null);
  const [visits, setVisits] = useState<AdminVisitsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { getErrorMessage } = useApiError();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [metricsRes, visitsRes] = await Promise.all([
          adminApi.getMetrics(),
          adminApi.getVisits(),
        ]);
        setMetrics(metricsRes.data);
        setVisits(visitsRes.data);
      } catch (error) {
        toast.error(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [getErrorMessage]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="py-20 text-center">
        <p className="text-neutral-400">Failed to load admin metrics.</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <motion.div
        className="relative mx-auto max-w-7xl space-y-6 py-4 px-1 sm:px-0"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >

        <motion.div variants={itemVariants} className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] border border-white/[0.08]">
            <LayoutDashboard className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-sm text-neutral-500">Platform overview and analytics</p>
          </div>
        </motion.div>

        <motion.div
          variants={containerVariants}
          className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        >
          {[
            { title: 'Total Users', value: metrics.totalUsers, icon: <Users className="h-5 w-5" /> },
            { title: 'Total Analyses', value: metrics.totalAnalyses, icon: <BarChart3 className="h-5 w-5" /> },
            { title: 'Review Analyses', value: metrics.individualReviewAnalyses, icon: <FileText className="h-5 w-5" /> },
            { title: 'Link Analyses', value: metrics.linkAnalyses, icon: <Link2 className="h-5 w-5" /> },
            { title: 'By Auth Users', value: metrics.analysesByAuthenticatedUsers, icon: <Shield className="h-5 w-5" /> },
            { title: 'By Anonymous', value: metrics.analysesByAnonymousUsers, icon: <Globe className="h-5 w-5" /> },
          ].map((metric) => (
            <motion.div key={metric.title} variants={itemVariants}>
              <MetricCard title={metric.title} value={metric.value} icon={metric.icon} />
            </motion.div>
          ))}
        </motion.div>

        {visits && (
          <motion.div variants={itemVariants}>
            <div className="flex items-center gap-2 mb-4">
              <Eye className="h-4 w-4 text-neutral-500" />
              <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wide">Visit Statistics</h2>
            </div>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { title: 'Total Visits', value: visits.totalVisits, icon: <Eye className="h-5 w-5" /> },
                { title: 'Authenticated Visits', value: visits.authenticatedVisits, icon: <UserCheck className="h-5 w-5" /> },
                { title: 'Anonymous Visits', value: visits.anonymousVisits, icon: <UserX className="h-5 w-5" /> },
              ].map((stat) => (
                <motion.div key={stat.title} variants={itemVariants}>
                  <MetricCard title={stat.title} value={stat.value} icon={stat.icon} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
