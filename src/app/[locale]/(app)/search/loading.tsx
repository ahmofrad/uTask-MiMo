import { Skeleton } from "@/components/feedback/loading-skeleton";

export default function SearchLoading() {
  return (
    <div className="px-6 py-6">
      <Skeleton className="h-8 w-24 mb-6" />
      <Skeleton className="h-10 w-full mb-8" />
      <div className="space-y-4">
        <Skeleton className="h-5 w-24 mb-2" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border-primary">
              <Skeleton className="w-2 h-2 rounded-full" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
