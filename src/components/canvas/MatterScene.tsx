// MatterFlow - escena Three.js principal. (c) 2026 Abel Gomez
// Canvas fullscreen, fondo negro profundo, EffectComposer con Bloom +
// aberracion cromatica. Renderiza el sistema de materia activo con una
// transicion de fundido (Framer Motion en la capa DOM lo acompana).
import { Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
} from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { useRef } from 'react'
import * as THREE from 'three'
import { useMatterStore } from '../../store/matterStore'
import ParticleSystem from './ParticleSystem'
import PlasmaSystem from './PlasmaSystem'
import RaysSystem from './RaysSystem'
import ForceSystem from './ForceSystem'
import UniverseCreationSystem from './UniverseCreationSystem'

/** Cuenta FPS y lo publica al store (throttle ~5 veces/seg). */
function FpsMeter() {
  const setFps = useMatterStore((s) => s.setFps)
  const acc = useRef({ frames: 0, t: 0 })
  useFrame((_, delta) => {
    const a = acc.current
    a.frames += 1
    a.t += delta
    if (a.t >= 0.25) {
      setFps(Math.round(a.frames / a.t))
      a.frames = 0
      a.t = 0
    }
  })
  return null
}

function ActiveMatter() {
  const mode = useMatterStore((s) => s.matterMode)
  switch (mode) {
    case 'plasma':
      return <PlasmaSystem />
    case 'rays':
      return <RaysSystem />
    case 'force':
      return <ForceSystem />
    case 'create':
      return <UniverseCreationSystem />
    case 'particles':
    default:
      return <ParticleSystem />
  }
}

export default function MatterScene() {
  // Pausa real: al congelar, el canvas deja de invocar useFrame (frameloop).
  // Tambien se congela mientras el easter egg (amen) esta activo, para que los
  // efectos de fondo se detengan y solo se vea la frase + imagenes.
  const paused = useMatterStore((s) => s.paused)
  const easterEgg = useMatterStore((s) => s.easterEgg)
  return (
    <Canvas
      className="absolute inset-0 z-10"
      dpr={[1, 2]}
      frameloop={paused || easterEgg ? 'never' : 'always'}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0, 10], fov: 50 }}
      onCreated={({ gl }) => {
        // fondo transparente: deja ver la camara (o el negro del body) detras
        gl.setClearColor(new THREE.Color('#000004'), 0)
      }}
    >
      <ambientLight intensity={0.65} />
      <pointLight position={[4, 4, 12]} intensity={1.1} color="#ffffff" />
      <pointLight position={[-6, -3, 8]} intensity={0.5} color="#6C63FF" />

      <Suspense fallback={null}>
        <ActiveMatter />
      </Suspense>

      <FpsMeter />

      <Post />
    </Canvas>
  )
}

/** Post-procesado (Bloom + aberracion). Se DESACTIVA en modo Fuerza para que
 *  el video de la camara se vea normal (sin el brillo del bloom). */
function Post() {
  const mode = useMatterStore((s) => s.matterMode)
  if (mode === 'force') return null
  return (
    <EffectComposer>
      <Bloom
        intensity={1.15}
        luminanceThreshold={0.12}
        luminanceSmoothing={0.9}
        mipmapBlur
      />
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={new THREE.Vector2(0.0006, 0.0006)}
        radialModulation={false}
        modulationOffset={0}
      />
    </EffectComposer>
  )
}
