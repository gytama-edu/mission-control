/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { useClasses } from './hooks/useClasses';
import { Dashboard } from './components/Dashboard';
import { ClassDetail } from './components/ClassDetail';
import { Landing } from './components/Landing';
import { StudentAccess } from './components/StudentAccess';

export default function App() {
  const [viewMode, setViewMode] = useState<'landing' | 'teacher' | 'student'>('landing');
  const {
    classes,
    isLoading,
    error,
    importLocalData,
    addClass,
    editClass,
    deleteClass,
    regenerateJoinCode,
    addStudent,
    editStudent,
    deleteStudent,
    regenerateStudentPin,
    updateStudentLives,
    updateStudentPoints,
    startMeeting
  } = useClasses();

  const [activeClassId, setActiveClassId] = useState<string | null>(null);

  const activeClass = classes.find(c => c.id === activeClassId);

  if (viewMode === 'landing') {
    return <Landing onSelectTeacher={() => setViewMode('teacher')} onSelectStudent={() => setViewMode('student')} />;
  }

  if (viewMode === 'student') {
    return <StudentAccess onBack={() => setViewMode('landing')} />;
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
          onUpdateLives={(studentId, change) => updateStudentLives(activeClass.id, studentId, change)}
          onUpdatePoints={(studentId, change) => updateStudentPoints(activeClass.id, studentId, change)}
          onStartMeeting={() => startMeeting(activeClass.id)}
        />
      ) : (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-4">
          <div className="w-full max-w-7xl mx-auto mb-4">
            <button
              onClick={() => setViewMode('landing')}
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
          />
        </div>
      )}
    </div>
  );
}
