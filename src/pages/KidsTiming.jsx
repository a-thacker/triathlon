import React, { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { formatDuration, diffMs, kidsStatus } from '../lib/utils'
import ConfirmModal from '../components/ConfirmModal'

export default function KidsTiming() {
  const [participants, setParticipants] = useState([])
  const [timingRecords, setTimingRecords] = useState({}) // keyed by participant_id
  const [raceStart, setRaceStart] = useState(null) // ISO string
  const [raceEnded, setRaceEnded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchVal, setSearchVal] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [now, setNow] = useState(Date.now())
  const searchRef = useRef()

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => { load() }, [])

  async function load() {
    // Load participants
    const { data: pData } = await supabase
      .from('participants')
      .select('*')
      .eq('race_type', 'kids')
      .eq('checked_in', true)
      .order('race_number')

    // Load race event (start)
    const { data: evData } = await supabase
      .from('race_events')
      .select('*')
      .eq('race_type', 'kids')
      .order('ts', { ascending: false })

    // Load timing records
    const { data: tData } = await supabase
      .from('timing_records')
      .select('*')
      .eq('race_type', 'kids')

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
        // find start
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

  const filteredParticipants = participants.filter(p => {
    const q = searchVal.trim()
    if (!q) return true
    return String(p.race_number).startsWith(q) ||
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(q.toLowerCase())
  })

  // If exact number match, highlight it
  const exactMatch = participants.find(p => String(p.race_number) === searchVal.trim())

  async function startRace() {
    const ts = new Date().toISOString()
    const { error } = await supabase.from('race_events').insert({
      race_type: 'kids', event_type: 'start', ts
    })
    if (error) { alert('Error starting race: ' + error.message); return }
    // Create timing records for all participants
    const inserts = participants.map(p => ({
      participant_id: p.id,
      race_type: 'kids',
    }))
    if (inserts.length > 0) {
      await supabase.from('timing_records').upsert(inserts, { onConflict: 'participant_id', ignoreDuplicates: true })
    }
    setRaceStart(ts)
    setConfirm(null)
    focusSearch()
    // reload timing
    const { data } = await supabase.from('timing_records').select('*').eq('race_type', 'kids')
    const tMap = {}
    if (data) data.forEach(r => { tMap[r.participant_id] = r })
    setTimingRecords(tMap)
  }

  async function endRace() {
    const { error } = await supabase.from('race_events').insert({
      race_type: 'kids', event_type: 'end', ts: new Date().toISOString()
    })
    if (!error) { setRaceEnded(true); setConfirm(null); focusSearch() }
  }

  async function resetRace() {
    // Delete timing records for kids
    await supabase.from('timing_records').delete().eq('race_type', 'kids')
    // Insert reset event
    await supabase.from('race_events').insert({
      race_type: 'kids', event_type: 'reset', ts: new Date().toISOString()
    })
    setRaceStart(null)
    setRaceEnded(false)
    setTimingRecords({})
    setConfirm(null)
    focusSearch()
  }

  async function markFinished(p) {
    const ts = new Date().toISOString()
    const rec = timingRecords[p.id]
    if (!rec) return
    const { error } = await supabase.from('timing_records').update({ finish_time: ts }).eq('id', rec.id)
    if (!error) {
      setTimingRecords(m => ({ ...m, [p.id]: { ...rec, finish_time: ts } }))
    }
    setSearchVal('')
    focusSearch()
  }

  async function markDNF(p) {
    const rec = timingRecords[p.id]
    if (!rec) return
    const { error } = await supabase.from('timing_records').update({ dnf: true }).eq('id', rec.id)
    if (!error) {
      setTimingRecords(m => ({ ...m, [p.id]: { ...rec, dnf: true } }))
    }
    setSearchVal('')
    focusSearch()
    setConfirm(null)
  }

  async function goBack(p) {
    const rec = timingRecords[p.id]
    if (!rec) return
    // Kids only has finish_time — undo it
    if (rec.finish_time) {
      const { error } = await supabase.from('timing_records').update({ finish_time: null }).eq('id', rec.id)
      if (!error) setTimingRecords(m => ({ ...m, [p.id]: { ...rec, finish_time: null } }))
    } else if (rec.dnf) {
      const { error } = await supabase.from('timing_records').update({ dnf: false }).eq('id', rec.id)
      if (!error) setTimingRecords(m => ({ ...m, [p.id]: { ...rec, dnf: false } }))
    }
    setSearchVal('')
    focusSearch()
    setConfirm(null)
  }

  function getRaceStatusLabel() {
    if (!raceStart) return { label: 'Waiting for Start', color: 'var(--muted)' }
    if (raceEnded) return { label: 'Race Ended', color: 'var(--danger)' }
    return { label: 'Race Running', color: 'var(--success)' }
  }

  const raceStatus = getRaceStatusLabel()

  // End race warnings
  function getWarnings() {
    return participants.filter(p => {
      const rec = timingRecords[p.id]
      if (!rec) return raceStart
      return !rec.finish_time && !rec.dnf
    })
  }

  if (loading) return <div className="text-muted">Loading...</div>

  const displayList = searchVal.trim() ? filteredParticipants : participants

  return (
    <div>
      {/* Race controls */}
      <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:16, flexWrap:'wrap'}}>
        <div className="page-title" style={{marginBottom:0}}>Kids Race</div>
        <div style={{flex:1}} />
        <div style={{
          padding:'6px 14px', borderRadius:'999px', fontWeight:700, fontSize:'0.85rem',
          background: raceStart ? (raceEnded ? 'var(--danger)' : 'var(--success)') : 'var(--surface2)',
          color: raceStart ? '#0f1117' : 'var(--muted)'
        }}>
          {raceStatus.label}
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

      {/* Search */}
      <div className="timing-search">
        <input
          ref={searchRef}
          className="form-input"
          placeholder="Type race number..."
          value={searchVal}
          onChange={e => setSearchVal(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && exactMatch) {
              const rec = timingRecords[exactMatch.id]
              if (raceStart && !raceEnded && rec && !rec.finish_time && !rec.dnf) {
                markFinished(exactMatch)
              }
            }
          }}
        />
        {raceStart && <div style={{fontSize:'0.8rem', color:'var(--muted)', marginTop:6}}>Press Enter to mark finish for exact match</div>}
      </div>

      {/* Not started warning */}
      {!raceStart && (
        <div className="alert alert-warn">Race has not started. Press "Start Race" to begin timing.</div>
      )}

      {/* Participant rows */}
      <div>
        {displayList.map(p => {
          const rec = timingRecords[p.id]
          const status = kidsStatus(rec, !!raceStart)
          const isHighlighted = exactMatch?.id === p.id
          const isFinished = rec?.finish_time
          const isDNF = rec?.dnf
          const totalMs = diffMs(raceStart, rec?.finish_time)

          return (
            <div
              key={p.id}
              className={`participant-timing-row ${isHighlighted ? 'highlighted' : ''} ${isFinished ? 'finished' : ''} ${isDNF ? 'dnf' : ''}`}
            >
              <div className="timing-row-header">
                <div className="race-num-badge">#{p.race_number}</div>
                <div className="participant-name">{p.first_name} {p.last_name}</div>
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
              <div className="progress-dots">
                <span className={`dot ${raceStart ? 'done' : ''}`}>
                  {raceStart ? '✓' : '○'} Started
                </span>
                <span style={{color:'var(--muted)'}}>→</span>
                <span className={`dot ${isFinished ? 'done' : ''}`}>
                  {isFinished ? '✓' : '○'} Finished
                </span>
                {isFinished && totalMs != null && (
                  <span style={{marginLeft:8, color:'var(--kids-color)', fontWeight:700}}>
                    {formatDuration(totalMs)}
                  </span>
                )}
              </div>

              {/* Actions */}
              {raceStart && !raceEnded && (
                <div className="timing-actions">
                  {!isFinished && !isDNF && (
                    <button className="btn btn-success btn-lg" onClick={() => markFinished(p)}>
                      ✓ Mark Finished
                    </button>
                  )}
                  {(isFinished || isDNF) && (
                    <button className="btn btn-ghost" onClick={() => setConfirm({ type: 'goback', p })}>
                      ← Go Back
                    </button>
                  )}
                  {!isDNF && !isFinished && (
                    <button className="btn btn-danger btn-sm" onClick={() => setConfirm({ type: 'dnf', p })}>
                      DNF
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Confirm modals */}
      {confirm === 'start' && (
        <ConfirmModal
          title="Start Kids Race?"
          message={`This will record the official race start time for all ${participants.length} checked-in kids. This cannot be undone.`}
          onConfirm={startRace}
          onCancel={() => setConfirm(null)}
          confirmLabel="Start Race"
        />
      )}
      {confirm === 'end' && (
        <ConfirmModal
          title="End Kids Race?"
          onConfirm={endRace}
          onCancel={() => setConfirm(null)}
          confirmLabel="End Race"
          danger
        >
          {getWarnings().length > 0 && (
            <div className="alert alert-warn" style={{marginBottom:12}}>
              <strong>{getWarnings().length} participant(s) have not finished:</strong>
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
          title="Reset Kids Race?"
          message="This will delete ALL timing data for the kids race. This cannot be undone."
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
