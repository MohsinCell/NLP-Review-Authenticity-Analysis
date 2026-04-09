import axios from 'axios';
import type {
  ScraperDetectResponse,
  ScraperStartRequest,
  ScraperStartResponse,
  ScraperStatusResponse,
  CookieStatusResponse,
  CookieSiteStatus,
  CookieSchedulerState,
} from '../types';

const scraperClient = axios.create({
  baseURL: '/scraper',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

export const scraperApi = {

  detect: (url: string) =>
    scraperClient.get<ScraperDetectResponse>('/detect', { params: { url } }),

  startScrape: (data: ScraperStartRequest) =>
    scraperClient.post<ScraperStartResponse>('/scrape', data),

  getStatus: (jobId: string) =>
    scraperClient.get<ScraperStatusResponse>(`/status/${jobId}`),

  getDownloadUrl: (jobId: string) => `/scraper/download/${jobId}`,

  getCookieStatus: () =>
    scraperClient.get<CookieStatusResponse>('/cookies/status'),

  getSiteCookieStatus: (siteKey: string) =>
    scraperClient.get<CookieSiteStatus>(`/cookies/status/${siteKey}`),

  importCookies: (siteKey: string, cookies: string) =>
    scraperClient.post<CookieSiteStatus>(`/cookies/import/${siteKey}`, { cookies }),

  refreshSiteCookies: (siteKey: string) =>
    scraperClient.post<CookieSiteStatus>(`/cookies/refresh/${siteKey}`),

  refreshAllCookies: () =>
    scraperClient.post<CookieStatusResponse>('/cookies/refresh-all'),

  getSchedulerState: () =>
    scraperClient.get<CookieSchedulerState>('/cookies/scheduler'),

  updateScheduler: (config: { enabled: boolean; interval_seconds?: number }) =>
    scraperClient.post<CookieSchedulerState>('/cookies/scheduler', config),
};
