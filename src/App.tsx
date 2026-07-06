// MatterFlow - integra camara, escena de materia y toda la UI. (c) 2026 Abel Gomez
import MatterScene from './components/canvas/MatterScene'
import HandTracker from './components/camera/HandTracker'
import CameraOverlay from './components/camera/CameraOverlay'
import ModeSelector from './components/ui/ModeSelector'
import StatsHUD from './components/ui/StatsHUD'
import GestureGuide from './components/ui/GestureGuide'
import Controls from './components/ui/Controls'
import NoSignToast from './components/ui/NoSignToast'
import Copyright from './components/ui/Copyright'
import StartOverlay from './components/ui/StartOverlay'
import ModeTransition from './components/ui/ModeTransition'
import EasterEgg from './components/ui/EasterEgg'
import UniverseControls from './components/ui/UniverseControls'

export default function App() {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-mf-bg">
      {/* Canvas 3D principal (100% viewport) */}
      <MatterScene />

      {/* Fundido entre modos de materia */}
      <ModeTransition />

      {/* Camara + MediaPipe (video oculto) y fallback mouse/touch/demo */}
      <HandTracker />
      <CameraOverlay />

      {/* Interfaz */}
      <StatsHUD />
      <GestureGuide />
      <ModeSelector />
      <UniverseControls />
      <Controls />
      <NoSignToast />
      <Copyright />

      {/* Pantalla inicial con boton explicito de camara */}
      <StartOverlay />

      {/* Easter egg: seña de Victoria (✌️) o tecla V */}
      <EasterEgg />
    </div>
  )
}
