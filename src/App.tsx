/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { useClasses } from './hooks/useClasses';
import { Dashboard } from './components/Dashboard';
import { ClassDetail } from './components/ClassDetail';
import { Landing } from './components/Landing';
import { StudentAccess } from './components/StudentAccess';
import { TeacherAuth } from './components/TeacherAuth';
import { isSupabaseConfigured, supabase } from './lib/supabaseClient';
import { AlertTriangle, Loader2 } from 'lucide-react';

export default function App() {
  const [teacherUser, setTeacherUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [viewMode, setViewMode] = useState<'landing' | 'teacher' | 'student'>(() => {
    try {
      const saved = window.localStorage.getItem('mission_control_view_mode');
      if (saved === 'landing' || saved === 'teacher' || saved === 'student') {
        return saved;
      }
    } catch (e) {
      console.error(e);
    }
    return 'landing';
  });

  const handleSetViewMode = (mode: 'landing' | 'teacher' | 'student') => {
    setViewMode(mode);
    try {
      window.localStorage.setItem('mission_control_view_mode', mode);
    } catch (e) {
      console.error(e);
    }
  };

  // Check auth session on load
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setTeacherUser(session?.user ?? null);
      } catch (err) {
        console.error('Error retrieving session:', err);
      } finally {
        setAuthLoading(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setTeacherUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setTeacherUser(null);
      handleSetViewMode('landing');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-red-500/30 rounded-2xl p-8 shadow-2xl text-center">
          <AlertTriangle className="mx-auto h-16 w-16 text-red-500 mb-6" />
          <h1 className="text-2xl font-display font-bold text-white mb-4">
            Configuration Required
          </h1>
          <p className="text-slate-400 mb-6">
            Supabase is not configured. Please check environment variables.
          </p>
          <div className="bg-slate-950 p-4 rounded-xl text-left font-mono text-sm text-slate-300 border border-slate-800 mb-6 space-y-2">
            <div>Make sure these are defined in your environment:</div>
            <div className="text-blue-400 font-bold">VITE_SUPABASE_URL</div>
            <div className="text-blue-400 font-bold">VITE_SUPABASE_PUBLISHABLE_KEY</div>
          </div>
          <p className="text-xs text-slate-500">
            Provide these keys in your AI Studio settings or GitHub repository secrets.
          </p>
        </div>
      </div>
    );
  }

  const {
    classes,
    isLoading,
    error,
    importLocalData,
    addClass,
    claimClass,
    editClass,
    deleteClass,
    regenerateJoinCode,
    addStudent,
    editStudent,
    deleteStudent,
    regenerateStudentPin,
    updateStudentLives,
    updateStudentPoints,
    startMeeting,
    endMeeting
  } = useClasses(teacherUser?.id || null);

  const [activeClassId, setActiveClassId] = useState<string | null>(null);

  const activeClass = classes.find(c => c.id === activeClassId);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 text-blue-500 animate-spin mb-4" />
          <p className="text-slate-400">Loading teacher profile...</p>
        </div>
      </div>
    );
  }

  if (viewMode === 'landing') {
    return <Landing onSelectTeacher={() => handleSetViewMode('teacher')} onSelectStudent={() => handleSetViewMode('student')} />;
  }

  if (viewMode === 'student') {
    return <StudentAccess onBack={() => handleSetViewMode('landing')} />;
  }

  // If viewMode is teacher but no teacher is logged in, show TeacherAuth screen
  if (viewMode === 'teacher' && !teacherUser) {
    return (
      <TeacherAuth
        onBack={() => handleSetViewMode('landing')}
        onAuthSuccess={(user) => {
          setTeacherUser(user);
          handleSetViewMode('teacher');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {activeClass ? (
        <ClassDetail
          classData={activeClass}
          onBack={() => setActiveClassId(null)}
          onEditClass={(name, level, maxLives) => editClass(activeClass.id, name, level, maxLives)}
          onDeleteClass={() => {
            deleteClass(activeClass.id);
            setActiveClassId(null);
          }}
          onRegenerateJoinCode={() => regenerateJoinCode(activeClass.id)}
          onAddStudent={(name) => addStudent(activeClass.id, name)}
          onEditStudent={(studentId, name, nickname) => editStudent(activeClass.id, studentId, name, nickname)}
          onDeleteStudent={(studentId) => deleteStudent(activeClass.id, studentId)}
          onRegenerateStudentPin={(studentId) => regenerateStudentPin(activeClass.id, studentId)}
          onUpdateLives={(studentId, change, reason) => updateStudentLives(activeClass.id, studentId, change, reason)}
          onUpdatePoints={(studentId, change, reason) => updateStudentPoints(activeClass.id, studentId, change, reason)}
          onStartMeeting={() => startMeeting(activeClass.id)}
          onEndMeeting={(meetingId) => endMeeting(activeClass.id, meetingId)}
        />
      ) : (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-4">
          <div className="w-full max-w-7xl mx-auto mb-4">
            <button
              onClick={() => handleSetViewMode('landing')}
              className="text-slate-400 hover:text-white flex items-center gap-2 transition-colors"
            >
              ← Back to Main Menu
            </button>
          </div>
          <Dashboard
            classes={classes}
            isLoading={isLoading}
            error={error}
            onAddClass={addClass}
            onDeleteClass={deleteClass}
            onSelectClass={setActiveClassId}
            onImportLocalData={importLocalData}
            onClaimClass={claimClass}
            teacherEmail={teacherUser?.email}
            onLogout={handleLogout}
          />
        </div>
      )}
    </div>
  );
}
