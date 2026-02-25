import { useState } from 'react'

export default function AddFoodModal({ onClose, onAdd }) {
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [person, setPerson] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    await onAdd({
      name: name.trim(),
      location: location.trim() || null,
      person: person || null,
    })
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <h2 className="modal-title">음식 추가</h2>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="input-group">
            <label htmlFor="food-name">음식 이름 *</label>
            <input
              id="food-name"
              type="text"
              placeholder="ex) 삼겹살, 스시, 마라탕"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="input-group">
            <label htmlFor="food-location">장소 (선택)</label>
            <input
              id="food-location"
              type="text"
              placeholder="ex) 강남구 논현동 맛집"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label>누가 원해요? (선택)</label>
            <div className="person-chips">
              {['여친', '남친', '둘다'].map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`chip${person === p ? ' selected' : ''}`}
                  onClick={() => setPerson((prev) => (prev === p ? '' : p))}
                >
                  {p === '여친' ? '👩 여친' : p === '남친' ? '👨 남친' : '👫 둘 다'}
                </button>
              ))}
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              취소
            </button>
            <button type="submit" className="btn-primary" disabled={loading || !name.trim()}>
              {loading ? '추가 중…' : '추가하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
