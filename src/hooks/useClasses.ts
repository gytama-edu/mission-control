import { useState, useEffect } from 'react';
import { ClassData, Student, Meeting } from '../types';

const STORAGE_KEY = 'mission_control_classes';

export function useClasses() {
  const generateJoinCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();
  const generatePin = () => Math.floor(1000 + Math.random() * 9000).toString();

  const [classes, setClasses] = useState<ClassData[]>(() => {
    try {
      const item = window.localStorage.getItem(STORAGE_KEY);
      if (item) {
        const parsed = JSON.parse(item);
        let migrated = false;
        const updated = parsed.map((c: any) => {
          let cMigrated = false;
          if (!c.joinCode) {
            c.joinCode = generateJoinCode();
            cMigrated = true;
          }
          const updatedStudents = c.students.map((s: any) => {
            if (!s.pin) {
              s.pin = generatePin();
              cMigrated = true;
            } else if (typeof s.pin !== 'string') {
              s.pin = String(s.pin);
              cMigrated = true;
            }
            return s;
          });
          if (cMigrated) {
             migrated = true;
             return { ...c, students: updatedStudents };
          }
          return c;
        });
        if (migrated) {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        }
        return updated;
      }
      return [];
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
      joinCode: generateJoinCode(),
    };
    setClasses([...classes, newClass]);
  };

  const editClass = (id: string, name: string, level: string, maxLives: number) => {
    setClasses(classes.map(c => {
      if (c.id === id) {
        return {
          ...c,
          name,
          level,
          maxLives,
          students: c.students.map(s => ({
            ...s,
            lives: Math.min(s.lives, maxLives)
          }))
        };
      }
      return c;
    }));
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
          pin: generatePin(),
        };
        return { ...c, students: [...c.students, newStudent] };
      }
      return c;
    }));
  };

  const editStudent = (classId: string, studentId: string, name: string, nickname?: string) => {
    setClasses(classes.map(c => {
      if (c.id === classId) {
        return {
          ...c,
          students: c.students.map(s => {
            if (s.id === studentId) {
              return { ...s, name, nickname };
            }
            return s;
          })
        };
      }
      return c;
    }));
  };

  const deleteStudent = (classId: string, studentId: string) => {
    setClasses(classes.map(c => {
      if (c.id === classId) {
        return {
          ...c,
          students: c.students.filter(s => s.id !== studentId)
        };
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

  const regenerateJoinCode = (classId: string) => {
    setClasses(classes.map(c => {
      if (c.id === classId) {
        return { ...c, joinCode: generateJoinCode() };
      }
      return c;
    }));
  };

  const regenerateStudentPin = (classId: string, studentId: string) => {
    setClasses(classes.map(c => {
      if (c.id === classId) {
        return {
          ...c,
          students: c.students.map(s => {
            if (s.id === studentId) {
              return { ...s, pin: generatePin() };
            }
            return s;
          })
        };
      }
      return c;
    }));
  };

  return {
    classes,
    addClass,
    editClass,
    deleteClass,
    addStudent,
    editStudent,
    deleteStudent,
    updateStudentLives,
    updateStudentPoints,
    startMeeting,
    regenerateJoinCode,
    regenerateStudentPin
  };
}
