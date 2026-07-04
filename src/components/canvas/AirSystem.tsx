// MatterFlow - elemento AIRE (realista). (c) 2026 Abel Gomez
// Neblina/corrientes arrastradas por un campo de flujo (curl-noise) que forma
// remolinos. Particulas suaves de tamano variable; la mano genera rafagas.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { getPointers } from '../../store/pointerBus'
import { useMatterStore } from '../../store/matterStore'
import { airColor } from '../../utils/colorUtils'
import { makeSoftPointsMaterial } from '../../utils/pointsMaterial'

const COUNT = 700

const field = (x: number, y: number, t: number): number =>
  Math.sin(x * 6.0 + t * 0.6) * Math.cos(y * 5.0 - t * 0.5) +
  0.5 * Math.sin(x * 11.0 - t * 0.9) * Math.cos(y * 9.0 + t * 0.7)

const curl = (x: number, y: number, t: number): [number, number] => {
  const e = 0.001
  const dphidy = (field(x, y + e, t) - field(x, y - e, t)) / (2 * e)
  const dphidx = (field(x + e, y, t) - field(x - e, y, t)) / (2 * e)
  return [dphidy, -dphidx]
}

interface Wisp {
  x: number
  y: number
  vx: number
  vy: number
  base: number
}

export default function AirSystem() {
  const { viewport } = useThree()
  const pointsRef = useRef<THREE.Points>(null)
  const setParticleCount = useMatterStore((s) => s.setParticleCount)

  const wisps = useRef<Wisp[]>([])
  const positions = useMemo(() => new Float32Array(COUNT * 3), [])
  const aColor = useMemo(() => new Float32Array(COUNT * 3), [])
  const aSize = useMemo(() => new Float32Array(COUNT), [])
  const material = useMemo(() => makeSoftPointsMaterial(), [])
  const tmp = useMemo(() => new THREE.Color(), [])
  const clock = useRef(0)

  useEffect(() => {
    const arr: Wisp[] = new Array(COUNT)
    for (let i = 0; i < COUNT; i++) {
      arr[i] = { x: Math.random(), y: Math.random(), vx: 0, vy: 0, base: 0.4 + Math.random() * 1.3 }
    }
    wisps.current = arr
    setParticleCount(COUNT)
  }, [setParticleCount])

  useFrame((_, delta) => {
    clock.current += delta
    const T = clock.current
    const arr = wisps.current
    const pointers = getPointers().filter((p) => p.active)
    const scale = Math.max(viewport.width, viewport.height)

    for (let i = 0; i < arr.length; i++) {
      const w = arr[i]
      const [fx, fy] = curl(w.x, w.y, T)
      w.vx += fx * 0.00035
      w.vy += fy * 0.00035

      for (const ptr of pointers) {
        const dx = w.x - ptr.x
        const dy = w.y - ptr.y
        const d2 = dx * dx + dy * dy
        if (d2 < 0.06 && d2 > 1e-6) {
          const d = Math.sqrt(d2)
          const f = (0.06 - d2) * 1.3
          if (ptr.mode === 'repel') {
            w.vx += (dx / d) * f
            w.vy += (dy / d) * f
          } else {
            w.vx += (-dy / d) * f
            w.vy += (dx / d) * f
          }
        }
      }

      w.vx *= 0.95
      w.vy *= 0.95
      w.x += w.vx
      w.y += w.vy

      if (w.x < 0) w.x += 1
      else if (w.x > 1) w.x -= 1
      if (w.y < 0) w.y += 1
      else if (w.y > 1) w.y -= 1

      positions[i * 3] = (w.x - 0.5) * viewport.width
      positions[i * 3 + 1] = (0.5 - w.y) * viewport.height
      positions[i * 3 + 2] = 0

      const speed = Math.sqrt(w.vx * w.vx + w.vy * w.vy)
      airColor(Math.min(1, speed * 55), tmp)
      const a = 0.12 + Math.min(speed * 45, 0.5)
      aColor[i * 3] = tmp.r * a
      aColor[i * 3 + 1] = tmp.g * a
      aColor[i * 3 + 2] = tmp.b * a
      aSize[i] = w.base * scale * 0.05
    }

    const g = pointsRef.current?.geometry
    if (g) {
      g.attributes.position.needsUpdate = true
      ;(g.attributes.aColor as THREE.BufferAttribute).needsUpdate = true
      ;(g.attributes.aSize as THREE.BufferAttribute).needsUpdate = true
    }
  })

  return (
    <points ref={pointsRef} material={material}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={COUNT} />
        <bufferAttribute attach="attributes-aColor" args={[aColor, 3]} count={COUNT} />
        <bufferAttribute attach="attributes-aSize" args={[aSize, 1]} count={COUNT} />
      </bufferGeometry>
    </points>
  )
}