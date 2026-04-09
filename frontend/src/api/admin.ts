import api from './client';
import type {
  AdminMetricsResponse,
  AdminUserListResponse,
  AdminVisitsResponse,
  AnalysisCountResponse,
  ContactMessageResponse,
  PagedResponse,
} from '../types';

export const adminApi = {
  getMetrics: () =>
    api.get<AdminMetricsResponse>('/admin/metrics'),

  getUsers: (page: number = 0, size: number = 20) =>
    api.get<PagedResponse<AdminUserListResponse>>('/admin/users', {
      params: { page, size },
    }),

  getAnalysisCount: () =>
    api.get<AnalysisCountResponse>('/admin/analysis-count'),

  getVisits: () =>
    api.get<AdminVisitsResponse>('/admin/visits'),

  getContactMessages: () =>
    api.get<ContactMessageResponse[]>('/admin/contact-messages'),
};
