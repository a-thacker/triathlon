import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatDuration, diffMs, teamColorStyle, TEAM_COLORS, calcAdultSplits } from '../lib/utils'

const TABS = [
  { key: 'kids',  label: 'Kids Race'  },
  { key: 'adult', label: 'Adult Race' },
  { key: 'final', label: 'Final'      },
]

// ── Data fetchers ─────────────────────────────────────────────

async function fetchSettings() {
  const { data } = await supabase.from('app_settings').select('*').eq('id', 1).single()
  return data || { kids_results_released: false, adults_results_released: false }
}

async function fetchKidsLive() {
  const { data: evData } = await supabase.from('race_events').select('ts')
    .eq('race_type', 'kids').eq('event_type', 'start')
    .order('ts', { ascending: false }).limit(1)
  const startTs = evData?.[0]?.ts || null

  const { data: tData } = await supabase.from('timing_records')
    .select('*, participants(*)')
    .eq('race_type', 'kids').not('finish_time', 'is', null).eq('dnf', false)

  return (tData || [])
    .filter(r => !r.participants?.exclude_from_results)
    .map(r => ({
      id: r.id,
      raceNumber: r.participants?.race_number,
      name: `${r.participants?.first_name} ${r.participants?.last_name}`,
      age: r.participants?.age,
      gender: r.participants?.gender,
      totalMs: diffMs(startTs, r.finish_time),
    })).sort((a, b) => (a.totalMs ?? Infinity) - (b.totalMs ?? Infinity))
}

async function fetchAdultLive() {
  const { data: evData } = await supabase.from('race_events').select('ts')
    .eq('race_type', 'adult').eq('event_type', 'start')
    .order('ts', { ascending: false }).limit(1)
  const startTs = evData?.[0]?.ts || null

  const { data: tData } = await supabase.from('timing_records')
    .select('*').eq('race_type', 'adult')
    .not('finish_time', 'is', null).eq('dnf', false)
  if (!tData) return []

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

  return tData.map(r => {
    const splits = calcAdultSplits(r, startTs)
    if (r.team_color) {
      const members = teamMap[r.team_color] || []
      const colorLabel = TEAM_COLORS.find(c => c.value === r.team_color)?.label || 'Team'
      return {
        id: r.id, isTeam: true, teamColor: r.team_color,
        name: `${colorLabel} Team`,
        subName: members.map(m => m.first_name).join(' / '),
        raceNumbers: members.map(m => `#${m.race_number}`).join(' '),
        gender: null, age: null, ...splits,
      }
    }
    const p = pMap[r.participant_id] || {}
    return {
      id: r.id, isTeam: false,
      name: `${p.first_name} ${p.last_name}`,
      raceNumber: p.race_number,
      gender: p.gender, age: p.age, ...splits,
    }
  }).sort((a, b) => (a.totalMs ?? Infinity) - (b.totalMs ?? Infinity))
}

async function fetchFinal() {
  const kids = await fetchKidsLive()
  const { data: aEv } = await supabase.from('race_events').select('ts')
    .eq('race_type', 'adult').eq('event_type', 'start')
    .order('ts', { ascending: false }).limit(1)
  const aStart = aEv?.[0]?.ts || null

  const { data: indT } = await supabase.from('timing_records')
    .select('*, participants(*)').eq('race_type', 'adult')
    .not('finish_time', 'is', null).eq('dnf', false).is('team_color', null)

  const indRows = (indT || []).filter(r => !r.participants?.exclude_from_results).map(r => {
    const splits = calcAdultSplits(r, aStart)
    return {
      id: r.id,
      raceNumber: r.participants?.race_number,
      name: `${r.participants?.first_name} ${r.participants?.last_name}`,
      age: r.participants?.age, gender: r.participants?.gender, ...splits,
    }
  }).sort((a, b) => (a.totalMs ?? Infinity) - (b.totalMs ?? Infinity))

  const { data: teamT } = await supabase.from('timing_records').select('*')
    .eq('race_type', 'adult').not('finish_time', 'is', null).eq('dnf', false)
    .not('team_color', 'is', null)

  const teamColors = (teamT || []).map(r => r.team_color)
  let tmMap = {}
  if (teamColors.length > 0) {
    const { data } = await supabase.from('participants').select('*')
      .in('team_color', teamColors).eq('race_type', 'adult').order('team_role')
    if (data) data.forEach(p => {
      if (!tmMap[p.team_color]) tmMap[p.team_color] = []
      tmMap[p.team_color].push(p)
    })
  }

  const teamRows = (teamT || []).map(r => {
    const splits = calcAdultSplits(r, aStart)
    const members = tmMap[r.team_color] || []
    return {
      id: r.id, teamColor: r.team_color,
      teamLabel: TEAM_COLORS.find(c => c.value === r.team_color)?.label || 'Team',
      memberNames: members.map(m => m.first_name).join(' / '),
      raceNumbers: members.map(m => `#${m.race_number}`).join(' '),
      ...splits,
    }
  }).sort((a, b) => (a.totalMs ?? Infinity) - (b.totalMs ?? Infinity))

  return { kids, indRows, teamRows }
}

