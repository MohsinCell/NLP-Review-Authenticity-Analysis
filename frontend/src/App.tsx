import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';
import Spinner from './components/ui/Spinner';

const HomePage = lazy(() => import('./pages/HomePage'));
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const SignupPage = lazy(() => import('./pages/auth/SignupPage'));
const AnalyzeReviewPage = lazy(() => import('./pages/analysis/AnalyzeReviewPage'));
const ProductAnalysisPage = lazy(() => import('./pages/analysis/ProductAnalysisPage'));
const ModelsPage = lazy(() => import('./pages/ModelsPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const ProfilePage = lazy(() => import('./pages/dashboard/ProfilePage'));
const HistoryPage = lazy(() => import('./pages/dashboard/HistoryPage'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminContactMessagesPage = lazy(() => import('./pages/admin/AdminContactMessagesPage'));
const AdminCookiesPage = lazy(() => import('./pages/admin/AdminCookiesPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const FaqPage = lazy(() => import('./pages/FaqPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const ChromeExtensionPage = lazy(() => import('./pages/ChromeExtensionPage'));

function PageFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <Spinner size="lg" />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-center"
          containerStyle={{
            top: 20,
          }}
          toastOptions={{
            duration: 4000,
            style: {
              background: 'rgba(10, 10, 10, 0.95)',
              color: '#fff',
              borderRadius: '0.875rem',
              fontSize: '0.875rem',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(12px)',
              padding: '12px 16px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              maxWidth: '90vw',
            },
            success: {
              iconTheme: {
                primary: '#22c55e',
                secondary: '#fff',
              },
              style: {
                background: 'rgba(10, 10, 10, 0.95)',
                border: '1px solid rgba(34, 197, 94, 0.2)',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
              style: {
                background: 'rgba(10, 10, 10, 0.95)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
              },
            },
          }}
        />
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route element={<AppLayout />}>

              <Route path="/" element={<HomePage />} />
              <Route path="/analyze" element={<AnalyzeReviewPage />} />
              <Route path="/product-analysis" element={<ProductAnalysisPage />} />
              <Route path="/models" element={<ModelsPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/faq" element={<FaqPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />

              <Route
                path="/chrome-extension"
                element={
                  <ProtectedRoute requireAuth>
                    <ChromeExtensionPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/profile"
                element={
                  <ProtectedRoute requireAuth>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/history"
                element={
                  <ProtectedRoute requireAuth>
                    <HistoryPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin"
                element={
                  <ProtectedRoute requireAuth requireAdmin>
                    <AdminDashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute requireAuth requireAdmin>
                    <AdminUsersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/contact-messages"
                element={
                  <ProtectedRoute requireAuth requireAdmin>
                    <AdminContactMessagesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/cookies"
                element={
                  <ProtectedRoute requireAuth requireAdmin>
                    <AdminCookiesPage />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
