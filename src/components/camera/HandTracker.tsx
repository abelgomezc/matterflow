// MatterFlow - camara + MediaPipe. Alimenta el pointerBus con las manos
// detectadas y publica los landmarks para el CameraOverlay. Si no hay manos
// (o no hay camara), el fallback de mouse/touch/demo toma el control.
// (c) 2026 Abel Gomez
import { useEffect, useRef } from 'react'
import { useHandTracking } from '../../hooks/useHandTracking'
import {
  detectGesture,
  gestureToMode,
  gestureLabel,
  createWristTracker,
  type WristTracker,
} from '../../hooks/useGestureDetection'
import { useMatterStore } from '../../store/matterStore'
import { setPointers } from '../../store/pointerBus'
import type { Pointer } from '../../types/matter.types'
import type { HandData } from '../../hooks/useHandTracking'

/** Publica los landmarks actuales para que el overlay los dibuje. */
export const handLandmarksBus: { hands: HandData[] } = { hands: [] }

/** Publica el elemento <video> de la camara para usarlo como textura WebGL
 *  (p.ej. el modo Fuerza distorsiona este feed). */
export const cameraBus: { video: HTMLVideoElement | null } = { video: null }

const VIRTUAL_W = 1280
const VIRTUAL_H = 720

export default function HandTracker() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const wristTrackers = useRef<WristTracker[]>([
    createWristTracker(),
    createWristTracker(),
  ])
  const demoRef = useRef({ t: 0 })

  const cameraActive = useMatterStore((s) => s.cameraActive)
  const matterMode = useMatterStore((s) => s.matterMode)
  const setHandsDetected = useMatterStore((s) => s.setHandsDetected)
  const setCurrentGesture = useMatterStore((s) => s.setCurrentGesture)
  const setInteractionMode = useMatterStore((s) => s.setInteractionMode)
  const setForce = useMatterStore((s) => s.setForce)
  const setDemoMode = useMatterStore((s) => s.setDemoMode)
  const setCameraActive = useMatterStore((s) => s.setCameraActive)
  const setEasterEgg = useMatterStore((s) => s.setEasterEgg)
  const setNoSign = useMatterStore((s) => s.setNoSign)
  const eggTimer = useRef<number | undefined>(undefined)
  const amenFrames = useRef(0)
  const unknownFrames = useRef(0)
  const noSignCooldown = useRef(0)

  const { hands, isReady, error, startDetection, stopDetection } =
    useHandTracking(videoRef)

  // Arranca/detiene la webcam segun cameraActive
  useEffect(() => {
    let cancelled = false
    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: VIRTUAL_W, height: VIRTUAL_H, facingMode: 'user' },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        startDetection()
      } catch (e) {
        console.error('[MatterFlow] getUserMedia:', e)
        setCameraActive(false)
      }
    }

    if (cameraActive) {
      start()
    } else {
      stopDetection()
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }

    return () => {
      cancelled = true
    }
  }, [cameraActive, startDetection, stopDetection, setCameraActive])

  // Traduce manos detectadas -> punteros del bus, o activa el fallback
  useEffect(() => {
    handLandmarksBus.hands = hands

    if (cameraActive && hands.length > 0) {
      setDemoMode(false)
      setHandsDetected(hands.length)

      let primaryUnknown = false
      const pointers: Pointer[] = hands.map((hand, i) => {
        const g = detectGesture(
          hand,
          VIRTUAL_W,
          VIRTUAL_H,
          wristTrackers.current[i]
        )
        const mode = gestureToMode(g.gesture)
        if (i === 0) {
          primaryUnknown = g.gesture === 'UNKNOWN'
          setInteractionMode(mode)
          setCurrentGesture(gestureLabel(g.gesture))
          setForce(g.intensity)
        }
        return { x: hand.x, y: hand.y, mode, intensity: g.intensity, active: true }
      })

      // 🙏 "Amen": las DOS manos muy juntas -> easter egg. Requiere mantenerlo
      // ~varios cuadros (anti-parpadeo). Es un gesto de 2 manos, muy distintivo.
      let amen = false
      if (hands.length === 2) {
        const d = Math.hypot(hands[0].x - hands[1].x, hands[0].y - hands[1].y)
        if (d < 0.16) amen = true
      }
      if (amen) {
        setCurrentGesture('Manos juntas 🙏')
        amenFrames.current += 1
        unknownFrames.current = 0
        if (amenFrames.current >= 6) {
          setEasterEgg(true)
          if (eggTimer.current) window.clearTimeout(eggTimer.current)
          eggTimer.current = window.setTimeout(() => setEasterEgg(false), 5000)
        }
      } else {
        amenFrames.current = 0
        // Dos manos separadas: modo especial (campo entre ambas)
        if (pointers.length === 2) setCurrentGesture('Dos manos: campo')

        // Seña no reconocida sostenida -> mensaje gracioso (con enfriamiento)
        if (primaryUnknown && hands.length === 1) {
          unknownFrames.current += 1
          if (unknownFrames.current >= 14 && Date.now() > noSignCooldown.current) {
            setNoSign(true)
            noSignCooldown.current = Date.now() + 7000
            window.setTimeout(() => setNoSign(false), 2600)
          }
        } else {
          unknownFrames.current = 0
        }
      }
      setPointers(pointers)
    } else {
      setHandsDetected(0)
      amenFrames.current = 0
      unknownFrames.current = 0
      if (cameraActive) {
        setCurrentGesture('Buscando manos...')
      }
    }
  }, [
    hands,
    cameraActive,
    setDemoMode,
    setHandsDetected,
    setInteractionMode,
    setCurrentGesture,
    setForce,
  ])

  // --- Fallback de mouse/touch + modo demo automatico ---
  useEffect(() => {
    let raf = 0
    const mouse = { x: 0.5, y: 0.5, active: false, down: false }
    const usingHands = () => cameraActive && handLandmarksBus.hands.length > 0

    const onMove = (e: PointerEvent) => {
      mouse.x = e.clientX / window.innerWidth
      mouse.y = e.clientY / window.innerHeight
      mouse.active = true
    }
    const onDown = (e: PointerEvent) => {
      mouse.down = true
      onMove(e)
    }
    const onUp = () => {
      mouse.down = false
    }
    const onLeave = () => {
      mouse.active = false
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('pointerleave', onLeave)

    const loop = () => {
      if (!usingHands()) {
        // Sin manos: mouse/touch controla; si el mouse esta quieto, demo.
        if (mouse.active) {
          setDemoMode(false)
          // click/touch mantenido = repeler; normal = atraer
          const mode = mouse.down ? 'repel' : 'attract'
          const store = useMatterStore.getState()
          if (store.currentGesture !== (mouse.down ? 'Mouse: repeler' : 'Mouse: atraer')) {
            setCurrentGesture(mouse.down ? 'Mouse: repeler' : 'Mouse: atraer')
          }
          setForce(mouse.down ? 1 : 0.8)
          setPointers([
            { x: mouse.x, y: mouse.y, mode, intensity: mouse.down ? 1 : 0.8, active: true },
          ])
        } else {
          // Demo: cursor simulado en figura de Lissajous
          setDemoMode(true)
          demoRef.current.t += 0.012
          const t = demoRef.current.t
          const dx = 0.5 + 0.32 * Math.sin(t * 1.3)
          const dy = 0.5 + 0.28 * Math.sin(t * 1.9 + 1.2)
          const phase = Math.floor(t / 4) % 3
          const mode = phase === 0 ? 'attract' : phase === 1 ? 'vortex' : 'repel'
          setPointers([{ x: dx, y: dy, mode, intensity: 0.85, active: true }])
          setForce(0.85)
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('pointerleave', onLeave)
    }
  }, [cameraActive, setDemoMode, setCurrentGesture, setForce])

  // Reporta errores de MediaPipe al HUD
  useEffect(() => {
    if (error) setCurrentGesture('MediaPipe no disponible')
  }, [error, setCurrentGesture])

  // Publica el <video> para que otros efectos (modo Fuerza) lo usen como textura
  useEffect(() => {
    cameraBus.video = videoRef.current
    return () => {
      cameraBus.video = null
    }
  }, [])

  // En modo Fuerza el propio canvas dibuja la camara (distorsionada), asi que
  // se oculta este fondo DOM para no ver la imagen doble.
  const showDomBg = cameraActive && matterMode !== 'force'

  // La camara se muestra a pantalla completa como fondo (espejo selfie);
  // las particulas/efectos del canvas van encima (canvas transparente, z-10).
  return (
    <div
      className="absolute inset-0 z-0 transition-opacity duration-500"
      style={{ opacity: showDomBg ? 1 : 0 }}
    >
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        style={{ transform: 'scaleX(-1)' }} // espejo selfie (coincide con landmarks)
        playsInline
        muted
        width={VIRTUAL_W}
        height={VIRTUAL_H}
        data-ready={isReady}
      />
      {/* Oscurece un poco el video para que la materia resalte */}
      <div className="absolute inset-0 bg-mf-bg/45" />
    </div>
  )
}