import { useState } from 'react'

const CATEGORIES = ['한식', '일식', '중식', '양식', '분식', '카페', '배달', '기타']

export default function AddFoodModal({ food, onClose, onAdd, onSave }) {
  const isEditing = Boolean(food)
  const [name, setName] = useState(food?.name || '')
  const [location, setLocation] = useState(food?.location || '')
  const [person, setPerson] = useState(food?.person || '')
  const [category, setCategory] = useState(food?.category || '')
  const [notes, setNotes] = useState(food?.notes || '')
  const [priceLevel, setPriceLevel] = useState(food?.price_level || '')
  const [isFavorite, setIsFavorite] = useState(Boolean(food?.is_favorite))
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return

    setLoading(true)
    const payload = {
      name: name.trim(),
      location: location.trim() || null,
      person: person || null,
      category: category || null,
      notes: notes.trim() || null,
      price_level: priceLevel ? Number(priceLevel) : null,
      is_favorite: isFavorite,
    }

    if (isEditing) {
      await onSave(food.id, payload)
    } else {
      await onAdd(payload)
    }

    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-handle" />
        <h2 className="modal-title">{isEditing ? '음식 수정' : '음식 추가'}</h2>

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

          <div className="input-group">
            <label>종류 (선택)</label>
            <div className="chip-grid">
              {CATEGORIES.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`chip${category === item ? ' selected' : ''}`}
                  onClick={() => setCategory((prev) => (prev === item ? '' : item))}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="input-group">
            <label>가격대 (선택)</label>
            <div className="person-chips">
              {[1, 2, 3, 4].map((level) => (
                <button
                  key={level}
                  type="button"
                  className={`chip${Number(priceLevel) === level ? ' selected' : ''}`}
                  onClick={() => setPriceLevel((prev) => (Number(prev) === level ? '' : level))}
                >
                  {'₩'.repeat(level)}
                </button>
              ))}
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="food-notes">메모 (선택)</label>
            <textarea
              id="food-notes"
              placeholder="ex) 웨이팅 길면 포장하기, 매운맛 2단계"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <label className="favorite-toggle">
            <input
              type="checkbox"
              checked={isFavorite}
              onChange={(event) => setIsFavorite(event.target.checked)}
            />
            <span>즐겨찾기에 추가</span>
          </label>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              취소
            </button>
            <button type="submit" className="btn-primary" disabled={loading || !name.trim()}>
              {loading ? '저장 중…' : isEditing ? '저장하기' : '추가하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
