import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatDuration, diffMs, calcAdultSplits, TEAM_COLORS, teamColorStyle } from '../lib/utils'
import ConfirmModal from '../components/ConfirmModal'

// Convert ISO timestamp to local datetime-local input value
function toInputVal(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// Convert datetime-local input value back to ISO
function fromInputVal(val) {
  if (!val) return null
  return new Date(val).toISOString()
}

function TimingEditor({ entry, raceStart, onSaved }) {
  const rec = entry.timingRecord
  const isAdult = entry.race_type === 'adult'

  const [fields, setFields] = useState({
    swim_complete: toInputVal(rec?.swim_complete),
    bike_start:    toInputVal(rec?.bike_start),
    bike_complete: toInputVal(rec?.bike_complete),
    run_start:     toInputVal(rec?.run_start),
    finish_time:   toInputVal(rec?.finish_time),
    dnf:           rec?.dnf ?? false,
  })
  const [confirm, setConfirm] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  function setField(k, v) {
    setFields(f => ({ ...f, [k]: v }))
  }

  // Calculate preview splits from current field values
  const previewRec = {
    swim_complete: fromInputVal(fields.swim_complete),
    bike_start:    fromInputVal(fields.bike_start),
    bike_complete: fromInputVal(fields.bike_complete),
    run_start:     fromInputVal(fields.run_start),
    finish_time:   fromInputVal(fields.finish_time),
  }
  const splits  = isAdult ? calcAdultSplits(previewRec, raceStart) : {}
  const totalMs = diffMs(raceStart, previewRec.finish_time)

  async function save() {
    setSaving(true)
    setError('')
    const update = {
      swim_complete: fromInputVal(fields.swim_complete),
      bike_start:    fromInputVal(fields.bike_start),
      bike_complete: fromInputVal(fields.bike_complete),
      run_start:     fromInputVal(fields.run_start),
      finish_time:   fromInputVal(fields.finish_time),
      dnf:           fields.dnf,
    }
    // Remove adult-only fields for kids
    if (!isAdult) {
      delete update.swim_complete
      delete update.bike_start
      delete update.bike_complete
      delete update.run_start
    }
    const { error: err } = await supabase
      .from('timing_records').update(update).eq('id', rec.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    setConfirm(false)
    onSaved()
  }

  const labelStyle = { fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, display: 'block' }
  const inputStyle = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '8px 10px', fontSize: '0.85rem', width: '100%' }
  const splitStyle = { fontSize: '0.78rem', color: 'var(--muted)', marginTop: 2 }

  return (
    <div style={{ padding: '16px 0 8px', borderTop: '1px solid var(--border)', marginTop: 8 }}>
      {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

      {!rec && (
        <div className="alert alert-warn" style={{ marginBottom: 12 }}>
          No timing record exists for this participant yet. They need to have been part of a started race.
        </div>
      )}

      {rec && (
        <>
          {/* Kids: only finish time */}
          {!isAdult && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Finish Time</label>
                <input type="datetime-local" step="1" style={inputStyle}
                  value={fields.finish_time}
                  onChange={e => setField('finish_time', e.target.value)} />
                {totalMs != null && <div style={splitStyle}>Total: {formatDuration(totalMs)}</div>}
              </div>
            </div>
          )}

          {/* Adults: all splits */}
          {isAdult && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Swim Complete</label>
                <input type="datetime-local" step="1" style={inputStyle}
                  value={fields.swim_complete}
                  onChange={e => setField('swim_complete', e.target.value)} />
                {splits.swimMs != null && <div style={splitStyle}>Swim: {formatDuration(splits.swimMs)}</div>}
              </div>
              <div>
                <label style={labelStyle}>Begin Bike (T1 end)</label>
                <input type="datetime-local" step="1" style={inputStyle}
                  value={fields.bike_start}
                  onChange={e => setField('bike_start', e.target.value)} />
                {splits.t1Ms != null && <div style={splitStyle}>T1: {formatDuration(splits.t1Ms)}</div>}
              </div>
              <div>
                <label style={labelStyle}>Bike Complete</label>
                <input type="datetime-local" step="1" style={inputStyle}
                  value={fields.bike_complete}
                  onChange={e => setField('bike_complete', e.target.value)} />
                {splits.bikeMs != null && <div style={splitStyle}>Bike: {formatDuration(splits.bikeMs)}</div>}
              </div>
              <div>
                <label style={labelStyle}>Begin Run (T2 end)</label>
                <input type="datetime-local" step="1" style={inputStyle}
                  value={fields.run_start}
                  onChange={e => setField('run_start', e.target.value)} />
                {splits.t2Ms != null && <div style={splitStyle}>T2: {formatDuration(splits.t2Ms)}</div>}
              </div>
              <div>
                <label style={labelStyle}>Finish Time</label>
                <input type="datetime-local" step="1" style={inputStyle}
                  value={fields.finish_time}
                  onChange={e => setField('finish_time', e.target.value)} />
                {splits.runMs != null && <div style={splitStyle}>Run: {formatDuration(splits.runMs)}</div>}
              </div>
            </div>
          )}

          {/* Total preview */}
          {totalMs != null && (
            <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--surface2)', borderRadius: 6, fontSize: '0.9rem' }}>
              Total Time Preview: <strong style={{ color: 'var(--accent)', fontFamily: 'monospace' }}>{formatDuration(totalMs)}</strong>
            </div>
          )}

          {/* DNF toggle */}
          <label className="checkbox-label" style={{ marginBottom: 14 }}>
            <input type="checkbox" checked={fields.dnf} onChange={e => setField('dnf', e.target.checked)} />
            <span style={{ color: fields.dnf ? 'var(--danger)' : 'var(--text)', fontWeight: 600 }}>
              Mark as DNF (Did Not Finish)
            </span>
          </label>

          <button className="btn btn-warning" onClick={() => setConfirm(true)}>
            Save Time Changes
          </button>
        </>
      )}

      {confirm && (
        <ConfirmModal
          title="Save time changes?"
          message={`This will overwrite the recorded times for ${entry.displayName}. The updated times will immediately affect all results and splits.`}
          onConfirm={save}
          onCancel={() => setConfirm(false)}
          confirmLabel={saving ? 'Saving...' : 'Confirm Save'}
        />
      )}
    </div>
  )
}

