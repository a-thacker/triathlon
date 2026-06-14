import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatDuration, diffMs, teamColorStyle, TEAM_COLORS, calcAdultSplits } from '../lib/utils'

function Section({ title, children }) {
  return (
    <div>
      <div className="results-section-title">{title}</div>
      {children}
    </div>
  )
}

function IndividualTable({ rows, showSplits = false }) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 0 }}>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Rank</th><th>#</th><th>Name</th><th>Age</th><th>Gender</th>
              {showSplits && <><th>Swim</th><th>T1</th><th>Bike</th><th>T2</th><th>Run</th></>}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 800 }}>{i + 1}</td>
                <td className="font-bold text-accent">#{r.raceNumber}</td>
                <td className="font-bold">{r.name}</td>
                <td>{r.age}</td>
                <td style={{ textTransform: 'capitalize' }}>{r.gender}</td>
                {showSplits && <>
                  <td style={{ fontFamily: 'monospace' }}>{formatDuration(r.swimMs)}</td>
                  <td style={{ fontFamily: 'monospace', color: 'var(--muted)' }}>{formatDuration(r.t1Ms)}</td>
                  <td style={{ fontFamily: 'monospace' }}>{formatDuration(r.bikeMs)}</td>
                  <td style={{ fontFamily: 'monospace', color: 'var(--muted)' }}>{formatDuration(r.t2Ms)}</td>
                  <td style={{ fontFamily: 'monospace' }}>{formatDuration(r.runMs)}</td>
                </>}
                <td style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--accent)' }}>{formatDuration(r.totalMs)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={11} className="text-muted" style={{ padding: 16 }}>No results yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TeamsTable({ rows }) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 0 }}>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Rank</th><th>#(s)</th><th>Team</th>
              <th>Swim</th><th>T1</th><th>Bike</th><th>T2</th><th>Run</th><th>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 800 }}>{i + 1}</td>
                <td className="font-bold text-accent" style={{ fontSize: '0.82rem' }}>{r.raceNumbers}</td>
                <td>
                  <span style={teamColorStyle(r.teamColor)}>{r.teamLabel}</span>
                  <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 2 }}>{r.memberNames}</div>
                </td>
                <td style={{ fontFamily: 'monospace' }}>{formatDuration(r.swimMs)}</td>
                <td style={{ fontFamily: 'monospace', color: 'var(--muted)' }}>{formatDuration(r.t1Ms)}</td>
                <td style={{ fontFamily: 'monospace' }}>{formatDuration(r.bikeMs)}</td>
                <td style={{ fontFamily: 'monospace', color: 'var(--muted)' }}>{formatDuration(r.t2Ms)}</td>
                <td style={{ fontFamily: 'monospace' }}>{formatDuration(r.runMs)}</td>
                <td style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--accent)' }}>{formatDuration(r.totalMs)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={9} className="text-muted" style={{ padding: 16 }}>No team results yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

async function loadResults() {
  const { data: kEv } = await supabase.from('race_events').select('ts')
    .eq('race_type', 'kids').eq('event_type', 'start')
    .order('ts', { ascending: false }).limit(1)
  const kStart = kEv?.[0]?.ts || null

  const { data: kTiming } = await supabase.from('timing_records')
    .select('*, participants(*)')
    .eq('race_type', 'kids').not('finish_time', 'is', null).eq('dnf', false)

  const kRows = (kTiming || []).filter(r => !r.participants?.exclude_from_results).map(r => ({
    id: r.id,
    raceNumber: r.participants?.race_number,
    name: `${r.participants?.first_name} ${r.participants?.last_name}`,
    age: r.participants?.age,
    gender: r.participants?.gender,
    totalMs: diffMs(kStart, r.finish_time),
  })).sort((a, b) => (a.totalMs ?? Infinity) - (b.totalMs ?? Infinity))

  const { data: aEv } = await supabase.from('race_events').select('ts')
    .eq('race_type', 'adult').eq('event_type', 'start')
    .order('ts', { ascending: false }).limit(1)
  const aStart = aEv?.[0]?.ts || null

  const { data: indTiming } = await supabase.from('timing_records')
    .select('*, participants(*)')
    .eq('race_type', 'adult').not('finish_time', 'is', null).eq('dnf', false)
    .is('team_color', null)

  const indRows = (indTiming || []).filter(r => !r.participants?.exclude_from_results).map(r => {
    const splits = calcAdultSplits(r, aStart)
    return {
      id: r.id,
      raceNumber: r.participants?.race_number,
      name: `${r.participants?.first_name} ${r.participants?.last_name}`,
      age: r.participants?.age,
      gender: r.participants?.gender,
      ...splits,
    }
  }).sort((a, b) => (a.totalMs ?? Infinity) - (b.totalMs ?? Infinity))

  const { data: teamTiming } = await supabase.from('timing_records').select('*')
    .eq('race_type', 'adult').not('finish_time', 'is', null).eq('dnf', false)
    .not('team_color', 'is', null)

  const teamColors = (teamTiming || []).map(r => r.team_color)
  let teamMembersMap = {}
  if (teamColors.length > 0) {
    const { data: tmData } = await supabase.from('participants').select('*')
      .in('team_color', teamColors).eq('race_type', 'adult').order('team_role')
    if (tmData) tmData.forEach(p => {
      if (!teamMembersMap[p.team_color]) teamMembersMap[p.team_color] = []
      teamMembersMap[p.team_color].push(p)
    })
  }

  const teamRows = (teamTiming || []).map(r => {
    const splits = calcAdultSplits(r, aStart)
    const members = teamMembersMap[r.team_color] || []
    return {
      id: r.id,
      teamColor: r.team_color,
      teamLabel: TEAM_COLORS.find(c => c.value === r.team_color)?.label || 'Team',
      raceNumbers: members.map(m => `#${m.race_number}`).join(', '),
      memberNames: members.map(m => `${m.first_name} ${m.last_name}`).join(' / '),
      ...splits,
    }
  }).sort((a, b) => (a.totalMs ?? Infinity) - (b.totalMs ?? Infinity))

  return { kRows, indRows, teamRows }
}

