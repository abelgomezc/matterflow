// MatterFlow - estado global (Zustand). Todo en memoria, sin localStorage.
// (c) 2026 Abel Gomez
import { create } from 'zustand'
import type { MatterMode, InteractionMode } from '../types/matter.types'

interface MatterState {
  matterMode: MatterMode
  interactionMode: InteractionMode
  particleCount: number
  fps: number
  handsDetected: number
  currentGesture: string
  force: number // 0-1
  cameraActive: boolean
  demoMode: boolean // cursor simulado cuando no hay camara/manos
  showGuide: boolean
  paused: boolean // congela la animacion (frameloop del canvas)

  setMatterMode: (mode: MatterMode) => void
  setInteractionMode: (mode: InteractionMode) => void
  setParticleCount: (n: number) => void
  setFps: (fps: number) => void
  setHandsDetected: (n: number) => void
  setCurrentGesture: (g: string) => void
  setForce: (f: number) => void
  setCameraActive: (active: boolean) => void
  setDemoMode: (on: boolean) => void
  toggleGuide: () => void
  togglePaused: () => void
}

export const useMatterStore = create<MatterState>((set) => ({
  matterMode: 'particles',
  interactionMode: 'attract',
  particleCount: 0,
  fps: 0,
  handsDetected: 0,
  currentGesture: 'Ninguno',
  force: 0,
  cameraActive: false,
  demoMode: true,
  showGuide: true,
  paused: false,

  setMatterMode: (mode) => set({ matterMode: mode }),
  setInteractionMode: (mode) => set({ interactionMode: mode }),
  setParticleCount: (n) => set({ particleCount: n }),
  setFps: (fps) => set({ fps }),
  setHandsDetected: (n) => set({ handsDetected: n }),
  setCurrentGesture: (g) => set({ currentGesture: g }),
  setForce: (f) => set({ force: f }),
  setCameraActive: (active) => set({ cameraActive: active }),
  setDemoMode: (on) => set({ demoMode: on }),
  toggleGuide: () => set((s) => ({ showGuide: !s.showGuide })),
  togglePaused: () => set((s) => ({ paused: !s.paused })),
}))