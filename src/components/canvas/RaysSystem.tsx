// MatterFlow - RAYOS azules (relampagos electricos). (c) 2026 Abel Gomez
// Emision segun la pose de la mano:
//   - Solo dedos extendidos -> los rayos salen SOLO de esas puntas.
//   - Mano abierta -> salen de los dedos Y de la palma.
//   - Al hacer el movimiento de empuje/pulso -> MAS POTENCIA: los rayos son
//     mas GRUESOS y mas RAPIDOS (parpadeo mas veloz) + estallido radial.
// Los rayos se dibujan como triangulos para tener grosor real (no lineas 1px).
// Entre dos manos, arco principal. Nucleos brillantes + chispas.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { getPointers } from '../../store/pointerBus'
import { useMatterStore } from '../../store/matterStore'
import { handLandmarksBus } from '../camera/HandTracker'
import { isFingerExtended } from '../../utils/handUtils'

const MAXV = 36000 // vertices para triangulos
const MAX_SPARKS = 560
const REACH = 0.34

const STOPS = [
  new THREE.Color('#0A2A8F'),
  new THREE.Color('#1E6BFF'),
  new THREE.Color('#5FD0FF'),
  new THREE.Color('#FFFFFF'),
]
const blue = (t: number, out: THREE.Color): THREE.Color => {
  const c = Math.max(0, Math.min(1, t)) * (STOPS.length - 1)
  const i = Math.min(Math.floor(c), STOPS.length - 2)
  return out.copy(STOPS[i]).lerp(STOPS[i + 1], c - i)
}

const FINGER_TIPS: [number, number, number][] = [
  [8, 6, 5],
  [12, 10, 9],
  [16, 14, 13],
  [20, 18, 17],
]

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  life: number
}
interface Track {
  x: number
  y: number
  scale: number
  init: boolean
}
interface Emitter {
  x: number
  y: number
  dx: number
  dy: number
  power: number
}

