export type ClassroomMode = 'points' | 'lives';

export function getEffectiveClassroomMode(category?: 'regular' | 'private' | string, scoringSystem?: 'points' | 'lives'): ClassroomMode {
  if (scoringSystem) {
    return scoringSystem;
  }
  if (category === 'private') {
    return 'lives';
  }
  return 'points';
}
