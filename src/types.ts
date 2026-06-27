export interface Student {
  id: string;
  name: string;
  lives: number;
  points: number;
  joinedAt: string;
}

export interface Meeting {
  id: string;
  startedAt: string;
}

export interface ClassData {
  id: string;
  name: string;
  level: string;
  maxLives: number;
  students: Student[];
  meetings: Meeting[];
  createdAt: string;
}
