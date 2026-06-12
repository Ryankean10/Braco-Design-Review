import ProjectForm from '@/components/ProjectForm'

export default function NewProjectPage() {
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>New project</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Create a new BESS project</p>
      </div>
      <ProjectForm />
    </div>
  )
}
