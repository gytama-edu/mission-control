import { useState, useEffect } from 'react';
import { ClassData, Student, Meeting } from '../types';
import * as db from '../services/missionControlData';

const STORAGE_KEY = 'mission_control_classes';

export function useClasses(teacherId: string | null) {
  const generateJoinCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();
  const generatePin = () => Math.floor(1000 + Math.random() * 9000).toString();

  const [classes, setClasses] = useState<ClassData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await db.fetchClasses(teacherId);
      setClasses(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [teacherId]);

  const importLocalData = async () => {
    try {
      setIsLoading(true);
      const item = window.localStorage.getItem(STORAGE_KEY);
      if (!item) return;
      const localClasses = JSON.parse(item);
      for (const c of localClasses) {
        const joinCode = c.joinCode || generateJoinCode();
        const newClass = await db.createClass(c.name, c.level || '', c.maxLives, joinCode, teacherId || undefined);
        
        for (const s of c.students || []) {
          const pin = s.pin || generatePin();
          const newStudent = await db.addStudent(newClass.id, s.name, s.lives, String(pin));
          if (s.points > 0) {
            await db.updateStudentPoints(newStudent.id, s.points);
          }
          if (s.nickname) {
            await db.updateStudent(newStudent.id, s.name, s.nickname);
          }
        }
      }
      await loadData();
      alert('Local data imported to Supabase successfully!');
    } catch (err: any) {
      console.error(err);
      alert('Failed to import data: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const addClass = async (name: string, level: string, maxLives: number) => {
    try {
      await db.createClass(name, level, maxLives, generateJoinCode(), teacherId || undefined);
      await loadData();
    } catch (err: any) { alert(err.message); }
  };

  const claimClass = async (classId: string) => {
    if (!teacherId) return;
    try {
      await db.claimClass(classId, teacherId);
      await loadData();
    } catch (err: any) { alert(err.message); }
  };

  const editClass = async (id: string, name: string, level: string, maxLives: number) => {
    try {
      await db.updateClass(id, name, level, maxLives);
      await loadData();
    } catch (err: any) { alert(err.message); }
  };

  const deleteClass = async (id: string) => {
    try {
      await db.deleteClass(id);
      await loadData();
    } catch (err: any) { alert(err.message); }
  };

  const regenerateJoinCode = async (classId: string) => {
    try {
      await db.regenerateJoinCode(classId, generateJoinCode());
      await loadData();
    } catch (err: any) { alert(err.message); }
  };

  const addStudent = async (classId: string, name: string) => {
    try {
      const c = classes.find(cl => cl.id === classId);
      if (!c) return;
      await db.addStudent(classId, name, c.maxLives, generatePin());
      await loadData();
    } catch (err: any) { alert(err.message); }
  };

  const editStudent = async (classId: string, studentId: string, name: string, nickname?: string) => {
    try {
      await db.updateStudent(studentId, name, nickname);
      await loadData();
    } catch (err: any) { alert(err.message); }
  };

  const deleteStudent = async (classId: string, studentId: string) => {
    try {
      await db.deleteStudent(studentId);
      await loadData();
    } catch (err: any) { alert(err.message); }
  };

  const regenerateStudentPin = async (classId: string, studentId: string) => {
    try {
      await db.resetStudentPin(studentId, generatePin());
      await loadData();
    } catch (err: any) { alert(err.message); }
  };

  const updateStudentLives = async (classId: string, studentId: string, change: number) => {
    try {
      const c = classes.find(cl => cl.id === classId);
      if (!c) return;
      await db.updateStudentLives(studentId, change, c.maxLives);
      await loadData();
    } catch (err: any) { alert(err.message); }
  };

  const updateStudentPoints = async (classId: string, studentId: string, change: number) => {
    try {
      await db.updateStudentPoints(studentId, change);
      await loadData();
    } catch (err: any) { alert(err.message); }
  };

  const startMeeting = async (classId: string) => {
    try {
      const c = classes.find(cl => cl.id === classId);
      if (!c) return;
      await db.startNewMeeting(classId, c.maxLives);
      await loadData();
    } catch (err: any) { alert(err.message); }
  };

  return {
    classes,
    isLoading,
    error,
    importLocalData,
    addClass,
    claimClass,
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
