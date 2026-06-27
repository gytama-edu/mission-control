import { useState, useEffect } from 'react';
import { ClassData, Student, Meeting } from '../types';

const STORAGE_KEY = 'mission_control_classes';

export function useClasses() {
  const [classes, setClasses] = useState<ClassData[]>(() => {
    try {
      const item = window.localStorage.getItem(STORAGE_KEY);
      return item ? JSON.parse(item) : [];
    } catch (error) {
      console.error(error);
      return [];
    }
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(classes));
  }, [classes]);

  const addClass = (name: string, level: string, maxLives: number) => {
    const newClass: ClassData = {
      id: crypto.randomUUID(),
      name,
      level,
      maxLives,
      students: [],
      meetings: [],
      createdAt: new Date().toISOString(),
    };
    setClasses([...classes, newClass]);
  };

  const deleteClass = (id: string) => {
    setClasses(classes.filter(c => c.id !== id));
  };

  const addStudent = (classId: string, name: string) => {
    setClasses(classes.map(c => {
      if (c.id === classId) {
        const newStudent: Student = {
          id: crypto.randomUUID(),
          name,
          lives: c.maxLives,
          points: 0,
          joinedAt: new Date().toISOString(),
        };
        return { ...c, students: [...c.students, newStudent] };
      }
      return c;
    }));
  };

  const updateStudentLives = (classId: string, studentId: string, change: number) => {
    setClasses(classes.map(c => {
      if (c.id === classId) {
        return {
          ...c,
          students: c.students.map(s => {
            if (s.id === studentId) {
              return { ...s, lives: Math.max(0, Math.min(s.lives + change, c.maxLives)) };
            }
            return s;
          })
        };
      }
      return c;
    }));
  };

  const updateStudentPoints = (classId: string, studentId: string, change: number) => {
    setClasses(classes.map(c => {
      if (c.id === classId) {
        return {
          ...c,
          students: c.students.map(s => {
            if (s.id === studentId) {
              return { ...s, points: Math.max(0, s.points + change) };
            }
            return s;
          })
        };
      }
      return c;
    }));
  };

  const startMeeting = (classId: string) => {
    setClasses(classes.map(c => {
      if (c.id === classId) {
        const newMeeting: Meeting = {
          id: crypto.randomUUID(),
          startedAt: new Date().toISOString(),
        };
        return {
          ...c,
          meetings: [...c.meetings, newMeeting],
          students: c.students.map(s => ({
            ...s,
            lives: c.maxLives // Reset lives to maxLives, points unchanged
          }))
        };
      }
      return c;
    }));
  };

  return {
    classes,
    addClass,
    deleteClass,
    addStudent,
    updateStudentLives,
    updateStudentPoints,
    startMeeting
  };
}
