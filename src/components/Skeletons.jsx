const INFO_TILE_CONFIGS = [
  { bg: 'bg-blue-50/70', labelWidth: 'w-14', valueWidth: 'w-20' },
  { bg: 'bg-purple-50/70', labelWidth: 'w-16', valueWidth: 'w-20' },
  { bg: 'bg-indigo-50/70', labelWidth: 'w-12', valueWidth: 'w-24' },
  { bg: 'bg-pink-50/70', labelWidth: 'w-16', valueWidth: 'w-24' },
];

const TUITION_REQUIREMENT_ROWS = [
  ['w-16', 'w-16'],
  ['w-28', 'w-24'],
  ['w-16', 'w-28'],
  ['w-24', 'w-12'],
];

const TUITION_STATUS_ROWS = [
  ['w-20', 'w-20'],
  ['w-20', 'w-20'],
  ['w-24', 'w-14'],
];

const TUITION_ADMIN_ROWS = [
  ['w-20', 'w-24'],
  ['w-20', 'w-24'],
  ['w-24', 'w-20'],
];

const TEACHER_QUALIFICATION_ROWS = [
  ['w-20', 'w-24'],
  ['w-24', 'w-32'],
  ['w-16', 'w-20'],
];

const FILTER_BAR_ROWS = [
  ['w-44', 'w-32', 'w-28'],
  ['w-32', 'w-32', ''],
];

/**
 * Reusable shimmering placeholder block supporting inline (`span`) or block (`div`) elements.
 */
export function Skeleton({ className = '', as = 'div', ...props }) {
  const Tag = as;
  return (
    <Tag
      aria-hidden="true"
      className={`skeleton-shimmer rounded bg-gray-200/85 ${className}`.trim()}
      {...props}
    />
  );
}

function CardHeaderSkeleton({ titleWidth = 'w-28', subtitleWidth = 'w-32', badgeCount = 2 }) {
  const badgeWidths = ['w-16', 'w-14', 'w-12'];
  return (
    <div className="flex justify-between items-start mb-4 pb-3 border-b border-gray-100">
      <div className="space-y-2">
        <Skeleton className={`h-6 ${titleWidth}`} />
        <Skeleton className={`h-3.5 ${subtitleWidth}`} />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: badgeCount }).map((_, idx) => (
          <Skeleton key={idx} className={`h-5 ${badgeWidths[idx % badgeWidths.length]}`} />
        ))}
      </div>
    </div>
  );
}

function CardInfoGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 mb-4">
      {INFO_TILE_CONFIGS.map((tile, idx) => (
        <div key={idx} className={`${tile.bg} p-2.5 rounded space-y-1.5`}>
          <Skeleton className={`h-3 ${tile.labelWidth}`} />
          <Skeleton className={`h-4 ${tile.valueWidth}`} />
        </div>
      ))}
    </div>
  );
}

