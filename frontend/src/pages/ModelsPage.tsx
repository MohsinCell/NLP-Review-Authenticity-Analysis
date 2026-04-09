import { motion } from 'framer-motion';
import {
  BrainCircuit,
  Languages,
  ShieldCheck,
  Star,
  Cpu,
  Zap,
  Layers,
  Globe,
} from 'lucide-react';
import Card from '../components/ui/Card';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
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

const models = [
  {
    icon: ShieldCheck,
    title: 'AI Content Detection',
    subtitle: 'RoBERTa Sequence Classification',
    description: `Built on the roberta-base-openai-detector model, this classifier identifies AI-generated text
      by analyzing linguistic patterns. The model uses 12 transformer layers with 768 hidden dimensions
      and 12 attention heads. It outputs a binary classification (AI Generated / Human Written) with
      a confidence score based on softmax probabilities.`,
    highlight: 'AI Generated / Human Written',
    tags: ['RoBERTa-base', '125M Parameters', 'Binary Classification'],
  },
  {
    icon: BrainCircuit,
    title: 'Sentiment Analysis',
    subtitle: 'Custom BERT Classifier',
    description: `A BERT-base-uncased model with a custom classification head featuring two hidden layers
      (512 and 256 units) with batch normalization and dropout. The model processes text through the
      768-dimensional CLS token output and classifies reviews as Positive or Negative
      with associated confidence scores.`,
    highlight: 'Positive or Negative',
    tags: ['BERT-base', 'Custom Head', 'Binary Classification'],
  },
  {
    icon: Star,
    title: 'Rating Prediction',
    subtitle: 'BERT Sequence Classification',
    description: `A fine-tuned BertForSequenceClassification model trained for 5-class rating prediction.
      The model uses 6 transformer layers with 384 hidden dimensions and 12 attention heads.
      It predicts star ratings from 1 to 5 based on review content,
      mapping class indices directly to corresponding star values.`,
    highlight: '1 to 5',
    tags: ['BERT-small', '6 Layers', '5-Class Classification'],
  },
  {
    icon: Languages,
    title: 'Language Detection',
    subtitle: 'Statistical Analysis',
    description: `Before processing through transformer models, input text undergoes automatic language
      detection. Non-English reviews are translated using LibreTranslate integration, supporting
      over 50 languages. This preprocessing step ensures consistent model performance
      regardless of the original review language.`,
    highlight: '50 languages',
    tags: ['LibreTranslate', 'Auto-Detection', 'Preprocessing'],
  },
];

export default function ModelsPage() {
  return (
    <div className="relative min-h-screen">
      <motion.div
        className="relative mx-auto max-w-5xl space-y-10 sm:space-y-12 py-8 sm:py-12 px-4 lg:px-0"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >

        <motion.div variants={itemVariants} className="text-center space-y-6 max-w-2xl mx-auto">
          <div className="inline-flex items-center justify-center rounded-2xl bg-white/[0.05] p-5 border border-white/[0.08]">
            <BrainCircuit className="h-12 w-12 text-white" />
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white">
            Our <span className="text-gradient">AI Models</span>
          </h1>
          <p className="text-base sm:text-lg text-neutral-400 leading-relaxed">
            ReviewIQ uses three specialized transformer models for review analysis.
            Each model is optimized for its specific task and runs inference on the server.
          </p>
        </motion.div>

        <motion.div
          className="grid gap-4 sm:gap-6 md:grid-cols-2"
          variants={containerVariants}
        >
          {models.map((model) => (
            <motion.div key={model.title} variants={itemVariants}>
              <Card glow className="h-full">
                <div className="relative z-10">

                  <div className="flex items-start gap-4 mb-4">
                    <div className="rounded-xl bg-white/5 p-3 text-white ring-1 ring-white/10 shrink-0">
                      <model.icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold text-white">
                        {model.title}
                      </h3>
                      <p className="text-sm font-medium text-neutral-500 mt-1">
                        {model.subtitle}
                      </p>
                    </div>
                  </div>

                  <p className="text-sm sm:text-base text-neutral-400 leading-relaxed">
                    {model.description.split(model.highlight).map((part, i, arr) => (
                      <span key={i}>
                        {part}
                        {i < arr.length - 1 && (
                          <strong className="text-white font-medium">{model.highlight}</strong>
                        )}
                      </span>
                    ))}
                  </p>

                  <div className="mt-6 flex flex-wrap gap-2">
                    {model.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-full bg-white/5 px-3 py-1.5 text-xs font-medium text-neutral-300 border border-white/10"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card glow>
            <div className="flex flex-col md:flex-row items-center gap-6 sm:gap-8">
              <div className="p-5 bg-white/5 rounded-2xl border border-white/10 shrink-0">
                <Cpu className="w-12 sm:w-14 h-12 sm:h-14 text-white" />
              </div>
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-3 flex items-center gap-2">
                  Model Inference Pipeline
                  <Zap className="h-5 w-5 text-amber-400" />
                </h3>
                <p className="text-sm sm:text-base text-neutral-400 leading-relaxed max-w-3xl">
                  The ML service runs as a Flask microservice loading PyTorch models on startup. Reviews are tokenized
                  with model-specific tokenizers (BERT/RoBERTa), processed through transformer layers, and return
                  predictions with confidence scores. Batch analysis processes multiple reviews sequentially with
                  automatic language translation for non-English content.
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-4">
                  {[
                    { icon: Layers, label: 'Sequential Processing' },
                    { icon: Zap, label: 'PyTorch Runtime' },
                    { icon: Globe, label: 'REST API' },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center gap-2 text-sm text-neutral-500"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
