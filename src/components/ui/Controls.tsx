// MatterFlow - controles: pausa/reanudar. (c) 2026 Abel Gomez
import { useMatterStore } from '../../store/matterStore'

export default function Controls() {
  const paused = useMatterStore((s) => s.paused)
  const togglePaused = useMatterStore((s) => s.togglePaused)

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center px-4">
      <button
        onClick={togglePaused}
        className="mf-glass pointer-events-auto flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white/85 transition-colors hover:text-white"
        title={paused ? 'Reanudar (la animacion esta congelada)' : 'Pausar la animacion'}
      >
        <span aria-hidden>{paused ? '▶️' : '⏸️'}</span>
        {paused ? 'Reanudar' : 'Pausar'}
      </button>
    </div>
  )
}