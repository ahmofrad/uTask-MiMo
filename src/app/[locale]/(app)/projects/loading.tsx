import { Skeleton } from "@/components/feedback/loading-skeleton";

export default function ProjectsLoading() {
  return (
    <div className="px-6 py-6">
      <Skeleton className="h-8 w-32 mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="p-5 rounded-xl border border-border-primary">
            <Skeleton className="h-5 w-32 mb-3" />
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
