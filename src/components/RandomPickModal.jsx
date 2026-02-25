import { useState, useEffect, useRef } from 'react'

const SPIN_DURATION = 2000 // ms
const TICK_START = 60 // ms between ticks (fast)
const TICK_END = 300 // ms between ticks (slow)

export default function RandomPickModal({ foods, onClose }) {
  const [phase, setPhase] = useState('spinning') // 'spinning' | 'result'
  const [displayFood, setDisplayFood] = useState(foods[0])
  const [result, setResult] = useState(null)
  const intervalRef = useRef(null)

  useEffect(() => {
    // Pick the actual result upfront
    const picked = foods[Math.floor(Math.random() * foods.length)]
    setResult(picked)

    // Animate through random items with slowing ticks
    let elapsed = 0
    let tick = TICK_START

    const spin = () => {
      setDisplayFood(foods[Math.floor(Math.random() * foods.length)])
      elapsed += tick

      // Gradually slow down
      tick = TICK_START + Math.floor((TICK_END - TICK_START) * (elapsed / SPIN_DURATION))

      if (elapsed >= SPIN_DURATION) {
        clearInterval(intervalRef.current)
        setDisplayFood(picked)
        setPhase('result')
      } else {
        clearInterval(intervalRef.current)
        intervalRef.current = setTimeout(spin, tick)
      }
    }

    intervalRef.current = setTimeout(spin, tick)

    return () => {
      clearTimeout(intervalRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRetry = () => {
    setPhase('spinning')
    setDisplayFood(foods[0])
    setResult(null)

    const picked = foods[Math.floor(Math.random() * foods.length)]
    setResult(picked)

    let elapsed = 0
    let tick = TICK_START

    const spin = () => {
      setDisplayFood(foods[Math.floor(Math.random() * foods.length)])
      elapsed += tick
      tick = TICK_START + Math.floor((TICK_END - TICK_START) * (elapsed / SPIN_DURATION))

      if (elapsed >= SPIN_DURATION) {
        clearTimeout(intervalRef.current)
        setDisplayFood(picked)
        setPhase('result')
      } else {
        clearTimeout(intervalRef.current)
        intervalRef.current = setTimeout(spin, tick)
      }
    }

    clearTimeout(intervalRef.current)
    intervalRef.current = setTimeout(spin, tick)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet random-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <h2 className="modal-title">
          {phase === 'spinning' ? '뽑는 중…' : '오늘의 선택! 🎉'}
        </h2>

        <div className={`roulette-box${phase === 'result' ? ' result' : ''}`}>
          <div className={`roulette-name${phase === 'spinning' ? ' spinning' : ''}`}>
            {displayFood.name}
          </div>
          {phase === 'result' && displayFood.location && (
            <p className="roulette-location">📍 {displayFood.location}</p>
          )}
          {phase === 'result' && displayFood.person && (
            <p className="roulette-person">
              {displayFood.person === '여친' ? '👩 여친이 원했어요' :
               displayFood.person === '남친' ? '👨 남친이 원했어요' :
               '👫 둘 다 원했어요'}
            </p>
          )}
        </div>

        {phase === 'result' && (
          <div className="modal-actions">
            <button className="btn-secondary" onClick={handleRetry}>
              다시 뽑기 🔄
            </button>
            <button className="btn-primary" onClick={onClose}>
              이걸로 결정! ✓
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
