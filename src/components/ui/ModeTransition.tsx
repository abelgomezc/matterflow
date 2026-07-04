// MatterFlow - fundido entre modos de materia (Framer Motion). (c) 2026 Abel Gomez
// Al cambiar de materia hace un breve fade-out/fade-in (0.4s ease-in-out)
// sobre el canvas, acompanando el swap del sistema activo.
import { AnimatePresence, motion } from 'framer-motion'
import { useMatterStore } from '../../store/matterStore'

export default function ModeTransition() {
  const matterMode = useMatterStore((s) => s.matterMode)

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={matterMode}
        className="pointer-events-none absolute inset-0 z-20 bg-mf-bg"
        initial={{ opacity: 0.85 }}
        animate={{ opacity: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4, ease: 'easeInOut' }}
      />
    </AnimatePresence>
  )
}