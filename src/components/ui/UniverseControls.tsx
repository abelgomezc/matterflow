// MatterFlow - controles simples para el creador de universos. (c) 2026 Abel Gomez
import { useMatterStore } from '../../store/matterStore'
import type { UniverseTool } from '../../types/matter.types'

const TOOLS: { id: UniverseTool; icon: string; label: string }[] = [
  { id: 'planet', icon: '🪐', label: 'Planeta' },
  { id: 'sun', icon: '☀️', label: 'Sol' },
  { id: 'star', icon: '⭐', label: 'Estrella' },
  { id: 'meteor', icon: '☄️', label: 'Meteorito' },
  { id: 'moon', icon: '🌙', label: 'Luna' },
  { id: 'blackHole', icon: '⚫', label: 'Agujero negro' },
]

export default function UniverseControls() {
  const matterMode = useMatterStore((state) => state.matterMode)
  const universeTool = useMatterStore((state) => state.universeTool)
  const setUniverseTool = useMatterStore((state) => state.setUniverseTool)
  const resetUniverse = useMatterStore((state) => state.resetUniverse)
  const createSolarSystem = useMatterStore((state) => state.createSolarSystem)

  if (matterMode !== 'create') return null

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-32 z-30 flex justify-center px-3">
      <div className="mf-glass pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl p-1.5">
        {TOOLS.map((tool) => {
          const active = universeTool === tool.id
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => setUniverseTool(tool.id)}
              className={`flex min-w-16 flex-col items-center rounded-xl px-3 py-1.5 text-[10px] transition ${
                active
                  ? 'bg-mf-cyan/20 text-white ring-1 ring-mf-cyan'
                  : 'text-white/55 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="text-xl" aria-hidden>
                {tool.icon}
              </span>
              {tool.label}
            </button>
          )
        })}
        <button
          type="button"
          onClick={createSolarSystem}
          className="ml-1 rounded-xl border border-cyan-300/30 px-3 py-3 text-xs text-cyan-100 transition hover:bg-cyan-400/15"
        >
          Sistema solar
        </button>
        <button
          type="button"
          onClick={resetUniverse}
          className="ml-1 rounded-xl border border-red-300/30 px-3 py-3 text-xs text-red-200 transition hover:bg-red-400/15"
        >
          Limpiar
        </button>
      </div>
      <div className="pointer-events-none absolute -bottom-7 rounded-full bg-black/55 px-3 py-1 text-[10px] text-white/75">
        Elige y haz pinza · arrastra para lanzar · las colisiones son físicas
      </div>
    </div>
  )
}
