import api from './client';
import type {
  AuthResponse,
  SignupRequest,
  LoginRequest,
  SendOtpRequest,
  VerifyOtpRequest,
  MessageResponse,
} from '../types';

export const authApi = {
  sendOtp: (data: SendOtpRequest) =>
    api.post<MessageResponse>('/auth/send-otp', data),

  verifyOtp: (data: VerifyOtpRequest) =>
    api.post<MessageResponse>('/auth/verify-otp', data),

  signup: (data: SignupRequest) =>
    api.post<AuthResponse>('/auth/signup', data),

  login: (data: LoginRequest) =>
    api.post<AuthResponse>('/auth/login', data),

  refreshToken: (refreshToken: string) =>
    api.post<AuthResponse>('/auth/refresh-token', { refreshToken }),

  logout: () =>
    api.post<MessageResponse>('/auth/logout'),
};
