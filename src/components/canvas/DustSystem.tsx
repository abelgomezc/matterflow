// MatterFlow - esfera de polvo luminosa (modo "Polvo"). (c) 2026 Abel Gomez
// Nube volumetrica 3D de miles de puntos cyan con borde brillante (Fresnel),
// bloom y turbulencia suave. Crece al abrir la palma, se disuelve al cerrarla.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { handLandmarksBus } from '../camera/HandTracker'
import { getPointers } from '../../store/pointerBus'
import { useMatterStore } from '../../store/matterStore'
import { dist2D } from '../../utils/handUtils'
import { colorByDustCyan } from '../../utils/colorUtils'
import { glowSprite } from '../../utils/textures'
import type { HandData } from '../../hooks/useHandTracking'
import type { Landmark } from '../../types/hand.types'

const MAX_GRAINS = 11000
const MIN_RADIUS = 0.55
const MAX_RADIUS = 2.85

const SPRING = 16
const DAMPING = 0.86
const TURBULENCE = 1.35
const SWIRL = 0.38

interface HandInfo {
  open: boolean
  x: number
  y: number
  openness: number
}

interface DustGrain {
  dirX: number
  dirY: number
  dirZ: number
  radial: number
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  size: number
  colorT: number
  seed: number
}

const fingerExtended = (l: Landmark[], tip: number, pip: number) =>
  dist2D(l[0], l[tip]) > dist2D(l[0], l[pip]) * 1.12

const readHand = (hand: HandData, vw: number, vh: number): HandInfo => {
  const l = hand.landmarks
  const cx = (l[0].x + l[9].x) / 2
  const cy = (l[0].y + l[9].y) / 2
  const handLen = Math.max(dist2D(l[0], l[9]), 0.04)
  const spread = dist2D(l[4], l[8]) / handLen
  const ext =
    [
      fingerExtended(l, 8, 6),
      fingerExtended(l, 12, 10),
      fingerExtended(l, 16, 14),
      fingerExtended(l, 20, 18),
    ].filter(Boolean).length / 4
  const open = ext > 0.6
  return {
    open,
    x: (cx - 0.5) * vw,
    y: (0.5 - cy) * vh,
    openness: Math.max(0, Math.min(1, spread * 0.7 + ext * 0.5)),
  }
}

const dustNoise = (x: number, y: number, z: number, t: number, seed: number): number =>
  Math.sin(x * 1.7 + seed + t * 0.9) * 0.45 +
  Math.sin(y * 2.1 - seed * 1.3 + t * 1.1) * 0.35 +
  Math.sin(z * 1.9 + seed * 0.7 - t * 0.8) * 0.35 +
  Math.sin((x + y + z) * 0.8 + t * 1.4) * 0.25

const makeGrain = (): DustGrain => {
  const theta = Math.random() * Math.PI * 2
  const phi = Math.acos(2 * Math.random() - 1)
  const sinP = Math.sin(phi)
  // sesgo hacia la corteza: borde mas denso y luminoso (efecto Fresnel)
  const radial = 0.42 + 0.58 * Math.pow(Math.random(), 0.48)
  return {
    dirX: sinP * Math.cos(theta),
    dirY: sinP * Math.sin(theta),
    dirZ: Math.cos(phi),
    radial,
    x: 0,
    y: 0,
    z: 0,
    vx: (Math.random() - 0.5) * 0.25,
    vy: (Math.random() - 0.5) * 0.25,
    vz: (Math.random() - 0.5) * 0.25,
    size: 0.08 + Math.random() * 0.28,
    colorT: Math.random(),
    seed: Math.random() * 100,
  }
}

