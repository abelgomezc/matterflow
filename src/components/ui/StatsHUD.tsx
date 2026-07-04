// MatterFlow - HUD de estadisticas (esquinas superiores). (c) 2026 Abel Gomez
import { useMatterStore } from '../../store/matterStore'
import type { InteractionMode } from '../../types/matter.types'

const MODE_LABEL: Record<InteractionMode, string> = {
  attract: 'Atraer',
  repel: 'Repeler',
  vortex: 'Vortex',
  freeze: 'Congelar',
  create: 'Crear',
}

function Row({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 whitespace-nowrap text-xs text-white/80 sm:text-sm">
      <span aria-hidden className="w-4 text-center">
        {icon}
      </span>
      {children}
    </div>
  )
}

export default function StatsHUD() {
  const fps = useMatterStore((s) => s.fps)
  const particleCount = useMatterStore((s) => s.particleCount)
  const handsDetected = useMatterStore((s) => s.handsDetected)
  const currentGesture = useMatterStore((s) => s.currentGesture)
  const interactionMode = useMatterStore((s) => s.interactionMode)
  const force = useMatterStore((s) => s.force)
  const cameraActive = useMatterStore((s) => s.cameraActive)
  const demoMode = useMatterStore((s) => s.demoMode)

  const mpActive = cameraActive
  const fpsColor = fps >= 50 ? '#00D4AA' : fps >= 30 ? '#D4A843' : '#FF4A4A'

  return (
    <>
      {/* Superior izquierda */}
      <div className="mf-glass pointer-events-none absolute left-4 top-4 z-30 flex flex-col gap-1.5 rounded-xl px-3 py-2.5">
        <Row icon="📡">
          MediaPipe ·{' '}
          <span style={{ color: mpActive ? '#00D4AA' : 'rgba(255,255,255,0.45)' }}>
            {mpActive ? 'ACTIVO' : 'INACTIVO'}
          </span>
        </Row>
        <Row icon="⚡">
          <span style={{ color: fpsColor }}>{fps} FPS</span>
        </Row>
        <Row icon="🎛️">Modo: {MODE_LABEL[interactionMode]}</Row>
        <Row icon="✨">Particulas: {particleCount}</Row>
      </div>

      {/* Superior derecha */}
      <div className="mf-glass pointer-events-none absolute right-4 top-4 z-30 flex flex-col items-end gap-1.5 rounded-xl px-3 py-2.5">
        <Row icon="🖐️">Manos: {handsDetected}</Row>
        <Row icon="👋">Gesto: {currentGesture}</Row>
        <Row icon="💪">Fuerza: {Math.round(force * 100)}%</Row>
        {demoMode && (
          <div className="text-[10px] uppercase tracking-widest text-mf-purple/80">
            modo demo
          </div>
        )}
      </div>
    </>
  )
}