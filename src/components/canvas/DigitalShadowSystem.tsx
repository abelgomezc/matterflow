// MatterFlow - Digital Shadow delega su visual principal al CameraOverlay.
// (c) 2026 Abel Gomez
import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { faceLandmarksBus } from '../camera/HandTracker'
import { useMatterStore } from '../../store/matterStore'

export default function DigitalShadowSystem() {
  const setParticleCount = useMatterStore((state) => state.setParticleCount)
  const setCurrentGesture = useMatterStore((state) => state.setCurrentGesture)
  const lastStatus = useRef({ text: '', at: 0 })

  useEffect(() => {
    setParticleCount(0)
    return () => setParticleCount(0)
  }, [setParticleCount])

  useFrame(() => {
    const now = performance.now()
    const hasFace = Boolean(faceLandmarksBus.faces[0]?.landmarks.length)
    const text = hasFace
      ? 'Digital Shadow: Face + hands'
      : 'Digital Shadow: buscando rostro'

    if (lastStatus.current.text !== text || now - lastStatus.current.at > 600) {
      lastStatus.current = { text, at: now }
      setCurrentGesture(text)
    }
  })

  return null
}
