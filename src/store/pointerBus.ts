// MatterFlow - bus imperativo de punteros (manos reales, mouse/touch o demo).
// Se actualiza cada frame y lo leen los sistemas de materia dentro de useFrame,
// evitando re-renders de React por particula. (c) 2026 Abel Gomez
import type { Pointer } from '../types/matter.types'

/** Punteros activos en coordenadas normalizadas 0-1 (origen arriba-izq). */
export const pointerBus: { pointers: Pointer[] } = { pointers: [] }

export const setPointers = (pointers: Pointer[]): void => {
  pointerBus.pointers = pointers
}

export const getPointers = (): Pointer[] => pointerBus.pointers