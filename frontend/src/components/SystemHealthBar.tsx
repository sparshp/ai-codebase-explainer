import { useEffect, useState, useCallback } from 'react'
import { healthApi, type HealthStatus } from '../api/health.api'

function Dot({ ok }: { ok: boolean }) {
  return (
    <span
      style={{
        width: 7, height: 7, borderRadius: '50%', display: 'inline-block',
        background: ok ? '#1D9E75' : '#E24B4A',
      }}
    />
  )
}

export function SystemHealthBar() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [error, setError]   = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await healthApi.check()
      setHealth(data)
      setError(false)
    } catch {
      setHealth(null)
      setError(true)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [load])

  const services = health?.services
  const allOk = health?.status === 'ok'

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mb-6 px-1">
      <span className="font-medium text-gray-600">System</span>
      {error && (
        <span className="flex items-center gap-1.5 text-red-600">
          <Dot ok={false} /> API unreachable
        </span>
      )}
      {services && (
        <>
          <span className="flex items-center gap-1.5">
            <Dot ok={services.postgres === 'ok'} /> Postgres
          </span>
          <span className="flex items-center gap-1.5">
            <Dot ok={services.redis === 'ok'} /> Redis
          </span>
          <span className="flex items-center gap-1.5">
            <Dot ok={services.chroma === 'ok'} /> Chroma
          </span>
          <span className={allOk ? 'text-green-700' : 'text-amber-700'}>
            {allOk ? 'healthy' : 'degraded'}
            {health?.uptime != null && (
              <span className="text-gray-400 ml-1">
                · up {Math.floor(health.uptime / 60)}m
              </span>
            )}
          </span>
        </>
      )}
      <button
        type="button"
        onClick={load}
        className="text-indigo-600 hover:text-indigo-800 ml-auto"
      >
        Refresh
      </button>
    </div>
  )
}
