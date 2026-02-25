const PERSON_LABEL = {
  여친: { label: '여친', emoji: '👩' },
  남친: { label: '남친', emoji: '👨' },
  둘다: { label: '둘 다', emoji: '👫' },
}

export default function FoodCard({ food, onDelete, style }) {
  const person = food.person ? PERSON_LABEL[food.person] : null

  return (
    <li className="food-card" style={style}>
      <div className="food-card-body">
        <div className="food-card-info">
          <p className="food-name">{food.name}</p>
          {food.location && <p className="food-location">📍 {food.location}</p>}
        </div>
        <div className="food-card-meta">
          {person && (
            <span className="food-person">
              {person.emoji} {person.label}
            </span>
          )}
        </div>
      </div>
      <button
        className="delete-btn"
        onClick={() => onDelete(food.id)}
        aria-label={`${food.name} 삭제`}
      >
        ✕
      </button>
    </li>
  )
}
