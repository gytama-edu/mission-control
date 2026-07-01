import { useState, useEffect } from 'react';
import { ClassData, Student, Meeting, ActivityLog } from '../types';
import * as db from '../services/missionControlData';
import { supabase } from '../lib/supabaseClient';

const STORAGE_KEY = 'mission_control_classes';

const updateQueue: Record<string, Promise<void>> = {};
const pendingCount: Record<string, number> = {};

export function useClasses(teacherId: string | null) {
  const generateJoinCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();
  const generatePin = () => Math.floor(1000 + Math.random() * 9000).toString();

  const [classes, setClasses] = useState<ClassData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    if (!silent) setError(null);
    try {
      const data = await db.fetchClasses(teacherId);
      
      setClasses(currentClasses => {
        if (!currentClasses.length) return data;
        
        return data.map(newClass => {
          const currentClass = currentClasses.find(c => c.id === newClass.id);
          if (!currentClass) return newClass;

          return {
            ...newClass,
            students: newClass.students?.map(newStudent => {
              if (pendingCount[newStudent.id] > 0) {
                const currentStudent = currentClass.students?.find(s => s.id === newStudent.id);
                return currentStudent || newStudent;
              }
              return newStudent;
            })
          };
        });
      });
      
    } catch (err: any) {
      console.error(err);
      if (!silent) setError(err.message || 'Failed to load data');
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    if (!teacherId) return;

    // Listen to changes on classes, students, meetings, and activity_logs
    const channel = supabase
      .channel('teacher-dashboard-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'classes' },
        () => { loadData(true); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'students' },
        () => { loadData(true); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meetings' },
        () => { loadData(true); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'activity_logs' },
        () => { loadData(true); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

  const addClass = async (name: string, level: string, maxLives: number, category: 'regular' | 'private' = 'regular') => {
    try {
      await db.createClass(name, level, maxLives, generateJoinCode(), teacherId || undefined, category);
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

  const editClass = async (id: string, name: string, level: string, maxLives: number, category?: 'regular' | 'private') => {
    try {
      if (category) {
        await db.updateClass(id, name, level, maxLives, category);
      } else {
        await db.updateClass(id, name, level, maxLives);
      }
      await loadData();
    } catch (err: any) { alert(err.message); }
  };

  const archiveClass = async (id: string) => {
    try {
      await db.archiveClass(id);
      await loadData();
    } catch (err: any) { alert(err.message); }
  };

  const restoreClass = async (id: string) => {
    try {
      await db.restoreClass(id);
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

  const updateStudentLives = async (classId: string, studentId: string, change: number, reason?: string | null) => {
    // We cannot reliably use classes from closure because of rapid updates, so we depend on setClasses callback
    let maxLives = 5;
    
    // Optimistic UI
    setClasses(prev => prev.map(cl => {
      if (cl.id !== classId) return cl;
      maxLives = cl.maxLives;
      return {
        ...cl,
        students: cl.students?.map(s => {
          if (s.id !== studentId) return s;
          const newLives = Math.max(0, Math.min(cl.maxLives, (s.lives ?? 5) + change));
          return { ...s, lives: newLives };
        })
      };
    }));

    pendingCount[studentId] = (pendingCount[studentId] || 0) + 1;
    const prevPromise = updateQueue[studentId] || Promise.resolve();

    updateQueue[studentId] = prevPromise.then(async () => {
      try {
        await db.updateStudentLives(studentId, change, maxLives, reason);
      } catch (err: any) { 
        alert('Could not update lives. Please try again.'); 
      } finally {
        pendingCount[studentId]--;
        if (pendingCount[studentId] === 0) {
          await loadData(true);
        }
      }
    });
  };

  const updateStudentPoints = async (classId: string, studentId: string, change: number, reason?: string | null) => {
    // Optimistic UI
    setClasses(prev => prev.map(cl => {
      if (cl.id !== classId) return cl;
      return {
        ...cl,
        students: cl.students?.map(s => {
          if (s.id !== studentId) return s;
          const newPoints = Math.max(0, (s.points ?? 0) + change);
          return { ...s, points: newPoints };
        })
      };
    }));

    pendingCount[studentId] = (pendingCount[studentId] || 0) + 1;
    const prevPromise = updateQueue[studentId] || Promise.resolve();

    updateQueue[studentId] = prevPromise.then(async () => {
      try {
        await db.updateStudentPoints(studentId, change, reason);
      } catch (err: any) { 
        alert('Could not update points. Please try again.'); 
      } finally {
        pendingCount[studentId]--;
        if (pendingCount[studentId] === 0) {
          await loadData(true);
        }
      }
    });
  };

  const startMeeting = async (classId: string) => {
    try {
      const c = classes.find(cl => cl.id === classId);
      if (!c) return;
      await db.startNewMeeting(classId, c.maxLives);
      await loadData();
    } catch (err: any) { alert(err.message); }
  };

  const endMeeting = async (classId: string, meetingId: string) => {
    try {
      await db.endClassMeeting(meetingId, classId);
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
    archiveClass,
    restoreClass,
    deleteClass,
    addStudent,
    editStudent,
    deleteStudent,
    updateStudentLives,
    updateStudentPoints,
    startMeeting,
    endMeeting,
    regenerateJoinCode,
    regenerateStudentPin,
    syncData: () => loadData(true)
  };
}
