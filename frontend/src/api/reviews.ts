import api from './client';
import type {
  ReviewAnalysisRequest,
  ReviewAnalysisResponse,
  LinkAnalysisRequest,
  LinkAnalysisResponse,
  SaveLinkAnalysisRequest,
  MessageResponse,
  ProductTrustReportResponse,
} from '../types';

export const reviewApi = {
  analyzeReview: (data: ReviewAnalysisRequest) =>
    api.post<ReviewAnalysisResponse>('/reviews/analyze', data),

  analyzeLink: (data: LinkAnalysisRequest) =>
    api.post<LinkAnalysisResponse>('/reviews/analyze-link', data),

  saveLinkAnalysis: (data: SaveLinkAnalysisRequest) =>
    api.post<MessageResponse>('/reviews/save-link-analysis', data),

  getProductTrustReport: (reviews: Record<string, unknown>[]) =>
    api.post<ProductTrustReportResponse>('/ml-service/product-trust-report', { reviews }),
};