function DetailRowListSkeleton({ headingWidth = 'w-36', rows }) {
  return (
    <div className="mb-4">
      <Skeleton className={`h-4 ${headingWidth} mb-2.5`} />
      <div className="space-y-2">
        {rows.map(([left, right], idx) => (
          <div key={idx} className="flex justify-between items-center gap-3">
            <Skeleton className={`h-3.5 ${left}`} />
            <Skeleton className={`h-3.5 ${right}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Shimmering skeleton card mirroring TuitionCard layout and color blocks.
 */
export function TuitionCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-5">
      <CardHeaderSkeleton titleWidth="w-20" subtitleWidth="w-32" badgeCount={2} />
      <CardInfoGridSkeleton />

      <div className="mb-4 p-3 bg-yellow-50/70 rounded space-y-1.5">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-4 w-3/4" />
      </div>

      <DetailRowListSkeleton headingWidth="w-36" rows={TUITION_REQUIREMENT_ROWS} />

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="bg-green-50/70 p-3 rounded space-y-1.5">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="bg-green-50/70 p-3 rounded space-y-1.5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="col-span-2 bg-orange-50/90 p-3 rounded border-2 border-orange-200/70 space-y-1.5">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-6 w-24" />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>

      <div className="mb-4 p-3 bg-gray-50 rounded space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-3.5 w-5/6" />
        <Skeleton className="h-3.5 w-2/3" />
        <Skeleton className="h-3.5 w-1/2" />
      </div>

      <div className="mb-4 p-3 bg-purple-50/60 rounded space-y-2">
        <Skeleton className="h-4 w-28" />
        {TUITION_STATUS_ROWS.map(([left, right], idx) => (
          <div key={idx} className="flex justify-between items-center">
            <Skeleton className={`h-3 ${left}`} />
            <Skeleton className={`h-3 ${right}`} />
          </div>
        ))}
      </div>

      <div className="pt-3 border-t border-gray-100 space-y-1.5">
        {TUITION_ADMIN_ROWS.map(([left, right], idx) => (
          <div key={idx} className="flex justify-between items-center">
            <Skeleton className={`h-3 ${left}`} />
            <Skeleton className={`h-3 ${right}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Shimmering skeleton card mirroring TeacherCard layout and action footer.
 */
export function TeacherCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-5 flex flex-col justify-between">
      <div>
        <CardHeaderSkeleton titleWidth="w-36" subtitleWidth="w-24" badgeCount={2} />
        <CardInfoGridSkeleton />

        <div className="mb-4 p-3 bg-yellow-50/70 rounded space-y-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-4/5" />
        </div>

        <DetailRowListSkeleton headingWidth="w-28" rows={TEACHER_QUALIFICATION_ROWS} />

        <div className="mb-4 p-3 bg-gray-50 rounded space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-3.5 w-1/2" />
        </div>
      </div>

      <div className="pt-3 border-t border-gray-100">
        <Skeleton className="h-9 w-full rounded-lg bg-blue-200/70" />
      </div>
    </div>
  );
}

const CARD_SKELETONS = {
  tuition: TuitionCardSkeleton,
  teacher: TeacherCardSkeleton,
};

/**
 * Responsive 3-column grid of shimmering Tuition or Teacher skeleton cards.
 */
export function CardGridSkeleton({ variant = 'tuition', count = 6 }) {
  const CardSkeleton = CARD_SKELETONS[variant] || TuitionCardSkeleton;
  return (
    <div
      role="status"
      aria-label={`Loading ${variant}s`}
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
    >
      {Array.from({ length: count }).map((_, index) => (
        <CardSkeleton key={`skeleton-${variant}-${index}`} />
      ))}
    </div>
  );
}

/**
 * Full dashboard shell skeleton shown during initial session verification for returning sessions.
 */
export function AppShellSkeleton({ variant = 'tuition' }) {
  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100/60 flex flex-col">
      {/* Navbar Skeleton */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-xl bg-blue-200/70" />
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3 w-48 hidden sm:block" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-24 rounded-lg" />
              <Skeleton className="h-9 w-28 rounded-lg" />
              <div className="h-6 w-px bg-gray-200 mx-1 sm:mx-2" />
              <Skeleton className="h-9 w-20 rounded-lg" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Skeleton */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2.5">
              <Skeleton className="h-9 w-64 sm:w-72" />
              <Skeleton className="h-4 w-72 sm:w-80" />
              <Skeleton className="h-3.5 w-52" />
            </div>
            {variant === 'teacher' && (
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-28 rounded-lg" />
                <Skeleton className="h-9 w-24 rounded-lg bg-blue-200/70" />
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-xs p-6 mb-8 border border-gray-200">
            <Skeleton className="h-6 w-36 mb-4" />
            {FILTER_BAR_ROWS.map((row, rowIdx) => (
              <div key={rowIdx} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                {row.map((labelWidth, colIdx) => (
                  <div key={colIdx} className={labelWidth ? 'space-y-2' : 'flex items-end'}>
                    {labelWidth && <Skeleton className={`h-4 ${labelWidth}`} />}
                    <Skeleton className="h-10 w-full rounded-lg" />
                  </div>
                ))}
              </div>
            ))}
            <Skeleton className="h-4 w-36" />
          </div>

          <CardGridSkeleton variant={variant} count={6} />
        </div>
      </main>
    </div>
  );
}

/**
 * Centered lock-screen card skeleton shown while verifying session before login.
 */
export function LockScreenSkeleton() {
  return (
    <div
      role="status"
      aria-label="Verifying session"
      className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100/60 flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 max-w-md w-full flex flex-col items-center">
        <Skeleton className="w-16 h-16 rounded-full bg-blue-100 mb-5" />
        <Skeleton className="h-7 w-40 mb-2" />
        <Skeleton className="h-4 w-64 mb-1.5" />
        <Skeleton className="h-4 w-48 mb-6" />

        <div className="w-full space-y-4">
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
          <Skeleton className="h-10 w-full rounded-lg bg-blue-200/70" />
        </div>

        <div className="mt-8 pt-4 border-t border-gray-100 w-full flex justify-center">
          <Skeleton className="h-3.5 w-48" />
        </div>
      </div>
    </div>
  );
}