export default function DustSystem() {
  const { viewport } = useThree()
  const setParticleCount = useMatterStore((s) => s.setParticleCount)
  const setCurrentGesture = useMatterStore((s) => s.setCurrentGesture)

  const grainsRef = useRef<DustGrain[]>([])
  const pointsRef = useRef<THREE.Points>(null)
  const radiusRef = useRef(0)
  const centerRef = useRef(new THREE.Vector3())
  const spinRef = useRef(0)
  const wasActiveRef = useRef(false)
  const lastStatus = useRef({ text: '', at: 0 })
  const tmpColor = useMemo(() => new THREE.Color(), [])

  const { positions, colors, sizes } = useMemo(
    () => ({
      positions: new Float32Array(MAX_GRAINS * 3),
      colors: new Float32Array(MAX_GRAINS * 3),
      sizes: new Float32Array(MAX_GRAINS),
    }),
    []
  )

  const sprite = useMemo(() => glowSprite(), [])

  useEffect(() => {
    grainsRef.current = Array.from({ length: MAX_GRAINS }, makeGrain)
  }, [])

  const status = (text: string, now = performance.now()) => {
    if (lastStatus.current.text !== text || now - lastStatus.current.at > 350) {
      lastStatus.current = { text, at: now }
      setCurrentGesture(text)
    }
  }

  const resolveTarget = (vw: number, vh: number): HandInfo | null => {
    const hands = handLandmarksBus.hands
    if (hands.length > 0) {
      const open = hands.map((h) => readHand(h, vw, vh)).filter((i) => i.open)
      return open[0] ?? null
    }
    const ptr = getPointers().find((p) => p.active)
    if (!ptr) return null
    return {
      open: true,
      x: (ptr.x - 0.5) * vw,
      y: (0.5 - ptr.y) * vh,
      openness: 0.5 + ptr.intensity * 0.4,
    }
  }

  useFrame((state, delta) => {
    const { width: vw, height: vh } = viewport
    const dt = Math.min(delta, 0.033)
    const t = state.clock.elapsedTime
    const target = resolveTarget(vw, vh)

    if (target) {
      const goal = MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * target.openness
      radiusRef.current += (goal - radiusRef.current) * Math.min(1, dt * 4)
      centerRef.current.x += (target.x - centerRef.current.x) * Math.min(1, dt * 8)
      centerRef.current.y += (target.y - centerRef.current.y) * Math.min(1, dt * 8)
    } else {
      radiusRef.current += (0 - radiusRef.current) * Math.min(1, dt * 3)
    }

    const r = radiusRef.current
    const active = r > 0.06
    const cx = centerRef.current.x
    const cy = centerRef.current.y
    const cz = 0

    if (active && !wasActiveRef.current) {
      for (const g of grainsRef.current) {
        const shellR = r * g.radial * 0.12
        g.x = cx + g.dirX * shellR
        g.y = cy + g.dirY * shellR
        g.z = cz + g.dirZ * shellR
        g.vx = 0
        g.vy = 0
        g.vz = 0
      }
    }
    wasActiveRef.current = active

    if (active) spinRef.current += dt * 0.22

    const cosS = Math.cos(spinRef.current)
    const sinS = Math.sin(spinRef.current)
    const grains = grainsRef.current
    let visible = 0

    for (let i = 0; i < grains.length; i += 1) {
      const g = grains[i]

      if (!active) {
        const fade = Math.min(1, r / MIN_RADIUS)
        if (fade < 0.04) continue

        g.vx += g.dirX * dt * 2.4
        g.vy += g.dirY * dt * 2.4
        g.vz += g.dirZ * dt * 2.4
        g.vx *= 0.94
        g.vy *= 0.94
        g.vz *= 0.94
        g.x += g.vx * dt
        g.y += g.vy * dt
        g.z += g.vz * dt

        const rim = Math.pow(g.radial, 0.28)
        colorByDustCyan(rim * 0.9, tmpColor)
        positions[i * 3] = g.x
        positions[i * 3 + 1] = g.y
        positions[i * 3 + 2] = g.z
        colors[i * 3] = tmpColor.r * fade
        colors[i * 3 + 1] = tmpColor.g * fade
        colors[i * 3 + 2] = tmpColor.b * fade
        sizes[i] = g.size * (0.35 + rim * 0.9) * fade
        visible += 1
        continue
      }

      let dx = g.dirX
      let dy = g.dirY
      const rx = dx * cosS - dy * sinS
      const ry = dx * sinS + dy * cosS
      dx = rx
      dy = ry
      const dz = g.dirZ

      const wobble = 1 + 0.04 * dustNoise(dx, dy, dz, t, g.seed)
      const shellR = r * g.radial * wobble
      const tx = cx + dx * shellR
      const ty = cy + dy * shellR
      const tz = cz + dz * shellR

      const sx = (tx - g.x) * SPRING
      const sy = (ty - g.y) * SPRING
      const sz = (tz - g.z) * SPRING

      const turb = TURBULENCE * (0.25 + g.radial * 0.75)
      const nx = dustNoise(g.x, g.y, g.z, t, g.seed)
      const ny = dustNoise(g.y, g.z, g.x, t, g.seed + 17)
      const nz = dustNoise(g.z, g.x, g.y, t, g.seed + 31)

      const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1
      const tangX = -dy / len
      const tangY = dx / len

      g.vx += (sx + nx * turb + tangX * SWIRL * g.radial) * dt
      g.vy += (sy + ny * turb + tangY * SWIRL * g.radial) * dt
      g.vz += (sz + nz * turb) * dt
      g.vx *= DAMPING
      g.vy *= DAMPING
      g.vz *= DAMPING
      g.x += g.vx * dt
      g.y += g.vy * dt
      g.z += g.vz * dt

      positions[i * 3] = g.x
      positions[i * 3 + 1] = g.y
      positions[i * 3 + 2] = g.z

      // Fresnel: borde brillante, centro mas tenue (como la referencia)
      const rim = Math.pow(g.radial, 0.26)
      const colorMix = rim * 0.82 + g.colorT * 0.18
      colorByDustCyan(colorMix, tmpColor)
      const bright = 0.18 + rim * 0.82
      colors[i * 3] = tmpColor.r * bright
      colors[i * 3 + 1] = tmpColor.g * bright
      colors[i * 3 + 2] = tmpColor.b * bright
      sizes[i] = g.size * (0.35 + rim * 1.45)
      visible += 1
    }

    for (let i = visible; i < MAX_GRAINS; i += 1) {
      positions[i * 3 + 2] = -9999
    }

    const geom = pointsRef.current?.geometry
    if (geom) {
      geom.attributes.position.needsUpdate = true
      geom.attributes.color.needsUpdate = true
      ;(geom.attributes.size as THREE.BufferAttribute).needsUpdate = true
      geom.setDrawRange(0, visible)
    }

    setParticleCount(active ? visible : Math.min(visible, 800))

    if (active) {
      status(`Esfera de polvo: ${((r / MAX_RADIUS) * 100).toFixed(0)}%`)
    } else if (handLandmarksBus.hands.length > 0) {
      status('Abre la palma para invocar la esfera')
    } else {
      status('Abre la palma frente a la camara')
    }
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={MAX_GRAINS} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} count={MAX_GRAINS} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} count={MAX_GRAINS} />
      </bufferGeometry>
      <pointsMaterial
        size={0.028}
        map={sprite}
        vertexColors
        transparent
        opacity={1}
        depthWrite={false}
        depthTest
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  )
}
