
export interface User {
  id: string;
  fullName: string;
  email: string;
  role: 'USER' | 'ADMIN';
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: User;
}

export interface SignupRequest {
  fullName: string;
  email: string;
  password: string;
}

export interface SendOtpRequest {
  email: string;
  captchaToken?: string;
}

export interface VerifyOtpRequest {
  email: string;
  otp: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  captchaToken?: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface DeleteAccountRequest {
  password: string;
}

export interface ConfirmDeleteAccountRequest {
  otp: string;
}

export interface MessageResponse {
  message: string;
}

export interface ReviewAnalysisRequest {
  reviewText: string;
}

export interface ReviewAnalysisResponse {
  sentiment: string;
  confidence: number;
  predictedRating: number;
  aiGeneratedProbability: number;
  authenticityScore: number;
  authenticityLabel: string;
  language: string;
  languageName?: string;
  originalText?: string;
  translatedText?: string;
  wasTranslated: boolean;
}

export interface LinkAnalysisRequest {
  productUrl: string;
}

export interface SaveLinkAnalysisRequest {
  productUrl: string;
  totalReviewsAnalyzed: number;
  positivePercentage: number;
  negativePercentage: number;
  neutralPercentage: number;
  averagePredictedRating: number;
  aiGeneratedPercentage: number;
  languagesDetected: string;
}

export interface LinkAnalysisResponse {
  domain: string;
  totalReviewsAnalyzed: number;
  positivePercentage: number;
  negativePercentage: number;
  neutralPercentage: number;
  averagePredictedRating: number;
  aiGeneratedPercentage: number;
  authenticityScore: number;
  authenticityLabel: string;
  languagesDetected: string;
}

export interface ScraperDetectResponse {
  detected: boolean;
  site?: string;
  requires_js?: boolean;
  cookies_found?: boolean;
}

export interface ScraperStartRequest {
  url: string;
  max_pages: number;
  max_reviews: number;
  min_delay: number;
  max_delay: number;
  render_js: boolean;
}

export interface ScraperStartResponse {
  job_id: string;
}

export interface ScrapedReview {
  text: string;
  rating: number;
  date: string;
}

export interface ProductMetadata {
  name: string;
  brand: string;
  image_url: string;
  price: string;
  overall_rating: number | null;
  total_ratings: number;
  total_reviews: number;
  platform: string;
  url: string;
}

export interface ScraperStatusResponse {
  status: 'pending' | 'running' | 'completed' | 'failed';
  current_page: number;
  max_pages: number;
  total_reviews: number;
  message: string;
  site_name: string;
  error: string | null;
  reviews?: ScrapedReview[];
  product?: ProductMetadata;
}

export interface CookieSiteStatus {
  site_key: string;
  site_name: string;
  domain: string;
  status: 'valid' | 'expired' | 'missing' | 'refreshing' | 'login_active';
  cookie_count: number;
  last_refreshed: string | null;
  last_checked: string | null;
  message: string;
}

export interface CookieStatusResponse {
  sites: CookieSiteStatus[];
  scheduler: CookieSchedulerState;
}

export interface CookieLoginCheckResponse {
  logged_in: boolean;
  status: string;
  message: string;
  cookies_captured: boolean;
  current_url?: string;
  cookie_count?: number;
}

export interface CookieSchedulerState {
  enabled: boolean;
  interval_seconds: number;
  last_run: string | null;
  next_run: string | null;
  running: boolean;
}

export interface AnalyzedReview {
  text: string;
  scraperRating: number;
  date: string;
  sentiment: string;
  confidence: number;
  predictedRating: number;
  aiGeneratedProbability: number;
  authenticityScore: number;
  authenticityLabel: string;
  detectedLanguage: string;
  error?: string;
}

export interface UserProfileResponse {
  id: string;
  fullName: string;
  email: string;
  role: string;
  createdAt?: string;
  totalAnalyses: number;
}

export interface ReviewHistoryResponse {
  id: string;
  reviewTextPreview: string;
  sentiment: string;
  predictedRating: number;
  aiGeneratedProbability: number;
  authenticityScore: number;
  authenticityLabel: string;
  detectedLanguage: string;
  createdAt: string;
  analysisType: string;

  domain?: string;
  totalReviewsAnalyzed?: number;
  positivePercentage?: number;
  negativePercentage?: number;
  neutralPercentage?: number;
  averagePredictedRating?: number;
  aiGeneratedPercentage?: number;
  languagesDetected?: string;
  productUrlPreview?: string;
}

export interface PagedResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export interface AdminMetricsResponse {
  totalUsers: number;
  totalAnalyses: number;
  analysesByAuthenticatedUsers: number;
  analysesByAnonymousUsers: number;
  individualReviewAnalyses: number;
  linkAnalyses: number;
  languageDistribution: Record<string, number>;
  domainDistribution: Record<string, number>;
}

export interface AdminUserListResponse {
  id: string;
  fullName: string;
  email: string;
  role: string;
  enabled: boolean;
  createdAt: string;
  totalAnalyses: number;
}

export interface AdminVisitsResponse {
  totalVisits: number;
  authenticatedVisits: number;
  anonymousVisits: number;
}

export interface AnalysisCountResponse {
  [key: string]: number;
}

export interface ContactMessageResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  subject: string;
  message: string;
  userId: string | null;
  createdAt: string;
}

export interface Keyword {
  keyword: string;
  score: number;
}

export interface Topic {
  topic: string;
  count: number;
  keywords: string[];
}

export interface KeywordExtractionResponse {
  keywords: Keyword[];
  topics: Topic[];
  wordCount: number;
  reviewCount: number;
}

export interface RedFlag {
  type: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  evidence: string;
}

export interface RedFlagsResponse {
  redFlags: RedFlag[];
  totalFlags: number;
  suspicionLevel: 'high' | 'medium' | 'low';
  score: number;
}

export interface DetectionResult {
  detected: boolean;
  severity: 'high' | 'medium' | 'low';
  score: number;
  details: string;
  flaggedIndices?: number[];
  distribution?: Record<string, number>;
  stats?: Record<string, number>;
  clusters?: Array<{ reviewIndices: number[]; preview: string; count: number }>;
  repeatedPhrases?: Array<{ phrase: string; count: number; reviewIndices: number[] }>;
}

export interface ProductTrustReportResponse {
  trustScore: number;
  trustLabel: string;
  totalReviews: number;
  detections: {
    reviewBurst: DetectionResult;
    ratingDistribution: DetectionResult;
    ratingSentimentMismatch: DetectionResult;
    duplicateContent: DetectionResult;
    lengthUniformity: DetectionResult;
    phraseRepetition: DetectionResult;
  };
}

export interface ApiError {
  message: string;
  status: number;
  timestamp?: string;
  errors?: Record<string, string>;
}
