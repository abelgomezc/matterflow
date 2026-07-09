// MatterFlow - MediaPipe ImageSegmenter para Digital Shadow.
// Segmenta la persona/cuerpo visible y publica una máscara simple.
// (c) 2026 Abel Gomez
import { useCallback, useEffect, useRef, useState } from 'react'
import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision'

export interface PersonMask {
  width: number
  height: number
  data: Float32Array
}

const SEGMENTER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite'

export const usePersonSegmentation = (
  videoRef: React.RefObject<HTMLVideoElement | null>
) => {
  const [mask, setMask] = useState<PersonMask | null>(null)
  const [error, setError] = useState<string | null>(null)
  const segmenterRef = useRef<ImageSegmenter | null>(null)
  const animFrameRef = useRef<number | undefined>(undefined)
  const lastVideoTimeRef = useRef(-1)
  const runningRef = useRef(false)

  const initMediaPipe = useCallback(async () => {
    if (segmenterRef.current) return segmenterRef.current

    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
      )
      const segmenter = await ImageSegmenter.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: SEGMENTER_MODEL_URL,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      })
      segmenterRef.current = segmenter
      setError(null)
      return segmenter
    } catch (e) {
      console.error('[MatterFlow] Error iniciando ImageSegmenter:', e)
      setError('No se pudo cargar segmentacion.')
      return null
    }
  }, [])

  useEffect(() => {
    return () => {
      runningRef.current = false
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      segmenterRef.current?.close()
      segmenterRef.current = null
    }
  }, [])

  const startSegmentation = useCallback(async () => {
    if (runningRef.current) return
    const segmenter = await initMediaPipe()
    if (!segmenter) return

    runningRef.current = true

    const detect = () => {
      if (!runningRef.current) return
      const video = videoRef.current
      const activeSegmenter = segmenterRef.current
      if (!video || !activeSegmenter) {
        animFrameRef.current = requestAnimationFrame(detect)
        return
      }

      if (
        video.readyState >= 2 &&
        video.currentTime !== lastVideoTimeRef.current
      ) {
        lastVideoTimeRef.current = video.currentTime
        try {
          activeSegmenter.segmentForVideo(video, performance.now(), (result) => {
            const confidenceMask = result.confidenceMasks?.[0]
            if (!confidenceMask) return
            setMask({
              width: confidenceMask.width,
              height: confidenceMask.height,
              data: confidenceMask.getAsFloat32Array().slice(),
            })
          })
        } catch (e) {
          console.error('[MatterFlow] segmentForVideo:', e)
        }
      }

      animFrameRef.current = requestAnimationFrame(detect)
    }
    detect()
  }, [initMediaPipe, videoRef])

  const stopSegmentation = useCallback(() => {
    runningRef.current = false
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    setMask(null)
  }, [])

  return { mask, error, startSegmentation, stopSegmentation }
}
