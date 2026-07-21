// MatterFlow - motor de fisica de particulas via useRef (sin re-renders).
// (c) 2026 Abel Gomez
import { useRef, useCallback } from 'react'
import type { Particle, Pointer } from '../types/matter.types'
import {
  PHYSICS,
  createParticle,
  integrateParticle,
  applyHandForce,
  applyParticleInteraction,
} from '../utils/physicsUtils'

export interface ParticlePhysics {
  particles: React.MutableRefObject<Particle[]>
  init: (count: number, w: number, h: number) => void
  step: (pointers: Pointer[], w: number, h: number, handsDetected?: number) => void
}

export const useParticlePhysics = (): ParticlePhysics => {
  const particles = useRef<Particle[]>([])
  const frame = useRef(0)

  const init = useCallback((count: number, w: number, h: number) => {
    const arr: Particle[] = new Array(count)
    for (let i = 0; i < count; i++) arr[i] = createParticle(w, h)
    particles.current = arr
  }, [])

  const step = useCallback(
    (pointers: Pointer[], w: number, h: number, handsDetected = 0) => {
      const arr = particles.current
      frame.current += 1

      if (handsDetected <= 0) {
        if (arr.length === 0) return
        const cx = w * 0.5
        const cy = h * 0.5
        for (let i = 0; i < arr.length; i++) {
          const p = arr[i]
          const dx = p.x - cx
          const dy = p.y - cy
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          p.vx += (dx / dist) * 0.55 + (Math.random() - 0.5) * 0.8
          p.vy += (dy / dist) * 0.55 + (Math.random() - 0.5) * 0.8
          p.vz += (Math.random() - 0.5) * 0.28
          p.energy = Math.max(p.energy, 0.75)
          integrateParticle(p, w, h, 0.006)
        }
        arr.splice(0, Math.max(1, Math.ceil(arr.length * 0.028)))
        return
      }

      const activeHands = pointers.filter((ptr) => ptr.active).slice(0, handsDetected)
      if (activeHands.length === 0) return

      const targetCount = Math.min(900, 360 * activeHands.length)
      const spawnCount = Math.min(28 * activeHands.length, targetCount - arr.length)
      for (let k = 0; k < spawnCount; k++) {
        const ptr = activeHands[k % activeHands.length]
        const p = createParticle(w, h)
        p.x = ptr.x * w + (Math.random() - 0.5) * 260
        p.y = ptr.y * h + (Math.random() - 0.5) * 260
        p.z = (Math.random() - 0.5) * 90
        p.vx = (Math.random() - 0.5) * 7
        p.vy = (Math.random() - 0.5) * 7
        p.vz = (Math.random() - 0.5) * 1.2
        p.energy = 1
        arr.push(p)
      }
      if (arr.length > targetCount) arr.splice(0, arr.length - targetCount)

      for (let i = 0; i < arr.length; i++) {
        const p = arr[i]
        const hand = activeHands[i % activeHands.length]
        const hx = hand.x * w
        const hy = hand.y * h
        if (hand.mode !== 'create') {
          applyHandForce(p, hx, hy, hand.mode, hand.intensity)
        }
        const phase = i * 2.399963 + frame.current * 0.025
        const band = ((i * 37) % 100) / 100
        const radius = 86 + band * 64
        const sx = Math.cos(phase) * radius * Math.sin(band * Math.PI)
        const sy = Math.sin(phase * 0.92) * radius * 0.72
        const sz = Math.cos(band * Math.PI * 2 + frame.current * 0.018) * 44
        const tx = hx + sx
        const ty = hy + sy
        p.vx += (tx - p.x) * 0.012
        p.vy += (ty - p.y) * 0.012
        p.vz += (sz - p.z) * 0.018
        p.energy = Math.max(p.energy, 0.45 + hand.intensity * 0.35)
      }

      for (const ptr of activeHands) {
        if (ptr.mode !== 'create') continue
        const hx = ptr.x * w
        const hy = ptr.y * h
        for (let k = 0; k < 3; k++) {
          const p = createParticle(w, h)
          p.x = hx + (Math.random() - 0.5) * 24
          p.y = hy + (Math.random() - 0.5) * 24
          p.vx = (Math.random() - 0.5) * 6
          p.vy = (Math.random() - 0.5) * 6
          p.energy = 1
          arr.push(p)
        }
      }
      if (arr.length > targetCount) arr.splice(0, arr.length - targetCount)

      // interaccion leve entre particulas (muestreo para O(n) barato)
      if (PHYSICS.PARTICLE_INTERACTION > 0) {
        for (let i = 0; i < arr.length; i++) {
          const j = (i + 7) % arr.length
          if (i !== j) applyParticleInteraction(arr[i], arr[j])
        }
      }

      // integracion
      for (let i = 0; i < arr.length; i++) {
        integrateParticle(arr[i], w, h)
      }
    },
    []
  )

  return { particles, init, step }
}
