// MatterFlow - deteccion de los 5 gestos de mano. (c) 2026 Abel Gomez
import type { HandData } from './useHandTracking'
import type { Gesture, GestureResult, Landmark } from '../types/hand.types'
import type { InteractionMode } from '../types/matter.types'
import { isFingerExtended, dist2D } from '../utils/handUtils'

/**
 * Estado opcional para detectar WRIST_ROTATE (requiere memoria del angulo
 * de la muneca entre frames). Se pasa desde el consumidor.
 */
export interface WristTracker {
  lastAngle: number | null
  rotationAccum: number
}

export const createWristTracker = (): WristTracker => ({
  lastAngle: null,
  rotationAccum: 0,
})

const wristAngle = (lm: Landmark[]): number => {
  // vector muneca(0) -> base del dedo medio(9)
  return Math.atan2(lm[9].y - lm[0].y, lm[9].x - lm[0].x)
}

export const detectGesture = (
  hand: HandData,
  canvasW: number,
  canvasH: number,
  wrist?: WristTracker
): GestureResult => {
  const lm = hand.landmarks
  const handX = hand.x * canvasW
  const handY = hand.y * canvasH

  const indexExt = isFingerExtended(lm, 8, 6)
  const middleExt = isFingerExtended(lm, 12, 10)
  const ringExt = isFingerExtended(lm, 16, 14)
  const pinkyExt = isFingerExtended(lm, 20, 18)

  // --- Giro de muneca -> VORTEX (tiene prioridad si hay rotacion marcada) ---
  if (wrist) {
    const angle = wristAngle(lm)
    if (wrist.lastAngle !== null) {
      let d = angle - wrist.lastAngle
      while (d > Math.PI) d -= Math.PI * 2
      while (d < -Math.PI) d += Math.PI * 2
      wrist.rotationAccum = wrist.rotationAccum * 0.85 + d
    }
    wrist.lastAngle = angle
    // > ~30 grados acumulados de rotacion reciente
    if (Math.abs(wrist.rotationAccum) > 0.52) {
      return {
        gesture: 'WRIST_ROTATE',
        intensity: Math.min(1, Math.abs(wrist.rotationAccum)),
        handX,
        handY,
      }
    }
  }

  // --- Pinza (pulgar + indice muy juntos) -> CONGELAR ---
  const pinchDist = dist2D(lm[4], lm[8])
  if (pinchDist < 0.05) {
    return {
      gesture: 'PINCH',
      intensity: 1 - pinchDist / 0.05,
      handX,
      handY,
    }
  }

  // --- Dos dedos (V) -> en modo Crear genera una estrella ---
  // El easter egg sigue siendo exclusivamente la postura de "amen".
  if (indexExt && middleExt && !ringExt && !pinkyExt) {
    return { gesture: 'VICTORY', intensity: 0.9, handX, handY }
  }

  // --- Palma abierta -> ATRAER ---
  if (indexExt && middleExt && ringExt && pinkyExt) {
    return { gesture: 'OPEN_PALM', intensity: 1.0, handX, handY }
  }

  // --- Puno cerrado -> REPELER ---
  if (!indexExt && !middleExt && !ringExt && !pinkyExt) {
    return { gesture: 'CLOSED_FIST', intensity: 1.0, handX, handY }
  }

  // --- Solo indice -> CREAR MATERIA ---
  if (indexExt && !middleExt && !ringExt && !pinkyExt) {
    return { gesture: 'POINTING', intensity: 0.8, handX, handY }
  }

  return { gesture: 'UNKNOWN', intensity: 0.3, handX, handY }
}

/** Mapa gesto -> modo de interaccion con la materia. */
export const gestureToMode = (gesture: Gesture): InteractionMode => {
  const map: Record<Gesture, InteractionMode> = {
    OPEN_PALM: 'attract',
    CLOSED_FIST: 'repel',
    POINTING: 'create',
    PINCH: 'freeze',
    WRIST_ROTATE: 'vortex',
    VICTORY: 'attract',
    UNKNOWN: 'attract',
  }
  return map[gesture]
}

/** Etiqueta legible del gesto para el HUD. */
export const gestureLabel = (gesture: Gesture): string => {
  const map: Record<Gesture, string> = {
    OPEN_PALM: 'Palma abierta',
    CLOSED_FIST: 'Puno cerrado',
    POINTING: 'Indice (crear)',
    PINCH: 'Pinza (congelar)',
    WRIST_ROTATE: 'Giro (vortex)',
    VICTORY: 'Victoria (V)',
    UNKNOWN: 'Indefinido',
  }
  return map[gesture]
}
