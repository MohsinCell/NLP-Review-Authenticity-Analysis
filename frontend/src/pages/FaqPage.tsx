import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, ChevronDown } from 'lucide-react';

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

const faqs = [
  {
    question: 'What is ReviewIQ?',
    answer:
      'ReviewIQ is an NLP-powered platform that analyzes product reviews for authenticity, sentiment, and AI-generated content. It uses three specialized transformer models (BERT and RoBERTa) to provide detailed insights into the trustworthiness of online reviews.',
  },
  {
    question: 'How does ReviewIQ detect fake or AI-generated reviews?',
    answer:
      'ReviewIQ uses a RoBERTa-based classifier fine-tuned on real vs AI-generated text datasets. It analyzes linguistic patterns, writing style, and statistical markers to calculate the probability that a review was written by an AI model rather than a human. The system also performs a product-level trust report that cross-references multiple signals like review bursts, rating-sentiment mismatches, duplicate content, and phrase repetition.',
  },
  {
    question: 'Which e-commerce platforms are supported?',
    answer:
      'ReviewIQ currently supports Amazon (all major regions including US, India, UK, Canada, Germany, France, Italy, Spain, Australia, and Japan), Flipkart, Myntra, Ajio, and Nykaa. We plan to expand support to additional platforms in the future.',
  },
  {
    question: 'What machine learning models does ReviewIQ use?',
    answer:
      'ReviewIQ uses three transformer-based models: (1) A custom BERT classifier with batch normalization layers for binary sentiment analysis (positive/negative), (2) A RoBERTa-based sequence classifier for AI-generated content detection, and (3) A fine-tuned BERT model for 5-class star rating prediction (1-5 stars). All models run server-side using PyTorch.',
  },
  {
    question: 'How accurate is the analysis?',
    answer:
      'The accuracy depends on the model and the quality of the input text. Our sentiment analysis model achieves strong performance on standard benchmarks, and the AI detection model is fine-tuned on the OpenAI GPT-2 output dataset. Rating prediction uses a 5-class BERT classifier. For best results, reviews should be at least a few sentences long. Very short reviews (a few words) may yield lower confidence scores.',
  },
  {
    question: 'What languages are supported?',
    answer:
      'ReviewIQ supports over 50 languages through automatic language detection and translation. Non-English reviews are detected and translated to English using LibreTranslate before being processed by the ML models. This ensures consistent analysis quality regardless of the original review language.',
  },
  {
    question: 'Is ReviewIQ free to use?',
    answer:
      'Yes, ReviewIQ is free to use. You can analyze individual reviews without an account. Creating a free account unlocks additional features like analysis history, the Chrome extension, and product-level trust reports.',
  },
  {
    question: 'What is the Chrome extension?',
    answer:
      'The ReviewIQ Chrome extension lets you analyze product reviews directly from product pages on supported e-commerce sites without leaving the page. It detects when you are on a supported product page, scrapes reviews, runs full NLP analysis, and displays results in a popup. A detailed full-page report is also available. The Chrome extension requires a free ReviewIQ account.',
  },
  {
    question: 'How does the product trust report work?',
    answer:
      'The product trust report analyzes all scraped reviews as a collective dataset. It checks for six manipulation signals: review burst patterns (many reviews in a short time), abnormal rating distributions, mismatches between star ratings and sentiment, duplicate or near-duplicate content, suspiciously uniform review lengths, and repeated phrases across reviews. Each signal is scored individually, and an overall trust score (0-100) is calculated.',
  },
  {
    question: 'Is my data stored or shared?',
    answer:
      'ReviewIQ stores your analysis history only if you have an account, so you can revisit past results. We do not sell, share, or distribute your data to third parties. Review text is processed server-side for analysis and is not used for model training. You can view our Privacy Policy for full details.',
  },
  {
    question: 'What is the maximum number of reviews that can be analyzed?',
    answer:
      'You can analyze up to 50 reviews per product in a single analysis session. The default is 20 reviews, which provides a good balance between analysis depth and processing time. Scraping and analyzing reviews is done sequentially to ensure accuracy.',
  },
  {
    question: 'How do I contact support?',
    answer:
      'You can reach us through the Contact page on the website. Fill in the contact form with your query and we will get back to you. For urgent issues, include as much detail as possible about the problem you are experiencing.',
  },
];

function FaqItem({ question, answer, isOpen, onToggle }: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border border-white/[0.06] rounded-2xl bg-white/[0.02] overflow-hidden transition-colors duration-200 hover:border-white/[0.1]">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full px-6 py-5 text-left gap-4"
      >
        <span className="text-sm sm:text-base font-medium text-white">{question}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0"
        >
          <ChevronDown className="h-4 w-4 text-white/40" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div className="px-6 pb-5 text-sm text-white/50 leading-relaxed">
              {answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FaqPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

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
            <HelpCircle className="h-12 w-12 text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white">
            Frequently Asked <span className="text-gradient">Questions</span>
          </h1>
          <p className="text-base sm:text-lg text-neutral-400 leading-relaxed">
            Everything you need to know about ReviewIQ and how it works.
          </p>
        </motion.div>

        <motion.div variants={containerVariants} className="space-y-3">
          {faqs.map((faq, i) => (
            <motion.div key={i} variants={itemVariants}>
              <FaqItem
                question={faq.question}
                answer={faq.answer}
                isOpen={openIndex === i}
                onToggle={() => setOpenIndex(openIndex === i ? null : i)}
              />
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
