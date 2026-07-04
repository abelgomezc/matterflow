// MatterFlow - Easter egg: juntar las dos manos (🙏 amen). (c) 2026 Abel Gomez
// La materia (particulas) se ensambla formando la frase y aparecen las
// imagenes o6/o7 de /public. Atajo: tecla V para probar sin camara.
import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useMatterStore } from '../../store/matterStore'

const LINES = ['EL SR OREJITAS', 'ES UN NIÑO PRODIGIO']
// Paleta cosmica sobria: sobre todo blanco estelar, con azules palidos y un
// leve lila. Poco colorido -> se lee como letras de estrellas.
const PALETTE = ['#FFFFFF', '#DCE9FF', '#AAC5FF', '#C3B3FF']
/** Elige color con peso hacia el blanco (aspecto de campo estelar). */
const pickColor = (): number => {
  const r = Math.random()
  if (r < 0.66) return 0 // blanco
  if (r < 0.85) return 1 // azul muy palido
  if (r < 0.95) return 2 // azul
  return 3 // lila tenue
}

interface P {
  x: number
  y: number
  tx: number
  ty: number
  vx: number
  vy: number
  ci: number // indice de color/sprite
  size: number
  delay: number // seg antes de empezar a viajar (ensamblado escalonado)
  orbA: number // amplitud de oscilacion al asentarse
  orbS: number // velocidad de oscilacion
  phase: number
  star: boolean // destello grande ocasional
}

/** Crea un sprite radial suave (glow) del color dado. */
const makeSprite = (color: string): HTMLCanvasElement => {
  const s = 64
  const cv = document.createElement('canvas')
  cv.width = s
  cv.height = s
  const c = cv.getContext('2d')!
  const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0, color)
  g.addColorStop(0.35, color)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  c.globalAlpha = 1
  c.fillStyle = g
  c.beginPath()
  c.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2)
  c.fill()
  return cv
}

