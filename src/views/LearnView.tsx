import React, { useState } from 'react';
import { AppState } from '../types';
import {
  LESSONS,
  DAY_1_TASKS,
  PHASE_1_RECAP,
  WEEKLY_ACTION_PLAN,
  PHASE_3_WEEKLY_CHECKLIST,
  DAY_36_TASKS,
  Lesson
} from '../data/learnData';
import {
  BookOpen,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Award,
  Zap,
  Check,
  RotateCcw
} from 'lucide-react';

interface LearnViewProps {
  appState: AppState;
  onToggleLessonLearned: (lessonId: string) => void;
  onAnswerQuiz: (lessonId: string, optionIndex: number) => void;
  onShowToast: (text: string, type?: 'success' | 'info' | 'warning', undo?: () => void) => void;
}

export const LearnView: React.FC<LearnViewProps> = ({
  appState,
  onToggleLessonLearned,
  onAnswerQuiz,
  onShowToast
}) => {
  const { learnedLessonIds, quizAnswers, selectedDayNumber } = appState;
  const initialPhase: 'phase1' | 'phase2' | 'phase3' =
    selectedDayNumber <= 7 ? 'phase1' : selectedDayNumber >= 36 ? 'phase3' : 'phase2';
  const [activePhaseTab, setActivePhaseTab] = useState<'phase1' | 'phase2' | 'phase3'>(initialPhase);

  const filteredLessons = LESSONS.filter((l) => l.phase === activePhaseTab);
  const [expandedLessonId, setExpandedLessonId] = useState<string | null>(filteredLessons[0]?.id || null);

  const completedCount = filteredLessons.filter((l) => learnedLessonIds.includes(l.id)).length;
  const totalCount = filteredLessons.length;

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="space-y-1 pt-1">
        <span className="text-xs font-bold text-[#B6FF3B] uppercase tracking-wider">
          Evidence-Based Knowledge Stack
        </span>
        <h2 className="text-2xl font-extrabold text-white tracking-tight">
          Why This Program Works
        </h2>
        <p className="text-xs text-slate-400">
          Understand the metabolic science behind every repetition and meal.
        </p>
      </div>

      {/* Phase 1 Recap Card */}
      <div className="p-5 sm:p-6 rounded-3xl bg-[#14181D] border border-[#222933] shadow-xl space-y-3">
        <div className="flex items-center gap-2 text-[#B6FF3B]">
          <Sparkles className="w-4 h-4" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-white">
            {PHASE_1_RECAP.title}
          </h3>
        </div>
        <p className="text-xs font-semibold text-slate-300">
          {PHASE_1_RECAP.summary}
        </p>

        <div className="space-y-2 pt-1 text-xs text-slate-400">
          {PHASE_1_RECAP.details.map((detail, idx) => (
            <div key={idx} className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#B6FF3B] shrink-0 mt-0.5" />
              <span>{detail}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Phase Selector & Progress Counter */}
      <div className="flex items-center justify-between p-3 rounded-2xl bg-[#14181D] border border-[#222933]">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0B0D10] border border-[#222933]">
          <button
            type="button"
            onClick={() => {
              setActivePhaseTab('phase1');
              setExpandedLessonId(LESSONS.find((l) => l.phase === 'phase1')?.id || null);
            }}
            className={`px-2.5 py-1.5 min-h-[36px] text-xs font-bold rounded-lg transition-colors ${
              activePhaseTab === 'phase1'
                ? 'bg-[#B6FF3B] text-black shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Phase 1
          </button>
          <button
            type="button"
            onClick={() => {
              setActivePhaseTab('phase2');
              setExpandedLessonId(LESSONS.find((l) => l.phase === 'phase2')?.id || null);
            }}
            className={`px-2.5 py-1.5 min-h-[36px] text-xs font-bold rounded-lg transition-colors ${
              activePhaseTab === 'phase2'
                ? 'bg-[#B6FF3B] text-black shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Phase 2
          </button>
          <button
            type="button"
            onClick={() => {
              setActivePhaseTab('phase3');
              setExpandedLessonId(LESSONS.find((l) => l.phase === 'phase3')?.id || null);
            }}
            className={`px-2.5 py-1.5 min-h-[36px] text-xs font-bold rounded-lg transition-colors ${
              activePhaseTab === 'phase3'
                ? 'bg-[#B6FF3B] text-black shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Phase 3
          </button>
        </div>

        <div className="text-right pr-1">
          <span className="block text-xs font-mono font-bold text-[#B6FF3B]">
            {completedCount} / {totalCount}
          </span>
          <span className="text-[10px] text-slate-500 uppercase">Mastered</span>
        </div>
      </div>

      {/* Lessons Card Stack */}
      <div className="space-y-3">
        {filteredLessons.map((lesson) => {
          const isExpanded = expandedLessonId === lesson.id;
          const isLearned = learnedLessonIds.includes(lesson.id);
          const userAnswer = quizAnswers[lesson.id];
          const hasAnswered = userAnswer !== undefined;
          const isAnswerCorrect = userAnswer === lesson.quiz.correctIndex;

          return (
            <div
              key={lesson.id}
              className={`rounded-2xl border transition-all ${
                isLearned
                  ? 'bg-[#14181D]/80 border-[#B6FF3B]/30'
                  : 'bg-[#14181D] border-[#222933]'
              }`}
            >
              {/* Header Bar */}
              <button
                type="button"
                onClick={() => setExpandedLessonId(isExpanded ? null : lesson.id)}
                className="w-full p-4 flex items-center justify-between text-left gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      isLearned
                        ? 'bg-[#B6FF3B] text-black'
                        : 'bg-[#0B0D10] border border-[#222933] text-slate-500'
                    }`}
                  >
                    {isLearned ? <Check className="w-4 h-4 stroke-[3]" /> : <BookOpen className="w-3.5 h-3.5" />}
                  </div>

                  <div className="min-w-0">
                    <span className="block text-xs sm:text-sm font-bold text-white truncate">
                      {lesson.title}
                    </span>
                    <span className="block text-[11px] text-slate-400 truncate">
                      {lesson.shortSummary}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 text-slate-400">
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {/* Expanded Lesson Content */}
              {isExpanded && (
                <div className="p-4 pt-0 space-y-4 border-t border-[#222933] mt-2 animate-in fade-in">
                  <div className="p-3.5 rounded-xl bg-[#0B0D10] border border-[#222933]">
                    <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                      {lesson.explanation}
                    </p>
                  </div>

                  {/* Micro Quiz */}
                  <div className="p-4 rounded-xl bg-[#181E26] border border-sky-500/20 space-y-3">
                    <div className="flex items-center gap-1.5 text-sky-400 font-bold text-xs">
                      <HelpCircle className="w-4 h-4" />
                      <span>Quick Quiz Check</span>
                    </div>

                    <p className="text-xs font-semibold text-white">
                      {lesson.quiz.question}
                    </p>

                    <div className="space-y-1.5">
                      {lesson.quiz.options.map((opt, optIdx) => {
                        const isChosen = userAnswer === optIdx;
                        const isCorrect = lesson.quiz.correctIndex === optIdx;

                        let btnStyle = 'bg-[#0B0D10] border-[#222933] text-slate-300 hover:border-slate-600';
                        if (hasAnswered) {
                          if (isCorrect) {
                            btnStyle = 'bg-emerald-950/40 border-emerald-500 text-emerald-300 font-bold';
                          } else if (isChosen && !isCorrect) {
                            btnStyle = 'bg-red-950/40 border-red-500 text-red-300';
                          } else {
                            btnStyle = 'bg-[#0B0D10] border-[#222933] text-slate-600 opacity-50';
                          }
                        }

                        return (
                          <button
                            key={optIdx}
                            type="button"
                            disabled={hasAnswered}
                            onClick={() => {
                              onAnswerQuiz(lesson.id, optIdx);
                              if (optIdx === lesson.quiz.correctIndex) {
                                onShowToast('Correct answer! Lesson ready to mark.', 'success');
                              } else {
                                onShowToast('Not quite. Review explanation above.', 'warning');
                              }
                            }}
                            className={`w-full p-2.5 rounded-lg border text-left text-xs transition-colors flex items-center justify-between gap-2 ${btnStyle}`}
                          >
                            <span>{opt}</span>
                            {hasAnswered && isCorrect && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {hasAnswered && (
                      <p className={`text-[11px] leading-relaxed ${isAnswerCorrect ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {lesson.quiz.explanation}
                      </p>
                    )}
                  </div>

                  {/* "Got it" Button */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-500">
                      Under 60 words plain language
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        onToggleLessonLearned(lesson.id);
                        onShowToast(isLearned ? 'Lesson uncompleted' : 'Lesson marked complete! +1 insight', 'info');
                      }}
                      className={`min-h-[44px] px-4 rounded-xl font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all ${
                        isLearned
                          ? 'bg-[#B6FF3B] text-black shadow-md shadow-[#B6FF3B]/10'
                          : 'bg-[#0B0D10] border border-slate-700 text-slate-200 hover:border-[#B6FF3B]'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isLearned ? 'Got It! (Completed)' : 'Got It'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Phase Action Plan / Foundation Reference */}
      <div className="p-5 sm:p-6 rounded-3xl bg-[#14181D] border border-[#222933] shadow-xl space-y-3">
        <div className="flex items-center gap-2 text-white">
          <Award className="w-4 h-4 text-[#B6FF3B]" />
          <h3 className="text-xs font-bold uppercase tracking-wider">
            {activePhaseTab === 'phase1'
              ? 'Phase 1 Foundation Mandates'
              : activePhaseTab === 'phase3'
              ? 'Phase 3 Weekly Blueprint'
              : 'Phase 2 Weekly Action Plan'}
          </h3>
        </div>

        <div className="space-y-2 pt-1 text-xs">
          {activePhaseTab === 'phase1' ? (
            DAY_1_TASKS.map((item, idx) => (
              <div key={item.id} className="p-3 rounded-xl bg-[#0B0D10] border border-[#222933] space-y-0.5">
                <span className="block font-bold text-slate-200">
                  {idx + 1}. {item.task}
                </span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {item.detail}
                </p>
              </div>
            ))
          ) : (
            (activePhaseTab === 'phase3' ? PHASE_3_WEEKLY_CHECKLIST : WEEKLY_ACTION_PLAN).map((item, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-[#0B0D10] border border-[#222933] space-y-0.5">
                <span className="block font-bold text-slate-200">
                  {'action' in item ? `${idx + 1}. ${item.action}` : `${idx + 1}. ${item.label}`}
                </span>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {item.detail}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
