import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function RegisterPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const { register }            = useAuth()
  const navigate                = useNavigate()

  const handleSubmit = async () => {
    setError('')
    setLoading(true)
    try {
      await register(email, password)
      navigate('/app')
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-6 text-gray-900">Create account</h1>
        <input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Email" type="email" value={email}
          onChange={e => setEmail(e.target.value)} />
        <input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Password (min 8 chars)" type="password" value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
        <button onClick={handleSubmit} disabled={loading}
          className="w-full py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {loading ? 'Creating account...' : 'Create account'}
        </button>
        <p className="text-sm text-gray-500 mt-4 text-center">
          Have an account? <Link to="/login" className="text-indigo-600 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}