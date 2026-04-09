import 'framer-motion';

declare module 'framer-motion' {
  interface TransitionDefinition {
    ease?: number[] | string;
  }
}
