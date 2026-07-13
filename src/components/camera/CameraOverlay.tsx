// MatterFlow - overlay de camara con landmarks de MediaPipe.
// En Digital Shadow, el overlay Face + hands ocupa toda la pantalla y el
// recuadro inferior muestra una miniatura de esa composicion.
// (c) 2026 Abel Gomez
import { useEffect, useRef } from 'react'
import { useMatterStore } from '../../store/matterStore'
import { cameraBus, faceLandmarksBus, handLandmarksBus } from './HandTracker'
import type { Landmark } from '../../types/hand.types'

const MINI_W = 160
const MINI_H = 120

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
const LEFT_BROW = [70, 63, 105, 66, 107]
const RIGHT_BROW = [336, 296, 334, 293, 300]
const MOUTH = [
  61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84,
  181, 91, 146, 61,
]
const NOSE = [168, 6, 197, 195, 5, 4, 1, 19, 94, 2]
const MIDLINE = [
  10, 151, 9, 8, 168, 6, 197, 195, 5, 4, 1, 19, 94, 2, 164, 0, 17, 18, 200,
  199, 175, 152,
]
const FINGER_TIPS = [4, 8, 12, 16, 20]
const DUST_DURATION = 920
const DUST_COOLDOWN = 560

interface FaceDustFx {
  startedAt: number
  origin: { x: number; y: number }
  target: { x: number; y: number }
}

const resizeCanvas = (canvas: HTMLCanvasElement, width: number, height: number) => {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const pixelWidth = Math.max(1, Math.floor(width * dpr))
  const pixelHeight = Math.max(1, Math.floor(height * dpr))
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth
    canvas.height = pixelHeight
  }
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  return dpr
}

