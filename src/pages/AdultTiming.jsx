import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { formatDuration, diffMs, adultStatus, teamColorStyle, TEAM_COLORS } from '../lib/utils'
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
        setRaceStart(null); setRaceEnded(false)
      } else if (latest.event_type === 'end') {
        const startEv = evData.find(e => e.event_type === 'start')
        setRaceStart(startEv ? startEv.ts : null)
        setRaceEnded(true)
      } else if (latest.event_type === 'start') {
        setRaceStart(latest.ts); setRaceEnded(false)
      }
    }
    setLoading(false)
    focusSearch()
  }

  function focusSearch() {
    setTimeout(() => searchRef.current?.focus(), 50)
  }

  const exactMatch = participants.find(p => String(p.race_number) === searchVal.trim())
  const displayList = searchVal.trim()
    ? participants.filter(p => {
        const q = searchVal.trim()
        return String(p.race_number).startsWith(q) ||
          `${p.first_name} ${p.last_name}`.toLowerCase().includes(q.toLowerCase())
      })
    : participants

  async function startRace() {
    const ts = new Date().toISOString()
    const { error } = await supabase.from('race_events').insert({ race_type: 'adult', event_type: 'start', ts })
    if (error) { alert('Error: ' + error.message); return }
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
    setRaceEnded(true); setConfirm(null); focusSearch()
  }

  async function resetRace() {
    await supabase.from('timing_records').delete().eq('race_type', 'adult')
    await supabase.from('race_events').insert({ race_type: 'adult', event_type: 'reset', ts: new Date().toISOString() })
    setRaceStart(null); setRaceEnded(false); setTimingRecords({}); setConfirm(null); focusSearch()
  }

  async function applyCheckpoint(p, field) {
    const ts = new Date().toISOString()
    const rec = timingRecords[p.id]
    if (!rec) return
    const { error } = await supabase.from('timing_records').update({ [field]: ts }).eq('id', rec.id)
    if (!error) setTimingRecords(m => ({ ...m, [p.id]: { ...rec, [field]: ts } }))
    setSearchVal(''); focusSearch()
  }

  async function markDNF(p) {
    const rec = timingRecords[p.id]
    if (!rec) return
    const { error } = await supabase.from('timing_records').update({ dnf: true }).eq('id', rec.id)
    if (!error) setTimingRecords(m => ({ ...m, [p.id]: { ...rec, dnf: true } }))
    setSearchVal(''); focusSearch(); setConfirm(null)
  }

  async function goBack(p) {
    const rec = timingRecords[p.id]
    if (!rec) return
    // Find and clear most recent checkpoint
    let update = {}
    if (rec.dnf) update = { dnf: false }
    else if (rec.finish_time) update = { finish_time: null }
    else if (rec.run_complete) update = { run_complete: null }
    else if (rec.bike_complete) update = { bike_complete: null }
    else if (rec.swim_complete) update = { swim_complete: null }
    else return
    const { error } = await supabase.from('timing_records').update(update).eq('id', rec.id)
    if (!error) setTimingRecords(m => ({ ...m, [p.id]: { ...rec, ...update } }))
    setSearchVal(''); focusSearch(); setConfirm(null)
  }

  function getNextButton(rec) {
    if (!rec || rec.dnf) return null
    if (!rec.swim_complete) return { label: '🏊 Mark Swim Complete', field: 'swim_complete' }
    if (!rec.bike_complete) return { label: '🚴 Mark Bike Complete', field: 'bike_complete' }
    if (!rec.run_complete)  return { label: '🏃 Mark Run Complete',  field: 'run_complete'  }
    if (!rec.finish_time)   return { label: '🏁 Mark Finished',      field: 'finish_time'   }
    return null
  }

  function getWarnings() {
    return participants.filter(p => {
      const rec = timingRecords[p.id]
      if (!rec) return !!raceStart
      return !rec.finish_time && !rec.dnf
    })
  }

  if (loading) return <div className="text-muted">Loading...</div>

  return (
    <div>
      <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:16, flexWrap:'wrap'}}>
        <div className="page-title" style={{marginBottom:0}}>Adult Race</div>
        <div style={{flex:1}} />
        <div style={{
          padding:'6px 14px', borderRadius:'999px', fontWeight:700, fontSize:'0.85rem',
          background: raceStart ? (raceEnded ? 'var(--danger)' : 'var(--success)') : 'var(--surface2)',
          color: raceStart ? '#0f1117' : 'var(--muted)'
        }}>
          {!raceStart ? 'Waiting for Start' : raceEnded ? 'Race Ended' : 'Race Running'}
        </div>
        {raceStart && !raceEnded && (
          <div style={{color:'var(--accent)', fontWeight:700, fontFamily:'monospace', fontSize:'1.1rem'}}>
            {formatDuration(now - new Date(raceStart).getTime())}
          </div>
        )}
      </div>

      <div className="race-controls">
        {!raceStart && (
          <button className="btn btn-success btn-lg" onClick={() => setConfirm('start')}>▶ Start Race</button>
        )}
        {raceStart && !raceEnded && (
          <button className="btn btn-danger" onClick={() => setConfirm('end')}>⬛ End Race</button>
        )}
        <button className="btn btn-ghost" onClick={() => setConfirm('reset')}>↺ Reset Race</button>
      </div>

      <div className="timing-search">
        <input
          ref={searchRef}
          className="form-input"
          placeholder="Type race number..."
          value={searchVal}
          onChange={e => setSearchVal(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && exactMatch && raceStart && !raceEnded) {
              const rec = timingRecords[exactMatch.id]
              const next = getNextButton(rec)
              if (next) applyCheckpoint(exactMatch, next.field)
            }
          }}
        />
        {raceStart && <div style={{fontSize:'0.8rem', color:'var(--muted)', marginTop:6}}>Press Enter to record next checkpoint for exact match</div>}
      </div>

      {!raceStart && <div className="alert alert-warn">Race has not started. Press "Start Race" to begin timing.</div>}

      <div>
        {displayList.map(p => {
          const rec = timingRecords[p.id]
          const status = adultStatus(rec, !!raceStart)
          const isHighlighted = exactMatch?.id === p.id
          const isFinished = rec?.finish_time
          const isDNF = rec?.dnf
          const nextBtn = raceStart && !raceEnded ? getNextButton(rec) : null

          // Splits
          const swimMs  = diffMs(raceStart, rec?.swim_complete)
          const t1Ms    = diffMs(rec?.swim_complete, rec?.bike_complete)
          const bikeMs  = diffMs(rec?.bike_complete, rec?.run_complete)
          const runMs   = diffMs(rec?.run_complete, rec?.finish_time)
          const totalMs = diffMs(raceStart, rec?.finish_time)

          return (
            <div
              key={p.id}
              className={`participant-timing-row ${isHighlighted ? 'highlighted' : ''} ${isFinished ? 'finished' : ''} ${isDNF ? 'dnf' : ''}`}
            >
              <div className="timing-row-header">
                <div className="race-num-badge">#{p.race_number}</div>
                <div className="participant-name">
                  {p.is_team && p.team_color
                    ? <span style={{...teamColorStyle(p.team_color), marginRight:8}}>{TEAM_COLORS.find(c=>c.value===p.team_color)?.label || 'Team'}</span>
                    : null
                  }
                  {p.first_name} {p.last_name}
                </div>
                <div className="participant-age">Age {p.age}</div>
                <div style={{
                  padding:'3px 12px', borderRadius:'999px', fontSize:'0.78rem', fontWeight:700,
                  background: isDNF ? 'var(--danger)' : isFinished ? 'var(--success)' : raceStart ? '#00d4ff22' : 'var(--surface2)',
                  color: isDNF ? '#fff' : isFinished ? '#0f1117' : raceStart ? 'var(--accent)' : 'var(--muted)'
                }}>
                  {status}
                </div>
              </div>

              {/* Progress */}
              <div className="progress-dots" style={{marginBottom:8}}>
                <span className={`dot ${raceStart ? 'done' : ''}`}>{raceStart?'✓':'○'} Start</span>
                <span style={{color:'var(--border)'}}>›</span>
                <span className={`dot ${rec?.swim_complete ? 'done' : ''}`}>{rec?.swim_complete?'✓':'○'} Swim {rec?.swim_complete && <small style={{color:'var(--muted)'}}>{formatDuration(swimMs)}</small>}</span>
                <span style={{color:'var(--border)'}}>›</span>
                <span className={`dot ${rec?.bike_complete ? 'done' : ''}`}>{rec?.bike_complete?'✓':'○'} T1/Bike {rec?.bike_complete && <small style={{color:'var(--muted)'}}>{formatDuration(bikeMs)}</small>}</span>
                <span style={{color:'var(--border)'}}>›</span>
                <span className={`dot ${rec?.run_complete ? 'done' : ''}`}>{rec?.run_complete?'✓':'○'} Run {rec?.run_complete && <small style={{color:'var(--muted)'}}>{formatDuration(runMs)}</small>}</span>
                <span style={{color:'var(--border)'}}>›</span>
                <span className={`dot ${rec?.finish_time ? 'done' : ''}`}>{rec?.finish_time?'✓':'○'} Finish</span>
                {isFinished && (
                  <span style={{marginLeft:12, color:'var(--adult-color)', fontWeight:800, fontSize:'0.95rem'}}>
                    Total: {formatDuration(totalMs)}
                  </span>
                )}
              </div>

              {/* Actions */}
              {raceStart && !raceEnded && (
                <div className="timing-actions">
                  {nextBtn && (
                    <button className="btn btn-success btn-lg" onClick={() => applyCheckpoint(p, nextBtn.field)}>
                      {nextBtn.label}
                    </button>
                  )}
                  {(rec?.swim_complete || isDNF) && (
                    <button className="btn btn-ghost" onClick={() => setConfirm({ type: 'goback', p })}>← Go Back</button>
                  )}
                  {!isDNF && !isFinished && (
                    <button className="btn btn-danger btn-sm" onClick={() => setConfirm({ type: 'dnf', p })}>DNF</button>
                  )}
                </div>
              )}

              {/* Split detail if finished */}
              {isFinished && (
                <div style={{display:'flex', gap:20, marginTop:8, fontSize:'0.82rem', color:'var(--muted)', flexWrap:'wrap'}}>
                  <span>Swim: <strong style={{color:'var(--text)'}}>{formatDuration(swimMs)}</strong></span>
                  <span>T1: <strong style={{color:'var(--text)'}}>{formatDuration(t1Ms)}</strong></span>
                  <span>Bike: <strong style={{color:'var(--text)'}}>{formatDuration(bikeMs)}</strong></span>
                  <span>Run: <strong style={{color:'var(--text)'}}>{formatDuration(runMs)}</strong></span>
                  <span>Total: <strong style={{color:'var(--adult-color)'}}>{formatDuration(totalMs)}</strong></span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {confirm === 'start' && (
        <ConfirmModal
          title="Start Adult Race?"
          message={`This will record the official race start for all ${participants.length} checked-in adults. This cannot be undone.`}
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
            <div className="alert alert-warn" style={{marginBottom:12}}>
              <strong>{getWarnings().length} participant(s) not finished:</strong>
              <div style={{marginTop:6}}>
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
