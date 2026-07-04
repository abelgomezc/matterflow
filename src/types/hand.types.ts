// MatterFlow - tipos de mano y gestos. (c) 2026 Abel Gomez

export interface Landmark {
  x: number
  y: number
  z: number
}

export interface HandResult {
  landmarks: Landmark[]
  handedness: 'Left' | 'Right'
  score: number
}

export type Gesture =
  | 'OPEN_PALM' // palma abierta -> atraer
  | 'CLOSED_FIST' // puno cerrado -> repeler
  | 'POINTING' // solo indice -> crear materia
  | 'PINCH' // pinza -> congelar
  | 'WRIST_ROTATE' // giro de muneca -> vortex
  | 'UNKNOWN'

export interface GestureResult {
  gesture: Gesture
  intensity: number // 0-1, que tan definido es el gesto
  handX: number // posicion en canvas (px)
  handY: number
}