const drawPath = (
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  ids: number[],
  width: number,
  height: number,
  strokeStyle: string,
  lineWidth = 1,
  close = false
) => {
  ctx.beginPath()
  ids.forEach((id, index) => {
    const point = landmarks[id]
    if (!point) return
    const x = point.x * width
    const y = point.y * height
    if (index === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  if (close) ctx.closePath()
  ctx.strokeStyle = strokeStyle
  ctx.lineWidth = lineWidth
  ctx.stroke()
}

const seededWave = (value: number) => {
  const x = Math.sin(value * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

const drawLightning = (
  ctx: CanvasRenderingContext2D,
  origin: { x: number; y: number },
  target: { x: number; y: number },
  width: number,
  height: number,
  progress: number,
  large: boolean
) => {
  const scale = large ? Math.max(width, height) / 900 : 1
  const ox = origin.x * width
  const oy = origin.y * height
  const tx = target.x * width
  const ty = target.y * height
  const dx = tx - ox
  const dy = ty - oy
  const len = Math.max(Math.hypot(dx, dy), 1)
  const nx = -dy / len
  const ny = dx / len
  const alpha = Math.sin(Math.min(1, progress) * Math.PI)
  const jitter = (large ? 20 : 5) * alpha
  const segments = large ? 14 : 8

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let pass = 0; pass < 3; pass += 1) {
    ctx.beginPath()
    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments
      const seed = seededWave(i * 17 + progress * 31 + pass * 11)
      const offset = (seed - 0.5) * jitter * (1 - Math.abs(t - 0.5) * 1.35)
      const x = ox + dx * t + nx * offset
      const y = oy + dy * t + ny * offset
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle =
      pass === 0
        ? `rgba(120,255,0,${0.2 * alpha})`
        : pass === 1
          ? `rgba(215,255,0,${0.42 * alpha})`
          : `rgba(255,255,255,${0.86 * alpha})`
    ctx.lineWidth = (pass === 0 ? 9 : pass === 1 ? 4 : 1.6) * scale
    ctx.stroke()
  }
  ctx.restore()
}

const drawDustFace = (
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  width: number,
  height: number,
  large: boolean,
  fx: FaceDustFx,
  now: number
) => {
  const progress = Math.min(1, (now - fx.startedAt) / DUST_DURATION)
  const scale = large ? Math.max(width, height) / 900 : 1
  const alpha = 1 - progress * 0.82
  const blast = Math.sin(progress * Math.PI)
  const cx = fx.target.x * width
  const cy = fx.target.y * height

  drawLightning(ctx, fx.origin, fx.target, width, height, progress, large)

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < landmarks.length; i += large ? 1 : 2) {
    const point = landmarks[i]
    const baseX = point.x * width
    const baseY = point.y * height
    let vx = baseX - cx
    let vy = baseY - cy
    const dist = Math.max(Math.hypot(vx, vy), 1)
    vx /= dist
    vy /= dist

    const seedA = seededWave(i + 4)
    const seedB = seededWave(i + 31)
    const seedC = seededWave(i + 79)
    const scatter = (large ? 130 : 28) * (0.2 + seedA) * progress ** 1.45
    const spin = (seedB - 0.5) * (large ? 54 : 12) * blast
    const fall = (large ? 60 : 14) * progress ** 2 * (0.35 + seedC)
    const x = baseX + vx * scatter - vy * spin
    const y = baseY + vy * scatter + vx * spin + fall
    const hot = i % 12 === 0

    ctx.fillStyle = hot
      ? `rgba(215,255,0,${Math.max(0, alpha)})`
      : `rgba(120,255,0,${Math.max(0, alpha * 0.72)})`
    ctx.beginPath()
    ctx.arc(x, y, (hot ? 2.1 : 1.15) * scale * (1 + blast * 0.8), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

const drawFace = (
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[] | undefined,
  width: number,
  height: number,
  large: boolean,
  fx: FaceDustFx | null,
  now: number
) => {
  if (!landmarks?.length) return
  if (fx && now - fx.startedAt < DUST_DURATION) {
    drawDustFace(ctx, landmarks, width, height, large, fx, now)
    return
  }

  const scale = large ? Math.max(width, height) / 900 : 1
  const contourWidth = large ? Math.max(2.5, scale * 3.4) : 1.25
  const detailWidth = large ? Math.max(1.4, scale * 2) : 1

  drawPath(ctx, landmarks, FACE_OVAL, width, height, 'rgba(215,255,0,0.94)', contourWidth, true)
  drawPath(ctx, landmarks, MIDLINE, width, height, 'rgba(215,255,0,0.48)', detailWidth)
  drawPath(ctx, landmarks, LEFT_EYE, width, height, 'rgba(255,255,255,0.72)', detailWidth)
  drawPath(ctx, landmarks, RIGHT_EYE, width, height, 'rgba(255,255,255,0.72)', detailWidth)
  drawPath(ctx, landmarks, LEFT_BROW, width, height, 'rgba(255,255,255,0.42)', detailWidth)
  drawPath(ctx, landmarks, RIGHT_BROW, width, height, 'rgba(255,255,255,0.42)', detailWidth)
  drawPath(ctx, landmarks, MOUTH, width, height, 'rgba(120,255,0,0.72)', detailWidth * 1.15)
  drawPath(ctx, landmarks, NOSE, width, height, 'rgba(215,255,0,0.58)', detailWidth)

  for (let i = 0; i < landmarks.length; i += large ? 2 : 3) {
    const px = landmarks[i].x * width
    const py = landmarks[i].y * height
    const hot = i % 12 === 0
    ctx.fillStyle = hot ? '#D7FF00' : 'rgba(120,255,0,0.58)'
    ctx.beginPath()
    ctx.arc(px, py, hot ? 1.45 * scale : 0.85 * scale, 0, Math.PI * 2)
    ctx.fill()
  }
}

const detectFaceTouch = () => {
  const face = faceLandmarksBus.faces[0]
  const landmarks = face?.landmarks
  if (!face || !landmarks?.length) return null

  const minX = face.x - face.width * 0.58
  const maxX = face.x + face.width * 0.58
  const minY = face.y - face.height * 0.58
  const maxY = face.y + face.height * 0.58
  const touchDistance = Math.max(0.045, Math.min(face.width, face.height) * 0.16)

  for (const hand of handLandmarksBus.hands) {
    for (const tipId of FINGER_TIPS) {
      const tip = hand.landmarks[tipId]
      if (!tip) continue
      const insideBox =
        tip.x >= minX && tip.x <= maxX && tip.y >= minY && tip.y <= maxY

      let closest = landmarks[0]
      let closestDistance = Number.POSITIVE_INFINITY
      for (let i = 0; i < landmarks.length; i += 3) {
        const point = landmarks[i]
        const distance = Math.hypot(point.x - tip.x, point.y - tip.y)
        if (distance < closestDistance) {
          closestDistance = distance
          closest = point
        }
      }

      if (insideBox || closestDistance < touchDistance) {
        return {
          origin: { x: tip.x, y: tip.y },
          target: { x: closest.x, y: closest.y },
        }
      }
    }
  }

  return null
}

const drawHands = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  large: boolean
) => {
  const hands = handLandmarksBus.hands
  const scale = large ? Math.max(width, height) / 900 : 1
  for (const hand of hands) {
    const lm = hand.landmarks
    ctx.strokeStyle = 'rgba(255,255,255,0.42)'
    ctx.lineWidth = large ? Math.max(1.4, scale * 2) : 1
    for (const [a, b] of CONNECTIONS) {
      ctx.beginPath()
      ctx.moveTo(lm[a].x * width, lm[a].y * height)
      ctx.lineTo(lm[b].x * width, lm[b].y * height)
      ctx.stroke()
    }

    for (let i = 0; i < lm.length; i += 1) {
      const px = lm[i].x * width
      const py = lm[i].y * height
      let radius = 1.3
      ctx.fillStyle = 'rgba(0,212,170,0.65)'
      if (i === 0) {
        radius = 3.5
        ctx.fillStyle = '#FFFFFF'
      } else if (TIP_IDS.has(i)) {
        radius = 2.6
        ctx.fillStyle = '#C084FC'
      } else if (KNUCKLE_IDS.has(i)) {
        radius = 1.8
        ctx.fillStyle = '#00D4AA'
      }
      ctx.beginPath()
      ctx.arc(px, py, radius * scale, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

const drawMirroredVideoCover = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) => {
  const video = cameraBus.video
  if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
    ctx.fillStyle = 'rgba(0,0,4,0.55)'
    ctx.fillRect(0, 0, width, height)
    return
  }

  const videoRatio = video.videoWidth / video.videoHeight
  const canvasRatio = width / height
  const drawHeight = videoRatio > canvasRatio ? height : width / videoRatio
  const drawWidth = videoRatio > canvasRatio ? height * videoRatio : width
  const x = (width - drawWidth) / 2
  const y = (height - drawHeight) / 2

  ctx.save()
  ctx.translate(width, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(video, x, y, drawWidth, drawHeight)
  ctx.restore()
}

const drawOverlay = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  large: boolean,
  includeVideo: boolean,
  fx: FaceDustFx | null,
  now: number
) => {
  ctx.clearRect(0, 0, width, height)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (includeVideo) {
    drawMirroredVideoCover(ctx, width, height)
    ctx.fillStyle = 'rgba(0,0,4,0.22)'
    ctx.fillRect(0, 0, width, height)
  } else if (!large) {
    ctx.fillStyle = 'rgba(0,0,4,0.55)'
    ctx.fillRect(0, 0, width, height)
  }

  drawFace(ctx, faceLandmarksBus.faces[0]?.landmarks, width, height, large, fx, now)
  drawHands(ctx, width, height, large)
}

export default function CameraOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fullCanvasRef = useRef<HTMLCanvasElement>(null)
  const dustFxRef = useRef<FaceDustFx | null>(null)
  const lastDustAtRef = useRef(0)
  const cameraActive = useMatterStore((s) => s.cameraActive)
  const matterMode = useMatterStore((s) => s.matterMode)

  useEffect(() => {
    if (!cameraActive) return
    let raf = 0
    const draw = () => {
      const miniCanvas = canvasRef.current
      const miniCtx = miniCanvas?.getContext('2d')
      const isDigitalShadow = matterMode === 'digitalShadow'
      const now = performance.now()
      const currentFx =
        dustFxRef.current && now - dustFxRef.current.startedAt < DUST_DURATION
          ? dustFxRef.current
          : null

      if (
        isDigitalShadow &&
        !currentFx &&
        now - lastDustAtRef.current > DUST_COOLDOWN
      ) {
        const hit = detectFaceTouch()
        if (hit) {
          dustFxRef.current = { ...hit, startedAt: now }
          lastDustAtRef.current = now
        }
      }

      const activeFx =
        dustFxRef.current && now - dustFxRef.current.startedAt < DUST_DURATION
          ? dustFxRef.current
          : null
      if (!activeFx) dustFxRef.current = null

      if (isDigitalShadow) {
        const fullCanvas = fullCanvasRef.current
        const fullCtx = fullCanvas?.getContext('2d')
        if (fullCanvas && fullCtx) {
          const dpr = resizeCanvas(fullCanvas, window.innerWidth, window.innerHeight)
          fullCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
          drawOverlay(fullCtx, window.innerWidth, window.innerHeight, true, false, activeFx, now)
        }
      }

      if (miniCanvas && miniCtx) {
        const dpr = resizeCanvas(miniCanvas, MINI_W, MINI_H)
        miniCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
        drawOverlay(miniCtx, MINI_W, MINI_H, false, isDigitalShadow, activeFx, now)
      }

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [cameraActive, matterMode])

  if (!cameraActive) return null

  return (
    <>
      {matterMode === 'digitalShadow' && (
        <canvas
          ref={fullCanvasRef}
          className="pointer-events-none absolute inset-0 z-20"
        />
      )}
      <div className="mf-glass pointer-events-none absolute bottom-4 left-4 z-30 overflow-hidden rounded-xl p-1">
        <canvas ref={canvasRef} className="rounded-lg" />
        <div className="mt-1 text-center text-[10px] uppercase tracking-widest text-white/50">
          {matterMode === 'digitalShadow' ? 'Screen mirror' : 'MediaPipe'}
        </div>
      </div>
    </>
  )
}