export default function FinalResults() {
  const [kids, setKids]     = useState([])
  const [ind, setInd]       = useState([])
  const [teams, setTeams]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [settings, setSettings] = useState({ kids_results_released: false, adults_results_released: false })
  const [saving, setSaving]     = useState('')
  const [raceStatus, setRaceStatus] = useState({ kids: 'not_started', adult: 'not_started' })

  useEffect(() => {
    loadResults().then(({ kRows, indRows, teamRows }) => {
      setKids(kRows); setInd(indRows); setTeams(teamRows); setLoading(false)
    })
    loadSettings()
    loadRaceStatus()
  }, [])

  async function loadRaceStatus() {
    const { data } = await supabase.from('race_events').select('race_type, event_type')
    if (!data) return
    const status = { kids: 'not_started', adult: 'not_started' }
    // Check each race type
    ;['kids', 'adult'].forEach(rt => {
      const events = data.filter(e => e.race_type === rt).map(e => e.event_type)
      if (events.includes('end'))        status[rt] = 'ended'
      else if (events.includes('start')) status[rt] = 'running'
    })
    setRaceStatus(status)
  }

  async function loadSettings() {
    const { data } = await supabase.from('app_settings').select('*').eq('id', 1).single()
    if (data) setSettings(data)
  }

  async function toggleRelease(field) {
    setSaving(field)
    const newVal = !settings[field]
    const { error } = await supabase.from('app_settings').update({ [field]: newVal }).eq('id', 1)
    if (!error) setSettings(s => ({ ...s, [field]: newVal }))
    setSaving('')
  }

  if (loading) return <div className="text-muted">Loading...</div>

  return (
    <div>
      <div className="page-title">Final Results</div>
      <div className="page-sub">Official race results. Use the release buttons to make results visible to participants.</div>

      {/* Release controls */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title">Participant Visibility</div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>

          {/* Kids */}
          <div style={{ flex: 1, minWidth: 200, background: 'var(--surface2)', borderRadius: 8, padding: '14px 16px' }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Kids Results</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: 8 }}>
              {settings.kids_results_released
                ? 'Visible to participants on the public results page.'
                : 'Hidden from participants. Release when ready to announce.'}
            </div>
            {raceStatus.kids !== 'ended' && !settings.kids_results_released && (
              <div className="alert alert-warn" style={{ marginBottom: 8, fontSize: '0.78rem', padding: '6px 10px' }}>
                {raceStatus.kids === 'not_started' ? 'Race has not started yet.' : 'Race is still running. End the race before releasing results.'}
              </div>
            )}
            <button
              className={`btn btn-sm ${settings.kids_results_released ? 'btn-danger' : 'btn-success'}`}
              onClick={() => toggleRelease('kids_results_released')}
              disabled={saving === 'kids_results_released' || (raceStatus.kids !== 'ended' && !settings.kids_results_released)}
            >
              {saving === 'kids_results_released' ? 'Saving...'
                : settings.kids_results_released ? 'Hide Results' : 'Release Results'}
            </button>
          </div>

          {/* Adults */}
          <div style={{ flex: 1, minWidth: 200, background: 'var(--surface2)', borderRadius: 8, padding: '14px 16px' }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Adult Results</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: 8 }}>
              {settings.adults_results_released
                ? 'Visible to participants on the public results page.'
                : 'Hidden from participants. Release when ready to announce.'}
            </div>
            {raceStatus.adult !== 'ended' && !settings.adults_results_released && (
              <div className="alert alert-warn" style={{ marginBottom: 8, fontSize: '0.78rem', padding: '6px 10px' }}>
                {raceStatus.adult === 'not_started' ? 'Race has not started yet.' : 'Race is still running. End the race before releasing results.'}
              </div>
            )}
            <button
              className={`btn btn-sm ${settings.adults_results_released ? 'btn-danger' : 'btn-success'}`}
              onClick={() => toggleRelease('adults_results_released')}
              disabled={saving === 'adults_results_released' || (raceStatus.adult !== 'ended' && !settings.adults_results_released)}
            >
              {saving === 'adults_results_released' ? 'Saving...'
                : settings.adults_results_released ? 'Hide Results' : 'Release Results'}
            </button>
          </div>

        </div>
      </div>

      <Section title="Kids Race — Top 3 Overall">
        <IndividualTable rows={kids.slice(0, 3)} />
      </Section>
      <Section title="Adult Race — Top 3 Overall">
        <IndividualTable rows={ind.slice(0, 3)} showSplits />
      </Section>
      <Section title="Adult Race — Top 3 Men">
        <IndividualTable rows={ind.filter(r => r.gender === 'male').slice(0, 3)} showSplits />
      </Section>
      <Section title="Adult Race — Top 3 Women">
        <IndividualTable rows={ind.filter(r => r.gender === 'female').slice(0, 3)} showSplits />
      </Section>
      <Section title="Team Results">
        <TeamsTable rows={teams} />
      </Section>
    </div>
  )
}
