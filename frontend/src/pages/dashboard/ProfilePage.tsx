import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Mail, Calendar, BarChart3, Shield, LogOut, Lock, Key, Trash2, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { userApi } from '../../api/user';
import { useAuth } from '../../context/AuthContext';
import { useApiError } from '../../hooks/useApiError';
import type { UserProfileResponse } from '../../types';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Spinner from '../../components/ui/Spinner';
import Modal from '../../components/ui/Modal';
import { formatDate } from '../../lib/utils';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { getErrorMessage } = useApiError();

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState<'password' | 'otp'>('password');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteOtp, setDeleteOtp] = useState('');
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({});
  const [isDeleting, setIsDeleting] = useState(false);

  const deletePasswordRef = useRef<HTMLInputElement>(null);
  const deleteOtpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await userApi.getProfile();
        setProfile(response.data);
      } catch (error) {
        toast.error(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, [getErrorMessage]);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    navigate('/');
  };

  const validatePasswordForm = () => {
    const errs: Record<string, string> = {};
    if (!currentPassword) errs.currentPassword = 'Current password is required';
    if (!newPassword) errs.newPassword = 'New password is required';
    else if (newPassword.length < 8) errs.newPassword = 'Password must be at least 8 characters';
    else if (!/[A-Z]/.test(newPassword)) errs.newPassword = 'Must contain an uppercase letter';
    else if (!/[0-9]/.test(newPassword)) errs.newPassword = 'Must contain a number';
    if (newPassword !== confirmNewPassword) errs.confirmNewPassword = 'Passwords do not match';
    if (currentPassword && newPassword && currentPassword === newPassword) {
      errs.newPassword = 'New password must be different from current password';
    }
    setPasswordErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!validatePasswordForm()) return;
    setIsChangingPassword(true);
    try {
      await userApi.changePassword({ currentPassword, newPassword });
      toast.success('Password changed successfully. Please log in again.');
      setShowPasswordForm(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordErrors({});
      await logout();
      navigate('/login');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleInitiateDelete = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!deletePassword) errs.password = 'Password is required';
    setDeleteErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setIsDeleting(true);
    try {
      const response = await userApi.initiateDeleteAccount({ password: deletePassword });
      toast.success(response.data.message);

      setDeletePassword('');
      setDeleteErrors({});
      setDeleteStep('otp');

      setTimeout(() => {
        deleteOtpRef.current?.focus();
      }, 100);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmDelete = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!deleteOtp) errs.otp = 'OTP is required';
    else if (deleteOtp.length !== 6) errs.otp = 'OTP must be 6 digits';
    setDeleteErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setIsDeleting(true);
    try {
      const response = await userApi.confirmDeleteAccount({ otp: deleteOtp });
      toast.success(response.data.message);
      setShowDeleteModal(false);

      await logout();
      navigate('/');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsDeleting(false);
    }
  };

  const resetDeleteModal = () => {
    setShowDeleteModal(false);
    setDeleteStep('password');
    setDeletePassword('');
    setDeleteOtp('');
    setDeleteErrors({});
  };

  const handleDeletePasswordChange = (e: ChangeEvent<HTMLInputElement>) => {
    setDeletePassword(e.target.value);
  };

  const handleDeleteOtpChange = (e: ChangeEvent<HTMLInputElement>) => {

    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setDeleteOtp(value);
  };

  useEffect(() => {
    if (showDeleteModal && deleteStep === 'password') {

      const timeoutId = setTimeout(() => {
        deletePasswordRef.current?.focus();
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [showDeleteModal, deleteStep]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="py-20 text-center">
        <p className="text-neutral-400">Failed to load profile.</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <motion.div
        className="relative mx-auto max-w-2xl space-y-6 py-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >

        <motion.div variants={itemVariants} className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] border border-white/[0.08]">
            <User className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Profile</h1>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card hover={false} glow>
            <div className="flex flex-col items-center sm:flex-row sm:items-start gap-6">

              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/[0.05] text-white border border-white/[0.1] shrink-0">
                <User className="h-12 w-12" />
              </div>

              <div className="flex-1 min-w-0 text-center sm:text-left overflow-hidden">
                <h2 className="text-2xl font-bold text-white truncate" title={profile.fullName}>
                  {profile.fullName}
                </h2>
                <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <Badge variant={profile.role === 'ADMIN' ? 'info' : 'default'}>
                    <Shield className="mr-1 h-3 w-3" />
                    {profile.role}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3 border-t border-white/10 pt-6">
              {[
                { icon: Mail, label: 'Email', value: profile.email },
                { icon: Calendar, label: 'Member Since', value: profile.createdAt ? formatDate(profile.createdAt) : 'N/A' },
                { icon: BarChart3, label: 'Total Analyses', value: profile.totalAnalyses.toString() },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-4 border border-white/[0.06] min-w-0"
                >
                  <div className="rounded-lg bg-white/5 p-2.5 shrink-0">
                    <item.icon className="h-4 w-4 text-white" />
                  </div>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <p className="text-xs font-medium text-neutral-500">{item.label}</p>
                    <p className="text-sm font-medium text-white truncate" title={item.value}>
                      {item.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-3 border-t border-white/10 pt-6">
              <Button
                variant="secondary"
                onClick={() => setShowPasswordForm(!showPasswordForm)}
              >
                <Lock className="h-4 w-4" /> Change Password
              </Button>
              <Button variant="danger" onClick={handleLogout}>
                <LogOut className="h-4 w-4" /> Logout
              </Button>
            </div>

            <div className="mt-6 border-t border-red-500/20 pt-6">
              <div className="flex items-start gap-3 rounded-xl bg-red-500/5 border border-red-500/20 p-4">
                <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-red-400 mb-1">Account Deletion</h4>
                  <p className="text-xs text-red-300/70 mb-3">
                    Permanently delete your account and all associated data. This action cannot be undone.
                  </p>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setShowDeleteModal(true)}
                  >
                    <Trash2 className="h-4 w-4" /> Delete Account
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        <AnimatePresence>
          {showPasswordForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
            >
              <Card hover={false} glow>
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10">
                    <Key className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-white">Change Password</h3>
                </div>

                <form onSubmit={handleChangePassword} className="space-y-5">
                  <Input
                    id="currentPassword"
                    label="Current Password"
                    type="password"
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    error={passwordErrors.currentPassword}
                    leftIcon={<Lock className="h-4 w-4" />}
                  />

                  <Input
                    id="newPassword"
                    label="New Password"
                    type="password"
                    placeholder="Min. 8 characters, 1 uppercase, 1 number"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    error={passwordErrors.newPassword}
                    leftIcon={<Lock className="h-4 w-4" />}
                  />

                  <Input
                    id="confirmNewPassword"
                    label="Confirm New Password"
                    type="password"
                    placeholder="Re-enter new password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    error={passwordErrors.confirmNewPassword}
                  />

                  <div className="flex gap-3 pt-2">
                    <Button type="submit" glow isLoading={isChangingPassword}>
                      Update Password
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setShowPasswordForm(false);
                        setCurrentPassword('');
                        setNewPassword('');
                        setConfirmNewPassword('');
                        setPasswordErrors({});
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <Modal
          isOpen={showDeleteModal}
          onClose={resetDeleteModal}
          title={deleteStep === 'password' ? 'Delete Account' : 'Verify Account Deletion'}
          disableAutoFocus
        >
          <div key={deleteStep}>
            {deleteStep === 'password' ? (
              <form onSubmit={handleInitiateDelete} className="space-y-5">
                <div className="flex items-start gap-3 rounded-xl bg-red-500/10 border border-red-500/30 p-4 mb-6">
                  <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-400 mb-1">Warning: This action is irreversible</p>
                    <p className="text-xs text-red-300/70">
                      All your data including analysis history will be permanently deleted and cannot be recovered.
                    </p>
                  </div>
                </div>

                <Input
                  ref={deletePasswordRef}
                  id="deletePassword"
                  label="Confirm Your Password"
                  type="password"
                  placeholder="Enter your password to continue"
                  value={deletePassword}
                  onChange={handleDeletePasswordChange}
                  error={deleteErrors.password}
                  leftIcon={<Lock className="h-4 w-4" />}
                />

                <div className="flex gap-3 pt-2">
                  <Button
                    type="submit"
                    variant="danger"
                    glow
                    isLoading={isDeleting}
                  >
                    Continue to Verification
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={resetDeleteModal}
                    disabled={isDeleting}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleConfirmDelete} className="space-y-5">
                <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-4 mb-6">
                  <p className="text-sm text-white/70 mb-2">
                    A verification code has been sent to your email address:
                  </p>
                  <p className="text-sm font-medium text-white">{profile?.email}</p>
                </div>

                <Input
                  ref={deleteOtpRef}
                  id="deleteOtp"
                  label="Verification Code"
                  type="text"
                  inputMode="numeric"
                  placeholder="Enter 6-digit code"
                  value={deleteOtp}
                  onChange={handleDeleteOtpChange}
                  error={deleteErrors.otp}
                  leftIcon={<Key className="h-4 w-4" />}
                  maxLength={6}
                />

                <div className="flex items-start gap-3 rounded-xl bg-red-500/10 border border-red-500/30 p-4">
                  <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-300/70">
                    By confirming, your account will be permanently deleted. This action cannot be undone.
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    type="submit"
                    variant="danger"
                    glow
                    isLoading={isDeleting}
                  >
                    Permanently Delete Account
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={resetDeleteModal}
                    disabled={isDeleting}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </div>
        </Modal>
      </motion.div>
    </div>
  );
}
