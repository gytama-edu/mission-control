export function getPointActionMessage(delta: number): string {
  switch (delta) {
    case 1:
      return "Small participation bonus";
    case 3:
      return "Active English participation";
    case 5:
      return "Good answer";
    case 10:
      return "Task completed";
    case -1:
      return "Used Indonesian once";
    case -3:
      return "Repeated Indonesian";
    case -5:
      return "Classroom behavior reminder";
    default:
      if (delta > 0) {
        return "Points added manually";
      } else {
        return "Points deducted manually";
      }
  }
}

export function formatPointActionLabel(delta: number): string {
  const sign = delta > 0 ? '+' : '';
  const message = getPointActionMessage(delta);
  const pointWord = Math.abs(delta) === 1 ? 'point' : 'points';
  return `${sign}${delta} ${pointWord} — ${message}`;
}
