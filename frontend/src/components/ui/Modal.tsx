import { type ReactNode, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';

  ariaLabelledBy?: string;

  ariaDescribedBy?: string;

  disableAutoFocus?: boolean;
}

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 }
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring' as const, damping: 25, stiffness: 300 }
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 10,
    transition: { duration: 0.15 }
  }
};

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl'
};

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const elements = container.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  return Array.from(elements).filter(
    (el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden')
  );
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  ariaLabelledBy,
  ariaDescribedBy,
  disableAutoFocus = false
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const hasInitialFocused = useRef(false);
  const titleId = title ? 'modal-title' : ariaLabelledBy;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }

      if (event.key === 'Tab' && modalRef.current) {
        const focusableElements = getFocusableElements(modalRef.current);
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        const isWithinModal = modalRef.current.contains(document.activeElement);

        if (!isWithinModal) {

          event.preventDefault();
          firstElement.focus();
          return;
        }

        if (event.shiftKey) {

          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {

          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {

      if (!hasInitialFocused.current) {
        previousActiveElement.current = document.activeElement as HTMLElement;
      }

      document.addEventListener('keydown', handleKeyDown);

      document.body.style.overflow = 'hidden';

      if (!disableAutoFocus && !hasInitialFocused.current) {

        const timeoutId = setTimeout(() => {
          if (modalRef.current) {
            const focusableElements = getFocusableElements(modalRef.current);
            if (focusableElements.length > 0) {
              focusableElements[0].focus();
            } else {
              modalRef.current.focus();
            }
          }
          hasInitialFocused.current = true;
        }, 50);

        return () => {
          clearTimeout(timeoutId);
          document.removeEventListener('keydown', handleKeyDown);
          document.body.style.overflow = '';
        };
      }

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
      };
    } else {

      hasInitialFocused.current = false;

      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    }
  }, [isOpen, handleKeyDown, disableAutoFocus]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 landscape:p-2"
            role="presentation"
          >
            <motion.div
              className="fixed inset-0 bg-black/80 backdrop-blur-md"
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={onClose}
              aria-hidden="true"
            />

            <motion.div
              ref={modalRef}
              className={`relative z-10 w-full ${sizeClasses[size]} overflow-hidden`}
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              aria-describedby={ariaDescribedBy}
              tabIndex={-1}
            >
              <div className="rounded-2xl border border-white/[0.12] bg-neutral-900/95 backdrop-blur-xl p-3 sm:p-6 max-h-[calc(100dvh-2rem)] landscape:max-h-[calc(100dvh-1rem)] landscape:p-3 overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  {title && (
                    <h2
                      id="modal-title"
                      className="text-lg font-semibold text-white"
                    >
                      {title}
                    </h2>
                  )}
                  <button
                    onClick={onClose}
                    className="rounded-lg p-2.5 text-neutral-400 hover:text-white hover:bg-white/10 transition-colors duration-200 focus-ring ml-auto"
                    aria-label="Close modal"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>

                <div>{children}</div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