// ── Result card image generator ───────────────────────────────

function ordinal(n) {
  if (n === 1) return '1st'
  if (n === 2) return '2nd'
  if (n === 3) return '3rd'
  return `${n}th`
}

function downloadResultCard(row, raceType, placements = []) {
  const canvas = document.createElement('canvas')
  const showSplits = raceType === 'adult'
  const W = 800
  // Height: base + splits row + placements row if any
  const placementH = placements.length > 0 ? 36 : 0
  const H = showSplits ? 420 + placementH : 320 + placementH
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')

  const accent = raceType === 'kids' ? '#ffd32a' : '#00d4ff'

  // Background
  ctx.fillStyle = '#0f1117'
  ctx.fillRect(0, 0, W, H)

  // Accent bar
  ctx.fillStyle = accent
  ctx.fillRect(0, 0, 6, H)

  // Header
  ctx.fillStyle = accent
  ctx.font = 'bold 22px system-ui, sans-serif'
  ctx.fillText('TriTimer — Lawroweld 2026', 32, 44)
  ctx.fillStyle = '#8892b0'
  ctx.font = '15px system-ui, sans-serif'
  ctx.fillText(raceType === 'kids' ? 'Kids Race' : 'Adult Race', 32, 68)

  // Divider
  ctx.fillStyle = '#2e3250'
  ctx.fillRect(32, 82, W - 64, 1)

  // Placement badges (top right)
  if (placements.length > 0) {
    const medalColors = { '1st': '#FFD700', '2nd': '#C0C0C0', '3rd': '#CD7F32' }
    let bx = W - 32
    placements.slice().reverse().forEach(p => {
      const rank = p.split(' ')[0]
      const bg = medalColors[rank] || '#2e3250'
      const tw = ctx.measureText(p).width + 20
      bx -= tw + 8
      ctx.fillStyle = bg
      ctx.beginPath()
      ctx.roundRect(bx, 20, tw + 8, 26, 6)
      ctx.fill()
      ctx.fillStyle = '#111'
      ctx.font = 'bold 13px system-ui, sans-serif'
      ctx.fillText(p, bx + 10, 37)
    })
  }

  // Name
  ctx.fillStyle = '#f0f2ff'
  ctx.font = 'bold 32px system-ui, sans-serif'
  const displayName = row.name
  ctx.fillText(displayName, 32, 124)

  if (row.isTeam && row.subName) {
    ctx.fillStyle = '#8892b0'
    ctx.font = '16px system-ui, sans-serif'
    ctx.fillText(row.subName, 32, 150)
  }

  // Race number
  ctx.fillStyle = accent
  ctx.font = 'bold 18px system-ui, sans-serif'
  const numLabel = row.isTeam ? row.raceNumbers : `#${row.raceNumber}`
  const numY = row.isTeam && row.subName ? 178 : 158
  ctx.fillText(numLabel, 32, numY)

  // Total time
  const timeY = row.isTeam ? 240 : 220
  ctx.fillStyle = accent
  ctx.font = 'bold 52px monospace'
  ctx.fillText(formatDuration(row.totalMs), 32, timeY)
  ctx.fillStyle = '#8892b0'
  ctx.font = '14px system-ui, sans-serif'
  ctx.fillText('Total Time', 32, timeY + 22)

  // Splits — shown for ALL adult entries including teams
  if (showSplits) {
    const splits = [
      { label: 'Swim', val: row.swimMs },
      { label: 'T1',   val: row.t1Ms   },
      { label: 'Bike', val: row.bikeMs },
      { label: 'T2',   val: row.t2Ms   },
      { label: 'Run',  val: row.runMs  },
    ]
    const splitY = timeY + 42
    const colW = (W - 64) / splits.length
    splits.forEach((s, i) => {
      const x = 32 + i * colW
      ctx.fillStyle = '#22263a'
      ctx.beginPath()
      ctx.roundRect(x, splitY, colW - 8, 60, 6)
      ctx.fill()
      ctx.fillStyle = '#8892b0'
      ctx.font = 'bold 11px system-ui, sans-serif'
      ctx.fillText(s.label.toUpperCase(), x + 10, splitY + 18)
      ctx.fillStyle = '#f0f2ff'
      ctx.font = 'bold 15px monospace'
      ctx.fillText(formatDuration(s.val), x + 10, splitY + 42)
    })
  }

  // Footer
  ctx.fillStyle = '#8892b0'
  ctx.font = '12px system-ui, sans-serif'
  ctx.fillText(`tritimer.app · ${new Date().toLocaleDateString()}`, 32, H - 16)

  // Download
  const link = document.createElement('a')
  const safeName = displayName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')
  link.download = `TriTimer_${safeName}_result.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}

// ── UI components ─────────────────────────────────────────────

function RankBadge({ rank }) {
  const colors = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' }
  return (
    <div style={{
      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
      background: colors[rank] || 'var(--surface2)',
      color: rank <= 3 ? '#111' : 'var(--muted)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 900, fontSize: '0.82rem',
    }}>
      {rank}
    </div>
  )
}

function SaveButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'var(--surface2)', border: '1px solid var(--border)',
        color: 'var(--text)', borderRadius: 8, padding: '6px 12px',
        fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0,
      }}
    >
      Save Card
    </button>
  )
}

// Compute placement strings for a row given all result sets
function computePlacements(row, raceType, allKids, allAdultInd, allTeams) {
  const badges = []
  if (raceType === 'kids') {
    const rank = allKids.findIndex(r => r.id === row.id) + 1
    if (rank >= 1 && rank <= 3) badges.push(`${ordinal(rank)} Overall`)
    return badges
  }
  if (row.isTeam) {
    const rank = allTeams.findIndex(r => r.id === row.id) + 1
    if (rank >= 1 && rank <= 3) badges.push(`${ordinal(rank)} Team`)
    return badges
  }
  // Individual adult
  const overallRank = allAdultInd.findIndex(r => r.id === row.id) + 1
  if (overallRank >= 1 && overallRank <= 3) badges.push(`${ordinal(overallRank)} Overall`)
  const genderList = allAdultInd.filter(r => r.gender === row.gender)
  const genderRank = genderList.findIndex(r => r.id === row.id) + 1
  const gLabel = row.gender === 'male' ? 'Men' : row.gender === 'female' ? 'Women' : row.gender
  if (genderRank >= 1 && genderRank <= 3) badges.push(`${ordinal(genderRank)} ${gLabel}`)
  return badges
}

function KidsResultCard({ rank, row, placements = [] }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '14px 16px', marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <RankBadge rank={rank} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.name}
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '0.78rem', marginTop: 2 }}>
            #{row.raceNumber} · Age {row.age} · {row.gender}
          </div>
          {placements.length > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 5 }}>
              {placements.map(p => (
                <span key={p} style={{
                  background: p.startsWith('1st') ? '#FFD70033' : p.startsWith('2nd') ? '#C0C0C033' : '#CD7F3233',
                  color: p.startsWith('1st') ? '#FFD700' : p.startsWith('2nd') ? '#C0C0C0' : '#CD7F32',
                  fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                }}>
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>
        <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '1.1rem', color: 'var(--kids-color)', flexShrink: 0 }}>
          {formatDuration(row.totalMs)}
        </div>
        <SaveButton onClick={() => downloadResultCard(row, 'kids', placements)} />
      </div>
    </div>
  )
}

function AdultResultCard({ rank, row, placements = [] }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '14px 16px', marginBottom: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <RankBadge rank={rank} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {row.isTeam ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={teamColorStyle(row.teamColor)}>{row.name}</span>
              </div>
              <div style={{ color: 'var(--muted)', fontSize: '0.78rem', marginTop: 3 }}>
                {row.raceNumbers} · {row.subName}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>{row.name}</div>
              <div style={{ color: 'var(--muted)', fontSize: '0.78rem', marginTop: 2 }}>
                #{row.raceNumber} · Age {row.age} · {row.gender}
              </div>
            </>
          )}
          {placements.length > 0 && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 5 }}>
              {placements.map(p => (
                <span key={p} style={{
                  background: p.startsWith('1st') ? '#FFD70033' : p.startsWith('2nd') ? '#C0C0C033' : '#CD7F3233',
                  color: p.startsWith('1st') ? '#FFD700' : p.startsWith('2nd') ? '#C0C0C0' : '#CD7F32',
                  fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                }}>
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>
        <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '1.05rem', color: 'var(--adult-color)', flexShrink: 0 }}>
          {formatDuration(row.totalMs)}
        </div>
        <SaveButton onClick={() => downloadResultCard(row, 'adult', placements)} />
      </div>
      {/* Split bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
        {[
          { label: 'Swim', val: row.swimMs },
          { label: 'T1',   val: row.t1Ms   },
          { label: 'Bike', val: row.bikeMs },
          { label: 'T2',   val: row.t2Ms   },
          { label: 'Run',  val: row.runMs  },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--surface2)', borderRadius: 6, padding: '5px 4px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '0.62rem', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {s.label}
            </div>
            <div style={{ fontSize: '0.78rem', fontFamily: 'monospace', fontWeight: 700, marginTop: 2 }}>
              {formatDuration(s.val)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyState({ message }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--muted)', fontSize: '0.95rem' }}>
      {message}
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.1em', color: 'var(--muted)', padding: '20px 0 8px',
    }}>
      {children}
    </div>
  )
}

// ── Tabs ──────────────────────────────────────────────────────

function KidsTab() {
  const [rows, setRows]             = useState([])
  const [raceStart, setRaceStart]   = useState(null)
  const [raceEnd,   setRaceEnd]     = useState(null)
  const [loading, setLoading]       = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    refresh()
    const data  = setInterval(refresh, 10000)
    const clock = setInterval(() => setNow(Date.now()), 1000)
    return () => { clearInterval(data); clearInterval(clock) }
  }, [])

  async function refresh() {
    const { data: evData } = await supabase.from('race_events').select('event_type, ts')
      .eq('race_type', 'kids').order('ts', { ascending: false })
    const startEv = (evData || []).find(e => e.event_type === 'start')
    const endEv   = (evData || []).find(e => e.event_type === 'end')
    setRaceStart(startEv?.ts || null)
    setRaceEnd(endEv?.ts || null)
    const data = await fetchKidsLive()
    setRows(data); setLoading(false); setLastUpdate(new Date())
  }

  const raceEndTs = raceEnd ? new Date(raceEnd).getTime() : null
  const elapsedMs = raceStart ? (raceEndTs || now) - new Date(raceStart).getTime() : null
  if (loading) return <EmptyState message="Loading..." />

  return (
    <div>
      {elapsedMs != null && (
        <div style={{ textAlign: 'center', padding: '12px 0 4px' }}>
          <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '2rem', color: 'var(--kids-color)' }}>
            {formatDuration(elapsedMs)}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
            Race time · started {new Date(raceStart).toLocaleTimeString()}
          </div>
        </div>
      )}
      <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 12, textAlign: 'right' }}>
        {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : ''}
      </div>
      {rows.length === 0
        ? <EmptyState message="No finishers yet. Check back soon!" />
        : rows.map((row, i) => <KidsResultCard key={row.id} rank={i + 1} row={row} placements={computePlacements(row, 'kids', rows, [], [])} />)
      }
    </div>
  )
}

const STATUS_ORDER_PUB = ['Swimming', 'In T1', 'Biking', 'In T2', 'Running', 'Finished']

function deriveStatusPub(rec, raceStarted) {
  if (!raceStarted || !rec) return raceStarted ? 'Swimming' : null
  if (rec.dnf) return 'DNF'
  if (rec.finish_time)   return 'Finished'
  if (rec.run_start)     return 'Running'
  if (rec.bike_complete) return 'In T2'
  if (rec.bike_start)    return 'Biking'
  if (rec.swim_complete) return 'In T1'
  return 'Swimming'
}

function AdultTab() {
  const [allRows, setAllRows]       = useState([])
  const [raceStart, setRaceStart]   = useState(null)
  const [raceEnd,   setRaceEnd]     = useState(null)
  const [loading, setLoading]       = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    refresh()
    const data  = setInterval(refresh, 10000)
    const clock = setInterval(() => setNow(Date.now()), 1000)
    return () => { clearInterval(data); clearInterval(clock) }
  }, [])

  async function refresh() {
    // Fetch race start and end
    const { data: evData } = await supabase.from('race_events').select('event_type, ts')
      .eq('race_type', 'adult').order('ts', { ascending: false })
    const startEv = (evData || []).find(e => e.event_type === 'start')
    const endEv   = (evData || []).find(e => e.event_type === 'end')
    const startTs = startEv?.ts || null
    setRaceStart(startTs)
    setRaceEnd(endEv?.ts || null)

    // Fetch ALL timing records (not just finished)
    const { data: tData } = await supabase.from('timing_records').select('*').eq('race_type', 'adult')
    if (!tData) { setLoading(false); return }

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
      const status = deriveStatusPub(r, !!startTs)
      if (r.team_color) {
        const members = teamMap[r.team_color] || []
        const colorLabel = TEAM_COLORS.find(c => c.value === r.team_color)?.label || 'Team'
        return { id: r.id, isTeam: true, status, teamColor: r.team_color,
          name: `${colorLabel} Team`, subName: members.map(m => m.first_name).join(' / '),
          raceNumbers: members.map(m => `#${m.race_number}`).join(' '),
          gender: null, age: null, ...splits }
      }
      const p = pMap[r.participant_id] || {}
      return { id: r.id, isTeam: false, status,
        name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
        raceNumber: p.race_number, gender: p.gender, age: p.age, ...splits }
    })
    setAllRows(built)
    setLoading(false)
    setLastUpdate(new Date())
  }

  const raceEndTs = raceEnd ? new Date(raceEnd).getTime() : null
  const elapsedMs = raceStart ? (raceEndTs || now) - new Date(raceStart).getTime() : null
  const indAll  = allRows.filter(r => !r.isTeam)
  const teamAll = allRows.filter(r => r.isTeam)
  const finishedRows = allRows.filter(r => r.status === 'Finished').sort((a,b) => (a.totalMs??Infinity)-(b.totalMs??Infinity))

  const displayed = statusFilter === 'all' ? null : allRows.filter(r => r.status === statusFilter)
  const grouped = STATUS_ORDER_PUB.reduce((acc, s) => {
    const m = allRows.filter(r => r.status === s)
    if (m.length > 0) acc[s] = m
    return acc
  }, {})

  const sel = { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '8px 12px', fontSize: '0.82rem', cursor: 'pointer', width: '100%' }

  if (loading) return <EmptyState message="Loading..." />

  return (
    <div>
      {/* Race timer */}
      {elapsedMs != null && (
        <div style={{ textAlign: 'center', padding: '12px 0 4px' }}>
          <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '2rem', color: 'var(--accent)' }}>
            {formatDuration(elapsedMs)}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
            Race time · started {new Date(raceStart).toLocaleTimeString()}
          </div>
        </div>
      )}

      <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 10, textAlign: 'right' }}>
        {lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : ''}
      </div>

      {/* Status filter */}
      {allRows.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <select style={sel} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">All ({allRows.length})</option>
            {STATUS_ORDER_PUB.map(s => {
              const count = allRows.filter(r => r.status === s).length
              return count > 0 ? <option key={s} value={s}>{s} ({count})</option> : null
            })}
          </select>
        </div>
      )}

      {allRows.length === 0 ? (
        <EmptyState message="No timing data yet. Check back soon!" />
      ) : statusFilter !== 'all' ? (
        displayed.length === 0
          ? <EmptyState message="Nobody in this status right now." />
          : displayed.map((row, i) => (
              <AdultResultCard key={row.id} rank={row.status === 'Finished' ? finishedRows.indexOf(row) + 1 : null} row={row} placements={computePlacements(row, 'adult', [], indAll, teamAll)} />
            ))
      ) : (
        STATUS_ORDER_PUB.map(s => grouped[s] ? (
          <div key={s}>
            <SectionLabel>{s} ({grouped[s].length})</SectionLabel>
            {grouped[s].map((row, i) => (
              <AdultResultCard key={row.id} rank={s === 'Finished' ? i + 1 : null} row={row} placements={computePlacements(row, 'adult', [], indAll, teamAll)} />
            ))}
          </div>
        ) : null)
      )}
    </div>
  )
}

