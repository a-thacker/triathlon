import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatDuration } from '../lib/utils'

export default function RaceClock() {
  const { raceType } = useParams() // 'kids' or 'adult'
  const [raceStart, setRaceStart] = useState(null)
  const [raceEnd, setRaceEnd]     = useState(null)
  const [status, setStatus]       = useState('loading') // loading | waiting | running | ended
  const [now, setNow]             = useState(Date.now())
  const [finisherCount, setFinisherCount] = useState(0)

  const validType = raceType === 'kids' || raceType === 'adult'
  const accent = raceType === 'kids' ? '#ffd32a' : '#00d4ff'
  const label  = raceType === 'kids' ? 'Kids Race' : 'Adult Race'

  useEffect(() => {
    if (!validType) return
    load()
    const dataInterval  = setInterval(load, 5000)
    const clockInterval = setInterval(() => setNow(Date.now()), 100) // smooth tenths
    return () => { clearInterval(dataInterval); clearInterval(clockInterval) }
  }, [raceType])

  async function load() {
    const { data: evData } = await supabase.from('race_events')
      .select('event_type, ts').eq('race_type', raceType)
      .order('ts', { ascending: false })

    const startEv = (evData || []).find(e => e.event_type === 'start')
    const endEv   = (evData || []).find(e => e.event_type === 'end')

    setRaceStart(startEv?.ts || null)
    setRaceEnd(endEv?.ts || null)
    setStatus(endEv ? 'ended' : startEv ? 'running' : 'waiting')

    const { count } = await supabase.from('timing_records')
      .select('*', { count: 'exact', head: true })
      .eq('race_type', raceType)
      .not('finish_time', 'is', null)
      .eq('dnf', false)
    setFinisherCount(count || 0)
  }

  if (!validType) {
    return (
      <div style={{
        minHeight: '100vh', background: '#000', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.5rem', fontFamily: 'system-ui, sans-serif',
      }}>
        Invalid race type. Use /clock/kids or /clock/adult
      </div>
    )
  }

  const raceEndTs = raceEnd ? new Date(raceEnd).getTime() : null
  const elapsedMs = raceStart
    ? (raceEndTs || now) - new Date(raceStart).getTime()
    : 0

  return (
    <div style={{
      minHeight: '100vh',
      background: '#000',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '40px',
    }}>
      {/* Race label */}
      <div style={{
        fontSize: 'clamp(1.5rem, 4vw, 3rem)',
        fontWeight: 900,
        color: accent,
        letterSpacing: '0.04em',
        marginBottom: '24px',
        textTransform: 'uppercase',
      }}>
        {label}
      </div>

      {/* Status */}
      {status === 'waiting' && (
        <div style={{ color: '#666', fontSize: 'clamp(2rem, 6vw, 4.5rem)', fontWeight: 700 }}>
          Waiting for Start
        </div>
      )}

      {(status === 'running' || status === 'ended') && (
        <>
          <div style={{
            fontFamily: 'monospace',
            fontWeight: 900,
            fontSize: 'clamp(5rem, 18vw, 16rem)',
            color: status === 'ended' ? '#666' : '#fff',
            lineHeight: 1,
            letterSpacing: '0.02em',
            textShadow: status === 'running' ? `0 0 60px ${accent}55` : 'none',
          }}>
            {formatDuration(elapsedMs)}
          </div>

          {status === 'ended' && (
            <div style={{
              marginTop: '24px',
              fontSize: 'clamp(1.5rem, 4vw, 3rem)',
              fontWeight: 800,
              color: '#ff4757',
              letterSpacing: '0.06em',
            }}>
              RACE ENDED
            </div>
          )}

          <div style={{
            marginTop: '32px',
            fontSize: 'clamp(1rem, 2.5vw, 1.8rem)',
            color: accent,
            fontWeight: 700,
          }}>
            {finisherCount} finished
          </div>
        </>
      )}

      {/* Footer branding */}
      <div style={{
        position: 'fixed', bottom: 24, left: 0, right: 0,
        textAlign: 'center', color: '#444', fontSize: '1rem', fontWeight: 600,
      }}>
        TriTimer · Lawroweld 2026
      </div>
    </div>
  )
}
