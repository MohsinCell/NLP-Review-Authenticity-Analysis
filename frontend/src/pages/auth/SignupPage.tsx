import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, ArrowLeft, Check, User, Lock, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../api/auth';
import { useApiError } from '../../hooks/useApiError';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card from '../../components/ui/Card';
import OtpInput from '../../components/ui/OtpInput';
import SvgCaptcha from '../../components/SvgCaptcha';

type Step = 'details' | 'otp' | 'creating';

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

const stepTransition = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: { duration: 0.25 },
};

export default function SignupPage() {
  const [step, setStep] = useState<Step>('details');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [captchaToken, setCaptchaToken] = useState('');

  const [otp, setOtp] = useState(['', '', '', '', '', '']);

  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const { signup } = useAuth();
  const navigate = useNavigate();
  const { getErrorMessage } = useApiError();

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const validateDetails = () => {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.fullName = 'Full name is required';
    if (!email) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Invalid email address';
    if (!password) errs.password = 'Password is required';
    else if (password.length < 8) errs.password = 'Min. 8 characters';
    else if (!/[A-Z]/.test(password)) errs.password = 'Need an uppercase letter';
    else if (!/[0-9]/.test(password)) errs.password = 'Need a number';
    if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match';
    if (!captchaToken) errs.captcha = 'Please complete the verification';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSendOtp = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateDetails()) return;

    setIsSendingOtp(true);
    try {
      await authApi.sendOtp({ email, captchaToken });
      toast.success('Verification code sent');
      setStep('otp');
      setResendCooldown(60);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setIsSendingOtp(true);
    try {
      await authApi.sendOtp({ email });
      toast.success('New code sent');
      setResendCooldown(60);
      setOtp(['', '', '', '', '', '']);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyAndSignup = async (e: FormEvent) => {
    e.preventDefault();
    const otpString = otp.join('');
    if (otpString.length !== 6) {
      toast.error('Enter the complete 6-digit code');
      return;
    }

    setIsVerifying(true);
    try {
      await authApi.verifyOtp({ email, otp: otpString });
      toast.success('Email verified!');
    } catch (error) {
      toast.error(getErrorMessage(error));
      setIsVerifying(false);
      return;
    }
    setIsVerifying(false);

    setStep('creating');
    try {
      await signup({ fullName, email, password });
      toast.success('Account created!');
      navigate('/');
    } catch (error) {
      toast.error(getErrorMessage(error));
      setStep('otp');
    }
  };

  const steps = ['details', 'otp', 'creating'] as const;
  const currentStepIndex = steps.indexOf(step);

  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center px-4 sm:px-6">
      <motion.div
        className="w-full max-w-md"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <Card hover={false} glow padding="lg" className="overflow-hidden">

          <motion.div className="mb-6 text-center" variants={itemVariants}>
            <img src="/R.png" alt="ReviewIQ" className="mx-auto h-16 w-16 mb-4 object-contain" />
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <h1 className="text-2xl font-bold text-white">
                  {step === 'details' && 'Create account'}
                  {step === 'otp' && 'Verify email'}
                  {step === 'creating' && 'Almost there...'}
                </h1>
                <p className="mt-2 text-sm text-neutral-500">
                  {step === 'details' && 'Join ReviewIQ to save your analysis history'}
                  {step === 'otp' && (
                    <>Code sent to <span className="text-neutral-300">{email}</span></>
                  )}
                  {step === 'creating' && 'Setting up your account'}
                </p>
              </motion.div>
            </AnimatePresence>
          </motion.div>

          <motion.div variants={itemVariants} className="mb-8 flex items-center justify-center gap-2">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors duration-200 ${
                    step === s
                      ? 'bg-white text-black'
                      : currentStepIndex > i
                        ? 'bg-white/20 text-white border border-white/20'
                        : 'bg-white/5 text-neutral-600 border border-white/10'
                  }`}
                >
                  {currentStepIndex > i ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                {i < 2 && (
                  <div
                    className={`h-px w-8 transition-colors duration-200 ${
                      currentStepIndex > i ? 'bg-white/30' : 'bg-white/10'
                    }`}
                  />
                )}
              </div>
            ))}
          </motion.div>

          <AnimatePresence mode="wait">

            {step === 'details' && (
              <motion.form
                key="details"
                onSubmit={handleSendOtp}
                className="space-y-4"
                {...stepTransition}
              >
                <motion.div variants={itemVariants}>
                  <Input
                    id="fullName"
                    label="Full Name"
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    error={errors.fullName}
                    leftIcon={<User className="h-4 w-4" />}
                  />
                </motion.div>

                <motion.div variants={itemVariants}>
                  <Input
                    id="email"
                    label="Email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    error={errors.email}
                    leftIcon={<Mail className="h-4 w-4" />}
                  />
                </motion.div>

                <motion.div variants={itemVariants}>
                  <Input
                    id="password"
                    label="Password"
                    type="password"
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    error={errors.password}
                    leftIcon={<Lock className="h-4 w-4" />}
                  />
                </motion.div>

                <motion.div variants={itemVariants}>
                  <Input
                    id="confirmPassword"
                    label="Confirm Password"
                    type="password"
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    error={errors.confirmPassword}
                    leftIcon={<Lock className="h-4 w-4" />}
                  />
                </motion.div>

                <motion.div variants={itemVariants} className="pt-1">
                  <label className="block text-sm font-medium text-white/60 mb-2">Verification</label>
                  <SvgCaptcha
                    onVerify={(token) => setCaptchaToken(token)}
                    onExpire={() => setCaptchaToken('')}
                  />
                </motion.div>
                {errors.captcha && (
                  <p className="text-xs text-red-400 text-center animate-fade-in">
                    {errors.captcha}
                  </p>
                )}

                <motion.div variants={itemVariants}>
                  <Button type="submit" className="w-full" glow isLoading={isSendingOtp}>
                    <span>Continue</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </motion.div>

                <motion.div variants={itemVariants}>
                  <Button type="button" variant="outline" className="w-full" onClick={() => navigate('/')}>
                    <span>Continue as Guest</span>
                  </Button>
                </motion.div>
              </motion.form>
            )}

            {step === 'otp' && (
              <motion.form
                key="otp"
                onSubmit={handleVerifyAndSignup}
                className="space-y-6"
                {...stepTransition}
              >
                <OtpInput
                  value={otp}
                  onChange={setOtp}
                  autoFocus
                  disabled={isVerifying}
                />

                <Button
                  type="submit"
                  className="w-full"
                  glow
                  isLoading={isVerifying}
                  disabled={otp.join('').length !== 6}
                >
                  <span>Verify & Create Account</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>

                <div className="text-center text-sm">
                  <p className="text-neutral-500">
                    Didn't receive code?{' '}
                    {resendCooldown > 0 ? (
                      <span className="text-neutral-600">
                        Resend in <span className="text-white font-medium">{resendCooldown}s</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={isSendingOtp}
                        className="font-medium text-white hover:text-neutral-300 disabled:opacity-50 transition-colors"
                      >
                        Resend
                      </button>
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setStep('details');
                    setOtp(['', '', '', '', '', '']);
                  }}
                  className="flex w-full items-center justify-center gap-2 text-sm text-neutral-500 hover:text-white transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to details
                </button>
              </motion.form>
            )}

            {step === 'creating' && (
              <motion.div
                key="creating"
                className="flex flex-col items-center py-12"
                {...stepTransition}
              >
                <div className="h-12 w-12 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                <p className="mt-6 text-sm text-neutral-500">
                  Creating your account...
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div variants={itemVariants} className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-neutral-900 px-3 text-xs text-neutral-500 z-10">or</span>
              </div>
            </div>

            <p className="mt-6 text-center text-sm text-neutral-500">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-semibold text-white underline decoration-white/40 underline-offset-4 hover:text-white hover:decoration-white transition-all duration-200"
              >
                Sign in
              </Link>
            </p>
          </motion.div>
        </Card>
      </motion.div>
    </div>
  );
}
