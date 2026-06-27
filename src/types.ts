export interface Student {
  id: string;
  name: string;
  nickname?: string;
  lives: number;
  points: number;
  joinedAt: string;
  pin: string;
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
  joinCode: string;
  teacherId?: string | null;
}
