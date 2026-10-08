// Placeholders shown instantly while a page streams in (used by loading.tsx files).
// They also let Next.js prefetch each route's shell, so a click never waits on the server.

const bar = (width: number | string, height = 16, radius = 8) => (
  <span className="loading-shimmer" style={{ display: 'block', width, height, borderRadius: radius }} />
)

export function ListPageSkeleton() {
  return (
    <div className="bg-soft" aria-busy="true" aria-label="กำลังโหลด">
      <section className="page-head">
        <div className="inner" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 18 }}>
          {bar(160, 14)}
          {bar(260, 36, 10)}
          {bar('min(760px, 100%)', 56, 999)}
        </div>
      </section>
      <div className="container" style={{ paddingTop: 28, paddingBottom: 96 }}>
        <div className="row wrap" style={{ gap: 8, marginBottom: 22 }}>
          {[96, 120, 84, 132, 104].map((w) => (
            <span key={w}>{bar(w, 36, 999)}</span>
          ))}
        </div>
        <div className="grid-events">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="loading-shimmer" style={{ height: 360, borderRadius: 20 }} />
          ))}
        </div>
      </div>
    </div>
  )
}

export function DetailPageSkeleton() {
  return (
    <div className="bg-soft" aria-busy="true" aria-label="กำลังโหลด">
      <div className="container" style={{ paddingTop: 28, paddingBottom: 96 }}>
        {bar(220, 14)}
        <div className="row wrap" style={{ gap: 28, marginTop: 22, alignItems: 'flex-start' }}>
          <div className="loading-shimmer" style={{ flex: '0 1 380px', minWidth: 260, height: 460, borderRadius: 20 }} />
          <div className="stack" style={{ flex: '1 1 380px', gap: 14 }}>
            {bar(110, 24, 999)}
            {bar('90%', 34, 10)}
            {bar('60%', 18)}
            {bar('100%', 120, 16)}
            {bar('100%', 180, 16)}
          </div>
        </div>
      </div>
    </div>
  )
}

export function AdminSkeleton() {
  return (
    <div className="stack" style={{ gap: 18 }} aria-busy="true" aria-label="กำลังโหลด">
      {bar(240, 32, 10)}
      <div className="row wrap" style={{ gap: 12 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="loading-shimmer" style={{ flex: '1 1 180px', height: 96, borderRadius: 16 }} />
        ))}
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="loading-shimmer" style={{ height: 120, borderRadius: 16 }} />
      ))}
    </div>
  )
}