function FinalTab({ settings }) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchFinal().then(d => { setData(d); setLoading(false) })
  }, [])

  // Not released — show holding message
  if (!settings.kids_results_released && !settings.adults_results_released) {
    return (
      <EmptyState message="Final results will be announced shortly. Stay tuned!" />
    )
  }

  if (loading) return <EmptyState message="Loading..." />
  if (!data) return <EmptyState message="No results yet." />

  const { kids, indRows, teamRows } = data
  const top3Kids  = kids.slice(0, 3)
  const top3All   = indRows.slice(0, 3)
  const top3Men   = indRows.filter(r => r.gender === 'male').slice(0, 3)
  const top3Women = indRows.filter(r => r.gender === 'female').slice(0, 3)

  return (
    <div>
      {settings.kids_results_released && top3Kids.length > 0 && (
        <>
          <SectionLabel>Kids — Top 3</SectionLabel>
          {top3Kids.map((row, i) => <KidsResultCard key={row.id} rank={i + 1} row={row} placements={computePlacements(row, 'kids', kids, [], [])} />)}
        </>
      )}
      {settings.kids_results_released && top3Kids.length === 0 && (
        <EmptyState message="No kids results yet." />
      )}

      {settings.adults_results_released && (
        <>
          {top3All.length > 0 && (
            <>
              <SectionLabel>Adults — Top 3 Overall</SectionLabel>
              {top3All.map((row, i) => <AdultResultCard key={row.id} rank={i + 1} row={row} placements={computePlacements(row, 'adult', [], indRows, teamRows)} />)}
            </>
          )}
          {top3Men.length > 0 && (
            <>
              <SectionLabel>Adults — Top 3 Men</SectionLabel>
              {top3Men.map((row, i) => <AdultResultCard key={row.id} rank={i + 1} row={row} placements={computePlacements(row, 'adult', [], indRows, teamRows)} />)}
            </>
          )}
          {top3Women.length > 0 && (
            <>
              <SectionLabel>Adults — Top 3 Women</SectionLabel>
              {top3Women.map((row, i) => <AdultResultCard key={row.id} rank={i + 1} row={row} placements={computePlacements(row, 'adult', [], indRows, teamRows)} />)}
            </>
          )}
          {teamRows.length > 0 && (
            <>
              <SectionLabel>Teams</SectionLabel>
              {teamRows.map((t, i) => (
                <div key={t.id} style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 12, padding: '14px 16px', marginBottom: 10,
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <RankBadge rank={i + 1} />
                  <div style={{ flex: 1 }}>
                    <span style={teamColorStyle(t.teamColor)}>{t.teamLabel} Team</span>
                    <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 3 }}>
                      {t.raceNumbers} · {t.memberNames}
                    </div>
                  </div>
                  <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '1.05rem', color: 'var(--adult-color)', flexShrink: 0 }}>
                    {formatDuration(t.totalMs)}
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}

      {!settings.adults_results_released && settings.kids_results_released && (
        <div style={{ marginTop: 20 }}>
          <EmptyState message="Adult results will be announced shortly." />
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────

export default function PublicResults() {
  const [tab, setTab]           = useState('kids')
  const [settings, setSettings] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetchSettings().then(setSettings)
    // Re-check release flags every 15s
    const t = setInterval(() => fetchSettings().then(setSettings), 15000)
    return () => clearInterval(t)
  }, [])

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      maxWidth: 600, margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px 0', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: '1.3rem', color: 'var(--accent)' }}>TriTimer</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Lawroweld 2026 · Live Results</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>Home</button>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 100px' }}>
        {tab === 'kids'  && <KidsTab />}
        {tab === 'adult' && <AdultTab />}
        {tab === 'final' && settings && <FinalTab settings={settings} />}
        {tab === 'final' && !settings && <EmptyState message="Loading..." />}
      </div>

      {/* Bottom tab bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 600,
        background: 'var(--surface)', borderTop: '1px solid var(--border)',
        display: 'flex', zIndex: 200,
      }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1, padding: '14px 8px', border: 'none', cursor: 'pointer',
              background: 'transparent', fontSize: '0.82rem', fontWeight: 700,
              color: tab === t.key ? 'var(--accent)' : 'var(--muted)',
              borderTop: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
              transition: 'color 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}
