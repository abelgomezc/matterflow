// MatterFlow - tipos de materia y particulas. (c) 2026 Abel Gomez
import * as THREE from 'three'

export type MatterMode =
  | 'particles'
  | 'plasma'
  | 'rays'
  | 'force'
  | 'create'
  | 'digitalShadow'
  | 'dust'
export type InteractionMode = 'attract' | 'repel' | 'vortex' | 'freeze' | 'create'
export type UniverseTool =
  | 'planet'
  | 'sun'
  | 'star'
  | 'meteor'
  | 'moon'
  | 'blackHole'

export type PlanetVariant =
  | 'rocky'
  | 'ocean'
  | 'gasGiant'
  | 'ice'
  | 'volcanic'

/** Particula 2D con fisica clasica (motor de utils/physicsUtils). */
export interface Particle {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  mass: number
  r: number // radio visual
  energy: number // 0-1, determina el color
  frozen: boolean
  frozenTimer: number
  trail: { x: number; y: number; z: number }[]
}

/** Particula basada en vectores de Three.js (sistemas 3D). */
export interface Particle3D {
  position: THREE.Vector3
  velocity: THREE.Vector3
  mass: number
  radius: number
  energy: number
  frozen: boolean
  frozenTimer: number
  trail: THREE.Vector3[]
  color: THREE.Color
}

export interface ClothNode {
  position: THREE.Vector3
  prevPosition: THREE.Vector3
  velocity: THREE.Vector3
  pinned: boolean
  mass: number
}

export interface ClothConstraint {
  nodeA: number
  nodeB: number
  restLength: number
  stiffness: number
}

/** Punto de interaccion (mano real o fallback de mouse/touch). */
export interface Pointer {
  /** Coordenadas normalizadas 0-1 (origen arriba-izquierda). */
  x: number
  y: number
  mode: InteractionMode
  intensity: number
  active: boolean
}
