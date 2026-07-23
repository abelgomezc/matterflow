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
  step: (pointers: Pointer[], w: number, h: number) => void
}

export const useParticlePhysics = (): ParticlePhysics => {
  const particles = useRef<Particle[]>([])

  const init = useCallback((count: number, w: number, h: number) => {
    const arr: Particle[] = new Array(count)
    for (let i = 0; i < count; i++) arr[i] = createParticle(w, h)
    particles.current = arr
  }, [])

  const step = useCallback(
    (pointers: Pointer[], w: number, h: number) => {
      const arr = particles.current
      if (arr.length === 0) return

      // fuerzas de cada puntero (mano/mouse)
      for (const ptr of pointers) {
        if (!ptr.active) continue
        const hx = ptr.x * w
        const hy = ptr.y * h

        if (ptr.mode === 'create') {
          // crea materia bajo la punta del dedo
          for (let k = 0; k < 3; k++) {
            const p = createParticle(w, h)
            p.x = hx + (Math.random() - 0.5) * 24
            p.y = hy + (Math.random() - 0.5) * 24
            p.vx = (Math.random() - 0.5) * 6
            p.vy = (Math.random() - 0.5) * 6
            p.energy = 1
            arr.push(p)
          }
          // limita el total para no degradar el rendimiento
          if (arr.length > 900) arr.splice(0, arr.length - 900)
          continue
        }

        for (let i = 0; i < arr.length; i++) {
          applyHandForce(arr[i], hx, hy, ptr.mode, ptr.intensity)
        }
      }

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
