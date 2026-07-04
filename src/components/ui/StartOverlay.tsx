// MatterFlow - overlay inicial con boton explicito de camara. (c) 2026 Abel Gomez
import { motion } from 'framer-motion'
import { useMatterStore } from '../../store/matterStore'

export default function StartOverlay() {
  const cameraActive = useMatterStore((s) => s.cameraActive)
  const setCameraActive = useMatterStore((s) => s.setCameraActive)

  if (cameraActive) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center p-6"
    >
      <motion.div
        initial={{ y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mf-glass pointer-events-auto max-w-md rounded-3xl p-8 text-center shadow-glow"
      >
        <h1 className="bg-gradient-to-r from-mf-purple via-mf-cyan to-white bg-clip-text text-4xl font-bold text-transparent">
          MatterFlow
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-white/70">
          Manipula materia en 3D con las manos en el aire. Detecta tus gestos
          con la camara mediante MediaPipe. Sin login, sin servidor: 100% en tu
          navegador.
        </p>

        <button
          onClick={() => setCameraActive(true)}
          className="mt-6 w-full rounded-xl bg-gradient-to-r from-mf-purple to-mf-cyan px-6 py-3 font-semibold text-white transition-transform hover:scale-[1.02] active:scale-95"
        >
          🎥 Activar camara
        </button>

        <p className="mt-4 text-xs text-white/45">
          ¿Sin camara? Ya puedes jugar: mueve el mouse o toca la pantalla para
          controlar la materia. El modo demo se anima solo.
        </p>

        <div className="mt-5 text-[11px] text-white/30">
          © 2026 Abel Gomez · Todos los derechos reservados
        </div>
      </motion.div>
    </motion.div>
  )
}