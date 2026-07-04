// MatterFlow - texturas generadas por codigo (sprites suaves). (c) 2026 Abel Gomez
import * as THREE from 'three'

let glowTex: THREE.Texture | null = null

/**
 * Sprite radial suave (nucleo brillante -> transparente). Da a los Points
 * aspecto de particula/llama en vez de punto duro. Se cachea (singleton).
 */
export const glowSprite = (): THREE.Texture => {
  if (glowTex) return glowTex
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.25, 'rgba(255,255,255,0.85)')
  g.addColorStop(0.5, 'rgba(255,255,255,0.35)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  glowTex = tex
  return tex
}