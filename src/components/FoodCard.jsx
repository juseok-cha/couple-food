const PERSON_LABEL = {
  여친: { label: '여친', emoji: '👩' },
  남친: { label: '남친', emoji: '👨' },
  둘다: { label: '둘 다', emoji: '👫' },
}

function formatEatenDate(value) {
  if (!value) return ''
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

export default function FoodCard({
  food,
  currentUserId,
  distanceText,
  onOpenMap,
  onDelete,
  onEdit,
  onMarkEaten,
  onToggleFavorite,
  style,
}) {
  const person = food.person ? PERSON_LABEL[food.person] : null
  const isOwn = food.added_by === currentUserId
  const isEaten = Boolean(food.eaten_at)
  const shortNotes = food.notes?.length > 52 ? `${food.notes.slice(0, 52)}…` : food.notes
  const displayTitle = food.place_name || food.name

  return (
    <li className={`food-card${isEaten ? ' eaten' : ''}`} style={style}>
      <div className="food-card-body">
        <div className="food-card-info">
          <div className="food-title-row">
            <button
              className={`favorite-btn${food.is_favorite ? ' active' : ''}`}
              onClick={() => onToggleFavorite(food)}
              aria-label={food.is_favorite ? `${displayTitle} 즐겨찾기 해제` : `${displayTitle} 즐겨찾기`}
            >
              {food.is_favorite ? '★' : '☆'}
            </button>
            <p className="food-name">{displayTitle}</p>
          </div>
          {distanceText && <p className="food-distance">지금 위치에서 {distanceText}</p>}
          {shortNotes && <p className="food-notes">{shortNotes}</p>}
          {!isOwn && food.added_by && (
            <p className="food-added-by">상대방이 추가했어요 💌</p>
          )}
          {isEaten && <p className="food-eaten">방문한 날: {formatEatenDate(food.eaten_at)}</p>}
        </div>
        <div className="food-card-meta">
          {food.category && <span className="food-tag">{food.category}</span>}
          {person && (
            <span className="food-person">
              {person.emoji} {person.label}
            </span>
          )}
          {food.price_level && <span className="food-tag">{'₩'.repeat(food.price_level)}</span>}
        </div>
      </div>
      <div className="food-card-actions">
        <div className="food-primary-actions">
          {!isEaten ? (
            <button
              className="food-action-btn primary"
              onClick={() => onMarkEaten(food)}
              aria-label={`${displayTitle} 방문 완료`}
            >
              방문 완료
            </button>
          ) : (
            <button
              className="food-action-btn"
              onClick={() => onEdit(food)}
              aria-label={`${displayTitle} 수정`}
            >
              메모 수정
            </button>
          )}
        </div>
        <div className="food-secondary-actions">
          <button
            className="food-icon-btn"
            onClick={() => onEdit(food)}
            aria-label={`${displayTitle} 수정`}
            title="수정"
          >
            ✎
          </button>
          {food.map_url && (
            <button
              className="food-icon-btn"
              onClick={() => onOpenMap(food)}
              aria-label={`${displayTitle} 지도 열기`}
              title="지도"
            >
              ⌖
            </button>
          )}
          <button
            className="delete-btn"
            onClick={() => onDelete(food.id)}
            aria-label={`${displayTitle} 삭제`}
            title="삭제"
          >
            ✕
          </button>
        </div>
      </div>
    </li>
  )
}
