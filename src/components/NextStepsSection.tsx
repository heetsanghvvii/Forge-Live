import React from 'react';
import type { AppState, TabType } from '../types';
import { deriveNextSteps, isFreshOrEmptyState } from '../utils/nextSteps';
import { CheckCircle2, Circle, ArrowRight, ListTodo, Sparkles } from 'lucide-react';

interface NextStepsSectionProps {
  appState: AppState;
  onNavigateTab: (tab: TabType) => void;
  onConfirmScheduleClick?: () => void;
}

export const NextStepsSection: React.FC<NextStepsSectionProps> = ({
  appState,
  onNavigateTab,
  onConfirmScheduleClick
}) => {
  const items = deriveNextSteps(appState);
  const isFresh = isFreshOrEmptyState(appState);

  const completedCount = items.filter((i) => i.completed).length;
  const totalCount = items.length;
  const allDone = totalCount > 0 && completedCount === totalCount;

  return (
    <section
      aria-label="Next steps"
      className="p-5 rounded-2xl bg-[#14181D] border border-[#222933] shadow-lg space-y-3.5"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#B6FF3B]/10 border border-[#B6FF3B]/30 flex items-center justify-center text-[#B6FF3B] shrink-0">
            {allDone ? (
              <Sparkles className="w-4 h-4 text-[#B6FF3B]" />
            ) : (
              <ListTodo className="w-4 h-4 text-[#B6FF3B]" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-white tracking-tight uppercase">
              Next Steps
            </h3>
            <p className="text-[11px] text-slate-400 truncate">
              {isFresh
                ? 'Foundation Starter Steps'
                : allDone
                ? 'All targets complete today!'
                : `${completedCount} of ${totalCount} completed`}
            </p>
          </div>
        </div>

        <div className="shrink-0">
          {allDone ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#B6FF3B]/15 border border-[#B6FF3B]/30 text-[#B6FF3B] text-[10px] font-extrabold uppercase">
              Complete
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-lg bg-[#0B0D10] border border-[#222933] text-slate-400 font-mono text-[10px] font-bold uppercase">
              {completedCount}/{totalCount} Done
            </span>
          )}
        </div>
      </div>

      {/* Items list */}
      <div className="space-y-2">
        {items.map((item) => {
          const isItemCompleted = item.completed;

          return (
            <div
              key={item.id}
              className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                isItemCompleted
                  ? 'bg-[#0B0D10]/50 border-[#222933]/50 opacity-80'
                  : 'bg-[#0B0D10] border-[#222933] hover:border-slate-700'
              }`}
            >
              {/* Status icon + Text */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                    isItemCompleted
                      ? 'bg-[#B6FF3B] text-black'
                      : 'bg-[#14181D] border border-[#222933] text-slate-600'
                  }`}
                >
                  {isItemCompleted ? (
                    <CheckCircle2 className="w-4 h-4 fill-[#B6FF3B] text-black" />
                  ) : (
                    <Circle className="w-3.5 h-3.5 text-slate-500" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h4
                    className={`text-xs sm:text-sm font-bold truncate ${
                      isItemCompleted ? 'line-through text-slate-400' : 'text-white'
                    }`}
                  >
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                    {item.description}
                  </p>
                </div>
              </div>

              {/* Action Button */}
              {item.actionTab && (
                <button
                  type="button"
                  onClick={() => {
                    if (item.id === 'starter-schedule' && onConfirmScheduleClick) {
                      onConfirmScheduleClick();
                    } else if (item.actionTab) {
                      onNavigateTab(item.actionTab);
                    }
                  }}
                  className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold flex items-center gap-1 active:scale-95 transition-all ${
                    isItemCompleted
                      ? 'bg-[#14181D] border border-[#222933] text-slate-400 hover:text-white'
                      : 'bg-[#B6FF3B] text-black hover:bg-[#a6ec31] shadow-sm shadow-[#B6FF3B]/10'
                  }`}
                >
                  <span>{item.actionLabel}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
