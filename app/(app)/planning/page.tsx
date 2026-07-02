import WorkPlanner from '@/components/planning/WorkPlanner'

export default function PlanningPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Work Planner</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Forecast programme duration and manpower for a new BESS site — benchmarked against real Dyce construction data.
          </p>
        </div>
        <WorkPlanner/>
      </div>
    </div>
  )
}
