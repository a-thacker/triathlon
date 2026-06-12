import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { formatDuration, diffMs, adultStatus, teamColorStyle, TEAM_COLORS, nextAdultAction, calcAdultSplits } from '../lib/utils'
import ConfirmModal from '../components/ConfirmModal'

export default function AdultTiming() {
  const [participants, setParticipants] = useState([])
  const [timingRecords, setTimingRecords] = useState({})
  const [raceStart, setRaceStart] = useState(null)
  const [raceEnded, setRaceEnded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchVal, setSearchVal] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [now, setNow] = useState(Date.now())
  const searchRef = useRef()

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => { load() }, [])

  async function load() {
    const { data: pData } = await supabase
      .from('participants')
      .select('*')
      .eq('race_type', 'adult')
      .eq('checked_in', true)
      .order('race_number')

    const { data: evData } = await supabase
      .from('race_events')
      .select('*')
      .eq('race_type', 'adult')
      .order('ts', { ascending: false })

    const { data: tData } = await supabase
      .from('timing_records')
      .select('*')
      .eq('race_type', 'adult')

    setParticipants(pData || [])

    const tMap = {}
    if (tData) tData.forEach(r => { tMap[r.participant_id] = r })
    setTimingRecords(tMap)

    if (evData && evData.length > 0) {
      const latest = evData[0]
      if (latest.event_type === 'reset') {
        setRaceStart(null)
        setRaceEnded(false)
      } else if (latest.event_type === 'end') {
        const startEv = evData.find(e => e.event_type === 'start')
        setRaceStart(startEv ? startEv.ts : null)
        setRaceEnded(true)
      } else if (latest.event_type === 'start') {
        setRaceStart(latest.ts)
        setRaceEnded(false)
      }
    }

    setLoading(false)
    focusSearch()
  }

  function focusSearch() {
    setTimeout(() => searchRef.current?.focus(), 50)
  }

  // Match on race number, name, or team color label (e.g. "red", "blue")
  function matchesSearch(p, q) {
    if (!q) return true
    const lower = q.toLowerCase()
    if (String(p.race_number).startsWith(q)) return true
    if (`${p.first_name} ${p.last_name}`.toLowerCase().includes(lower)) return true
    if (p.is_team && p.team_color) {
      const colorLabel = TEAM_COLORS.find(c => c.value === p.team_color)?.label || ''
      if (colorLabel.toLowerCase().includes(lower)) return true
    }
    // Also match individual team member names
    if (p.swimmer_name && p.swimmer_name.toLowerCase().includes(lower)) return true
    if (p.biker_name   && p.biker_name.toLowerCase().includes(lower))   return true
    if (p.runner_name  && p.runner_name.toLowerCase().includes(lower))   return true
    return false
  }

  const q = searchVal.trim()
  const exactMatch = participants.find(p => String(p.race_number) === q)
  const displayList = q
    ? participants.filter(p => matchesSearch(p, q))
    : participants

  async function startRace() {
    const ts = new Date().toISOString()
    const { error } = await supabase.from('race_events').insert({ race_type: 'adult', event_type: 'start', ts })
    if (error) { alert('Error starting race: ' + error.message); return }
    const inserts = participants.map(p => ({ participant_id: p.id, race_type: 'adult' }))
    if (inserts.length > 0) {
      await supabase.from('timing_records').upsert(inserts, { onConflict: 'participant_id', ignoreDuplicates: true })
    }
    setRaceStart(ts)
    setConfirm(null)
    focusSearch()
    const { data } = await supabase.from('timing_records').select('*').eq('race_type', 'adult')
    const tMap = {}
    if (data) data.forEach(r => { tMap[r.participant_id] = r })
    setTimingRecords(tMap)
  }

  async function endRace() {
    await supabase.from('race_events').insert({ race_type: 'adult', event_type: 'end', ts: new Date().toISOString() })
    setRaceEnded(true)
    setConfirm(null)
    focusSearch()
  }

  async function resetRace() {
    await supabase.from('timing_records').delete().eq('race_type', 'adult')
    await supabase.from('race_events').delete().eq('race_type', 'adult')
    setRaceStart(null)
    setRaceEnded(false)
    setTimingRecords({})
    setConfirm(null)
    focusSearch()
  }

  async function applyCheckpoint(p, field) {
    const ts = new Date().toISOString()
    const rec = timingRecords[p.id]
    if (!rec) return
    const { error } = await supabase.from('timing_records').update({ [field]: ts }).eq('id', rec.id)
    if (!error) setTimingRecords(m => ({ ...m, [p.id]: { ...rec, [field]: ts } }))
    setSearchVal('')
    focusSearch()
  }

  async function markDNF(p) {
    const rec = timingRecords[p.id]
    if (!rec) return
    const { error } = await supabase.from('timing_records').update({ dnf: true }).eq('id', rec.id)
    if (!error) setTimingRecords(m => ({ ...m, [p.id]: { ...rec, dnf: true } }))
    setSearchVal('')
    focusSearch()
    setConfirm(null)
  }

  async function goBack(p) {
    const rec = timingRecords[p.id]
    if (!rec) return
    let update = {}
    if (rec.dnf)                update = { dnf: false }
    else if (rec.finish_time)   update = { finish_time: null }
    else if (rec.run_start)     update = { run_start: null }
    else if (rec.bike_complete) update = { bike_complete: null }
    else if (rec.bike_start)    update = { bike_start: null }
    else if (rec.swim_complete) update = { swim_complete: null }
    else return
    const { error } = await supabase.from('timing_records').update(update).eq('id', rec.id)
    if (!error) setTimingRecords(m => ({ ...m, [p.id]: { ...rec, ...update } }))
    setSearchVal('')
    focusSearch()
    setConfirm(null)
  }

  function getWarnings() {
    return participants.filter(p => {
      const rec = timingRecords[p.id]
      if (!rec) return !!raceStart
      return !rec.finish_time && !rec.dnf
    })
  }

  function teamLabel(color) {
    return TEAM_COLORS.find(c => c.value === color)?.label || 'Team'
  }

  // Build a one-line name string for a participant
  // Individual: "Jane Smith"
  // Team: "Smith (Team) — Swimmer / Biker / Runner" with blanks skipped
  function displayName(p) {
    if (!p.is_team) return `${p.first_name} ${p.last_name}`
    const members = [p.swimmer_name, p.biker_name, p.runner_name].filter(Boolean)
    const unique = [...new Set(members)] // dedupe in case same name appears twice
    return unique.join(' / ')
  }

  // Which leg name to show next to the current action button (for teams)
  function currentLegName(p, rec) {
    if (!p.is_team) return null
    if (!rec) return null
    if (!rec.swim_complete) return p.swimmer_name || null
    if (!rec.bike_start)    return p.swimmer_name || null  // still in T1, swimmer just finished
    if (!rec.bike_complete) return p.biker_name   || null
    if (!rec.run_start)     return p.biker_name   || null  // still in T2, biker just finished
    if (!rec.finish_time)   return p.runner_name  || null
    return null
  }

  if (loading) return <div className="text-muted">Loading...</div>

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="page-title" style={{ marginBottom: 0 }}>Adult Race</div>
        <div style={{ flex: 1 }} />
        <div style={{
          padding: '6px 14px', borderRadius: '999px', fontWeight: 700, fontSize: '0.85rem',
          background: raceStart ? (raceEnded ? 'var(--danger)' : 'var(--success)') : 'var(--surface2)',
          color: raceStart ? '#0f1117' : 'var(--muted)'
        }}>
          {!raceStart ? 'Waiting for Start' : raceEnded ? 'Race Ended' : 'Race Running'}
        </div>
        {raceStart && !raceEnded && (
          <div style={{ color: 'var(--accent)', fontWeight: 700, fontFamily: 'monospace', fontSize: '1.1rem' }}>
            {formatDuration(now - new Date(raceStart).getTime())}
          </div>
        )}
      </div>

      {/* Race controls */}
      <div className="race-controls">
        {!raceStart && (
          <button className="btn btn-success btn-lg" onClick={() => setConfirm('start')}>Start Race</button>
        )}
        {raceStart && !raceEnded && (
          <button className="btn btn-danger" onClick={() => setConfirm('end')}>End Race</button>
        )}
        <button className="btn btn-ghost" onClick={() => setConfirm('reset')}>Reset Race</button>
      </div>

      {/* Search */}
      <div className="timing-search">
        <input
          ref={searchRef}
          className="form-input"
          placeholder="Race number, name, or team color..."
          value={searchVal}
          onChange={e => setSearchVal(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && exactMatch && raceStart && !raceEnded) {
              const rec = timingRecords[exactMatch.id]
              const next = nextAdultAction(rec)
              if (next) applyCheckpoint(exactMatch, next.field)
            }
          }}
        />
        {raceStart && (
          <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: 6 }}>
            Press Enter to record next checkpoint for exact number match
          </div>
        )}
      </div>

      {!raceStart && (
        <div className="alert alert-warn">Race has not started. Press "Start Race" to begin timing.</div>
      )}

      {/* Participant rows */}
      <div>
        {displayList.map(p => {
          const rec = timingRecords[p.id]
          const status = adultStatus(rec, !!raceStart)
          const isHighlighted = exactMatch?.id === p.id
          const isFinished = !!rec?.finish_time
          const isDNF = !!rec?.dnf
          const next = raceStart && !raceEnded ? nextAdultAction(rec) : null
          const canGoBack = raceStart && !raceEnded && rec &&
            (rec.swim_complete || rec.bike_start || rec.bike_complete || rec.run_start || rec.finish_time || rec.dnf)
          const splits = calcAdultSplits(rec, raceStart)
          const legName = currentLegName(p, rec)

          return (
            <div
              key={p.id}
              className={`participant-timing-row${isHighlighted ? ' highlighted' : ''}${isFinished ? ' finished' : ''}${isDNF ? ' dnf' : ''}`}
            >
              {/* Row header */}
              <div className="timing-row-header">
                <div className="race-num-badge">#{p.race_number}</div>

                {p.is_team && p.team_color && (
                  <span style={{ ...teamColorStyle(p.team_color), flexShrink: 0 }}>
                    {teamLabel(p.team_color)}
                  </span>
                )}

                {/* Individual vs team name display */}
                {p.is_team ? (
                  <div style={{ flex: 1, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
                    {p.swimmer_name && (
                      <span style={{ fontSize: '0.9rem' }}>
                        <span style={{ color: 'var(--muted)', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>Swim</span>
                        <strong>{p.swimmer_name}</strong>
                      </span>
                    )}
                    {p.biker_name && (
                      <span style={{ fontSize: '0.9rem' }}>
                        <span style={{ color: 'var(--muted)', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>Bike</span>
                        <strong>{p.biker_name}</strong>
                      </span>
                    )}
                    {p.runner_name && (
                      <span style={{ fontSize: '0.9rem' }}>
                        <span style={{ color: 'var(--muted)', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>Run</span>
                        <strong>{p.runner_name}</strong>
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="participant-name">{p.first_name} {p.last_name}</div>
                )}

                <div className="participant-age">Age {p.age}</div>

                {/* Status chip */}
                <div style={{
                  padding: '3px 12px', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 700, flexShrink: 0,
                  background: isDNF ? 'var(--danger)' : isFinished ? 'var(--success)' : raceStart ? '#00d4ff22' : 'var(--surface2)',
                  color: isDNF ? '#fff' : isFinished ? '#0f1117' : raceStart ? 'var(--accent)' : 'var(--muted)'
                }}>
                  {status}
                </div>
              </div>

              {/* Progress dots */}
              <div className="progress-dots" style={{ marginBottom: 10 }}>
                <span className={`dot ${raceStart ? 'done' : ''}`}>{raceStart ? 'v' : 'o'} Start</span>
                <span style={{ color: 'var(--border)' }}>-</span>
                <span className={`dot ${rec?.swim_complete ? 'done' : ''}`}>
                  {rec?.swim_complete ? 'v' : 'o'} Swim
                  {rec?.swim_complete && splits.swimMs != null && <small style={{ color: 'var(--muted)', marginLeft: 3 }}>{formatDuration(splits.swimMs)}</small>}
                  {p.is_team && p.swimmer_name && <small style={{ color: 'var(--muted)', marginLeft: 4 }}>({p.swimmer_name.split(' ')[0]})</small>}
                </span>
                <span style={{ color: 'var(--border)' }}>-</span>
                <span className={`dot ${rec?.bike_start ? 'done' : ''}`}>
                  {rec?.bike_start ? 'v' : 'o'} T1
                  {rec?.bike_start && splits.t1Ms != null && <small style={{ color: 'var(--muted)', marginLeft: 3 }}>{formatDuration(splits.t1Ms)}</small>}
                </span>
                <span style={{ color: 'var(--border)' }}>-</span>
                <span className={`dot ${rec?.bike_complete ? 'done' : ''}`}>
                  {rec?.bike_complete ? 'v' : 'o'} Bike
                  {rec?.bike_complete && splits.bikeMs != null && <small style={{ color: 'var(--muted)', marginLeft: 3 }}>{formatDuration(splits.bikeMs)}</small>}
                  {p.is_team && p.biker_name && <small style={{ color: 'var(--muted)', marginLeft: 4 }}>({p.biker_name.split(' ')[0]})</small>}
                </span>
                <span style={{ color: 'var(--border)' }}>-</span>
                <span className={`dot ${rec?.run_start ? 'done' : ''}`}>
                  {rec?.run_start ? 'v' : 'o'} T2
                  {rec?.run_start && splits.t2Ms != null && <small style={{ color: 'var(--muted)', marginLeft: 3 }}>{formatDuration(splits.t2Ms)}</small>}
                </span>
                <span style={{ color: 'var(--border)' }}>-</span>
                <span className={`dot ${rec?.finish_time ? 'done' : ''}`}>
                  {rec?.finish_time ? 'v' : 'o'} Run
                  {rec?.finish_time && splits.runMs != null && <small style={{ color: 'var(--muted)', marginLeft: 3 }}>{formatDuration(splits.runMs)}</small>}
                  {p.is_team && p.runner_name && <small style={{ color: 'var(--muted)', marginLeft: 4 }}>({p.runner_name.split(' ')[0]})</small>}
                </span>
                <span style={{ color: 'var(--border)' }}>-</span>
                <span className={`dot ${isFinished ? 'done' : ''}`}>{isFinished ? 'v' : 'o'} Done</span>
                {isFinished && splits.totalMs != null && (
                  <span style={{ marginLeft: 12, color: 'var(--adult-color)', fontWeight: 800, fontSize: '0.95rem' }}>
                    Total: {formatDuration(splits.totalMs)}
                  </span>
                )}
              </div>

              {/* Action buttons */}
              {raceStart && !raceEnded && (
                <div className="timing-actions">
                  {next && (
                    <button className="btn btn-success btn-lg" onClick={() => applyCheckpoint(p, next.field)}>
                      {next.label}{legName ? ` — ${legName}` : ''}
                    </button>
                  )}
                  {canGoBack && (
                    <button className="btn btn-ghost" onClick={() => setConfirm({ type: 'goback', p })}>
                      Go Back
                    </button>
                  )}
                  {!isDNF && !isFinished && (
                    <button className="btn btn-danger btn-sm" onClick={() => setConfirm({ type: 'dnf', p })}>
                      DNF
                    </button>
                  )}
                </div>
              )}

              {/* Split summary when finished */}
              {isFinished && (
                <div style={{ display: 'flex', gap: 20, marginTop: 8, fontSize: '0.82rem', color: 'var(--muted)', flexWrap: 'wrap' }}>
                  <span>Swim: <strong style={{ color: 'var(--text)' }}>{formatDuration(splits.swimMs)}</strong></span>
                  <span>T1: <strong style={{ color: 'var(--text)' }}>{formatDuration(splits.t1Ms)}</strong></span>
                  <span>Bike: <strong style={{ color: 'var(--text)' }}>{formatDuration(splits.bikeMs)}</strong></span>
                  <span>T2: <strong style={{ color: 'var(--text)' }}>{formatDuration(splits.t2Ms)}</strong></span>
                  <span>Run: <strong style={{ color: 'var(--text)' }}>{formatDuration(splits.runMs)}</strong></span>
                  <span>Total: <strong style={{ color: 'var(--adult-color)' }}>{formatDuration(splits.totalMs)}</strong></span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Confirm modals */}
      {confirm === 'start' && (
        <ConfirmModal
          title="Start Adult Race?"
          message={`This records the official race start for all ${participants.length} checked-in adults. This cannot be undone.`}
          onConfirm={startRace}
          onCancel={() => setConfirm(null)}
          confirmLabel="Start Race"
        />
      )}
      {confirm === 'end' && (
        <ConfirmModal
          title="End Adult Race?"
          onConfirm={endRace}
          onCancel={() => setConfirm(null)}
          confirmLabel="End Race"
          danger
        >
          {getWarnings().length > 0 && (
            <div className="alert alert-warn" style={{ marginBottom: 12 }}>
              <strong>{getWarnings().length} participant(s) not finished:</strong>
              <div style={{ marginTop: 6 }}>
                {getWarnings().map(p => <div key={p.id}>#{p.race_number} {p.first_name} {p.last_name}</div>)}
              </div>
            </div>
          )}
          <p>Are you sure you want to end the race?</p>
        </ConfirmModal>
      )}
      {confirm === 'reset' && (
        <ConfirmModal
          title="Reset Adult Race?"
          message="This will delete ALL timing data for the adult race. This cannot be undone."
          onConfirm={resetRace}
          onCancel={() => setConfirm(null)}
          confirmLabel="Reset Everything"
          danger
        />
      )}
      {confirm?.type === 'goback' && (
        <ConfirmModal
          title="Undo Last Action?"
          message={`Remove the most recent timing entry for ${confirm.p.first_name} ${confirm.p.last_name}?`}
          onConfirm={() => goBack(confirm.p)}
          onCancel={() => setConfirm(null)}
          confirmLabel="Go Back"
        />
      )}
      {confirm?.type === 'dnf' && (
        <ConfirmModal
          title="Mark as DNF?"
          message={`Mark ${confirm.p.first_name} ${confirm.p.last_name} as Did Not Finish?`}
          onConfirm={() => markDNF(confirm.p)}
          onCancel={() => setConfirm(null)}
          confirmLabel="Mark DNF"
          danger
        />
      )}
    </div>
  )
}
