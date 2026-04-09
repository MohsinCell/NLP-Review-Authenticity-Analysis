import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Cookie,
  RefreshCw,
  Upload,
  X,
  CheckCircle,
  AlertCircle,
  Clock,
  Globe,
  ServerOff,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { scraperApi } from '../../api/scraper';
import type { CookieSiteStatus } from '../../types';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import { formatDate } from '../../lib/utils';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35 },
  },
};

const STATUS_BADGE: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'default'> = {
  valid: 'success',
  expired: 'danger',
  missing: 'warning',
  refreshing: 'info',
  unknown: 'default',
};

const STATUS_LABEL: Record<string, string> = {
  valid: 'Valid',
  expired: 'Expired',
  missing: 'Missing',
  refreshing: 'Refreshing...',
  unknown: 'Unknown',
};

export default function AdminCookiesPage() {
  const [sites, setSites] = useState<CookieSiteStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [serviceUnavailable, setServiceUnavailable] = useState(false);
  const [refreshing, setRefreshing] = useState<Record<string, boolean>>({});
  const [refreshingAll, setRefreshingAll] = useState(false);

  const [importSite, setImportSite] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await scraperApi.getCookieStatus();
      setSites(res.data.sites);
      setServiceUnavailable(false);
    } catch {
      setServiceUnavailable(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleImportCookies = async () => {
    if (!importSite || !importText.trim()) return;

    setImporting(true);
    try {
      const res = await scraperApi.importCookies(importSite, importText.trim());
      setSites((prev) =>
        prev.map((s) => (s.site_key === importSite ? res.data : s))
      );
      toast.success(`Imported cookies for ${res.data.site_name}`);
      setImportSite(null);
      setImportText('');
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || 'Failed to import cookies';
      toast.error(message);
    } finally {
      setImporting(false);
    }
  };

  const handleRefreshSite = async (siteKey: string) => {
    setRefreshing((prev) => ({ ...prev, [siteKey]: true }));
    try {
      const res = await scraperApi.refreshSiteCookies(siteKey);
      setSites((prev) =>
        prev.map((s) => (s.site_key === siteKey ? res.data : s))
      );
      if (res.data.status === 'valid') {
        toast.success(`${res.data.site_name} cookies refreshed`);
      } else {
        toast.error(`${res.data.site_name}: ${res.data.message}`);
      }
    } catch {
      toast.error('Refresh failed');
    } finally {
      setRefreshing((prev) => ({ ...prev, [siteKey]: false }));
    }
  };

  const handleRefreshAll = async () => {
    setRefreshingAll(true);
    try {
      const res = await scraperApi.refreshAllCookies();
      setSites(res.data.sites);
      toast.success('All cookies refreshed');
    } catch {
      toast.error('Refresh all failed');
    } finally {
      setRefreshingAll(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (serviceUnavailable) {
    return (
      <motion.div
        className="mx-auto max-w-6xl py-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants}>
          <Card className="p-8 sm:p-12 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20">
                <ServerOff className="h-8 w-8 text-amber-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white mb-2">Scraper Service Unavailable</h2>
                <p className="text-neutral-400 max-w-md mx-auto">
                  The cookie management service is not running or not reachable.
                  This service requires the Flask scraper backend to be running on the server.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsLoading(true);
                  fetchStatus();
                }}
                className="mt-4"
              >
                <RefreshCw className="h-4 w-4" />
                Retry Connection
              </Button>
            </div>
          </Card>
        </motion.div>
      </motion.div>
    );
  }

  const validCount = sites.filter((s) => s.status === 'valid').length;
  const expiredCount = sites.filter(
    (s) => s.status === 'expired' || s.status === 'missing'
  ).length;

  const importSiteInfo = importSite
    ? sites.find((s) => s.site_key === importSite)
    : null;

  return (
    <>
      <motion.div
        className="mx-auto max-w-6xl space-y-6 py-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >

        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] border border-white/[0.08]">
              <Cookie className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Cookie Management</h1>
              <p className="text-sm text-neutral-500">
                <span className="text-white font-semibold">{validCount}</span> valid
                {expiredCount > 0 && (
                  <>
                    {' / '}
                    <span className="text-red-400 font-semibold">{expiredCount}</span>{' '}
                    need attention
                  </>
                )}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            disabled={refreshingAll}
            isLoading={refreshingAll}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh All
          </Button>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sites.map((site) => {
            const isRefresh = refreshing[site.site_key] || site.status === 'refreshing';

            return (
              <motion.div key={site.site_key} variants={itemVariants}>
                <Card className="p-4 sm:p-5 h-full flex flex-col">

                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 rounded-lg bg-white/[0.05] shrink-0">
                        <Globe className="h-4 w-4 text-neutral-400" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-white truncate">
                          {site.site_name}
                        </h3>
                        <p className="text-xs text-neutral-500">{site.domain}</p>
                      </div>
                    </div>
                    <Badge variant={STATUS_BADGE[site.status] || 'default'}>
                      {STATUS_LABEL[site.status] || site.status}
                    </Badge>
                  </div>

                  <div className="space-y-2 mb-4 flex-1">
                    <div className="flex items-center gap-2 text-xs">
                      {site.status === 'valid' ? (
                        <CheckCircle className="h-3.5 w-3.5 text-green-400 shrink-0" />
                      ) : site.status === 'expired' || site.status === 'missing' ? (
                        <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                      )}
                      <span className="text-neutral-400 truncate">{site.message}</span>
                    </div>

                    {site.cookie_count > 0 && (
                      <p className="text-xs text-neutral-500">
                        {site.cookie_count} cookies
                      </p>
                    )}

                    {site.last_refreshed && (
                      <p className="text-xs text-neutral-500">
                        Refreshed: {formatDate(site.last_refreshed)}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 mt-auto">
                    <Button
                      variant="primary"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setImportSite(site.site_key);
                        setImportText('');
                      }}
                      disabled={isRefresh}
                    >
                      <Upload className="h-4 w-4" />
                      Import Cookies
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRefreshSite(site.site_key)}
                      disabled={isRefresh || site.status === 'missing'}
                      isLoading={isRefresh}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {importSite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => { setImportSite(null); setImportText(''); }}
          />
          <div className="relative w-full max-w-lg rounded-2xl border border-white/[0.08] bg-neutral-950 p-6 shadow-2xl">

            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">
                Import Cookies: {importSiteInfo?.site_name}
              </h2>
              <button
                onClick={() => { setImportSite(null); setImportText(''); }}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.05] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4 rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 text-xs text-neutral-400 space-y-1.5">
              <p className="font-medium text-neutral-300">How to export cookies:</p>
              <p>1. Install a browser extension like <span className="text-white">EditThisCookie</span> or <span className="text-white">Cookie Editor</span></p>
              <p>2. Log in to <span className="text-white">{importSiteInfo?.domain}</span> in your browser</p>
              <p>3. Click the extension icon and export cookies (JSON or Netscape format)</p>
              <p>4. Paste the exported cookies below</p>
            </div>

            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={'Paste cookies here...\n\nSupports JSON (from browser extensions) or Netscape tab-separated format.'}
              rows={8}
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-white/20 resize-none font-mono"
            />

            <div className="flex justify-end gap-3 mt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setImportSite(null); setImportText(''); }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleImportCookies}
                disabled={!importText.trim() || importing}
                isLoading={importing}
              >
                <Upload className="h-4 w-4" />
                Import
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
