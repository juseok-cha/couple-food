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
  onDelete,
  onEdit,
  onMarkEaten,
  onToggleFavorite,
  style,
}) {
  const person = food.person ? PERSON_LABEL[food.person] : null
  const isOwn = food.added_by === currentUserId
  const isEaten = Boolean(food.eaten_at)

  return (
    <li className={`food-card${isEaten ? ' eaten' : ''}`} style={style}>
      <div className="food-card-body">
        <div className="food-card-info">
          <div className="food-title-row">
            <button
              className={`favorite-btn${food.is_favorite ? ' active' : ''}`}
              onClick={() => onToggleFavorite(food)}
              aria-label={food.is_favorite ? `${food.name} 즐겨찾기 해제` : `${food.name} 즐겨찾기`}
            >
              {food.is_favorite ? '★' : '☆'}
            </button>
            <p className="food-name">{food.name}</p>
          </div>
          {food.location && <p className="food-location">📍 {food.location}</p>}
          {food.notes && <p className="food-notes">{food.notes}</p>}
          {!isOwn && food.added_by && (
            <p className="food-added-by">상대방이 추가했어요 💌</p>
          )}
          {isEaten && <p className="food-eaten">먹은 날: {formatEatenDate(food.eaten_at)}</p>}
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
        {!isEaten && (
          <button
            className="food-action-btn"
            onClick={() => onMarkEaten(food)}
            aria-label={`${food.name} 먹음 표시`}
          >
            먹음
          </button>
        )}
        <button
          className="food-action-btn"
          onClick={() => onEdit(food)}
          aria-label={`${food.name} 수정`}
        >
          수정
        </button>
        <button
          className="delete-btn"
          onClick={() => onDelete(food.id)}
          aria-label={`${food.name} 삭제`}
        >
          ✕
        </button>
      </div>
    </li>
  )
}
