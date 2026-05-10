import { useEffect, useMemo, useRef, useState } from 'react'

function formatVisitedAt(value) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export default function MemoryModal({ food, onClose, onSave }) {
  const initialVisitedAt = useMemo(() => new Date().toISOString(), [])
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)

  const [note, setNote] = useState('')
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraLoading, setCameraLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setCameraReady(false)
  }

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('이 브라우저에서는 카메라 촬영을 지원하지 않아요.')
      setCameraLoading(false)
      return
    }

    try {
      setCameraLoading(true)
      setError('')
      stopCamera()

      let stream

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false,
        })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        })
      }

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      setCameraReady(true)
      setCameraLoading(false)
    } catch {
      setError('카메라 권한을 허용해 주세요.')
      setCameraLoading(false)
    }
  }

  useEffect(() => {
    startCamera()

    return () => {
      stopCamera()

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current

    if (!video.videoWidth || !video.videoHeight) {
      setError('카메라 화면이 아직 준비되지 않았어요.')
      return
    }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))

    if (!blob) {
      setError('사진을 찍지 못했어요. 다시 시도해 주세요.')
      return
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }

    const capturedFile = new File([blob], `memory-${Date.now()}.jpg`, { type: 'image/jpeg' })
    setFile(capturedFile)
    setPreviewUrl(URL.createObjectURL(blob))
    setError('')
    stopCamera()
  }

  const handleRetake = async () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }

    setPreviewUrl('')
    setFile(null)
    await startCamera()
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!file) {
      setError('카메라로 같이 찍은 사진을 남겨 주세요.')
      return
    }

    setLoading(true)
    const result = await onSave({
      food,
      file,
      note,
      visitedAt: initialVisitedAt,
    })

    if (result?.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet memory-modal-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="modal-handle" />
        <h2 className="modal-title">오늘의 추억 남기기</h2>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="memory-summary">
            <p className="memory-place">{food.place_name || food.name}</p>
            <p className="memory-date">{formatVisitedAt(initialVisitedAt)}</p>
          </div>

          <div className="input-group">
            <label>같이 찍은 사진 *</label>

            <div className="camera-box">
              {previewUrl ? (
                <div className="memory-preview">
                  <img src={previewUrl} alt="방금 찍은 추억 사진" />
                </div>
              ) : (
                <div className="camera-preview">
                  <video
                    ref={videoRef}
                    className="camera-video"
                    autoPlay
                    muted
                    playsInline
                  />
                  {!cameraReady && (
                    <div className="camera-placeholder">
                      {cameraLoading ? '카메라 준비 중…' : '카메라를 열지 못했어요.'}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="camera-actions">
              {previewUrl ? (
                <button type="button" className="btn-secondary" onClick={handleRetake}>
                  다시 찍기
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCapture}
                  disabled={!cameraReady}
                >
                  사진 찍기
                </button>
              )}
            </div>
          </div>

          <canvas ref={canvasRef} className="camera-canvas" />

          {previewUrl && (
            <div className="input-group">
              <label htmlFor="memory-note">짧은 메모 (선택)</label>
              <textarea
                id="memory-note"
                placeholder="ex) 비 오던 날이라 더 기억에 남았어"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
              />
            </div>
          )}

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions memory-modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              취소
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? '저장 중…' : '추억 저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
