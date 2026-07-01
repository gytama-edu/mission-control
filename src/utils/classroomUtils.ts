export type ClassroomMode = 'points' | 'lives';

export function getEffectiveClassroomMode(category?: 'regular' | 'private' | string, scoringSystem?: 'points' | 'lives'): ClassroomMode {
  if (scoringSystem) {
    return scoringSystem;
  }
  if (isPrivateClassCategory(category)) {
    return 'lives';
  }
  return 'points';
}

export function isPrivateClassCategory(category?: string | null | any) {
  // Handle case where category might be passed directly as string or it might be an object containing the category
  const catString = typeof category === 'string' ? category : (category?.category || category?.class_category || '');
  return String(catString || '').toLowerCase() === 'private';
}

export function shouldShowCompetitiveRank(category?: string | null | any) {
  return !isPrivateClassCategory(category);
}