export default function EasterEgg() {
  const easterEgg = useMatterStore((s) => s.easterEgg)
  const setEasterEgg = useMatterStore((s) => s.setEasterEgg)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Atajo de teclado: V alterna el easter egg (util sin camara)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'v' || e.key === 'V') {
        setEasterEgg(!useMatterStore.getState().easterEgg)
      } else if (e.key === 'Escape') {
        setEasterEgg(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setEasterEgg])

  // Animacion: la materia se ensambla (lenta y llamativa) formando el texto
  useEffect(() => {
    if (!easterEgg) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let particles: P[] = []
    let bgStars: { x: number; y: number; r: number; ph: number; a: number }[] = []
    let nebula: { x: number; y: number; r: number; c: string }[] = []
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const sprites = PALETTE.map(makeSprite)
    const start = performance.now()

    const build = () => {
      const W = window.innerWidth
      const H = window.innerHeight
      canvas.width = W * dpr
      canvas.height = H * dpr
      canvas.style.width = `${W}px`
      canvas.style.height = `${H}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const off = document.createElement('canvas')
      off.width = W
      off.height = H
      const octx = off.getContext('2d')!
      const fontSize = Math.min(W * 0.085, 130)
      octx.fillStyle = '#fff'
      octx.textAlign = 'center'
      octx.textBaseline = 'middle'
      octx.font = `900 ${fontSize}px ui-sans-serif, system-ui, sans-serif`
      const cy = H * 0.34
      octx.fillText(LINES[0], W / 2, cy - fontSize * 0.62)
      octx.fillText(LINES[1], W / 2, cy + fontSize * 0.62)

      const img = octx.getImageData(0, 0, W, H).data
      const gap = W < 700 ? 6 : 6 // densidad suficiente para leerse como letras
      const cx = W / 2
      const midY = H * 0.34
      particles = []
      for (let y = 0; y < H; y += gap) {
        for (let x = 0; x < W; x += gap) {
          if (img[(y * W + x) * 4 + 3] > 128) {
            // aparecen desde un remolino central y viajan lento hacia su lugar
            const ang = Math.random() * Math.PI * 2
            const rad = 60 + Math.random() * Math.max(W, H) * 0.5
            const star = Math.random() < 0.05 // pocas estrellas grandes (destello)
            particles.push({
              x: cx + Math.cos(ang) * rad,
              y: midY + Math.sin(ang) * rad,
              tx: x,
              ty: y,
              vx: 0,
              vy: 0,
              ci: star ? 0 : pickColor(), // estrellas grandes = blancas
              size: star ? 3.4 + Math.random() * 2 : 1.4 + Math.random() * 1.4,
              delay: Math.random() * 1.4,
              orbA: 0.6 + Math.random() * 1.4,
              orbS: 0.5 + Math.random() * 1.1,
              phase: Math.random() * Math.PI * 2,
              star,
            })
          }
        }
      }

      // campo de estrellas de fondo (universo)
      bgStars = []
      const nStars = Math.round((W * H) / 5200)
      for (let i = 0; i < nStars; i++) {
        bgStars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: 0.4 + Math.random() * 1.3,
          ph: Math.random() * Math.PI * 2,
          a: 0.25 + Math.random() * 0.5,
        })
      }

      // nebulosas tenues (manchas de color muy suave)
      nebula = [
        { x: W * 0.3, y: H * 0.3, r: Math.max(W, H) * 0.45, c: 'rgba(70,90,200,0.10)' },
        { x: W * 0.72, y: H * 0.42, r: Math.max(W, H) * 0.4, c: 'rgba(120,80,200,0.08)' },
        { x: W * 0.5, y: H * 0.7, r: Math.max(W, H) * 0.5, c: 'rgba(40,120,180,0.07)' },
      ]
    }

    const draw = () => {
      const W = window.innerWidth
      const H = window.innerHeight
      const t = (performance.now() - start) / 1000
      ctx.clearRect(0, 0, W, H)

      // nebulosas (muy tenues, mezcla normal)
      ctx.globalCompositeOperation = 'lighter'
      for (const nb of nebula) {
        const g = ctx.createRadialGradient(nb.x, nb.y, 0, nb.x, nb.y, nb.r)
        g.addColorStop(0, nb.c)
        g.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, W, H)
      }

      // estrellas de fondo (titilan suavemente)
      for (const s of bgStars) {
        const tw = s.a * (0.5 + 0.5 * Math.sin(t * 1.6 + s.ph))
        ctx.globalAlpha = tw
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        if (t > p.delay) {
          // objetivo con leve oscilacion (materia "viva") + resorte LENTO
          const etx = p.tx + Math.sin(t * p.orbS + p.phase) * p.orbA
          const ety = p.ty + Math.cos(t * p.orbS + p.phase) * p.orbA
          const ax = (etx - p.x) * 0.045 // lento
          const ay = (ety - p.y) * 0.045
          p.vx = (p.vx + ax) * 0.9
          p.vy = (p.vy + ay) * 0.9
          p.x += p.vx
          p.y += p.vy
        }
        // titileo + pulso de tamaño para estrellas
        const twinkle = 0.7 + 0.3 * Math.sin(t * 3 + p.phase)
        const pulse = p.star ? 1 + 0.35 * Math.sin(t * 4 + p.phase) : 1
        const d = p.size * (p.star ? 3.4 : 2.6) * pulse
        ctx.globalAlpha = twinkle
        ctx.drawImage(sprites[p.ci], p.x - d / 2, p.y - d / 2, d, d)
      }
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      raf = requestAnimationFrame(draw)
    }

    build()
    draw()
    const onResize = () => build()
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [easterEgg])

  return (
    <AnimatePresence>
      {easterEgg && (
        <motion.div
          className="absolute inset-0 z-50 flex flex-col items-center justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          onClick={() => setEasterEgg(false)}
          style={{
            background:
              'radial-gradient(120% 100% at 50% 40%, #05070f 0%, #02030a 55%, #000003 100%)',
            backdropFilter: 'blur(2px)',
            WebkitBackdropFilter: 'blur(2px)',
          }}
        >
          {/* particulas que forman la frase */}
          <canvas ref={canvasRef} className="pointer-events-none absolute inset-0" />

          {/* etiqueta de la seña */}
          <motion.div
            initial={{ y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mf-glass absolute left-1/2 top-6 -translate-x-1/2 rounded-full px-4 py-1.5 text-sm text-white/85"
          >
            🙏 Manos juntas (amén) detectadas
          </motion.div>

          {/* imagenes o6 / o7 */}
          <div
            className="relative z-10 mb-[9vh] flex items-end justify-center gap-4 px-4"
            onClick={(e) => e.stopPropagation()}
          >
            {['/o6.jpg', '/o7.jpg'].map((src, i) => (
              <motion.img
                key={src}
                src={src}
                alt="El Sr Orejitas"
                initial={{ y: 40, opacity: 0, rotate: i === 0 ? -6 : 6, scale: 0.9 }}
                animate={{ y: 0, opacity: 1, rotate: i === 0 ? -3 : 3, scale: 1 }}
                transition={{ delay: 0.35 + i * 0.12, type: 'spring', stiffness: 200, damping: 18 }}
                className="h-[26vh] max-h-72 w-auto rounded-2xl border border-white/20 object-cover shadow-glow"
              />
            ))}
          </div>

          {/* cerrar */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setEasterEgg(false)
            }}
            className="mf-glass absolute right-4 top-4 z-20 rounded-lg px-3 py-1.5 text-sm text-white/85 transition-colors hover:text-white"
          >
            ✕ Cerrar
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}