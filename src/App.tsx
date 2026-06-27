/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { useClasses } from './hooks/useClasses';
import { Dashboard } from './components/Dashboard';
import { ClassDetail } from './components/ClassDetail';

export default function App() {
  const {
    classes,
    addClass,
    deleteClass,
    addStudent,
    updateStudentLives,
    updateStudentPoints,
    startMeeting
  } = useClasses();

  const [activeClassId, setActiveClassId] = useState<string | null>(null);

  const activeClass = classes.find(c => c.id === activeClassId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {activeClass ? (
        <ClassDetail
          classData={activeClass}
          onBack={() => setActiveClassId(null)}
          onAddStudent={(name) => addStudent(activeClass.id, name)}
          onUpdateLives={(studentId, change) => updateStudentLives(activeClass.id, studentId, change)}
          onUpdatePoints={(studentId, change) => updateStudentPoints(activeClass.id, studentId, change)}
          onStartMeeting={() => startMeeting(activeClass.id)}
        />
      ) : (
        <Dashboard
          classes={classes}
          onAddClass={addClass}
          onDeleteClass={deleteClass}
          onSelectClass={setActiveClassId}
        />
      )}
    </div>
  );
}
