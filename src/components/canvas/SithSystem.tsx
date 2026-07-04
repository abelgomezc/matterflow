// MatterFlow - RAYOS SITH. (c) 2026 Abel Gomez
// Relampagos azul-blanco ramificados que se disparan desde las puntas de los
// dedos hacia afuera (direccion muneca->dedo). Entre dos manos se forma un
// arco principal. Chispas crepitantes en las puntas.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { getPointers } from '../../store/pointerBus'
import { useMatterStore } from '../../store/matterStore'
import { handLandmarksBus } from '../camera/HandTracker'
import { sithColor } from '../../utils/colorUtils'

const MAX_VERTS = 9000 // pares (LineSegments)
const MAX_SPARKS = 400
const FINGER_TIPS = [4, 8, 12, 16, 20]
const REACH = 0.42 // alcance del rayo en coords normalizadas

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  life: number
}

export default function SithSystem() {
  const { viewport } = useThree()
  const linesRef = useRef<THREE.LineSegments>(null)
  const sparksRef = useRef<THREE.Points>(null)
  const setParticleCount = useMatterStore((s) => s.setParticleCount)

  const linePos = useMemo(() => new Float32Array(MAX_VERTS * 3), [])
  const lineCol = useMemo(() => new Float32Array(MAX_VERTS * 3), [])
  const sparkPos = useMemo(() => new Float32Array(MAX_SPARKS * 3), [])
  const sparkCol = useMemo(() => new Float32Array(MAX_SPARKS * 3), [])
  const sparks = useRef<Spark[]>([])
  const tmp = useMemo(() => new THREE.Color(), [])
  const clock = useRef(0)
  const vRef = useRef(0)

  useEffect(() => {
    sparks.current = []
    setParticleCount(0)
  }, [setParticleCount])

  useFrame((_, delta) => {
    clock.current += delta
    const T = clock.current
    const w = viewport.width
    const h = viewport.height
    vRef.current = 0

    const toWX = (nx: number) => (nx - 0.5) * w
    const toWY = (ny: number) => (0.5 - ny) * h

    const pushSeg = (x1: number, y1: number, x2: number, y2: number, t: number) => {
      const v = vRef.current
      if (v + 6 > MAX_VERTS * 3) return
      linePos[v] = toWX(x1)
      linePos[v + 1] = toWY(y1)
      linePos[v + 2] = 0
      linePos[v + 3] = toWX(x2)
      linePos[v + 4] = toWY(y2)
      linePos[v + 5] = 0
      sithColor(t, tmp)
      for (let c = 0; c < 6; c += 3) {
        lineCol[v + c] = tmp.r
        lineCol[v + c + 1] = tmp.g
        lineCol[v + c + 2] = tmp.b
      }
      vRef.current = v + 6
    }

    // dibuja un rayo jagged de A a B, con ramas recursivas
    const bolt = (
      ax: number,
      ay: number,
      bx: number,
      by: number,
      thicknessT: number,
      branch: number,
      seed: number
    ) => {
      const dx = bx - ax
      const dy = by - ay
      const len = Math.sqrt(dx * dx + dy * dy) || 1e-4
      const nx = -dy / len
      const ny = dx / len
      const steps = 8
      let px = ax
      let py = ay
      for (let s = 1; s <= steps; s++) {
        const tt = s / steps
        const jitter =
          s === steps
            ? 0
            : (Math.sin(seed + s * 4.1 + T * 22) * 0.5 + Math.sin(seed * 2 + s * 9) * 0.5) *
              0.05 *
              len *
              4
        const cx = ax + dx * tt + nx * jitter
        const cy = ay + dy * tt + ny * jitter
        pushSeg(px, py, cx, cy, 0.55 + thicknessT * 0.35 + tt * 0.1)
        // ramas
        if (branch > 0 && s > 1 && s < steps && Math.random() < 0.35) {
          const blen = len * (0.25 + Math.random() * 0.3)
          const ang = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.6
          bolt(
            cx,
            cy,
            cx + Math.cos(ang) * blen,
            cy + Math.sin(ang) * blen,
            thicknessT * 0.6,
            branch - 1,
            seed + 13.7
          )
        }
        px = cx
        py = cy
      }
      // chispa en la punta
      if (Math.random() < 0.5 && sparks.current.length < MAX_SPARKS) {
        sparks.current.push({
          x: bx,
          y: by,
          vx: (Math.random() - 0.5) * 0.015,
          vy: (Math.random() - 0.5) * 0.015,
          life: 1,
        })
      }
    }

    const hands = handLandmarksBus.hands
    if (hands.length > 0) {
      for (const hand of hands) {
        const lm = hand.landmarks
        const wrist = lm[0]
        for (const tip of FINGER_TIPS) {
          const p = lm[tip]
          let dirx = p.x - wrist.x
          let diry = p.y - wrist.y
          const dl = Math.sqrt(dirx * dirx + diry * diry) || 1e-4
          dirx /= dl
          diry /= dl
          const reach = REACH * (0.6 + Math.random() * 0.6)
          bolt(p.x, p.y, p.x + dirx * reach, p.y + diry * reach, 1, 2, tip * 1.3)
        }
      }
      // arco principal entre dos manos (indice a indice)
      if (hands.length === 2) {
        bolt(
          hands[0].landmarks[8].x,
          hands[0].landmarks[8].y,
          hands[1].landmarks[8].x,
          hands[1].landmarks[8].y,
          1.4,
          2,
          99
        )
      }
    } else {
      // fallback: dispara rayos desde cada puntero hacia afuera
      const pointers = getPointers().filter((p) => p.active)
      for (const ptr of pointers) {
        for (let k = 0; k < 5; k++) {
          const ang = (k / 5) * Math.PI * 2 + T
          bolt(
            ptr.x,
            ptr.y,
            ptr.x + Math.cos(ang) * REACH,
            ptr.y + Math.sin(ang) * REACH,
            1,
            2,
            k * 7 + T
          )
        }
      }
    }

    const geo = linesRef.current?.geometry
    if (geo) {
      geo.attributes.position.needsUpdate = true
      geo.attributes.color.needsUpdate = true
      geo.setDrawRange(0, vRef.current / 3)
    }

    // chispas
    const sp = sparks.current
    for (let i = sp.length - 1; i >= 0; i--) {
      const s = sp[i]
      s.x += s.vx
      s.y += s.vy
      s.vy += 0.0005
      s.life -= 0.04
      if (s.life <= 0) sp.splice(i, 1)
    }
    for (let i = 0; i < MAX_SPARKS; i++) {
      const s = sp[i]
      if (s) {
        sparkPos[i * 3] = toWX(s.x)
        sparkPos[i * 3 + 1] = toWY(s.y)
        sparkPos[i * 3 + 2] = 0
        sithColor(0.6 + s.life * 0.4, tmp)
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

    setParticleCount(Math.round(vRef.current / 6) + sp.length)
  })

  return (
    <group>
      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[linePos, 3]} count={MAX_VERTS} />
          <bufferAttribute attach="attributes-color" args={[lineCol, 3]} count={MAX_VERTS} />
        </bufferGeometry>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.95}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          depthWrite={false}
        />
      </lineSegments>

      <points ref={sparksRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[sparkPos, 3]} count={MAX_SPARKS} />
          <bufferAttribute attach="attributes-color" args={[sparkCol, 3]} count={MAX_SPARKS} />
        </bufferGeometry>
        <pointsMaterial
          size={0.13}
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