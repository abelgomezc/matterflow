// MatterFlow - controles del creador de universos. (c) 2026 Abel Gomez
import { useMatterStore } from '../../store/matterStore'
import type { PlanetVariant, UniverseTool } from '../../types/matter.types'

const TOOLS: { id: UniverseTool; icon: string; label: string }[] = [
  { id: 'planet', icon: 'P', label: 'Planeta' },
  { id: 'sun', icon: 'S', label: 'Sol' },
  { id: 'star', icon: '*', label: 'Estrella' },
  { id: 'meteor', icon: 'M', label: 'Meteorito' },
  { id: 'moon', icon: 'L', label: 'Luna' },
  { id: 'blackHole', icon: 'BH', label: 'Agujero negro' },
]

const PLANETS: { id: PlanetVariant; label: string; swatch: string }[] = [
  { id: 'rocky', label: 'Rocoso', swatch: '#8A7057' },
  { id: 'ocean', label: 'Oceanico', swatch: '#1D7FBF' },
  { id: 'gasGiant', label: 'Gaseoso', swatch: '#C6925B' },
  { id: 'ice', label: 'Helado', swatch: '#BFE7FF' },
  { id: 'volcanic', label: 'Volcanico', swatch: '#C2410C' },
]

export default function UniverseControls() {
  const matterMode = useMatterStore((state) => state.matterMode)
  const universeTool = useMatterStore((state) => state.universeTool)
  const planetVariant = useMatterStore((state) => state.planetVariant)
  const setUniverseTool = useMatterStore((state) => state.setUniverseTool)
  const setPlanetVariant = useMatterStore((state) => state.setPlanetVariant)
  const resetUniverse = useMatterStore((state) => state.resetUniverse)
  const createSolarSystem = useMatterStore((state) => state.createSolarSystem)

  if (matterMode !== 'create') return null

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-24 z-30 flex flex-col items-center gap-2 px-3">
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
              <span className="text-sm font-semibold" aria-hidden>
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
          Sistema realista
        </button>
        <button
          type="button"
          onClick={resetUniverse}
          className="ml-1 rounded-xl border border-red-300/30 px-3 py-3 text-xs text-red-200 transition hover:bg-red-400/15"
        >
          Limpiar
        </button>
      </div>

      {universeTool === 'planet' && (
        <div className="mf-glass pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl px-2 py-1.5">
          <span className="px-2 text-[10px] uppercase tracking-[0.18em] text-white/45">
            Tipo
          </span>
          {PLANETS.map((planet) => {
            const active = planetVariant === planet.id
            return (
              <button
                key={planet.id}
                type="button"
                onClick={() => setPlanetVariant(planet.id)}
                className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[10px] transition ${
                  active
                    ? 'bg-white/15 text-white ring-1 ring-white/30'
                    : 'text-white/55 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: planet.swatch }}
                />
                {planet.label}
              </button>
            )
          })}
        </div>
      )}

      <div className="pointer-events-none rounded-full bg-black/70 px-3 py-1 text-[10px] text-white/75">
        Pinza para crear, arrastra para lanzar. Gravedad, orbitas, mareas,
        fusion, crateres y absorcion.
      </div>
    </div>
  )
}
