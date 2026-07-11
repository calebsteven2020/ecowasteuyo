// Reusable skeleton components for loading states

export function SkeletonBox({ className = "", style = {} }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded-2xl ${className}`}
      style={{ background: "linear-gradient(90deg, #e8f0e4 25%, #d4e8d5 50%, #e8f0e4 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite", ...style }}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="min-h-svh" style={{ background: "#f7f5f0", fontFamily: "var(--font-body)" }}>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex justify-between items-end mb-10">
          <div>
            <SkeletonBox style={{ width: 80, height: 14, borderRadius: 8, marginBottom: 8 }} />
            <SkeletonBox style={{ width: 200, height: 32, borderRadius: 10, marginBottom: 8 }} />
            <SkeletonBox style={{ width: 240, height: 14, borderRadius: 8 }} />
          </div>
          <div className="flex gap-3">
            <SkeletonBox style={{ width: 40, height: 40, borderRadius: "50%" }} />
            <SkeletonBox style={{ width: 40, height: 40, borderRadius: "50%" }} />
            <SkeletonBox style={{ width: 130, height: 40, borderRadius: 999 }} />
          </div>
        </div>
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-2xl p-5" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.08)" }}>
              <SkeletonBox style={{ width: 40, height: 40, borderRadius: 12, marginBottom: 16 }} />
              <SkeletonBox style={{ width: 60, height: 28, borderRadius: 8, marginBottom: 8 }} />
              <SkeletonBox style={{ width: 90, height: 14, borderRadius: 6, marginBottom: 4 }} />
              <SkeletonBox style={{ width: 70, height: 12, borderRadius: 6 }} />
            </div>
          ))}
        </div>
        {/* Chart + Impact */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="lg:col-span-2 rounded-2xl p-6" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.08)" }}>
            <SkeletonBox style={{ width: 140, height: 18, borderRadius: 8, marginBottom: 8 }} />
            <SkeletonBox style={{ width: 200, height: 13, borderRadius: 6, marginBottom: 24 }} />
            <SkeletonBox style={{ width: "100%", height: 175, borderRadius: 12 }} />
          </div>
          <div className="rounded-2xl p-6" style={{ background: "#1a2e1c" }}>
            <SkeletonBox style={{ width: 100, height: 18, borderRadius: 8, marginBottom: 8, background: "rgba(133,196,138,0.2)" }} />
            <SkeletonBox style={{ width: 160, height: 13, borderRadius: 6, marginBottom: 24, background: "rgba(133,196,138,0.1)" }} />
            {[...Array(3)].map((_, i) => (
              <div key={i} className="mb-5">
                <div className="flex justify-between mb-2">
                  <SkeletonBox style={{ width: 90, height: 13, borderRadius: 6, background: "rgba(133,196,138,0.15)" }} />
                  <SkeletonBox style={{ width: 50, height: 13, borderRadius: 6, background: "rgba(133,196,138,0.15)" }} />
                </div>
                <SkeletonBox style={{ width: "100%", height: 6, borderRadius: 999, background: "rgba(133,196,138,0.1)" }} />
              </div>
            ))}
          </div>
        </div>
        {/* Upcoming */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.08)" }}>
          <div className="px-6 py-5" style={{ borderBottom: "1px solid rgba(26,46,28,0.07)" }}>
            <SkeletonBox style={{ width: 150, height: 18, borderRadius: 8, marginBottom: 6 }} />
            <SkeletonBox style={{ width: 90, height: 13, borderRadius: 6 }} />
          </div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4" style={{ borderBottom: i < 2 ? "1px solid rgba(26,46,28,0.06)" : "none" }}>
              <SkeletonBox style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0 }} />
              <div className="flex-1">
                <SkeletonBox style={{ width: 140, height: 14, borderRadius: 6, marginBottom: 6 }} />
                <SkeletonBox style={{ width: 200, height: 12, borderRadius: 6 }} />
              </div>
              <div className="text-right">
                <SkeletonBox style={{ width: 80, height: 14, borderRadius: 6, marginBottom: 6 }} />
                <SkeletonBox style={{ width: 60, height: 12, borderRadius: 6 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function HistorySkeleton() {
  return (
    <div className="min-h-svh" style={{ background: "#f7f5f0" }}>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
      <div className="max-w-4xl mx-auto px-6 py-10">
        <SkeletonBox style={{ width: 120, height: 14, borderRadius: 8, marginBottom: 24 }} />
        <SkeletonBox style={{ width: 200, height: 32, borderRadius: 10, marginBottom: 8 }} />
        <SkeletonBox style={{ width: 300, height: 14, borderRadius: 8, marginBottom: 32 }} />
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-2xl p-4" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.08)" }}>
              <SkeletonBox style={{ width: 40, height: 32, borderRadius: 8, margin: "0 auto 8px" }} />
              <SkeletonBox style={{ width: 70, height: 12, borderRadius: 6, margin: "0 auto" }} />
            </div>
          ))}
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-2xl p-5 mb-3" style={{ background: "#fff", border: "1px solid rgba(26,46,28,0.08)" }}>
            <div className="flex items-start gap-3 mb-3">
              <SkeletonBox style={{ width: 40, height: 40, borderRadius: 12 }} />
              <div className="flex-1">
                <SkeletonBox style={{ width: 160, height: 14, borderRadius: 6, marginBottom: 6 }} />
                <SkeletonBox style={{ width: 80, height: 12, borderRadius: 6 }} />
              </div>
              <SkeletonBox style={{ width: 70, height: 24, borderRadius: 999 }} />
            </div>
            <SkeletonBox style={{ width: "100%", height: 1, borderRadius: 1, marginBottom: 12 }} />
            <div className="flex gap-2">
              <SkeletonBox style={{ width: 100, height: 32, borderRadius: 12 }} />
              <SkeletonBox style={{ width: 130, height: 32, borderRadius: 12 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
