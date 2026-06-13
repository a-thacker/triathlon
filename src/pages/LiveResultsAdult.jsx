import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatDuration, diffMs, teamColorStyle, TEAM_COLORS, calcAdultSplits } from '../lib/utils'

const STATUS_ORDER = ['Swimming', 'In T1', 'Biking', 'In T2', 'Running', 'Finished']

function deriveStatus(rec, raceStarted) {
  if (!raceStarted) return 'Not Started'
  if (!rec) return 'Swimming'
  if (rec.dnf) return 'DNF'
  if (rec.finish_time)   return 'Finished'
  if (rec.run_start)     return 'Running'
  if (rec.bike_complete) return 'In T2'
  if (rec.bike_start)    return 'Biking'
  if (rec.swim_complete) return 'In T1'
  return 'Swimming'
}

export default function LiveResultsAdult() {
  const [rows, setRows]           = useState([])
  const [raceStart, setRaceStart] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    load()
    const dataInterval = setInterval(load, 10000)
    const clockInterval = setInterval(() => setNow(Date.now()), 1000)
    return () => { clearInterval(dataInterval); clearInterval(clockInterval) }
  }, [])

  async function load() {
    const { data: evData } = await supabase.from('race_events').select('ts')
      .eq('race_type', 'adult').eq('event_type', 'start')
      .order('ts', { ascending: false }).limit(1)
    const startTs = evData?.[0]?.ts || null
    setRaceStart(startTs)

    // All timing records — not just finished
    const { data: tData } = await supabase.from('timing_records').select('*').eq('race_type', 'adult')
    if (!tData) return

    const individualIds = tData.filter(r => r.participant_id && !r.team_color).map(r => r.participant_id)
    const teamColors    = tData.filter(r => r.team_color).map(r => r.team_color)

    let pMap = {}
    if (individualIds.length > 0) {
      const { data } = await supabase.from('participants').select('*').in('id', individualIds)
      if (data) data.forEach(p => { pMap[p.id] = p })
    }
    let teamMap = {}
    if (teamColors.length > 0) {
      const { data } = await supabase.from('participants').select('*')
        .in('team_color', teamColors).eq('race_type', 'adult')
      if (data) data.forEach(p => {
        if (!teamMap[p.team_color]) teamMap[p.team_color] = []
        teamMap[p.team_color].push(p)
      })
    }

    const built = tData.map(r => {
      const splits = calcAdultSplits(r, startTs)
      const status = deriveStatus(r, !!startTs)
      if (r.team_color) {
        const members = teamMap[r.team_color] || []
        const colorLabel = TEAM_COLORS.find(c => c.value === r.team_color)?.label || 'Team'
        return {
          id: r.id, isTeam: true, rec: r, status,
          teamColor: r.team_color,
          name: `${colorLabel} Team`,
          subName: members.map(m => m.first_name).join(' / '),
          raceNumbers: members.map(m => `#${m.race_number}`).join(' '),
          gender: null, age: null, ...splits,
        }
      }
      const p = pMap[r.participant_id] || {}
      return {
        id: r.id, isTeam: false, rec: r, status,
        name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
        raceNumber: p.race_number,
        gender: p.gender, age: p.age, ...splits,
      }
    })

    // Sort: finished by totalMs, others by last checkpoint desc
    built.sort((a, b) => {
      if (a.status === 'Finished' && b.status === 'Finished') return (a.totalMs ?? Infinity) - (b.totalMs ?? Infinity)
      const ai = STATUS_ORDER.indexOf(a.status)
      const bi = STATUS_ORDER.indexOf(b.status)
      return bi - ai
    })

    setRows(built)
    setLastUpdate(new Date())
  }

  const elapsedMs = raceStart ? now - new Date(raceStart).getTime() : null

  const statuses = ['all', ...STATUS_ORDER]
  const displayed = statusFilter === 'all' ? rows : rows.filter(r => r.status === statusFilter)

  // Group for "all" view
  const grouped = STATUS_ORDER.reduce((acc, s) => {
    const matching = rows.filter(r => r.status === s)
    if (matching.length > 0) acc[s] = matching
    return acc
  }, {})

  const sel = {
    background: 'var(--surface2)', border: '1px solid var(--border)',
    borderRadius: 6, color: 'var(--text)', padding: '8px 12px',
    fontSize: '0.85rem', cursor: 'pointer', width: '100%',
  }

  function SplitBar({ row }) {
    if (!row.swimMs && !row.bikeMs && !row.runMs) return null
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 3, marginTop: 8 }}>
        {[
          { label: 'Swim', val: row.swimMs },
          { label: 'T1',   val: row.t1Ms   },
          { label: 'Bike', val: row.bikeMs },
          { label: 'T2',   val: row.t2Ms   },
          { label: 'Run',  val: row.runMs  },
        ].map(s => s.val != null ? (
          <div key={s.label} style={{ background: 'var(--surface2)', borderRadius: 5, padding: '4px 3px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.58rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>{s.label}</div>
            <div style={{ fontSize: '0.72rem', fontFamily: 'monospace', fontWeight: 700, marginTop: 1 }}>{formatDuration(s.val)}</div>
          </div>
        ) : (
          <div key={s.label} style={{ background: 'var(--surface2)', borderRadius: 5, padding: '4px 3px', textAlign: 'center', opacity: 0.3 }}>
            <div style={{ fontSize: '0.58rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>{s.label}</div>
            <div style={{ fontSize: '0.72rem', fontFamily: 'monospace', marginTop: 1 }}>—</div>
          </div>
        ))}
      </div>
    )
  }

  function ResultRow({ row, rank }) {
    return (
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '12px 14px', marginBottom: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {rank != null && (
            <div style={{
              width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
              background: rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : 'var(--surface2)',
              color: rank <= 3 ? '#111' : 'var(--muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: '0.75rem',
            }}>{rank}</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            {row.isTeam ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={teamColorStyle(row.teamColor)}>{row.name}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{row.raceNumbers}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 2 }}>{row.subName}</div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{row.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 1 }}>
                  #{row.raceNumber}{row.age ? ` · Age ${row.age}` : ''}{row.gender ? ` · ${row.gender}` : ''}
                </div>
              </>
            )}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '1rem', color: row.totalMs ? 'var(--adult-color)' : 'var(--muted)' }}>
              {row.totalMs ? formatDuration(row.totalMs) : row.status}
            </div>
          </div>
        </div>
        <SplitBar row={row} />
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div className="page-title">Adult Race — Live</div>
        {elapsedMs != null && (
          <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '1.3rem', color: 'var(--accent)' }}>
            {formatDuration(elapsedMs)}
          </div>
        )}
      </div>
      <div className="page-sub">
        {raceStart ? `Race started ${new Date(raceStart).toLocaleTimeString()}` : 'Race not started yet.'}
        {lastUpdate && ` · Updated ${lastUpdate.toLocaleTimeString()}`}
      </div>

      {/* Status filter */}
      <div style={{ marginBottom: 16 }}>
        <select style={sel} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All ({rows.length})</option>
          {STATUS_ORDER.map(s => {
            const count = rows.filter(r => r.status === s).length
            return count > 0 ? <option key={s} value={s}>{s} ({count})</option> : null
          })}
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="alert alert-info">No timing data yet.</div>
      ) : statusFilter !== 'all' ? (
        // Filtered view
        displayed.length === 0
          ? <div className="text-muted" style={{ padding: '24px 0' }}>Nobody in this status right now.</div>
          : displayed.map((row, i) => (
              <ResultRow key={row.id} row={row} rank={row.status === 'Finished' ? i + 1 : null} />
            ))
      ) : (
        // Grouped all view
        STATUS_ORDER.map(s => grouped[s] ? (
          <div key={s}>
            <div style={{
              fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.1em', color: 'var(--muted)', padding: '16px 0 6px',
              borderBottom: '1px solid var(--border)', marginBottom: 8,
            }}>
              {s} ({grouped[s].length})
            </div>
            {grouped[s].map((row, i) => (
              <ResultRow key={row.id} row={row} rank={s === 'Finished' ? i + 1 : null} />
            ))}
          </div>
        ) : null)
      )}
    </div>
  )
}
