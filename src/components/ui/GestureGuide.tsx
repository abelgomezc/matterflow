// MatterFlow - guia de gestos (panel colapsable). (c) 2026 Abel Gomez
import { AnimatePresence, motion } from 'framer-motion'
import { useMatterStore } from '../../store/matterStore'

const GESTURES: { icon: string; name: string; action: string }[] = [
  { icon: '🖐️', name: 'Palma abierta', action: 'Atraer' },
  { icon: '✊', name: 'Puno cerrado', action: 'Repeler' },
  { icon: '☝️', name: 'Un dedo', action: 'Crear' },
  { icon: '🤏', name: 'Pinza', action: 'Congelar' },
  { icon: '🔄', name: 'Giro de muneca', action: 'Vortex' },
]

export default function GestureGuide() {
  const showGuide = useMatterStore((s) => s.showGuide)
  const toggleGuide = useMatterStore((s) => s.toggleGuide)

  return (
    <div className="pointer-events-none absolute right-4 top-28 z-30 flex flex-col items-end">
      <button
        onClick={toggleGuide}
        className="mf-glass pointer-events-auto mb-2 rounded-lg px-3 py-1.5 text-xs text-white/80 transition-colors hover:text-white"
      >
        {showGuide ? 'Ocultar guia ✕' : 'Guia de gestos ?'}
      </button>

      <AnimatePresence>
        {showGuide && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.25 }}
            className="mf-glass pointer-events-auto w-56 rounded-xl p-3"
          >
            <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/50">
              Gestos
            </div>
            <ul className="flex flex-col gap-2">
              {GESTURES.map((g) => (
                <li key={g.name} className="flex items-center gap-2 text-xs">
                  <span aria-hidden className="text-base">
                    {g.icon}
                  </span>
                  <span className="text-white/70">{g.name}</span>
                  <span className="ml-auto font-medium text-mf-cyan">{g.action}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 border-t border-white/10 pt-2 text-[10px] leading-relaxed text-white/40">
              Sin manos, el mouse/touch controla la materia (mover = atraer,
              mantener presionado = repeler).
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}