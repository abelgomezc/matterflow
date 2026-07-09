// MatterFlow - MediaPipe Face en modo VIDEO para efectos tipo Digital Shadow.
// (c) 2026 Abel Gomez
import { useCallback, useEffect, useRef, useState } from 'react'
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import type { Landmark } from '../types/hand.types'

export interface FaceData {
  x: number
  y: number
  width: number
  height: number
  landmarks: Landmark[]
}

const FACE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task'

export const useFaceTracking = (
  videoRef: React.RefObject<HTMLVideoElement | null>
) => {
  const [faces, setFaces] = useState<FaceData[]>([])
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const landmarkerRef = useRef<FaceLandmarker | null>(null)
  const animFrameRef = useRef<number | undefined>(undefined)
  const lastVideoTimeRef = useRef(-1)
  const runningRef = useRef(false)

  const initMediaPipe = useCallback(async () => {
    if (landmarkerRef.current) return landmarkerRef.current

    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
      )
      const landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: FACE_MODEL_URL,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        minFaceDetectionConfidence: 0.45,
        minFacePresenceConfidence: 0.45,
        minTrackingConfidence: 0.45,
      })
      landmarkerRef.current = landmarker
      setIsReady(true)
      setError(null)
      return landmarker
    } catch (e) {
      console.error('[MatterFlow] Error iniciando FaceLandmarker:', e)
      setError('No se pudo cargar face tracking.')
      return null
    }
  }, [])

  useEffect(() => {
    return () => {
      runningRef.current = false
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      landmarkerRef.current?.close()
      landmarkerRef.current = null
    }
  }, [])

  const startDetection = useCallback(async () => {
    if (runningRef.current) return
    const landmarker = await initMediaPipe()
    if (!landmarker) return

    runningRef.current = true

    const detect = () => {
      if (!runningRef.current) return
      const video = videoRef.current
      const activeLandmarker = landmarkerRef.current
      if (!video || !activeLandmarker) {
        animFrameRef.current = requestAnimationFrame(detect)
        return
      }

      if (
        video.readyState >= 2 &&
        video.currentTime !== lastVideoTimeRef.current
      ) {
        lastVideoTimeRef.current = video.currentTime
        try {
          const results = activeLandmarker.detectForVideo(video, performance.now())
          if (results.faceLandmarks.length > 0) {
            const faceData = results.faceLandmarks.map((lm) => {
              const mirrored = lm.map((p) => ({ x: 1 - p.x, y: p.y, z: p.z }))
              const minX = Math.min(...mirrored.map((p) => p.x))
              const maxX = Math.max(...mirrored.map((p) => p.x))
              const minY = Math.min(...mirrored.map((p) => p.y))
              const maxY = Math.max(...mirrored.map((p) => p.y))
              return {
                x: (minX + maxX) / 2,
                y: (minY + maxY) / 2,
                width: maxX - minX,
                height: maxY - minY,
                landmarks: mirrored,
              }
            })
            setFaces(faceData)
          } else {
            setFaces((prev) => (prev.length === 0 ? prev : []))
          }
        } catch (e) {
          console.error('[MatterFlow] face detectForVideo:', e)
        }
      }
      animFrameRef.current = requestAnimationFrame(detect)
    }
    detect()
  }, [initMediaPipe, videoRef])

  const stopDetection = useCallback(() => {
    runningRef.current = false
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    setFaces([])
  }, [])

  return { faces, isReady, error, startDetection, stopDetection }
}
