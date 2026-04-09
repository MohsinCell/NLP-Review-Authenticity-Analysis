import { useState, useEffect } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import {
  Mail,
  Send,
  ArrowLeft,
  CheckCircle,
  User,
  MessageSquare,
  Shield,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../api/client';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Textarea from '../components/ui/Textarea';
import Card from '../components/ui/Card';
import OtpInput from '../components/ui/OtpInput';

type Step = 'form' | 'otp' | 'submitting' | 'success';

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

export default function ContactPage() {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>('form');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    subject: '',
    message: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (user) {
      const nameParts = (user.fullName || '').split(' ');
      const fName = nameParts[0] || '';
      const lName = nameParts.slice(1).join(' ') || '';

      setFormData(prev => ({
        ...prev,
        firstName: fName,
        lastName: lName,
        email: user.email || ''
      }));
    }
  }, [user]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setInterval(() => {
        setResendCooldown(prev => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [resendCooldown]);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });

    if (errors[e.target.name]) {
      setErrors(prev => ({ ...prev, [e.target.name]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (!formData.subject.trim()) {
      newErrors.subject = 'Subject is required';
    }
    if (!formData.message.trim()) {
      newErrors.message = 'Message is required';
    } else if (formData.message.trim().length < 10) {
      newErrors.message = 'Message must be at least 10 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSendOtp = async () => {
    if (!validateForm()) {
      toast.error('Please fill in all required fields correctly');
      return;
    }

    setLoading(true);
    try {
      await api.post('/contact/send-otp', { email: formData.email });
      toast.success('Verification code sent to your email');
      setStep('otp');
      setResendCooldown(60);
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to send verification code';
      if (message.includes('rate limit') || message.includes('too many')) {
        toast.error('Too many attempts. Please try again later.');
      } else if (message.includes('invalid') || message.includes('email')) {
        toast.error('Invalid email address. Please check and try again.');
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    try {
      await api.post('/contact/send-otp', { email: formData.email });
      toast.success('New verification code sent');
      setResendCooldown(60);
      setOtp(['', '', '', '', '', '']);
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to send verification code';
      if (message.includes('rate limit') || message.includes('too many')) {
        toast.error('Too many attempts. Please wait before trying again.');
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndSubmit = async () => {
    const otpString = otp.join('');
    if (otpString.length !== 6) {
      toast.error('Please enter the complete 6-digit code');
      return;
    }

    setStep('submitting');
    try {

      await api.post('/contact/verify-otp', { email: formData.email, otp: otpString });

      await api.post('/contact', formData);

      setStep('success');
      toast.success('Message sent successfully!');
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Something went wrong';

      if (message.includes('invalid') || message.includes('incorrect') || message.includes('OTP')) {
        toast.error('Invalid verification code. Please check and try again.');
        setOtp(['', '', '', '', '', '']);
      } else if (message.includes('expired')) {
        toast.error('Verification code has expired. Please request a new one.');
        setOtp(['', '', '', '', '', '']);
      } else if (message.includes('rate limit') || message.includes('too many')) {
        toast.error('Too many attempts. Please try again later.');
      } else {
        toast.error('Failed to send message. Please try again.');
      }
      setStep('otp');
    }
  };

  const handleBackToForm = () => {
    setStep('form');
    setOtp(['', '', '', '', '', '']);
  };

  const handleSendAnother = () => {
    setFormData({
      firstName: user ? (user.fullName || '').split(' ')[0] || '' : '',
      lastName: user ? (user.fullName || '').split(' ').slice(1).join(' ') || '' : '',
      email: user?.email || '',
      subject: '',
      message: ''
    });
    setOtp(['', '', '', '', '', '']);
    setErrors({});
    setStep('form');
  };

  return (
    <div className="relative min-h-screen">
      <motion.div
        className="relative max-w-2xl mx-auto py-8 sm:py-12 px-4 sm:px-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >

        <motion.div variants={itemVariants} className="text-center mb-10">
          <div className="inline-flex items-center justify-center rounded-2xl bg-white/[0.05] p-4 border border-white/[0.08] mb-4">
            <MessageSquare className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white sm:text-4xl">
            Contact <span className="text-gradient">Us</span>
          </h1>
          <p className="mt-4 text-lg text-neutral-400">
            Have a question or feedback? We'd love to hear from you.
          </p>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card hover={false} glow padding="lg">
            <AnimatePresence mode="wait">

                {step === 'form' && (
                  <motion.form
                    key="form"
                    onSubmit={(e: FormEvent) => { e.preventDefault(); handleSendOtp(); }}
                    className="space-y-5"
                    {...stepTransition}
                  >
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <motion.div variants={itemVariants}>
                        <Input
                          id="firstName"
                          name="firstName"
                          label="First name"
                          type="text"
                          value={formData.firstName}
                          onChange={handleChange}
                          disabled={!!user}
                          placeholder="John"
                          leftIcon={<User className="h-4 w-4" />}
                          error={errors.firstName}
                        />
                      </motion.div>

                      <motion.div variants={itemVariants}>
                        <Input
                          id="lastName"
                          name="lastName"
                          label="Last name"
                          type="text"
                          value={formData.lastName}
                          onChange={handleChange}
                          disabled={!!user}
                          placeholder="Doe"
                          error={errors.lastName}
                        />
                      </motion.div>
                    </div>

                    <motion.div variants={itemVariants}>
                      <Input
                        id="email"
                        name="email"
                        label="Email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        disabled={!!user}
                        placeholder="john@example.com"
                        leftIcon={<Mail className="h-4 w-4" />}
                        error={errors.email}
                      />
                    </motion.div>

                    <motion.div variants={itemVariants}>
                      <Input
                        id="subject"
                        name="subject"
                        label="Subject"
                        type="text"
                        value={formData.subject}
                        onChange={handleChange}
                        placeholder="How can we help?"
                        error={errors.subject}
                      />
                    </motion.div>

                    <motion.div variants={itemVariants}>
                      <Textarea
                        id="message"
                        name="message"
                        label="Message"
                        rows={4}
                        value={formData.message}
                        onChange={handleChange}
                        placeholder="Your message here..."
                        error={errors.message}
                      />
                    </motion.div>

                    <motion.div variants={itemVariants}>
                      <Button type="submit" className="w-full" glow isLoading={loading}>
                        <Send className="h-4 w-4" />
                        <span>Send Message</span>
                      </Button>
                    </motion.div>
                  </motion.form>
                )}

                {step === 'otp' && (
                  <motion.div
                    key="otp"
                    className="space-y-6"
                    {...stepTransition}
                  >
                    <div className="text-center">
                      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-white border border-white/10">
                        <Mail className="h-7 w-7" />
                      </div>
                      <h2 className="text-xl font-bold text-white">Verify Your Email</h2>
                      <p className="mt-2 text-sm text-neutral-400">
                        Enter the 6-digit code sent to{' '}
                        <span className="font-medium text-white">{formData.email}</span>
                      </p>
                    </div>

                    <OtpInput
                      value={otp}
                      onChange={setOtp}
                      autoFocus
                      disabled={loading}
                    />

                    <Button onClick={handleVerifyAndSubmit} className="w-full" glow isLoading={loading}>
                      <CheckCircle className="h-4 w-4" />
                      <span>Verify & Send Message</span>
                    </Button>

                    <div className="text-center text-sm">
                      <p className="text-neutral-400">
                        Didn't receive the code?{' '}
                        {resendCooldown > 0 ? (
                          <span className="text-neutral-500">
                            Resend in <span className="text-white font-medium">{resendCooldown}s</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={handleResendOtp}
                            disabled={loading}
                            className="font-medium text-white hover:text-neutral-300 disabled:opacity-50 transition-colors"
                          >
                            Resend Code
                          </button>
                        )}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleBackToForm}
                      className="flex w-full items-center justify-center gap-2 text-sm text-neutral-500 hover:text-white transition-colors"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back to form
                    </button>
                  </motion.div>
                )}

                {step === 'submitting' && (
                  <motion.div
                    key="submitting"
                    className="flex flex-col items-center py-12"
                    {...stepTransition}
                  >
                    <div className="h-12 w-12 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                    <p className="mt-6 text-sm text-neutral-500">
                      Sending your message...
                    </p>
                  </motion.div>
                )}

                {step === 'success' && (
                  <motion.div
                    key="success"
                    className="flex flex-col items-center py-8 sm:py-10"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                  >
                    <motion.div
                      className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 15 }}
                    >
                      <CheckCircle className="h-8 w-8 text-emerald-400" />
                    </motion.div>
                    <motion.h2
                      className="text-xl font-bold text-white mb-2"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      Message Sent!
                    </motion.h2>
                    <motion.p
                      className="text-sm text-neutral-400 text-center max-w-sm mb-8"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      Thank you for reaching out. We have received your message and will get back to you within 24 hours.
                    </motion.p>
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                    >
                      <Button onClick={handleSendAnother} variant="outline">
                        Send Another Message
                      </Button>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-xs text-neutral-600"
        >
          <div className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            <span>Email verification required</span>
          </div>
          <div className="h-3 w-px bg-neutral-800" />
          <span>Response within 24 hours</span>
        </motion.div>
      </motion.div>
    </div>
  );
}
