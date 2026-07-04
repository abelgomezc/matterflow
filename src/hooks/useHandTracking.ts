// MatterFlow - MediaPipe Hands en modo VIDEO (tiempo real). (c) 2026 Abel Gomez
import { useEffect, useRef, useState, useCallback } from 'react'
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import type { Landmark } from '../types/hand.types'

export interface HandData {
  x: number // posicion X normalizada 0-1 (ya espejada, modo selfie)
  y: number // posicion Y normalizada 0-1
  landmarks: Landmark[] // 21 landmarks espejados
  handedness: 'Left' | 'Right'
}

export const useHandTracking = (
  videoRef: React.RefObject<HTMLVideoElement | null>
) => {
  const [hands, setHands] = useState<HandData[]>([])
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const landmarkerRef = useRef<HandLandmarker | null>(null)
  const animFrameRef = useRef<number | undefined>(undefined)
  const lastVideoTimeRef = useRef(-1)
  const runningRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    const initMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
        )
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/models/hand_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numHands: 2, // hasta 2 manos simultaneas
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        })
        if (cancelled) {
          landmarker.close()
          return
        }
        landmarkerRef.current = landmarker
        setIsReady(true)
      } catch (e) {
        console.error('[MatterFlow] Error iniciando MediaPipe:', e)
        setError('No se pudo cargar MediaPipe. Se usara mouse/touch.')
      }
    }
    initMediaPipe()

    return () => {
      cancelled = true
      runningRef.current = false
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      landmarkerRef.current?.close()
      landmarkerRef.current = null
    }
  }, [])

  const startDetection = useCallback(() => {
    if (runningRef.current) return
    runningRef.current = true

    const detect = () => {
      if (!runningRef.current) return
      const video = videoRef.current
      const landmarker = landmarkerRef.current
      if (!video || !landmarker) {
        animFrameRef.current = requestAnimationFrame(detect)
        return
      }

      if (
        video.readyState >= 2 &&
        video.currentTime !== lastVideoTimeRef.current
      ) {
        lastVideoTimeRef.current = video.currentTime
        try {
          const results = landmarker.detectForVideo(video, performance.now())
          if (results.landmarks.length > 0) {
            const handData: HandData[] = results.landmarks.map((lm, i) => {
              // centroide de la palma como posicion principal
              const palmX = lm.reduce((s, p) => s + p.x, 0) / lm.length
              const palmY = lm.reduce((s, p) => s + p.y, 0) / lm.length
              return {
                x: 1 - palmX, // espejo horizontal (selfie)
                y: palmY,
                landmarks: lm.map((p) => ({ x: 1 - p.x, y: p.y, z: p.z })),
                handedness:
                  (results.handedness[i]?.[0]?.categoryName as
                    | 'Left'
                    | 'Right') || 'Right',
              }
            })
            setHands(handData)
          } else {
            setHands((prev) => (prev.length === 0 ? prev : []))
          }
        } catch (e) {
          console.error('[MatterFlow] detectForVideo:', e)
        }
      }
      animFrameRef.current = requestAnimationFrame(detect)
    }
    detect()
  }, [videoRef])

  const stopDetection = useCallback(() => {
    runningRef.current = false
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    setHands([])
  }, [])

  return { hands, isReady, error, startDetection, stopDetection }
}