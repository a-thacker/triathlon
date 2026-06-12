import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { formatDuration, diffMs, teamColorStyle, TEAM_COLORS, nextAdultAction, calcAdultSplits } from '../lib/utils'
import ConfirmModal from '../components/ConfirmModal'
import ResetConfirmModal from '../components/ResetConfirmModal'

// Derive status label from timing record
function adultStatusLabel(rec, raceStarted) {
  if (!raceStarted) return 'Waiting for Start'
  if (!rec) return 'Swimming'
  if (rec.dnf) return 'DNF'
  if (rec.finish_time)   return 'Finished'
  if (rec.run_start)     return 'Running'
  if (rec.bike_complete) return 'In T2'
  if (rec.bike_start)    return 'Biking'
  if (rec.swim_complete) return 'In T1'
  return 'Swimming'
}

export default function AdultTiming() {
  const [participants, setParticipants] = useState([])   // all checked-in adults
  const [timingMap, setTimingMap]       = useState({})   // key: participant_id OR "team:COLOR" -> record
  const [raceStart, setRaceStart]       = useState(null)
  const [raceEnded, setRaceEnded]       = useState(false)
  const [loading, setLoading]           = useState(true)
  const [searchVal, setSearchVal]       = useState('')
  const [confirm, setConfirm]           = useState(null)
  const [now, setNow]                   = useState(Date.now())
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

    // Build timing map:
    // - individuals: key = participant_id
    // - teams:       key = "team:COLOR"
    const tMap = {}
    if (tData) {
      tData.forEach(r => {
        if (r.team_color) {
          tMap[`team:${r.team_color}`] = r
        } else if (r.participant_id) {
          tMap[r.participant_id] = r
        }
      })
    }
    setTimingMap(tMap)

    if (evData && evData.length > 0) {
      const latest = evData[0]
      if (latest.event_type === 'end') {
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

  // Group participants: individuals stay solo, team members group by color
  // Returns array of "entries" — either { type:'individual', participant } or { type:'team', color, members[] }
  function buildEntries(list) {
    const entries = []
    const teamMap = {}

    list.forEach(p => {
      if (p.is_team && p.team_color) {
        if (!teamMap[p.team_color]) {
          teamMap[p.team_color] = { type: 'team', color: p.team_color, members: [] }
          entries.push(teamMap[p.team_color])
        }
        teamMap[p.team_color].members.push(p)
      } else {
        entries.push({ type: 'individual', participant: p })
      }
    })

    // Sort team members by role order: swimmer -> biker -> runner
    const roleOrder = { swimmer: 0, biker: 1, runner: 2 }
    Object.values(teamMap).forEach(t => {
      t.members.sort((a, b) => (roleOrder[a.team_role] ?? 9) - (roleOrder[b.team_role] ?? 9))
    })

    return entries
  }

  // Search: match individual by number/name, team by color label or any member name/number
  function matchesSearch(entry, q) {
    if (!q) return true
    const lower = q.toLowerCase()
    if (entry.type === 'individual') {
      const p = entry.participant
      return String(p.race_number).startsWith(q) ||
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(lower)
    }
    // team
    const colorLabel = TEAM_COLORS.find(c => c.value === entry.color)?.label || ''
    if (colorLabel.toLowerCase().includes(lower)) return true
    return entry.members.some(p =>
      String(p.race_number).startsWith(q) ||
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(lower)
    )
  }

  // Exact match: race number matches any member or individual
  function findExactEntry(entries, q) {
    if (!q) return null
    return entries.find(entry => {
      if (entry.type === 'individual') return String(entry.participant.race_number) === q
      return entry.members.some(p => String(p.race_number) === q)
    })
  }

  const q = searchVal.trim()
  const allEntries = buildEntries(participants)
  const displayEntries = q ? allEntries.filter(e => matchesSearch(e, q)) : allEntries
  const exactEntry = findExactEntry(allEntries, q)

  // Get timing record for an entry
  function recForEntry(entry) {
    if (entry.type === 'individual') return timingMap[entry.participant.id]
    return timingMap[`team:${entry.color}`]
  }

  async function startRace() {
    const ts = new Date().toISOString()
    const { error } = await supabase.from('race_events').insert({ race_type: 'adult', event_type: 'start', ts })
    if (error) { alert('Error starting race: ' + error.message); return }

    // Create timing records for individuals and one per team
    const inserts = []
    allEntries.forEach(entry => {
      if (entry.type === 'individual') {
        inserts.push({ participant_id: entry.participant.id, race_type: 'adult' })
      } else {
        // one record per team, keyed by team_color
        inserts.push({ team_color: entry.color, race_type: 'adult' })
      }
    })

    if (inserts.length > 0) {
      await supabase.from('timing_records').upsert(inserts, { ignoreDuplicates: true })
    }

    setRaceStart(ts)
    setConfirm(null)
    focusSearch()

    const { data } = await supabase.from('timing_records').select('*').eq('race_type', 'adult')
    const tMap = {}
    if (data) data.forEach(r => {
      if (r.team_color) tMap[`team:${r.team_color}`] = r
      else if (r.participant_id) tMap[r.participant_id] = r
    })
    setTimingMap(tMap)
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
    setTimingMap({})
    setConfirm(null)
    focusSearch()
  }

  async function applyCheckpoint(entry, field) {
    const ts = new Date().toISOString()
    const rec = recForEntry(entry)
    if (!rec) return
    const { error } = await supabase.from('timing_records').update({ [field]: ts }).eq('id', rec.id)
    if (!error) {
      const key = entry.type === 'individual' ? entry.participant.id : `team:${entry.color}`
      setTimingMap(m => ({ ...m, [key]: { ...rec, [field]: ts } }))
    }
    setSearchVal('')
    focusSearch()
  }

  async function markDNF(entry) {
    const rec = recForEntry(entry)
    if (!rec) return
    const { error } = await supabase.from('timing_records').update({ dnf: true }).eq('id', rec.id)
    if (!error) {
      const key = entry.type === 'individual' ? entry.participant.id : `team:${entry.color}`
      setTimingMap(m => ({ ...m, [key]: { ...rec, dnf: true } }))
    }
    setSearchVal('')
    focusSearch()
    setConfirm(null)
  }

  async function goBack(entry) {
    const rec = recForEntry(entry)
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
    if (!error) {
      const key = entry.type === 'individual' ? entry.participant.id : `team:${entry.color}`
      setTimingMap(m => ({ ...m, [key]: { ...rec, ...update } }))
    }
    setSearchVal('')
    focusSearch()
    setConfirm(null)
  }

  function getWarnings() {
    return allEntries.filter(entry => {
      const rec = recForEntry(entry)
      if (!rec) return !!raceStart
      return !rec.finish_time && !rec.dnf
    })
  }

  function teamColorLabel(color) {
    return TEAM_COLORS.find(c => c.value === color)?.label || 'Team'
  }

  function entryLabel(entry) {
    if (entry.type === 'individual') return `${entry.participant.first_name} ${entry.participant.last_name}`
    return `${teamColorLabel(entry.color)} Team`
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
            if (e.key === 'Enter' && exactEntry && raceStart && !raceEnded) {
              const rec = recForEntry(exactEntry)
              const next = nextAdultAction(rec)
              if (next) applyCheckpoint(exactEntry, next.field)
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

      {/* Entries */}
      <div>
        {displayEntries.map((entry, idx) => {
          const rec = recForEntry(entry)
          const status = adultStatusLabel(rec, !!raceStart)
          const isHighlighted = exactEntry === entry
          const isFinished = !!rec?.finish_time
          const isDNF = !!rec?.dnf
          const next = raceStart && !raceEnded ? nextAdultAction(rec) : null
          const canGoBack = raceStart && !raceEnded && rec &&
            (rec.swim_complete || rec.bike_start || rec.bike_complete || rec.run_start || rec.finish_time || rec.dnf)
          const splits = calcAdultSplits(rec, raceStart)
          const isTeam = entry.type === 'team'

          return (
            <div
              key={isTeam ? `team-${entry.color}` : entry.participant.id}
              className={`participant-timing-row${isHighlighted ? ' highlighted' : ''}${isFinished ? ' finished' : ''}${isDNF ? ' dnf' : ''}`}
            >
              {/* Header row */}
              <div className="timing-row-header">
                {isTeam ? (
                  // Team: color pill + race numbers + member names by role
                  <>
                    <span style={{ ...teamColorStyle(entry.color), flexShrink: 0, fontSize: '0.95rem' }}>
                      {teamColorLabel(entry.color)}
                    </span>
                    <div style={{ flex: 1, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                      {entry.members.map(p => (
                        <span key={p.id} style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ color: 'var(--accent)', fontWeight: 900, fontSize: '1rem' }}>#{p.race_number}</span>
                          <span style={{ color: 'var(--muted)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            {p.team_role}
                          </span>
                          <strong>{p.first_name} {p.last_name}</strong>
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  // Individual
                  <>
                    <div className="race-num-badge">#{entry.participant.race_number}</div>
                    <div className="participant-name">{entry.participant.first_name} {entry.participant.last_name}</div>
                    <div className="participant-age">Age {entry.participant.age}</div>
                  </>
                )}

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
                {[
                  { label: 'Start',  done: !!raceStart,          split: null },
                  { label: 'Swim',   done: !!rec?.swim_complete,  split: splits.swimMs },
                  { label: 'T1',     done: !!rec?.bike_start,     split: splits.t1Ms   },
                  { label: 'Bike',   done: !!rec?.bike_complete,  split: splits.bikeMs },
                  { label: 'T2',     done: !!rec?.run_start,      split: splits.t2Ms   },
                  { label: 'Run',    done: !!rec?.finish_time,    split: splits.runMs  },
                  { label: 'Finish', done: !!rec?.finish_time,    split: null          },
                ].map((step, i, arr) => (
                  <React.Fragment key={step.label}>
                    <span className={`dot ${step.done ? 'done' : ''}`}>
                      {step.done ? 'v' : 'o'} {step.label}
                      {step.done && step.split != null &&
                        <small style={{ color: 'var(--muted)', marginLeft: 3 }}>{formatDuration(step.split)}</small>
                      }
                    </span>
                    {i < arr.length - 1 && <span style={{ color: 'var(--border)' }}>-</span>}
                  </React.Fragment>
                ))}
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
                    <button className="btn btn-success btn-lg" onClick={() => applyCheckpoint(entry, next.field)}>
                      {next.label}
                    </button>
                  )}
                  {canGoBack && (
                    <button className="btn btn-ghost" onClick={() => setConfirm({ type: 'goback', entry })}>
                      Go Back
                    </button>
                  )}
                  {!isDNF && !isFinished && (
                    <button className="btn btn-danger btn-sm" onClick={() => setConfirm({ type: 'dnf', entry })}>
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
          message={`This records the official race start for all ${allEntries.length} entries. This cannot be undone.`}
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
              <strong>{getWarnings().length} entr{getWarnings().length === 1 ? 'y' : 'ies'} not finished:</strong>
              <div style={{ marginTop: 6 }}>
                {getWarnings().map((entry, i) => (
                  <div key={i}>{entryLabel(entry)}</div>
                ))}
              </div>
            </div>
          )}
          <p>Are you sure you want to end the race?</p>
        </ConfirmModal>
      )}
      {confirm === 'reset' && (
        <ResetConfirmModal
          title="Reset Adult Race?"
          finishedCount={Object.values(timingMap).filter(r => r.finish_time).length}
          onConfirm={resetRace}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm?.type === 'goback' && (
        <ConfirmModal
          title="Undo Last Action?"
          message={`Remove the most recent timing entry for ${entryLabel(confirm.entry)}?`}
          onConfirm={() => goBack(confirm.entry)}
          onCancel={() => setConfirm(null)}
          confirmLabel="Go Back"
        />
      )}
      {confirm?.type === 'dnf' && (
        <ConfirmModal
          title="Mark as DNF?"
          message={`Mark ${entryLabel(confirm.entry)} as Did Not Finish?`}
          onConfirm={() => markDNF(confirm.entry)}
          onCancel={() => setConfirm(null)}
          confirmLabel="Mark DNF"
          danger
        />
      )}
    </div>
  )
}
