import React, { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

// Draws a simple stick-figure silhouette in a given pose
// poses: 'swim', 'bike', 'run'
function drawFigure(ctx, x, y, scale, pose, alpha) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = '#2e3a50'
  ctx.fillStyle = '#2e3a50'
  ctx.lineWidth = scale * 2.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.translate(x, y)
  ctx.scale(scale, scale)

  if (pose === 'swim') {
    // Head
    ctx.beginPath(); ctx.arc(0, -22, 6, 0, Math.PI * 2); ctx.fill()
    // Body — horizontal, stretched
    ctx.beginPath(); ctx.moveTo(-4, -16); ctx.lineTo(4, 4); ctx.stroke()
    // Arms out front
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(20, -16); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(20, -6); ctx.stroke()
    // Legs trailing behind
    ctx.beginPath(); ctx.moveTo(4, 4); ctx.lineTo(-14, 10); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(4, 4); ctx.lineTo(-14, 2); ctx.stroke()

  } else if (pose === 'bike') {
    // Head
    ctx.beginPath(); ctx.arc(8, -36, 6, 0, Math.PI * 2); ctx.fill()
    // Torso leaning forward
    ctx.beginPath(); ctx.moveTo(8, -30); ctx.lineTo(0, -12); ctx.stroke()
    // Arms to handlebars
    ctx.beginPath(); ctx.moveTo(8, -26); ctx.lineTo(22, -20); ctx.stroke()
    // Rear wheel suggestion
    ctx.beginPath(); ctx.arc(-10, 4, 14, 0, Math.PI * 2)
    ctx.lineWidth = scale * 1.5; ctx.stroke(); ctx.lineWidth = scale * 2.5
    // Front wheel
    ctx.beginPath(); ctx.arc(22, 4, 14, 0, Math.PI * 2); ctx.stroke()
    // Frame
    ctx.beginPath()
    ctx.moveTo(-10, 4); ctx.lineTo(0, -12)
    ctx.lineTo(22, 4); ctx.lineTo(-10, 4)
    ctx.stroke()
    // Pedal legs
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(6, 4); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(-6, 0); ctx.stroke()

  } else { // run
    // Head
    ctx.beginPath(); ctx.arc(0, -36, 6, 0, Math.PI * 2); ctx.fill()
    // Body
    ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0, -10); ctx.stroke()
    // Arms swinging
    ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(12, -14); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(-10, -16); ctx.stroke()
    // Legs striding
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(10, 4); ctx.lineTo(6, 18); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(-8, 2); ctx.lineTo(-4, 18); ctx.stroke()
  }

  ctx.restore()
}

function AnimatedSilhouettes() {
  const canvasRef = useRef()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const W = canvas.width  = canvas.offsetWidth
    const H = canvas.height = canvas.offsetHeight

    const figures = [
      { pose: 'swim', x: W * 0.15, speed: 0.4, scale: 0.9, phase: 0 },
      { pose: 'bike', x: W * 0.48, speed: 0.6, scale: 1.0, phase: 1.5 },
      { pose: 'run',  x: W * 0.80, speed: 0.5, scale: 0.85, phase: 3.0 },
    ]

    let t = 0
    let raf

    function frame() {
      ctx.clearRect(0, 0, W, H)
      t += 0.012

      figures.forEach(f => {
        // Gentle horizontal drift
        const drift = Math.sin(t * f.speed + f.phase) * 12
        // Slight vertical bob
        const bob = Math.abs(Math.sin(t * f.speed * 2 + f.phase)) * 5
        // Fade in/out at edges
        const nx = f.x + drift
        const edgeFade = Math.min(1, Math.min(nx / 80, (W - nx) / 80))
        const alpha = 0.55 * edgeFade

        drawFigure(ctx, nx, H * 0.52 + bob, f.scale, f.pose, alpha)
      })

      raf = requestAnimationFrame(frame)
    }

    frame()
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        pointerEvents: 'none',
      }}
    />
  )
}

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
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Animated background silhouettes */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <AnimatedSilhouettes />
      </div>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', marginBottom: 48 }}>
        <div style={{
          fontSize: '2.6rem', fontWeight: 900, color: 'var(--accent)',
          letterSpacing: '-0.02em', marginBottom: 6,
        }}>
          TriTimer
        </div>
        <div style={{
          fontSize: '1.15rem', fontWeight: 700, color: 'var(--text)', marginBottom: 8,
        }}>
          Lawroweld 2026
        </div>
        <div style={{ color: 'var(--muted)', fontSize: '0.92rem' }}>
          Race day timing and results
        </div>
      </div>

      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column', gap: 16,
        width: '100%', maxWidth: 360,
      }}>
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
