import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{ fontSize: '2.4rem', fontWeight: 900, color: 'var(--accent)', letterSpacing: '-0.02em', marginBottom: 8 }}>
          TriTimer
        </div>
        <div style={{ color: 'var(--muted)', fontSize: '1rem' }}>
          Race day timing and results
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: 360 }}>
        <button
          className="btn btn-primary"
          style={{ padding: '22px', fontSize: '1.15rem', fontWeight: 700, borderRadius: 12, justifyContent: 'center' }}
          onClick={() => navigate('/results')}
        >
          View Results
        </button>

        <button
          className="btn btn-ghost"
          style={{ padding: '22px', fontSize: '1.15rem', fontWeight: 700, borderRadius: 12, justifyContent: 'center' }}
          onClick={() => navigate('/login')}
        >
          Organizer
        </button>
      </div>
    </div>
  )
}
