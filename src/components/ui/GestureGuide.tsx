// MatterFlow - guia de gestos por modo (con nombres). (c) 2026 Abel Gomez
import { AnimatePresence, motion } from 'framer-motion'
import { useMatterStore } from '../../store/matterStore'
import type { MatterMode } from '../../types/matter.types'

interface GestureItem {
  icon: string
  name: string
  action: string
}

// Gestos configurados por modo, con sus nombres.
const COMMON: GestureItem[] = [
  { icon: '🖐️', name: 'Palma abierta', action: 'Atraer' },
  { icon: '✊', name: 'Puno cerrado', action: 'Repeler' },
  { icon: '☝️', name: 'Un dedo', action: 'Crear' },
  { icon: '🤏', name: 'Pinza', action: 'Congelar' },
  { icon: '🔄', name: 'Giro de muneca', action: 'Vortex' },
]

const AMEN: GestureItem = { icon: '🙏', name: 'Dos manos juntas', action: 'Sorpresa' }

const BY_MODE: Record<MatterMode, GestureItem[]> = {
  particles: [...COMMON, AMEN],
  dust: [
    { icon: 'P', name: 'Palma abierta', action: 'Esfera de polvo en la palma' },
    { icon: 'C', name: 'Cerrar la mano', action: 'Deshacer la esfera' },
  ],
  plasma: [
    { icon: '🖐️', name: 'Dedos / palma', action: 'Los arcos siguen tus dedos' },
    { icon: '🙌', name: 'Dos manos', action: 'Arco entre las manos' },
    AMEN,
  ],
  rays: [
    { icon: '☝️', name: 'Solo dedos', action: 'Rayos desde las puntas' },
    { icon: '🖐️', name: 'Mano abierta', action: 'Rayos de dedos + palma' },
    { icon: '💨', name: 'Empujar (envion)', action: 'Mas potencia: gruesos y rapidos' },
    { icon: '🙌', name: 'Dos manos', action: 'Arco principal' },
    AMEN,
  ],
  force: [
    { icon: '💨', name: 'Palma + empujar', action: 'Onda de fuerza (pulso)' },
    { icon: '✊', name: 'Cerrar la mano', action: 'Agarrar / asfixiar el entorno' },
    AMEN,
  ],
  create: [
    { icon: '+', name: 'Elige abajo', action: 'Astro, luna o agujero negro' },
    { icon: 'o', name: 'Pinza en espacio', action: 'Crear astro' },
    { icon: 'o', name: 'Arrastrar y soltar', action: 'Lanzar / cambiar orbita' },
    { icon: '*', name: 'Palma sobre astro', action: 'Agrandarlo' },
    { icon: 'S', name: 'Sistema solar', action: 'Crear simulacion completa' },
    { icon: 'X', name: 'Dos punos', action: 'Limpiar universo' },
    AMEN,
  ],
  digitalShadow: [
    { icon: 'DS', name: 'Rostro frente a camara', action: 'Copia verde lateral' },
    { icon: 'PT', name: 'Mover la cabeza', action: 'Particulas siguen rostro' },
    { icon: 'GL', name: 'Sin rostro', action: 'Mascara demo procedural' },
    AMEN,
  ],
}

const MODE_NAME: Record<MatterMode, string> = {
  particles: 'Particulas',
  dust: 'Polvo',
  plasma: 'Plasma',
  rays: 'Rayos',
  force: 'Fuerza',
  create: 'Crear materia',
  digitalShadow: 'Digital Shadow',
}

export default function GestureGuide() {
  const showGuide = useMatterStore((s) => s.showGuide)
  const toggleGuide = useMatterStore((s) => s.toggleGuide)
  const matterMode = useMatterStore((s) => s.matterMode)

  const items = BY_MODE[matterMode]

  return (
    <div className="pointer-events-none absolute right-4 top-28 z-30 flex flex-col items-end">
      <button
        onClick={toggleGuide}
        className="mf-glass pointer-events-auto mb-2 rounded-lg px-3 py-1.5 text-xs text-white/80 transition-colors hover:text-white"
      >
        {showGuide ? 'Ocultar señas ✕' : 'Señas de este modo ?'}
      </button>

      <AnimatePresence>
        {showGuide && (
          <motion.div
            key={matterMode}
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.22 }}
            className="mf-glass mf-scroll pointer-events-auto max-h-[60vh] w-64 overflow-y-auto rounded-xl p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest text-white/50">
                Señas · {MODE_NAME[matterMode]}
              </span>
            </div>
            <ul className="flex flex-col gap-2">
              {items.map((g) => (
                <li key={g.name} className="flex items-center gap-2 text-xs">
                  <span aria-hidden className="w-5 text-center text-base">
                    {g.icon}
                  </span>
                  <span className="text-white/75">{g.name}</span>
                  <span className="ml-auto text-right font-medium text-mf-cyan">
                    {g.action}
                  </span>
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
