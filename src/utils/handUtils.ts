// MatterFlow - calculos de distancias, angulos y normalizaciones. (c) 2026 Abel Gomez
import type { Landmark } from '../types/hand.types'

/** Distancia euclidiana 2D entre dos landmarks (coords normalizadas 0-1). */
export const dist2D = (a: Landmark, b: Landmark): number => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

/** Distancia 3D entre dos landmarks. */
export const dist3D = (a: Landmark, b: Landmark): number => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = a.z - b.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

/** Angulo (radianes) del vector a->b respecto al eje X. */
export const angleBetween = (a: Landmark, b: Landmark): number =>
  Math.atan2(b.y - a.y, b.x - a.x)

/** Un dedo se considera extendido si su punta esta por encima (menor y) del PIP. */
export const isFingerExtended = (
  lm: Landmark[],
  tipIdx: number,
  pipIdx: number
): boolean => lm[tipIdx].y < lm[pipIdx].y

/** Centroide (promedio) de un conjunto de landmarks. */
export const centroid = (lm: Landmark[]): { x: number; y: number; z: number } => {
  let x = 0
  let y = 0
  let z = 0
  for (const p of lm) {
    x += p.x
    y += p.y
    z += p.z
  }
  const n = lm.length || 1
  return { x: x / n, y: y / n, z: z / n }
}

/** Convierte coordenada normalizada (0-1) a pixeles de canvas. */
export const toCanvas = (
  nx: number,
  ny: number,
  w: number,
  h: number
): { x: number; y: number } => ({ x: nx * w, y: ny * h })

/** Diferencia angular minima con signo entre dos angulos (radianes). */
export const angleDelta = (a: number, b: number): number => {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}