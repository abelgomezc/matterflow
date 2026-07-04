// MatterFlow - plasma: arcos electricos entre dedos/punteros. (c) 2026 Abel Gomez
// Rayos jagged (Bezier + ruido) siguen las puntas de los dedos; entre dos manos
// se forma un arco principal. Chispas secundarias vuelan desde los arcos.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { getPointers } from '../../store/pointerBus'
import { useMatterStore } from '../../store/matterStore'
import { handLandmarksBus } from '../camera/HandTracker'
import { plasmaColor } from '../../utils/colorUtils'

const MAX_VERTS = 4000 // pares para LineSegments
const SEGMENTS = 16
const FINGER_TIPS = [4, 8, 12, 16, 20]
const MAX_SPARKS = 320

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  life: number
}

// pseudo-ruido barato (suma de senos) en funcion de t
const noise = (t: number): number =>
  Math.sin(t * 12.9898) * 0.5 + Math.sin(t * 7.233 + 1.7) * 0.3 + Math.sin(t * 19.19) * 0.2

export default function PlasmaSystem() {
  const { viewport } = useThree()
  const linesRef = useRef<THREE.LineSegments>(null)
  const sparksRef = useRef<THREE.Points>(null)
  const setParticleCount = useMatterStore((s) => s.setParticleCount)

  const linePos = useMemo(() => new Float32Array(MAX_VERTS * 3), [])
  const lineCol = useMemo(() => new Float32Array(MAX_VERTS * 3), [])
  const sparkPos = useMemo(() => new Float32Array(MAX_SPARKS * 3), [])
  const sparkCol = useMemo(() => new Float32Array(MAX_SPARKS * 3), [])
  const sparks = useRef<Spark[]>([])
  const tmpColor = useMemo(() => new THREE.Color(), [])
  const clock = useRef(0)

  useEffect(() => {
    sparks.current = []
    setParticleCount(0)
  }, [setParticleCount])

  useFrame((_, delta) => {
    clock.current += delta
    const T = clock.current
    const w = viewport.width
    const h = viewport.height

    // origen y destinos de arcos en coords normalizadas
    const arcs: { ax: number; ay: number; bx: number; by: number; intensity: number }[] = []

    const hands = handLandmarksBus.hands
    if (hands.length > 0) {
      for (const hand of hands) {
        const lm = hand.landmarks
        const wrist = lm[0]
        for (const tip of FINGER_TIPS) {
          arcs.push({
            ax: wrist.x,
            ay: wrist.y,
            bx: lm[tip].x,
            by: lm[tip].y,
            intensity: 0.9,
          })
        }
      }
      // arco principal entre dos manos
      if (hands.length === 2) {
        arcs.push({
          ax: hands[0].landmarks[8].x,
          ay: hands[0].landmarks[8].y,
          bx: hands[1].landmarks[8].x,
          by: hands[1].landmarks[8].y,
          intensity: 1.4,
        })
      }
    } else {
      // fallback: arcos desde el centro hacia cada puntero
      const pointers = getPointers().filter((p) => p.active)
      for (const ptr of pointers) {
        for (let k = 0; k < 3; k++) {
          arcs.push({
            ax: 0.5,
            ay: 0.5,
            bx: ptr.x + (Math.random() - 0.5) * 0.05,
            by: ptr.y + (Math.random() - 0.5) * 0.05,
            intensity: 0.8 + k * 0.1,
          })
        }
      }
    }

    // construir segmentos jagged
    let v = 0
    const toWorldX = (nx: number) => (nx - 0.5) * w
    const toWorldY = (ny: number) => (0.5 - ny) * h

    for (let ai = 0; ai < arcs.length; ai++) {
      const arc = arcs[ai]
      const dx = arc.bx - arc.ax
      const dy = arc.by - arc.ay
      const len = Math.sqrt(dx * dx + dy * dy) || 1e-4
      // perpendicular unitario para el desplazamiento del rayo
      const nx = -dy / len
      const ny = dx / len

      let prevX = arc.ax
      let prevY = arc.ay
      for (let s = 1; s <= SEGMENTS; s++) {
        const t = s / SEGMENTS
        const jitter =
          s === SEGMENTS
            ? 0
            : noise(ai * 3.1 + t * 6 + T * 4) * 0.06 * Math.sin(t * Math.PI)
        const cx = arc.ax + dx * t + nx * jitter
        const cy = arc.ay + dy * t + ny * jitter
        if (v + 6 <= MAX_VERTS * 3) {
          linePos[v] = toWorldX(prevX)
          linePos[v + 1] = toWorldY(prevY)
          linePos[v + 2] = 0
          linePos[v + 3] = toWorldX(cx)
          linePos[v + 4] = toWorldY(cy)
          linePos[v + 5] = 0
          plasmaColor(0.5 + 0.5 * t + arc.intensity * 0.1, tmpColor)
          for (let c = 0; c < 6; c += 3) {
            lineCol[v + c] = tmpColor.r
            lineCol[v + c + 1] = tmpColor.g
            lineCol[v + c + 2] = tmpColor.b
          }
          v += 6
        }
        prevX = cx
        prevY = cy
      }

      // spawn de chispas en la punta
      if (Math.random() < 0.4 && sparks.current.length < MAX_SPARKS) {
        sparks.current.push({
          x: arc.bx,
          y: arc.by,
          vx: (Math.random() - 0.5) * 0.01,
          vy: (Math.random() - 0.5) * 0.01,
          life: 1,
        })
      }
    }

    const geo = linesRef.current?.geometry
    if (geo) {
      geo.attributes.position.needsUpdate = true
      geo.attributes.color.needsUpdate = true
      geo.setDrawRange(0, v / 3)
    }

    // actualizar chispas
    const sp = sparks.current
    for (let i = sp.length - 1; i >= 0; i--) {
      const s = sp[i]
      s.x += s.vx
      s.y += s.vy
      s.vy += 0.0004
      s.life -= 0.03
      if (s.life <= 0) sp.splice(i, 1)
    }
    for (let i = 0; i < MAX_SPARKS; i++) {
      const s = sp[i]
      if (s) {
        sparkPos[i * 3] = toWorldX(s.x)
        sparkPos[i * 3 + 1] = toWorldY(s.y)
        sparkPos[i * 3 + 2] = 0
        plasmaColor(0.6 + s.life * 0.4, tmpColor)
        sparkCol[i * 3] = tmpColor.r * s.life
        sparkCol[i * 3 + 1] = tmpColor.g * s.life
        sparkCol[i * 3 + 2] = tmpColor.b * s.life
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

    setParticleCount(v / 6 + sp.length)
  })

  return (
    <group>
      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[linePos, 3]}
            count={MAX_VERTS}
          />
          <bufferAttribute attach="attributes-color" args={[lineCol, 3]} count={MAX_VERTS} />
        </bufferGeometry>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          depthWrite={false}
        />
      </lineSegments>

      <points ref={sparksRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[sparkPos, 3]}
            count={MAX_SPARKS}
          />
          <bufferAttribute attach="attributes-color" args={[sparkCol, 3]} count={MAX_SPARKS} />
        </bufferGeometry>
        <pointsMaterial
          size={0.12}
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