import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useApiError } from '../../hooks/useApiError';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card from '../../components/ui/Card';
import SvgCaptcha from '../../components/SvgCaptcha';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
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

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaKey, setCaptchaKey] = useState(0);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { getErrorMessage } = useApiError();

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!email) errs.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Invalid email address';
    if (!password) errs.password = 'Password is required';
    else if (password.length < 6) errs.password = 'Password must be at least 6 characters';
    if (!captchaToken) errs.captcha = 'Please complete the verification';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const resetCaptcha = () => {
    setCaptchaToken('');
    setCaptchaKey(prev => prev + 1);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);
    try {
      await login({ email, password, captchaToken });
      toast.success('Welcome back!');
      navigate('/');
    } catch (error: unknown) {
      const message = getErrorMessage(error);
      const lowerMessage = message.toLowerCase();

      resetCaptcha();

      if (lowerMessage.includes('captcha')) {
        toast.error(message);
      }

      else if (lowerMessage.includes('locked')) {
        setFailedAttempts(0);
        toast.error('Account is temporarily locked. Please try again later.');
      }

      else if (lowerMessage.includes('attempts remaining') || lowerMessage.includes('attempt remaining')) {
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);
        toast.error(message);
      }

      else if (lowerMessage.includes('invalid') && (lowerMessage.includes('email') || lowerMessage.includes('password') || lowerMessage.includes('credentials'))) {
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);

        toast.error('No account found with these credentials. Please check your email and password, or sign up for a new account.');
      }

      else if (lowerMessage.includes('network') || lowerMessage.includes('timeout') || lowerMessage.includes('connection')) {
        toast.error('Unable to connect to the server. Please check your internet connection and try again.');
      }

      else {
        toast.error(message || 'An unexpected error occurred. Please try again later.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center px-4 sm:px-6">
      <motion.div
        className="w-full max-w-md"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <Card hover={false} glow padding="lg" className="overflow-hidden">

          <motion.div className="mb-8 text-center" variants={itemVariants}>
            <img src="/R.png" alt="ReviewIQ" className="mx-auto h-16 w-16 mb-4 object-contain" />
            <h1 className="text-2xl font-bold text-white">Welcome back</h1>
            <p className="mt-2 text-sm text-neutral-500">
              Sign in to continue to ReviewIQ
            </p>
          </motion.div>

          <form onSubmit={handleSubmit} className="space-y-5">
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
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                leftIcon={<Lock className="h-4 w-4" />}
              />
            </motion.div>

            <motion.div variants={itemVariants}>
              <label className="block text-sm font-medium text-white/60 mb-2">Verification</label>
              <SvgCaptcha
                key={captchaKey}
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
              <Button type="submit" className="w-full" glow isLoading={isLoading}>
                <span>Sign In</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Button type="button" variant="outline" className="w-full" onClick={() => navigate('/')}>
                <span>Continue as Guest</span>
              </Button>
            </motion.div>
          </form>

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
              Don't have an account?{' '}
              <Link
                to="/signup"
                className="font-semibold text-white underline decoration-white/40 underline-offset-4 hover:text-white hover:decoration-white transition-all duration-200"
              >
                Sign up
              </Link>
            </p>
          </motion.div>
        </Card>
      </motion.div>
    </div>
  );
}
