import { useState, useEffect, useRef } from 'react'

const SPIN_DURATION = 2000 // ms
const TICK_START = 60 // ms between ticks (fast)
const TICK_END = 300 // ms between ticks (slow)

export default function RandomPickModal({ foods, onClose, onMarkEaten }) {
  const [phase, setPhase] = useState('spinning') // 'spinning' | 'result'
  const [displayFood, setDisplayFood] = useState(foods[0])
  const [result, setResult] = useState(null)
  const intervalRef = useRef(null)
  const lastResultRef = useRef(null) // keep last picked item across retries

  // Pick a random food, optionally avoiding the last pick
  const pickFood = (exclude) => {
    if (!exclude) {
      return foods[Math.floor(Math.random() * foods.length)]
    }
    const pool = foods.filter((f) => f.id !== exclude.id)
    // If only one item exists, fallback to it
    const source = pool.length ? pool : foods
    return source[Math.floor(Math.random() * source.length)]
  }

  useEffect(() => {
    // Pick the actual result upfront
    const picked = pickFood(lastResultRef.current)
    setResult(picked)
    lastResultRef.current = picked

    // Animate through random items with slowing ticks
    let elapsed = 0
    let tick = TICK_START

    const spin = () => {
      setDisplayFood(pickFood())
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

    const picked = pickFood(lastResultRef.current)
    setResult(picked)
    lastResultRef.current = picked

    let elapsed = 0
    let tick = TICK_START

    const spin = () => {
      setDisplayFood(pickFood())
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

  const handleDecide = async () => {
    if (result && onMarkEaten) {
      await onMarkEaten(result)
    }

    onClose()
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
          {phase === 'result' && displayFood.category && (
            <p className="roulette-person">{displayFood.category}</p>
          )}
          {phase === 'result' && displayFood.price_level && (
            <p className="roulette-person">{'₩'.repeat(displayFood.price_level)}</p>
          )}
          {phase === 'result' && displayFood.notes && (
            <p className="roulette-note">{displayFood.notes}</p>
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
            <button className="btn-primary" onClick={handleDecide}>
              추억 남기기
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
