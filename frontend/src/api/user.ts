import api from './client';
import type {
  UserProfileResponse,
  ReviewHistoryResponse,
  PagedResponse,
  ChangePasswordRequest,
  DeleteAccountRequest,
  ConfirmDeleteAccountRequest,
  MessageResponse,
} from '../types';

export const userApi = {
  getProfile: () =>
    api.get<UserProfileResponse>('/users/me'),

  getHistory: (type?: 'REVIEW' | 'LINK', page: number = 0, size: number = 20) =>
    api.get<PagedResponse<ReviewHistoryResponse>>('/users/history', {
      params: { type, page, size },
    }),

  changePassword: (data: ChangePasswordRequest) =>
    api.put<MessageResponse>('/users/change-password', data),

  initiateDeleteAccount: (data: DeleteAccountRequest) =>
    api.post<MessageResponse>('/users/delete-account/initiate', data),

  confirmDeleteAccount: (data: ConfirmDeleteAccountRequest) =>
    api.post<MessageResponse>('/users/delete-account/confirm', data),
};
