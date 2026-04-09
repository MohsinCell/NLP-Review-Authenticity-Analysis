import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

const sections = [
  {
    title: '1. Information We Collect',
    content: [
      'Account Information: When you create a ReviewIQ account, we collect your full name, email address, and a hashed version of your password. Passwords are encrypted using BCrypt and are never stored in plain text.',
      'Analysis Data: When you analyze reviews, the review text is sent to our servers for processing by our machine learning models. If you are signed in, analysis results (sentiment, ratings, AI detection scores) are stored in your account history so you can revisit them.',
      'Usage Data: We collect basic usage information such as pages visited, features used, and timestamps to improve the platform. We do not use third-party analytics or tracking services.',
      'Contact Information: If you reach out through our contact form, we store your name, email, and message to respond to your inquiry.',
    ],
  },
  {
    title: '2. How We Use Your Information',
    content: [
      'To provide and operate the ReviewIQ platform, including review analysis, sentiment detection, AI content detection, and rating prediction.',
      'To maintain your analysis history so you can access past results from your account dashboard.',
      'To authenticate your account and manage sessions securely using JWT (JSON Web Tokens) with automatic token refresh.',
      'To respond to support requests submitted through the contact form.',
      'To improve our services and fix issues based on aggregated usage patterns.',
    ],
  },
  {
    title: '3. Machine Learning Processing',
    content: [
      'Review text submitted for analysis is processed server-side by our NLP models (BERT and RoBERTa architectures) running on our infrastructure. The text is tokenized, analyzed, and results are returned to your browser.',
      'Non-English reviews are automatically detected and translated to English for analysis. The translation is performed server-side and is not stored separately.',
      'Review text is not used to train or fine-tune our machine learning models. Our models are pre-trained and fine-tuned on established public datasets before deployment.',
    ],
  },
  {
    title: '4. Web Scraping',
    content: [
      'When you use the product analysis feature, ReviewIQ scrapes publicly available review data from the product page URL you provide. This includes review text, ratings, dates, and product metadata (name, price, brand, platform rating).',
      'Scraping is performed server-side on your behalf. We do not scrape data proactively or without your initiation. Each scraping job is triggered by an explicit user request.',
      'Scraped review data is used solely for the analysis you requested. Product metadata is displayed to help you identify the product being analyzed.',
    ],
  },
  {
    title: '5. Chrome Extension',
    content: [
      'The ReviewIQ Chrome extension communicates with our servers at reviewiq.website to perform analysis. It does not collect browsing history, track your activity across websites, or access any data beyond the product page you explicitly choose to analyze.',
      'The extension uses the activeTab and storage permissions. activeTab allows it to detect supported product pages on the current tab only. Storage is used to save analysis results locally in your browser for the full report view.',
      'The extension does not inject ads, modify page content beyond the detection notification, or communicate with any third-party servers.',
    ],
  },
  {
    title: '6. Data Storage and Retention',
    content: [
      'Account data is stored in a PostgreSQL database on our server. Passwords are hashed with BCrypt.',
      'JWT access tokens expire after a short period and are refreshed automatically. Refresh tokens are stored securely and can be revoked on logout.',
      'Analysis history is retained as long as your account is active. You can request deletion of your account and associated data by contacting us.',
      'Contact form submissions are stored until the inquiry is resolved.',
    ],
  },
  {
    title: '7. Data Sharing',
    content: [
      'We do not sell, rent, or share your personal information with third parties for marketing or advertising purposes.',
      'We do not use third-party analytics, advertising networks, or social media tracking pixels.',
      'Your data may only be disclosed if required by law or to protect the security of the platform.',
    ],
  },
  {
    title: '8. Cookies',
    content: [
      'ReviewIQ uses essential cookies and localStorage for authentication (storing JWT tokens and session state). These are strictly necessary for the platform to function.',
      'We do not use advertising cookies, tracking cookies, or third-party cookies of any kind.',
    ],
  },
  {
    title: '9. Security',
    content: [
      'All communication between your browser and ReviewIQ is encrypted using HTTPS/TLS.',
      'Passwords are hashed using BCrypt before storage.',
      'API endpoints are protected with JWT authentication where required.',
      'The server is configured with security headers and CORS policies to prevent unauthorized access.',
    ],
  },
  {
    title: '10. Changes to This Policy',
    content: [
      'We may update this privacy policy from time to time to reflect changes in our practices. Any changes will be posted on this page with an updated effective date.',
    ],
  },
  {
    title: '11. Contact',
    content: [
      'If you have questions about this privacy policy or want to request deletion of your data, please reach out through the Contact page on our website.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="relative min-h-screen">
      <motion.div
        className="relative mx-auto max-w-3xl space-y-10 sm:space-y-12 py-8 sm:py-12 px-4 lg:px-0"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants} className="text-center space-y-6 max-w-2xl mx-auto">
          <div className="inline-flex items-center justify-center rounded-2xl bg-white/[0.05] p-5 border border-white/[0.08]">
            <Shield className="h-12 w-12 text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white">
            Privacy <span className="text-gradient">Policy</span>
          </h1>
          <p className="text-base sm:text-lg text-neutral-400 leading-relaxed">
            How ReviewIQ handles your data. Last updated April 2026.
          </p>
        </motion.div>

        <motion.div variants={containerVariants} className="space-y-6">
          {sections.map((section) => (
            <motion.div
              key={section.title}
              variants={itemVariants}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 sm:p-8"
            >
              <h2 className="text-lg sm:text-xl font-semibold text-white mb-4">{section.title}</h2>
              <ul className="space-y-3">
                {section.content.map((item, i) => (
                  <li key={i} className="text-sm text-white/50 leading-relaxed pl-4 relative before:content-[''] before:absolute before:left-0 before:top-[9px] before:w-1.5 before:h-1.5 before:rounded-full before:bg-white/20">
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
