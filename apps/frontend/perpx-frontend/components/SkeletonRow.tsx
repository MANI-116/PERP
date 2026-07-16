export function SkeletonRow({ width }: { width: string }) {
  return (
    <div className="flex flex-row mb-px ml-1 mr-1">
      <div className="flex-1"><div className="h-3 bg-zinc-800 rounded animate-pulse" style={{ width }} /></div>
      <div className="flex-1 text-right"><div className="h-3 bg-zinc-800 rounded animate-pulse inline-block" style={{ width: "60%" }} /></div>
      <div className="flex-1 text-right"><div className="h-3 bg-zinc-800 rounded animate-pulse inline-block" style={{ width: "40%" }} /></div>
    </div>
  );
}