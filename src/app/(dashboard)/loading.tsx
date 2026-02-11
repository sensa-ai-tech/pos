export default function DashboardLoading() {
  return (
    <div className="space-y-6 p-4">
      {/* Stats skeleton */}
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4">
            <div className="mb-2 h-4 w-20 animate-pulse rounded bg-neutral-200" />
            <div className="h-8 w-24 animate-pulse rounded bg-neutral-200" />
          </div>
        ))}
      </div>

      {/* Content skeleton */}
      <div className="rounded-lg border p-4">
        <div className="mb-4 h-6 w-32 animate-pulse rounded bg-neutral-200" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="h-4 flex-1 animate-pulse rounded bg-neutral-200" />
              <div className="h-4 w-20 animate-pulse rounded bg-neutral-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
