// MatterFlow - sistema de particulas 3D (modo principal). (c) 2026 Abel Gomez
// Corre la fisica en espacio de pixeles (reusa physicsUtils) y mapea a
// coordenadas de mundo para renderizar con BufferGeometry + Points.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useParticlePhysics } from '../../hooks/useParticlePhysics'
import { getPointers } from '../../store/pointerBus'
import { useMatterStore } from '../../store/matterStore'
import { colorByEnergy } from '../../utils/colorUtils'
import { glowSprite } from '../../utils/textures'

const INITIAL = 380 // 300-500 particulas
const MAX = 1000
const TRAIL = 8

export default function ParticleSystem() {
  const { viewport } = useThree()
  const physics = useParticlePhysics()
  const setParticleCount = useMatterStore((s) => s.setParticleCount)

  const pointsRef = useRef<THREE.Points>(null)
  const trailRef = useRef<THREE.Points>(null)
  const countRef = useRef(0)

  // buffers reutilizables
  const { positions, colors, sizes, trailPos, trailCol } = useMemo(
    () => ({
      positions: new Float32Array(MAX * 3),
      colors: new Float32Array(MAX * 3),
      sizes: new Float32Array(MAX),
      trailPos: new Float32Array(MAX * TRAIL * 3),
      trailCol: new Float32Array(MAX * TRAIL * 3),
    }),
    []
  )

  const tmpColor = useMemo(() => new THREE.Color(), [])
  const sprite = useMemo(() => glowSprite(), [])

  // dimensiones del "canvas fisico" en pixeles
  const dims = useRef({ w: window.innerWidth, h: window.innerHeight })

  useEffect(() => {
    dims.current = { w: window.innerWidth, h: window.innerHeight }
    physics.init(INITIAL, dims.current.w, dims.current.h)
    const onResize = () => {
      dims.current = { w: window.innerWidth, h: window.innerHeight }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [physics])

  useFrame(() => {
    const { w, h } = dims.current
    physics.step(getPointers(), w, h)

    const arr = physics.particles.current
    const n = Math.min(arr.length, MAX)
    countRef.current = n

    for (let i = 0; i < n; i++) {
      const p = arr[i]
      // pixel -> mundo (y invertida: pantalla abajo = mundo abajo)
      const wx = (p.x / w - 0.5) * viewport.width
      const wy = (0.5 - p.y / h) * viewport.height
      const wz = p.z * 0.02

      positions[i * 3] = wx
      positions[i * 3 + 1] = wy
      positions[i * 3 + 2] = wz

      colorByEnergy(p.energy, tmpColor)
      colors[i * 3] = tmpColor.r
      colors[i * 3 + 1] = tmpColor.g
      colors[i * 3 + 2] = tmpColor.b

      sizes[i] = (p.r * 0.9 + p.energy * 4) * (viewport.width / w) * 12

      // trail (puntos desvanecidos)
      const t = p.trail
      for (let k = 0; k < TRAIL; k++) {
        const idx = (i * TRAIL + k) * 3
        const tp = t[t.length - 1 - k]
        if (tp) {
          trailPos[idx] = (tp.x / w - 0.5) * viewport.width
          trailPos[idx + 1] = (0.5 - tp.y / h) * viewport.height
          trailPos[idx + 2] = tp.z * 0.02
          const fade = (1 - k / TRAIL) * 0.5
          trailCol[idx] = tmpColor.r * fade
          trailCol[idx + 1] = tmpColor.g * fade
          trailCol[idx + 2] = tmpColor.b * fade
        } else {
          // fuera de pantalla
          trailPos[idx] = 0
          trailPos[idx + 1] = 0
          trailPos[idx + 2] = -9999
          trailCol[idx] = 0
          trailCol[idx + 1] = 0
          trailCol[idx + 2] = 0
        }
      }
    }
    // esconder particulas sobrantes
    for (let i = n; i < MAX; i++) {
      positions[i * 3 + 2] = -9999
    }

    const g = pointsRef.current?.geometry
    if (g) {
      g.attributes.position.needsUpdate = true
      g.attributes.color.needsUpdate = true
      ;(g.attributes.size as THREE.BufferAttribute).needsUpdate = true
      g.setDrawRange(0, n)
    }
    const tg = trailRef.current?.geometry
    if (tg) {
      tg.attributes.position.needsUpdate = true
      tg.attributes.color.needsUpdate = true
      tg.setDrawRange(0, n * TRAIL)
    }

    setParticleCount(n)
  })

  return (
    <group>
      {/* Trails */}
      <points ref={trailRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[trailPos, 3]}
            count={MAX * TRAIL}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[trailCol, 3]}
            count={MAX * TRAIL}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.06}
          map={sprite}
          vertexColors
          transparent
          opacity={0.6}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>

      {/* Particulas principales */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
            count={MAX}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[colors, 3]}
            count={MAX}
          />
          <bufferAttribute attach="attributes-size" args={[sizes, 1]} count={MAX} />
        </bufferGeometry>
        <pointsMaterial
          size={0.14}
          vertexColors
          transparent
          opacity={0.95}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          sizeAttenuation
        />
      </points>
    </group>
  )
}