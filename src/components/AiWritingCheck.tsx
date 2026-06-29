import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Loader2, ShieldAlert, Sparkles, CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react';

interface AiWritingCheckProps {
  submissionId: string;
  taskId: string;
  studentName: string;
  submissionText: string;
}

export function AiWritingCheck({ submissionId, taskId, studentName, submissionText }: AiWritingCheckProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const runCheck = async () => {
    if (!submissionId) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('ai-writing-check', {
        body: {
          submission_id: submissionId,
          task_id: taskId,
          review_context: {
            language: "en"
          }
        }
      });

      if (error) throw new Error(error.message || 'Failed to run AI Writing Check');
      
      if (data?.error) {
        throw new Error(data.error);
      }

      setResult(data);
    } catch (err: any) {
      console.error("AI Writing Check Error:", err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const getConcernColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'moderate': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'high': return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      default: return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
    }
  };

  const getConcernIcon = (level: string) => {
    switch (level) {
      case 'low': return <CheckCircle2 size={14} />;
      case 'moderate': return <AlertTriangle size={14} />;
      case 'high': return <AlertCircle size={14} />;
      default: return <Info size={14} />;
    }
  };

  // Do not show if no text
  if (!submissionText || submissionText.trim() === '') {
    return null;
  }

  return (
    <div className="mt-4 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-slate-800 flex flex-wrap gap-4 items-center justify-between bg-slate-950/50">
        <div>
          <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Sparkles size={16} className="text-purple-400" />
            AI Writing Check
          </h4>
          <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1.5">
            <ShieldAlert size={12} className="text-slate-400" />
            Teacher review signals only. Not proof of misconduct.
          </p>
        </div>
        
        {!loading && !result && (
          <button
            onClick={runCheck}
            disabled={loading}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2"
          >
            Run AI Writing Check
          </button>
        )}
      </div>

      {loading && (
        <div className="p-6 flex flex-col items-center justify-center text-slate-400 space-y-3">
          <Loader2 size={24} className="animate-spin text-purple-500" />
          <p className="text-xs font-medium">Analyzing writing patterns...</p>
        </div>
      )}

      {error && (
        <div className="p-4 m-4 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs flex items-start gap-2">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
          <button 
            onClick={runCheck}
            className="ml-auto underline hover:text-rose-300 font-medium"
          >
            Retry
          </button>
        </div>
      )}

      {result && result.status === 'completed' && (
        <div className="p-4 space-y-5">
          {/* Overall Summary */}
          <div className="flex flex-col md:flex-row gap-4 items-start">
            <div className={`shrink-0 px-3 py-2 rounded-lg border flex items-center gap-2 font-bold text-xs uppercase tracking-wider ${getConcernColor(result.overall_review?.concern_level)}`}>
              {getConcernIcon(result.overall_review?.concern_level)}
              {result.overall_review?.concern_level?.replace('_', ' ')} Concern
            </div>
            <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg text-xs text-slate-300 flex-1 leading-relaxed">
              <span className="font-bold text-slate-500 uppercase text-[10px] block mb-1">Summary</span>
              {result.overall_review?.summary}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Feedback & Review Areas */}
            <div className="space-y-4">
              {result.writing_feedback?.strengths?.length > 0 && (
                <div>
                  <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Strengths</h5>
                  <ul className="space-y-1">
                    {result.writing_feedback.strengths.map((item: string, i: number) => (
                      <li key={i} className="text-xs text-emerald-400/90 flex items-start gap-2">
                        <span className="text-emerald-500 mt-0.5">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {result.writing_feedback?.areas_to_review?.length > 0 && (
                <div>
                  <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Areas to Review</h5>
                  <ul className="space-y-1">
                    {result.writing_feedback.areas_to_review.map((item: string, i: number) => (
                      <li key={i} className="text-xs text-amber-400/90 flex items-start gap-2">
                        <span className="text-amber-500 mt-0.5">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Suggestions */}
            <div className="space-y-4">
              {result.writing_feedback?.suggested_follow_up_questions?.length > 0 && (
                <div>
                  <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Suggested Follow-Up Questions</h5>
                  <ul className="space-y-2">
                    {result.writing_feedback.suggested_follow_up_questions.map((item: string, i: number) => (
                      <li key={i} className="bg-slate-800/50 p-2 rounded text-xs text-slate-300 italic border border-slate-800 border-l-2 border-l-purple-500">
                        "{item}"
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Specific Signals */}
          {result.signals?.length > 0 && (
            <div className="pt-4 border-t border-slate-800/80">
              <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Identified Signals</h5>
              <div className="grid sm:grid-cols-2 gap-3">
                {result.signals.map((signal: any, i: number) => (
                  <div key={i} className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-bold text-xs text-slate-200">{signal.title}</span>
                      <span className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${
                        signal.severity === 'high' ? 'bg-rose-500/20 text-rose-400' : 
                        signal.severity === 'moderate' ? 'bg-amber-500/20 text-amber-400' : 
                        'bg-slate-800 text-slate-400'
                      }`}>
                        {signal.severity}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug mb-2">{signal.explanation}</p>
                    {signal.teacher_note && (
                      <div className="bg-purple-500/10 text-purple-300 p-2 rounded text-[10px] mt-2 border border-purple-500/20">
                        <span className="font-bold mr-1">Note:</span>{signal.teacher_note}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Limitations Disclaimer */}
          <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg flex gap-3 items-start">
            <Info size={16} className="text-slate-500 shrink-0 mt-0.5" />
            <div className="text-[10px] text-slate-500 space-y-1">
              <p className="font-bold uppercase tracking-wider text-slate-400 mb-1">Limitations</p>
              {result.limitations?.map((lim: string, i: number) => (
                <p key={i}>• {lim}</p>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end pt-2">
            <button 
              onClick={runCheck}
              className="text-xs text-slate-400 hover:text-slate-300 font-medium px-3 py-1.5 bg-slate-800/50 hover:bg-slate-800 rounded transition-colors"
            >
              Run Again
            </button>
          </div>
        </div>
      )}

      {result && result.status !== 'completed' && (
        <div className="p-4 m-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-xs flex flex-col gap-2">
          <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-[10px]">
            <AlertTriangle size={14} />
            {result.status.replace(/_/g, ' ')}
          </div>
          <p>{result.error || "The submission could not be analyzed."}</p>
          <div className="flex justify-end mt-1">
            <button 
              onClick={runCheck}
              className="underline hover:text-amber-300 font-medium"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
