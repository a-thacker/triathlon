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

function ResultsTable({ rows, showSplits = false }) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 0 }}>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>#</th>
              <th>Name</th>
              <th>Age</th>
              <th>Gender</th>
              {showSplits && <><th>Swim</th><th>T1</th><th>Bike</th><th>T2</th><th>Run</th></>}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 800 }}>{i + 1}</td>
                <td className="font-bold text-accent">{r.raceNumber}</td>
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
            {rows.length === 0 && (
              <tr><td colSpan={11} className="text-muted" style={{ padding: '16px' }}>No results yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TeamsTable({ teams }) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 0 }}>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>#</th>
              <th>Team</th>
              <th>Swim</th>
              <th>T1</th>
              <th>Bike</th>
              <th>T2</th>
              <th>Run</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t, i) => (
              <tr key={t.id}>
                <td style={{ fontWeight: 800 }}>{i + 1}</td>
                <td className="font-bold text-accent">{t.raceNumber}</td>
                <td>
                  <span style={teamColorStyle(t.teamColor)}>{t.teamLabel}</span>
                  <span style={{ marginLeft: 8 }}>{t.name}</span>
                </td>
                <td style={{ fontFamily: 'monospace' }}>{formatDuration(t.swimMs)}</td>
                <td style={{ fontFamily: 'monospace', color: 'var(--muted)' }}>{formatDuration(t.t1Ms)}</td>
                <td style={{ fontFamily: 'monospace' }}>{formatDuration(t.bikeMs)}</td>
                <td style={{ fontFamily: 'monospace', color: 'var(--muted)' }}>{formatDuration(t.t2Ms)}</td>
                <td style={{ fontFamily: 'monospace' }}>{formatDuration(t.runMs)}</td>
                <td style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--accent)' }}>{formatDuration(t.totalMs)}</td>
              </tr>
            ))}
            {teams.length === 0 && (
              <tr><td colSpan={9} className="text-muted" style={{ padding: '16px' }}>No team results yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function FinalResults() {
  const [kidsResults, setKidsResults] = useState([])
  const [adultResults, setAdultResults] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    // Kids
    const { data: kEv } = await supabase.from('race_events').select('ts').eq('race_type', 'kids').eq('event_type', 'start').limit(1)
    const kStart = kEv?.[0]?.ts || null
    const { data: kTiming } = await supabase.from('timing_records').select('*, participants(*)').eq('race_type', 'kids').not('finish_time', 'is', null).eq('dnf', false)

    const kRows = (kTiming || []).map(r => ({
      id: r.id,
      raceNumber: r.participants?.race_number,
      name: `${r.participants?.first_name} ${r.participants?.last_name}`,
      age: r.participants?.age,
      gender: r.participants?.gender,
      totalMs: diffMs(kStart, r.finish_time),
    })).sort((a, b) => (a.totalMs ?? Infinity) - (b.totalMs ?? Infinity))
    setKidsResults(kRows)

    // Adults
    const { data: aEv } = await supabase.from('race_events').select('ts').eq('race_type', 'adult').eq('event_type', 'start').limit(1)
    const aStart = aEv?.[0]?.ts || null
    const { data: aTiming } = await supabase.from('timing_records').select('*, participants(*)').eq('race_type', 'adult').not('finish_time', 'is', null).eq('dnf', false)

    const aRows = (aTiming || []).map(r => {
      const splits = calcAdultSplits(r, aStart)
      return {
        id: r.id,
        raceNumber: r.participants?.race_number,
        name: `${r.participants?.first_name} ${r.participants?.last_name}`,
        age: r.participants?.age,
        gender: r.participants?.gender,
        isTeam: r.participants?.is_team,
        teamColor: r.participants?.team_color,
        ...splits,
      }
    }).sort((a, b) => (a.totalMs ?? Infinity) - (b.totalMs ?? Infinity))
    setAdultResults(aRows)
    setLoading(false)
  }

  if (loading) return <div className="text-muted">Loading...</div>

  const individualsOnly = adultResults.filter(r => !r.isTeam)
  const teams = adultResults
    .filter(r => r.isTeam)
    .map(r => ({
      ...r,
      teamLabel: TEAM_COLORS.find(c => c.value === r.teamColor)?.label || 'Team',
    }))

  return (
    <div>
      <div className="page-title">Final Results</div>
      <div className="page-sub">Official race results</div>

      <Section title="Kids Race — Top 3 Overall">
        <ResultsTable rows={kidsResults.slice(0, 3)} />
      </Section>

      <Section title="Adult Race — Top 3 Overall">
        <ResultsTable rows={individualsOnly.slice(0, 3)} showSplits />
      </Section>

      <Section title="Adult Race — Top 3 Men">
        <ResultsTable rows={individualsOnly.filter(r => r.gender === 'male').slice(0, 3)} showSplits />
      </Section>

      <Section title="Adult Race — Top 3 Women">
        <ResultsTable rows={individualsOnly.filter(r => r.gender === 'female').slice(0, 3)} showSplits />
      </Section>

      <Section title="Team Results">
        <TeamsTable teams={teams} />
      </Section>
    </div>
  )
}
