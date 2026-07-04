// MatterFlow - motor de fisica de particulas. (c) 2026 Abel Gomez
import type { Particle } from '../types/matter.types'

export const PHYSICS = {
  GRAVITY: 0.015, // gravedad suave hacia abajo
  FRICTION: 0.97, // friccion del aire
  MAX_SPEED: 20, // velocidad maxima
  ATTRACT_FORCE: 0.06, // fuerza de atraccion
  REPEL_FORCE: 0.08, // fuerza de repulsion
  VORTEX_FORCE: 0.05, // fuerza del vortex
  INFLUENCE_RADIUS: 250, // radio de influencia de la mano (px)
  TRAIL_LENGTH: 10, // largo del trail
  PARTICLE_INTERACTION: 0.001, // particulas se afectan entre si
} as const

export const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v))

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

export const rand = (min: number, max: number): number =>
  min + Math.random() * (max - min)

/** Crea una particula nueva dentro de los limites dados. */
export const createParticle = (w: number, h: number): Particle => ({
  x: rand(0, w),
  y: rand(0, h),
  z: rand(-40, 40),
  vx: rand(-1, 1),
  vy: rand(-1, 1),
  vz: rand(-0.4, 0.4),
  mass: rand(0.6, 1.4),
  r: rand(1.5, 3.5),
  energy: 0,
  frozen: false,
  frozenTimer: 0,
  trail: [],
})

/**
 * Aplica la fuerza de la mano (o puntero) a una particula segun el modo.
 * Coordenadas en pixeles del canvas.
 */
export const applyHandForce = (
  p: Particle,
  handX: number,
  handY: number,
  mode: string,
  intensity: number
): void => {
  const dx = handX - p.x
  const dy = handY - p.y
  const dist = Math.sqrt(dx * dx + dy * dy) || 1

  if (dist > PHYSICS.INFLUENCE_RADIUS) return

  const force = Math.min((200 / (dist * dist)) * 800 * intensity, 15)
  p.energy = clamp(force / 8, 0, 1)

  switch (mode) {
    case 'attract':
      p.vx += (dx / dist) * force * PHYSICS.ATTRACT_FORCE
      p.vy += (dy / dist) * force * PHYSICS.ATTRACT_FORCE
      break
    case 'repel':
      p.vx -= (dx / dist) * force * PHYSICS.REPEL_FORCE
      p.vy -= (dy / dist) * force * PHYSICS.REPEL_FORCE
      break
    case 'vortex':
      // componente tangencial (giro) + leve atraccion radial
      p.vx += (-dy / dist) * force * PHYSICS.VORTEX_FORCE
      p.vy += (dx / dist) * force * PHYSICS.VORTEX_FORCE
      p.vx += (dx / dist) * force * 0.02
      p.vy += (dy / dist) * force * 0.02
      break
    case 'freeze':
      if (dist < 120) {
        p.vx *= 0.85
        p.vy *= 0.85
        if (Math.abs(p.vx) < 0.1 && Math.abs(p.vy) < 0.1) {
          p.frozen = true
          p.frozenTimer = 180
        }
      }
      break
    // 'create' se maneja fuera (genera particulas nuevas)
  }
}

/**
 * Integra una particula un paso: gravedad, friccion, limite de velocidad,
 * rebote en bordes y trail. Modifica la particula in-place.
 */
export const integrateParticle = (
  p: Particle,
  w: number,
  h: number,
  gravity = PHYSICS.GRAVITY
): void => {
  if (p.frozen) {
    p.frozenTimer -= 1
    if (p.frozenTimer <= 0) p.frozen = false
    p.energy *= 0.96
    return
  }

  p.vy += gravity
  p.vx *= PHYSICS.FRICTION
  p.vy *= PHYSICS.FRICTION

  // limite de velocidad
  const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
  if (speed > PHYSICS.MAX_SPEED) {
    p.vx = (p.vx / speed) * PHYSICS.MAX_SPEED
    p.vy = (p.vy / speed) * PHYSICS.MAX_SPEED
  }

  p.x += p.vx
  p.y += p.vy
  p.z += p.vz
  p.vz *= 0.98

  // rebote en bordes
  const damp = 0.7
  if (p.x < p.r) {
    p.x = p.r
    p.vx = Math.abs(p.vx) * damp
  } else if (p.x > w - p.r) {
    p.x = w - p.r
    p.vx = -Math.abs(p.vx) * damp
  }
  if (p.y < p.r) {
    p.y = p.r
    p.vy = Math.abs(p.vy) * damp
  } else if (p.y > h - p.r) {
    p.y = h - p.r
    p.vy = -Math.abs(p.vy) * damp
  }
  if (p.z < -60) {
    p.z = -60
    p.vz = Math.abs(p.vz) * damp
  } else if (p.z > 60) {
    p.z = 60
    p.vz = -Math.abs(p.vz) * damp
  }

  // energia decae con el tiempo, sube con la velocidad
  p.energy = clamp(Math.max(p.energy * 0.94, speed / PHYSICS.MAX_SPEED), 0, 1)

  // trail
  p.trail.push({ x: p.x, y: p.y, z: p.z })
  if (p.trail.length > PHYSICS.TRAIL_LENGTH) p.trail.shift()
}

/** Interaccion leve entre particulas cercanas (repulsion suave). */
export const applyParticleInteraction = (a: Particle, b: Particle): void => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const d2 = dx * dx + dy * dy
  if (d2 > 2500 || d2 < 0.01) return
  const dist = Math.sqrt(d2)
  const f = (PHYSICS.PARTICLE_INTERACTION * (50 - dist)) / dist
  a.vx += dx * f
  a.vy += dy * f
  b.vx -= dx * f
  b.vy -= dy * f
}