// MatterFlow - mini vista de camara (160x120) con landmarks superpuestos.
// Esquina inferior izquierda. (c) 2026 Abel Gomez
import { useEffect, useRef } from 'react'
import { useMatterStore } from '../../store/matterStore'
import { faceLandmarksBus, handLandmarksBus } from './HandTracker'

const W = 160
const H = 120

// Conexiones del esqueleto de la mano (pares de indices de landmarks)
const CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], // pulgar
  [0, 5], [5, 6], [6, 7], [7, 8], // indice
  [5, 9], [9, 10], [10, 11], [11, 12], // medio
  [9, 13], [13, 14], [14, 15], [15, 16], // anular
  [13, 17], [17, 18], [18, 19], [19, 20], // menique
  [0, 17], // base palma
]

const TIP_IDS = new Set([4, 8, 12, 16, 20])
const KNUCKLE_IDS = new Set([2, 5, 9, 13, 17])

const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379,
  378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127,
  162, 21, 54, 103, 67, 109, 10,
]
const LEFT_EYE = [33, 160, 158, 133, 153, 144, 33]
const RIGHT_EYE = [263, 387, 385, 362, 380, 373, 263]
const MOUTH = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291]
const NOSE = [168, 6, 197, 195, 5, 4, 1]

export default function CameraOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cameraActive = useMatterStore((s) => s.cameraActive)
  const matterMode = useMatterStore((s) => s.matterMode)

  useEffect(() => {
    if (!cameraActive) return
    let raf = 0
    const draw = () => {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, W, H)
        ctx.fillStyle = 'rgba(0,0,4,0.55)'
        ctx.fillRect(0, 0, W, H)

        if (matterMode === 'digitalShadow') {
          const face = faceLandmarksBus.faces[0]
          const lm = face?.landmarks
          if (lm?.length) {
            const drawPath = (
              ids: number[],
              strokeStyle: string,
              lineWidth = 1
            ) => {
              ctx.strokeStyle = strokeStyle
              ctx.lineWidth = lineWidth
              ctx.beginPath()
              ids.forEach((id, index) => {
                const point = lm[id]
                if (!point) return
                const x = point.x * W
                const y = point.y * H
                if (index === 0) ctx.moveTo(x, y)
                else ctx.lineTo(x, y)
              })
              ctx.stroke()
            }

            drawPath(FACE_OVAL, 'rgba(215,255,0,0.9)', 1.25)
            drawPath(LEFT_EYE, 'rgba(255,255,255,0.55)')
            drawPath(RIGHT_EYE, 'rgba(255,255,255,0.55)')
            drawPath(MOUTH, 'rgba(120,255,0,0.65)')
            drawPath(NOSE, 'rgba(215,255,0,0.55)')

            for (let i = 0; i < lm.length; i += 3) {
              const px = lm[i].x * W
              const py = lm[i].y * H
              ctx.fillStyle = i % 12 === 0 ? '#D7FF00' : 'rgba(120,255,0,0.55)'
              ctx.beginPath()
              ctx.arc(px, py, i % 12 === 0 ? 1.25 : 0.8, 0, Math.PI * 2)
              ctx.fill()
            }
          }
        }

        const hands = handLandmarksBus.hands
        for (const hand of hands) {
          const lm = hand.landmarks
          // conexiones
          ctx.strokeStyle = 'rgba(255,255,255,0.35)'
          ctx.lineWidth = 1
          for (const [a, b] of CONNECTIONS) {
            ctx.beginPath()
            ctx.moveTo(lm[a].x * W, lm[a].y * H)
            ctx.lineTo(lm[b].x * W, lm[b].y * H)
            ctx.stroke()
          }
          // puntos
          for (let i = 0; i < lm.length; i++) {
            const px = lm[i].x * W
            const py = lm[i].y * H
            if (i === 0) {
              ctx.fillStyle = '#FFFFFF'
              ctx.beginPath()
              ctx.arc(px, py, 3.5, 0, Math.PI * 2)
              ctx.fill()
            } else if (TIP_IDS.has(i)) {
              ctx.fillStyle = '#C084FC'
              ctx.beginPath()
              ctx.arc(px, py, 2.6, 0, Math.PI * 2)
              ctx.fill()
            } else if (KNUCKLE_IDS.has(i)) {
              ctx.fillStyle = '#00D4AA'
              ctx.beginPath()
              ctx.arc(px, py, 1.8, 0, Math.PI * 2)
              ctx.fill()
            } else {
              ctx.fillStyle = 'rgba(0,212,170,0.6)'
              ctx.beginPath()
              ctx.arc(px, py, 1.3, 0, Math.PI * 2)
              ctx.fill()
            }
          }
        }
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [cameraActive, matterMode])

  if (!cameraActive) return null

  return (
    <div className="mf-glass pointer-events-none absolute bottom-4 left-4 z-30 overflow-hidden rounded-xl p-1">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="rounded-lg"
        style={{ width: W, height: H }}
      />
      <div className="mt-1 text-center text-[10px] uppercase tracking-widest text-white/50">
        {matterMode === 'digitalShadow' ? 'Face + hands' : 'MediaPipe'}
      </div>
    </div>
  )
}