export default function EditTimes() {
  const [entries, setEntries]       = useState([])
  const [raceStarts, setRaceStarts] = useState({})
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filterRace, setFilterRace] = useState('all')
  const [expanded, setExpanded]     = useState(null) // id of expanded entry
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => { load() }, [refreshKey])

  async function load() {
    // Race starts
    const { data: evData } = await supabase.from('race_events')
      .select('race_type, event_type, ts').eq('event_type', 'start')
      .order('ts', { ascending: false })
    const starts = {}
    if (evData) evData.forEach(e => { if (!starts[e.race_type]) starts[e.race_type] = e.ts })
    setRaceStarts(starts)

    // All participants
    const { data: pData } = await supabase.from('participants').select('*').order('race_type').order('race_number')

    // All timing records
    const { data: tData } = await supabase.from('timing_records').select('*')
    const tByParticipant = {}
    const tByTeam = {}
    if (tData) tData.forEach(r => {
      if (r.participant_id) tByParticipant[r.participant_id] = r
      if (r.team_color)     tByTeam[`${r.team_color}:${r.race_type}`] = r
    })

    // Build display entries — group teams
    const built = []
    const seenTeams = new Set()

    ;(pData || []).forEach(p => {
      if (p.is_team && p.team_color) {
        const key = `${p.team_color}:${p.race_type}`
        if (seenTeams.has(key)) return
        seenTeams.add(key)
        const colorLabel = TEAM_COLORS.find(c => c.value === p.team_color)?.label || 'Team'
        built.push({
          id: key,
          race_type: p.race_type,
          displayName: `${colorLabel} Team`,
          raceNumber: p.race_number,
          isTeam: true,
          teamColor: p.team_color,
          timingRecord: tByTeam[key] || null,
        })
      } else {
        built.push({
          id: p.id,
          race_type: p.race_type,
          displayName: `${p.first_name} ${p.last_name}`,
          raceNumber: p.race_number,
          isTeam: false,
          timingRecord: tByParticipant[p.id] || null,
        })
      }
    })

    setEntries(built)
    setLoading(false)
  }

  const filtered = entries.filter(e => {
    if (filterRace !== 'all' && e.race_type !== filterRace) return false
    const q = search.toLowerCase().trim()
    if (!q) return true
    return String(e.raceNumber).includes(q) || e.displayName.toLowerCase().includes(q)
  })

  const sel = { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '8px 10px', fontSize: '0.85rem', cursor: 'pointer' }

  return (
    <div>
      <div className="page-title">Edit Times</div>
      <div className="page-sub">
        Search for any participant and edit their recorded timestamps. All changes require confirmation and take effect immediately.
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: 200 }}>
          <span className="search-icon">🔍</span>
          <input className="form-input" style={{ paddingLeft: 36 }}
            placeholder="Search by number or name..."
            value={search} onChange={e => setSearch(e.target.value)} autoFocus />
        </div>
        <select style={sel} value={filterRace} onChange={e => setFilterRace(e.target.value)}>
          <option value="all">All Races</option>
          <option value="kids">Kids</option>
          <option value="adult">Adult</option>
        </select>
      </div>

      {loading ? (
        <div className="text-muted">Loading...</div>
      ) : (
        <div>
          {filtered.length === 0 && (
            <div className="text-muted" style={{ padding: '24px 0' }}>No participants found.</div>
          )}
          {filtered.map(entry => (
            <div key={entry.id} className="card" style={{ marginBottom: 10, padding: '14px 18px' }}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
              >
                <div style={{ color: 'var(--accent)', fontWeight: 900, fontSize: '1.1rem', minWidth: 36 }}>
                  #{entry.raceNumber}
                </div>
                {entry.isTeam && (
                  <span style={teamColorStyle(entry.teamColor)}>{entry.displayName}</span>
                )}
                {!entry.isTeam && (
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{entry.displayName}</div>
                )}
                <span className={`badge badge-${entry.race_type}`}>{entry.race_type}</span>
                {entry.timingRecord?.finish_time && (
                  <span style={{ fontFamily: 'monospace', color: 'var(--success)', fontSize: '0.85rem', fontWeight: 700 }}>
                    {formatDuration(diffMs(raceStarts[entry.race_type], entry.timingRecord.finish_time))}
                  </span>
                )}
                {entry.timingRecord?.dnf && (
                  <span className="badge badge-no">DNF</span>
                )}
                {!entry.timingRecord && (
                  <span style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>No timing data</span>
                )}
                <div style={{ flex: 1 }} />
                <div style={{ color: 'var(--muted)', fontSize: '1.1rem' }}>
                  {expanded === entry.id ? '▲' : '▼'}
                </div>
              </div>

              {expanded === entry.id && (
                <TimingEditor
                  entry={entry}
                  raceStart={raceStarts[entry.race_type]}
                  onSaved={() => { setRefreshKey(k => k + 1); setExpanded(null) }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
