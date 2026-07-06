// MatterFlow - selector de materia (barra inferior glassmorphism). (c) 2026 Abel Gomez
import { motion } from 'framer-motion'
import { useMatterStore } from '../../store/matterStore'
import type { MatterMode } from '../../types/matter.types'

const MODES: { id: MatterMode; label: string; icon: string; color: string }[] = [
  { id: 'force', label: 'Fuerza', icon: '💥', color: '#7DD3FC' },
  { id: 'rays', label: 'Rayos', icon: '⚡', color: '#1E6BFF' },
  { id: 'particles', label: 'Particulas', icon: '✨', color: '#6C63FF' },
  { id: 'plasma', label: 'Plasma', icon: '🌀', color: '#C084FC' },
  { id: 'create', label: 'Crear', icon: '+', color: '#34D399' },
]

export default function ModeSelector() {
  const matterMode = useMatterStore((s) => s.matterMode)
  const setMatterMode = useMatterStore((s) => s.setMatterMode)

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-16 z-30 flex justify-center px-4">
      <div className="mf-glass pointer-events-auto flex items-center gap-1 rounded-2xl p-1.5 shadow-glow sm:gap-2 sm:p-2">
        {MODES.map((m) => {
          const active = m.id === matterMode
          return (
            <button
              key={m.id}
              onClick={() => setMatterMode(m.id)}
              className="relative rounded-xl px-3 py-2 text-xs font-medium transition-colors sm:px-4 sm:text-sm"
              style={{ color: active ? '#fff' : 'rgba(255,255,255,0.6)' }}
            >
              {active && (
                <motion.span
                  layoutId="mode-pill"
                  className="absolute inset-0 rounded-xl"
                  style={{
                    background: `linear-gradient(135deg, ${m.color}55, ${m.color}22)`,
                    border: `1px solid ${m.color}88`,
                  }}
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative flex items-center gap-1.5 whitespace-nowrap">
                <span aria-hidden>{m.icon}</span>
                <span className="hidden sm:inline">{m.label}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
