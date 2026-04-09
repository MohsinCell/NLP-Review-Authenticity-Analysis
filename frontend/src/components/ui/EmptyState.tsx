import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface EmptyStateProps {

  icon?: ReactNode;

  title: string;

  description?: string;

  action?: ReactNode;

  size?: 'sm' | 'md' | 'lg';

  animated?: boolean;
}

const sizeStyles = {
  sm: {
    container: 'py-8',
    iconBox: 'p-3',
    iconWrapper: 'mb-4',
    title: 'text-base',
    description: 'text-xs max-w-[200px]',
    action: 'mt-4',
  },
  md: {
    container: 'py-12',
    iconBox: 'p-4',
    iconWrapper: 'mb-5',
    title: 'text-lg',
    description: 'text-sm max-w-xs',
    action: 'mt-5',
  },
  lg: {
    container: 'py-16',
    iconBox: 'p-5',
    iconWrapper: 'mb-6',
    title: 'text-xl',
    description: 'text-sm max-w-sm',
    action: 'mt-6',
  },
};

const containerVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

const iconVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.3, delay: 0.1 },
  },
};

const textVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.3, delay: 0.2 },
  },
};

export default function EmptyState({
  icon,
  title,
  description,
  action,
  size = 'md',
  animated = true,
}: EmptyStateProps) {
  const styles = sizeStyles[size];

  const Wrapper = animated ? motion.div : 'div';
  const IconWrapper = animated ? motion.div : 'div';
  const TextWrapper = animated ? motion.div : 'div';

  return (
    <Wrapper
      className={`flex flex-col items-center justify-center ${styles.container} text-center`}
      {...(animated && {
        variants: containerVariants,
        initial: 'hidden',
        animate: 'visible',
      })}
      role="status"
      aria-label={title}
    >
      <div className="rounded-2xl p-6 max-w-sm">
        {icon && (
          <IconWrapper
            className={`${styles.iconWrapper} text-white/40 flex justify-center`}
            {...(animated && { variants: iconVariants })}
          >
            <div
              className={`${styles.iconBox} rounded-2xl bg-white/[0.03] border border-white/[0.08]`}
              aria-hidden="true"
            >
              {icon}
            </div>
          </IconWrapper>
        )}

        <TextWrapper {...(animated && { variants: textVariants })}>
          <h3 className={`${styles.title} font-semibold text-white`}>{title}</h3>

          {description && (
            <p
              className={`mt-2 ${styles.description} text-white/50 leading-relaxed mx-auto`}
            >
              {description}
            </p>
          )}
        </TextWrapper>

        {action && (
          <div className={styles.action}>{action}</div>
        )}
      </div>
    </Wrapper>
  );
}
