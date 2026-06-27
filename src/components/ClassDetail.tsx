import { useState } from 'react';
import { ClassData } from '../types';
import { ArrowLeft, Users, Shield, Plus, Minus, Star, Play, Trophy } from 'lucide-react';

interface ClassDetailProps {
  classData: ClassData;
  onBack: () => void;
  onAddStudent: (name: string) => void;
  onUpdateLives: (studentId: string, change: number) => void;
  onUpdatePoints: (studentId: string, change: number) => void;
  onStartMeeting: () => void;
}

export function ClassDetail({
  classData,
  onBack,
  onAddStudent,
  onUpdateLives,
  onUpdatePoints,
  onStartMeeting
}: ClassDetailProps) {
  const [newStudentName, setNewStudentName] = useState('');
  const [activeTab, setActiveTab] = useState<'roster' | 'leaderboard'>('roster');

  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;
    onAddStudent(newStudentName.trim());
    setNewStudentName('');
  };

  const sortedStudents = [...classData.students].sort((a, b) => b.points - a.points);

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <header className="mb-8">
        <button
          onClick={onBack}
          className="text-slate-400 hover:text-white flex items-center gap-2 mb-6 transition-colors"
        >
          <ArrowLeft size={20} />
          Back to Dashboard
        </button>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-lg">
          <div>
            <h1 className="text-3xl font-display font-bold text-white mb-2">{classData.name}</h1>
            <div className="flex flex-wrap gap-4 text-sm text-slate-400">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-slate-300">
                <Users size={14} /> Level: {classData.level}
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-slate-300">
                <Shield size={14} /> Max Lives: {classData.maxLives}
              </span>
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-slate-300">
                <Play size={14} /> Meetings: {classData.meetings.length}
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              if (confirm('Start a new meeting? This will reset all student lives to maximum.')) {
                onStartMeeting();
              }
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
          >
            <Play size={20} className="fill-current" />
            Start New Meeting
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 mb-8">
        <button
          onClick={() => setActiveTab('roster')}
          className={`px-6 py-3 font-medium transition-colors relative ${
            activeTab === 'roster' ? 'text-white' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Class Roster
          {activeTab === 'roster' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`px-6 py-3 font-medium transition-colors relative flex items-center gap-2 ${
            activeTab === 'leaderboard' ? 'text-white' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Trophy size={16} /> Leaderboard
          {activeTab === 'leaderboard' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-yellow-500" />
          )}
        </button>
      </div>

      {activeTab === 'roster' && (
        <div className="space-y-8">
          {/* Add Student Form */}
          <form onSubmit={handleAddStudent} className="flex gap-3">
            <input
              type="text"
              required
              value={newStudentName}
              onChange={(e) => setNewStudentName(e.target.value)}
              placeholder="New student name..."
              className="flex-1 max-w-md bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <Plus size={18} /> Add Student
            </button>
          </form>

          {/* Roster Grid */}
          {classData.students.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              No students added yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {classData.students.map((student) => (
                <div key={student.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-lg text-white">{student.name}</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Lives Control */}
                    <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                      <div className="text-xs text-slate-500 font-medium mb-2 uppercase tracking-wider flex items-center gap-1">
                        <Shield size={12} className="text-red-400" /> Lives
                      </div>
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => onUpdateLives(student.id, -1)}
                          disabled={student.lives <= 0}
                          className="w-8 h-8 rounded bg-slate-800 text-white flex items-center justify-center hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Minus size={16} />
                        </button>
                        <span className={`font-mono text-xl font-bold ${student.lives === 0 ? 'text-red-500' : 'text-white'}`}>
                          {student.lives}
                        </span>
                        <button
                          onClick={() => onUpdateLives(student.id, 1)}
                          disabled={student.lives >= classData.maxLives}
                          className="w-8 h-8 rounded bg-slate-800 text-white flex items-center justify-center hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Points Control */}
                    <div className="bg-slate-950 rounded-lg p-3 border border-slate-800">
                      <div className="text-xs text-slate-500 font-medium mb-2 uppercase tracking-wider flex items-center gap-1">
                        <Star size={12} className="text-yellow-400" /> Points
                      </div>
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => onUpdatePoints(student.id, -1)}
                          disabled={student.points <= 0}
                          className="w-8 h-8 rounded bg-slate-800 text-white flex items-center justify-center hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Minus size={16} />
                        </button>
                        <span className="font-mono text-xl font-bold text-white">
                          {student.points}
                        </span>
                        <button
                          onClick={() => onUpdatePoints(student.id, 1)}
                          className="w-8 h-8 rounded bg-slate-800 text-white flex items-center justify-center hover:bg-slate-700"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'leaderboard' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden max-w-3xl">
          {sortedStudents.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No students available for the leaderboard.</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800">
                  <th className="p-4 text-slate-400 font-medium w-16 text-center">Rank</th>
                  <th className="p-4 text-slate-400 font-medium">Student Name</th>
                  <th className="p-4 text-slate-400 font-medium text-right w-32">Points</th>
                </tr>
              </thead>
              <tbody>
                {sortedStudents.map((student, idx) => (
                  <tr key={student.id} className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/20">
                    <td className="p-4 text-center">
                      {idx === 0 ? (
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-yellow-500/20 text-yellow-500 font-bold">1</span>
                      ) : idx === 1 ? (
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-300/20 text-slate-300 font-bold">2</span>
                      ) : idx === 2 ? (
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-600/20 text-amber-500 font-bold">3</span>
                      ) : (
                        <span className="text-slate-500 font-mono">{idx + 1}</span>
                      )}
                    </td>
                    <td className="p-4 font-medium text-white">{student.name}</td>
                    <td className="p-4 text-right font-mono text-yellow-400 font-bold">{student.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
