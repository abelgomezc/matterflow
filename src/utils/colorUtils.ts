// MatterFlow - colores por energia, modo y velocidad. (c) 2026 Abel Gomez
import * as THREE from 'three'
import type { MatterMode } from '../types/matter.types'

const c = (hex: string) => new THREE.Color(hex)

/** Gradiente base de particulas: azul -> morado -> cyan -> blanco. */
const PARTICLE_STOPS: THREE.Color[] = [
  c('#1B2A6B'),
  c('#6C63FF'),
  c('#00D4AA'),
  c('#FFFFFF'),
]

/** Interpola un array de colores segun t (0-1). Escribe en `target`. */
export const gradient = (
  stops: THREE.Color[],
  t: number,
  target: THREE.Color
): THREE.Color => {
  const clamped = Math.max(0, Math.min(1, t))
  const scaled = clamped * (stops.length - 1)
  const i = Math.min(Math.floor(scaled), stops.length - 2)
  const f = scaled - i
  return target.copy(stops[i]).lerp(stops[i + 1], f)
}

/** Color de una particula segun su energia cinetica (0-1). */
export const colorByEnergy = (
  energy: number,
  target: THREE.Color = new THREE.Color()
): THREE.Color => gradient(PARTICLE_STOPS, energy, target)

/** Color base tematico por modo de materia. */
export const colorForMode = (mode: MatterMode): THREE.Color => {
  switch (mode) {
    case 'plasma':
      return c('#C084FC')
    case 'rays':
      return c('#1E6BFF')
    case 'force':
      return c('#7DD3FC')
    case 'particles':
    default:
      return c('#6C63FF')
  }
}

const PLASMA_STOPS = [c('#000004'), c('#6C63FF'), c('#C084FC'), c('#FFFFFF')]
export const plasmaColor = (t: number, target = new THREE.Color()): THREE.Color =>
  gradient(PLASMA_STOPS, t, target)

// --- Elementos ---

// Fuego: rojo -> naranja -> amarillo -> blanco (t = calor/vida)
const FIRE_STOPS = [c('#3A0A00'), c('#FF2D00'), c('#FF8A00'), c('#FFE066'), c('#FFFFFF')]
export const fireColor = (t: number, target = new THREE.Color()): THREE.Color =>
  gradient(FIRE_STOPS, t, target)

// Agua: azul profundo -> cyan -> espuma clara (t = velocidad)
const WATER_STOPS = [c('#003F7D'), c('#0066AA'), c('#00C8FF'), c('#BDF0FF')]
export const waterColor = (t: number, target = new THREE.Color()): THREE.Color =>
  gradient(WATER_STOPS, t, target)

// Aire: casi transparente -> cyan palido -> blanco (t = velocidad del viento)
const AIR_STOPS = [c('#1B3A4B'), c('#5FA8C7'), c('#BEE7FF'), c('#FFFFFF')]
export const airColor = (t: number, target = new THREE.Color()): THREE.Color =>
  gradient(AIR_STOPS, t, target)

// Rayo Sith: azul electrico -> cyan -> blanco puro
const SITH_STOPS = [c('#0A2A6B'), c('#2E6BFF'), c('#7DD3FC'), c('#FFFFFF')]
export const sithColor = (t: number, target = new THREE.Color()): THREE.Color =>
  gradient(SITH_STOPS, t, target)

/** Color CSS (para overlays 2D) segun energia. */
export const cssByEnergy = (energy: number): string => {
  const col = colorByEnergy(energy)
  return `rgb(${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)})`
}