export default function RaysSystem() {
  const { viewport } = useThree()
  const meshRef = useRef<THREE.Mesh>(null)
  const sparksRef = useRef<THREE.Points>(null)
  const glowRef = useRef<THREE.Points>(null)
  const setParticleCount = useMatterStore((s) => s.setParticleCount)

  const triPos = useMemo(() => new Float32Array(MAXV * 3), [])
  const triCol = useMemo(() => new Float32Array(MAXV * 3), [])
  const sparkPos = useMemo(() => new Float32Array(MAX_SPARKS * 3), [])
  const sparkCol = useMemo(() => new Float32Array(MAX_SPARKS * 3), [])
  const glowPos = useMemo(() => new Float32Array(16 * 3), [])
  const glowCol = useMemo(() => new Float32Array(16 * 3), [])
  const sparks = useRef<Spark[]>([])
  const tracks = useRef<Track[]>([
    { x: 0, y: 0, scale: 0, init: false },
    { x: 0, y: 0, scale: 0, init: false },
  ])
  const tmp = useMemo(() => new THREE.Color(), [])
  const clock = useRef(0)
  const vRef = useRef(0)

  useEffect(() => {
    sparks.current = []
    tracks.current.forEach((t) => (t.init = false))
    setParticleCount(0)
  }, [setParticleCount])

  useFrame((_, delta) => {
    clock.current += delta
    const T = clock.current
    const dt = Math.min(Math.max(delta, 1 / 240), 1 / 20)
    const w = viewport.width
    const h = viewport.height
    vRef.current = 0
    let glowN = 0

    const toWX = (nx: number) => (nx - 0.5) * w
    const toWY = (ny: number) => (0.5 - ny) * h

    // segmento grueso (quad = 2 triangulos) en coords de MUNDO
    const pushQuad = (
      x0: number,
      y0: number,
      x1: number,
      y1: number,
      hw0: number,
      hw1: number,
      t: number,
      bright: number
    ) => {
      const v = vRef.current
      if (v + 18 > MAXV * 3) return
      let dx = x1 - x0
      let dy = y1 - y0
      const l = Math.sqrt(dx * dx + dy * dy) || 1e-4
      const px = (-dy / l)
      const py = (dx / l)
      const ax = x0 + px * hw0
      const ay = y0 + py * hw0
      const bx = x0 - px * hw0
      const by = y0 - py * hw0
      const cx = x1 + px * hw1
      const cy = y1 + py * hw1
      const dx2 = x1 - px * hw1
      const dy2 = y1 - py * hw1
      blue(t, tmp)
      const r = tmp.r * bright
      const g = tmp.g * bright
      const b = tmp.b * bright
      const verts = [ax, ay, bx, by, cx, cy, cx, cy, bx, by, dx2, dy2]
      for (let i = 0; i < 6; i++) {
        triPos[v + i * 3] = verts[i * 2]
        triPos[v + i * 3 + 1] = verts[i * 2 + 1]
        triPos[v + i * 3 + 2] = 0
        triCol[v + i * 3] = r
        triCol[v + i * 3 + 1] = g
        triCol[v + i * 3 + 2] = b
      }
      vRef.current = v + 18
    }

    // rayo jagged con ramas; grosor y velocidad escalan con la potencia
    const bolt = (
      anx: number,
      any: number,
      bnx: number,
      bny: number,
      branch: number,
      seed: number,
      bright: number,
      halfW: number,
      speed: number
    ) => {
      const dx = bnx - anx
      const dy = bny - any
      const len = Math.sqrt(dx * dx + dy * dy) || 1e-4
      const nx = -dy / len
      const ny = dx / len
      const steps = 9
      let pnx = anx
      let pny = any
      for (let s = 1; s <= steps; s++) {
        const tt = s / steps
        const jitter =
          s === steps
            ? 0
            : (Math.sin(seed + s * 4.1 + T * speed) * 0.5 +
                Math.sin(seed * 2 + s * 9 - T * speed * 0.5) * 0.5) *
              0.05 *
              len *
              4
        const cnx = anx + dx * tt + nx * jitter
        const cny = any + dy * tt + ny * jitter
        // grosor decrece hacia la punta
        const hw0 = halfW * (1 - (s - 1) / steps) + halfW * 0.15
        const hw1 = halfW * (1 - s / steps) + halfW * 0.15
        pushQuad(toWX(pnx), toWY(pny), toWX(cnx), toWY(cny), hw0, hw1, 0.45 + tt * 0.5, bright)
        if (branch > 0 && s > 1 && s < steps && Math.random() < 0.4) {
          const blen = len * (0.25 + Math.random() * 0.35)
          const ang = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.7
          bolt(
            cnx,
            cny,
            cnx + Math.cos(ang) * blen,
            cny + Math.sin(ang) * blen,
            branch - 1,
            seed + 11.3,
            bright * 0.85,
            halfW * 0.6,
            speed
          )
        }
        pnx = cnx
        pny = cny
      }
      if (Math.random() < 0.55 && sparks.current.length < MAX_SPARKS) {
        sparks.current.push({
          x: bnx,
          y: bny,
          vx: (Math.random() - 0.5) * 0.016,
          vy: (Math.random() - 0.5) * 0.016,
          life: 1,
        })
      }
    }

    const addGlow = (x: number, y: number, bright: number) => {
      if (glowN >= 16) return
      glowPos[glowN * 3] = toWX(x)
      glowPos[glowN * 3 + 1] = toWY(y)
      glowPos[glowN * 3 + 2] = 0
      blue(0.85, tmp)
      glowCol[glowN * 3] = tmp.r * bright
      glowCol[glowN * 3 + 1] = tmp.g * bright
      glowCol[glowN * 3 + 2] = tmp.b * bright
      glowN++
    }

    const baseW = h * 0.0035
    const emitters: Emitter[] = []
    const hands = handLandmarksBus.hands

    if (hands.length > 0) {
      for (let hi = 0; hi < Math.min(hands.length, 2); hi++) {
        const hand = hands[hi]
        const lm = hand.landmarks
        const tr = tracks.current[hi]

        const scale = Math.hypot(lm[9].x - lm[0].x, lm[9].y - lm[0].y)
        let speed = 0
        let scaleVel = 0
        if (tr.init) {
          speed = Math.hypot(hand.x - tr.x, hand.y - tr.y) / dt
          scaleVel = (scale - tr.scale) / dt
        }
        tr.x = hand.x
        tr.y = hand.y
        tr.scale = scale
        tr.init = true
        const pushBoost = Math.min(2.0, Math.max(0, speed * 0.7, scaleVel * 2.2))
        const power = 1 + pushBoost

        let extCount = 0
        for (const [tip, pip, mcp] of FINGER_TIPS) {
          if (isFingerExtended(lm, tip, pip)) {
            extCount++
            let dx = lm[tip].x - lm[mcp].x
            let dy = lm[tip].y - lm[mcp].y
            const dl = Math.sqrt(dx * dx + dy * dy) || 1e-4
            emitters.push({ x: lm[tip].x, y: lm[tip].y, dx: dx / dl, dy: dy / dl, power })
          }
        }

        if (extCount >= 4) {
          let dx = lm[9].x - lm[0].x
          let dy = lm[9].y - lm[0].y
          const dl = Math.sqrt(dx * dx + dy * dy) || 1e-4
          emitters.push({ x: lm[9].x, y: lm[9].y, dx: dx / dl, dy: dy / dl, power: power * 1.15 })
          if (pushBoost > 0.4) {
            const bursts = 7
            for (let k = 0; k < bursts; k++) {
              const a = (k / bursts) * Math.PI * 2 + T
              emitters.push({ x: lm[9].x, y: lm[9].y, dx: Math.cos(a), dy: Math.sin(a), power: power * 1.1 })
            }
          }
        }
      }

      if (hands.length === 2) {
        bolt(
          hands[0].landmarks[8].x,
          hands[0].landmarks[8].y,
          hands[1].landmarks[8].x,
          hands[1].landmarks[8].y,
          2,
          77,
          1.5,
          baseW * 1.6,
          30
        )
      }
    } else {
      const pointers = getPointers().filter((p) => p.active)
      for (let pi = 0; pi < pointers.length; pi++) {
        const ptr = pointers[pi]
        const tr = tracks.current[pi]
        let speed = 0
        if (tr.init) speed = Math.hypot(ptr.x - tr.x, ptr.y - tr.y) / dt
        tr.x = ptr.x
        tr.y = ptr.y
        tr.init = true
        const power = 1 + Math.min(1.8, speed * 0.7)
        const count = 6
        for (let k = 0; k < count; k++) {
          const a = (k / count) * Math.PI * 2 + T * 0.6
          emitters.push({ x: ptr.x, y: ptr.y, dx: Math.cos(a), dy: Math.sin(a), power })
        }
      }
    }

    // dibuja rayos: potencia -> grosor y velocidad de parpadeo
    for (let i = 0; i < emitters.length; i++) {
      const e = emitters[i]
      const reach = REACH * e.power * (0.7 + Math.random() * 0.5)
      const bright = Math.min(1.8, 0.85 + (e.power - 1) * 0.7)
      const halfW = baseW * (0.8 + (e.power - 1) * 1.6) // mas grueso al empujar
      const flick = 22 + (e.power - 1) * 40 // mas rapido al empujar
      bolt(e.x, e.y, e.x + e.dx * reach, e.y + e.dy * reach, e.power > 1.4 ? 3 : 2, i * 3.7 + T, bright, halfW, flick)
      addGlow(e.x, e.y, bright)
    }

    const geo = meshRef.current?.geometry
    if (geo) {
      geo.attributes.position.needsUpdate = true
      geo.attributes.color.needsUpdate = true
      geo.setDrawRange(0, vRef.current / 3)
    }
    const glowGeo = glowRef.current?.geometry
    if (glowGeo) {
      for (let i = glowN; i < 16; i++) glowPos[i * 3 + 2] = -9999
      glowGeo.attributes.position.needsUpdate = true
      glowGeo.attributes.color.needsUpdate = true
      glowGeo.setDrawRange(0, glowN)
    }

    const sp = sparks.current
    for (let i = sp.length - 1; i >= 0; i--) {
      const s = sp[i]
      s.x += s.vx
      s.y += s.vy
      s.vy += 0.0005
      s.life -= 0.05
      if (s.life <= 0) sp.splice(i, 1)
    }
    for (let i = 0; i < MAX_SPARKS; i++) {
      const s = sp[i]
      if (s) {
        sparkPos[i * 3] = toWX(s.x)
        sparkPos[i * 3 + 1] = toWY(s.y)
        sparkPos[i * 3 + 2] = 0
        blue(0.6 + s.life * 0.4, tmp)
        sparkCol[i * 3] = tmp.r * s.life
        sparkCol[i * 3 + 1] = tmp.g * s.life
        sparkCol[i * 3 + 2] = tmp.b * s.life
      } else {
        sparkPos[i * 3 + 2] = -9999
      }
    }
    const sgeo = sparksRef.current?.geometry
    if (sgeo) {
      sgeo.attributes.position.needsUpdate = true
      sgeo.attributes.color.needsUpdate = true
      sgeo.setDrawRange(0, Math.min(sp.length, MAX_SPARKS))
    }

    setParticleCount(Math.round(vRef.current / 18) + sp.length)
  })

  return (
    <group>
      <mesh ref={meshRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[triPos, 3]} count={MAXV} />
          <bufferAttribute attach="attributes-color" args={[triCol, 3]} count={MAXV} />
        </bufferGeometry>
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0.96}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <points ref={glowRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[glowPos, 3]} count={16} />
          <bufferAttribute attach="attributes-color" args={[glowCol, 3]} count={16} />
        </bufferGeometry>
        <pointsMaterial
          size={0.6}
          vertexColors
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
        />
      </points>

      <points ref={sparksRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[sparkPos, 3]} count={MAX_SPARKS} />
          <bufferAttribute attach="attributes-color" args={[sparkCol, 3]} count={MAX_SPARKS} />
        </bufferGeometry>
        <pointsMaterial
          size={0.15}
          vertexColors
          transparent
          opacity={0.95}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation
        />
      </points>
    </group>
  )
}