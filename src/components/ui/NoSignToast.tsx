// MatterFlow - aviso gracioso cuando la seña no existe. (c) 2026 Abel Gomez
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useMatterStore } from '../../store/matterStore'

const PHRASES = [
  '🤨 Esa seña no existe... no seas tarado jeje',
  '🙃 Esa mano no dice nada, inténtalo mejor',
  '😜 ¿Qué seña es esa? ¡No existe!',
  '🤷 No reconozco eso... prueba una configurada',
  '😅 Esa no está en el manual, crack',
]

export default function NoSignToast() {
  const noSign = useMatterStore((s) => s.noSign)
  const [msg, setMsg] = useState(PHRASES[0])
  const wasVisible = useRef(false)

  // elige una frase al azar cada vez que aparece
  useEffect(() => {
    if (noSign && !wasVisible.current) {
      setMsg(PHRASES[(Math.random() * PHRASES.length) | 0])
    }
    wasVisible.current = noSign
  }, [noSign])

  return (
    <AnimatePresence>
      {noSign && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 320, damping: 22 }}
          className="mf-glass pointer-events-none absolute bottom-28 left-1/2 z-40 -translate-x-1/2 rounded-2xl px-5 py-3 text-center text-sm font-medium text-white shadow-glow"
        >
          {msg}
        </motion.div>
      )}
    </AnimatePresence>
  )
}