import React from 'react';

/**
 * Lightweight loading skeletons. Use these instead of spinners for a
 * snappier "the page is filling in" feel.
 *
 *   <SkeletonRow />          // single row in a list
 *   <SkeletonCard />         // card placeholder
 *   <SkeletonStat />         // KPI tile placeholder
 */

const baseClass = 'animate-pulse bg-slate-200 rounded';

export const SkeletonRow = ({ width = 'w-full' }) => (
  <div className={`h-4 ${width} ${baseClass}`} />
);

export const SkeletonCard = () => (
  <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl ${baseClass}`} />
      <div className="flex-1 space-y-2">
        <SkeletonRow width="w-1/2" />
        <SkeletonRow width="w-1/3" />
      </div>
    </div>
    <SkeletonRow />
    <SkeletonRow width="w-3/4" />
  </div>
);

export const SkeletonStat = () => (
  <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
    <SkeletonRow width="w-1/3" />
    <div className={`h-7 w-1/2 ${baseClass}`} />
  </div>
);

export const SkeletonList = ({ count = 3 }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} />
    ))}
  </div>
);

export default SkeletonCard;
