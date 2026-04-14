import { motion } from 'framer-motion';
import useStore from '../../store/useStore';
import useSmoothedProgress from './useSmoothedProgress';
import ProgressRing from './ProgressRing';
import StageIndicator from './StageIndicator';
import ActivityFeed from './ActivityFeed';
import OrbitalBackground from './OrbitalBackground';

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

export default function ProcessingScreen() {
  const processingStatus = useStore((s) => s.processingStatus);
  const pipelineProgress = useStore((s) => s.pipelineProgress);
  const percent = useSmoothedProgress(pipelineProgress);
  const currentStage = pipelineProgress?.stage ?? 0;

  return (
    <div
      className="w-full flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: 'var(--color-bg-base)', minHeight: '100dvh' }}
    >
      <OrbitalBackground percent={percent} />

      <motion.div
        className="flex flex-col items-center w-full"
        style={{ gap: 'clamp(20px, 4vw, 32px)' }}
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={fadeUp}>
          <ProgressRing percent={percent} statusMessage={processingStatus} />
        </motion.div>

        <motion.div variants={fadeUp}>
          <StageIndicator currentStage={currentStage} />
        </motion.div>

        <motion.div variants={fadeUp} className="w-full flex justify-center">
          <ActivityFeed statusMessage={processingStatus} />
        </motion.div>
      </motion.div>
    </div>
  );
}
