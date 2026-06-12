import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatDuration, diffMs, teamColorStyle, TEAM_COLORS } from '../lib/utils'

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
    <div className="card" style={{padding:0, overflow:'hidden', marginBottom:0}}>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>#</th>
              <th>Name</th>
              <th>Age</th>
              <th>Gender</th>
              {showSplits && <>
                <th>Swim</th><th>T1</th><th>Bike</th><th>Run</th>
              </>}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td className="rank-medal">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                </td>
                <td className="font-bold text-accent">{r.raceNumber}</td>
                <td className="font-bold">{r.name}</td>
                <td>{r.age}</td>
                <td style={{textTransform:'capitalize'}}>{r.gender}</td>
                {showSplits && <>
                  <td style={{fontFamily:'monospace'}}>{formatDuration(r.swimMs)}</td>
                  <td style={{fontFamily:'monospace', color:'var(--muted)'}}>{formatDuration(r.t1Ms)}</td>
                  <td style={{fontFamily:'monospace'}}>{formatDuration(r.bikeMs)}</td>
                  <td style={{fontFamily:'monospace'}}>{formatDuration(r.runMs)}</td>
                </>}
                <td style={{fontFamily:'monospace', fontWeight:800, color:'var(--accent)'}}>{formatDuration(r.totalMs)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={10} className="text-muted" style={{padding:'16px'}}>No results yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TeamsTable({ teams }) {
  return (
    <div className="card" style={{padding:0, overflow:'hidden', marginBottom:0}}>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>#</th>
              <th>Team</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t, i) => (
              <tr key={t.id}>
                <td className="rank-medal">{i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</td>
                <td className="font-bold text-accent">{t.raceNumber}</td>
                <td>
                  <span style={teamColorStyle(t.teamColor)}>{t.teamLabel}</span>
                  <span style={{marginLeft:8}}>{t.name}</span>
                </td>
                <td style={{fontFamily:'monospace', fontWeight:800, color:'var(--accent)'}}>{formatDuration(t.totalMs)}</td>
              </tr>
            ))}
            {teams.length === 0 && (
              <tr><td colSpan={4} className="text-muted" style={{padding:'16px'}}>No team results yet.</td></tr>
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
    const { data: kEv } = await supabase.from('race_events').select('ts').eq('race_type','kids').eq('event_type','start').limit(1)
    const kStart = kEv?.[0]?.ts || null
    const { data: kTiming } = await supabase.from('timing_records').select('*, participants(*)').eq('race_type','kids').not('finish_time','is',null).eq('dnf',false)

    const kRows = (kTiming||[]).map(r => ({
      id: r.id,
      raceNumber: r.participants?.race_number,
      name: `${r.participants?.first_name} ${r.participants?.last_name}`,
      age: r.participants?.age,
      gender: r.participants?.gender,
      totalMs: diffMs(kStart, r.finish_time),
    })).sort((a,b) => (a.totalMs??Infinity)-(b.totalMs??Infinity))
    setKidsResults(kRows)

    // Adults
    const { data: aEv } = await supabase.from('race_events').select('ts').eq('race_type','adult').eq('event_type','start').limit(1)
    const aStart = aEv?.[0]?.ts || null
    const { data: aTiming } = await supabase.from('timing_records').select('*, participants(*)').eq('race_type','adult').not('finish_time','is',null).eq('dnf',false)

    const aRows = (aTiming||[]).map(r => ({
      id: r.id,
      raceNumber: r.participants?.race_number,
      name: `${r.participants?.first_name} ${r.participants?.last_name}`,
      age: r.participants?.age,
      gender: r.participants?.gender,
      isTeam: r.participants?.is_team,
      teamColor: r.participants?.team_color,
      totalMs: diffMs(aStart, r.finish_time),
      swimMs:  diffMs(aStart, r.swim_complete),
      t1Ms:    diffMs(r.swim_complete, r.bike_complete),
      bikeMs:  diffMs(r.bike_complete, r.run_complete),
      runMs:   diffMs(r.run_complete, r.finish_time),
    })).sort((a,b) => (a.totalMs??Infinity)-(b.totalMs??Infinity))
    setAdultResults(aRows)
    setLoading(false)
  }

  if (loading) return <div className="text-muted">Loading...</div>

  const top3Overall_k = kidsResults.slice(0, 3)
  const top3Overall_a = adultResults.filter(r => !r.isTeam).slice(0, 3)
  const top3Men_a     = adultResults.filter(r => !r.isTeam && r.gender === 'male').slice(0, 3)
  const top3Women_a   = adultResults.filter(r => !r.isTeam && r.gender === 'female').slice(0, 3)
  const teams         = adultResults
    .filter(r => r.isTeam)
    .map(r => ({
      ...r,
      teamLabel: TEAM_COLORS.find(c => c.value === r.teamColor)?.label || 'Team',
    }))

  return (
    <div>
      <div className="page-title">Final Results</div>
      <div className="page-sub">Official race results</div>

      <Section title="🧒 Kids Race — Top 3 Overall">
        <ResultsTable rows={top3Overall_k} />
      </Section>

      <Section title="🏆 Adult Race — Top 3 Overall">
        <ResultsTable rows={top3Overall_a} showSplits />
      </Section>

      <Section title="👨 Adult Race — Top 3 Men">
        <ResultsTable rows={top3Men_a} showSplits />
      </Section>

      <Section title="👩 Adult Race — Top 3 Women">
        <ResultsTable rows={top3Women_a} showSplits />
      </Section>

      <Section title="👥 Team Results">
        <TeamsTable teams={teams} />
      </Section>
    </div>
  )
}
