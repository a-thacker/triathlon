import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatDuration, teamColorStyle, TEAM_COLORS, calcAdultSplits } from '../lib/utils'

export default function LiveResultsAdult() {
  const [results, setResults] = useState([])
  const [lastUpdate, setLastUpdate] = useState(null)

  useEffect(() => {
    load()
    const interval = setInterval(load, 10000)
    return () => clearInterval(interval)
  }, [])

  async function load() {
    const { data: evData } = await supabase
      .from('race_events').select('ts')
      .eq('race_type', 'adult').eq('event_type', 'start')
      .order('ts', { ascending: false }).limit(1)
    const startTs = evData?.[0]?.ts || null

    // Get all finished timing records for adults
    const { data: tData } = await supabase
      .from('timing_records').select('*')
      .eq('race_type', 'adult')
      .not('finish_time', 'is', null)
      .eq('dnf', false)

    if (!tData) { setResults([]); return }

    // Separate individual vs team records
    const individualIds = tData.filter(r => r.participant_id).map(r => r.participant_id)
    const teamColors    = tData.filter(r => r.team_color).map(r => r.team_color)

    // Fetch participant data for individuals
    let participantMap = {}
    if (individualIds.length > 0) {
      const { data: pData } = await supabase
        .from('participants').select('*').in('id', individualIds)
      if (pData) pData.forEach(p => { participantMap[p.id] = p })
    }

    // Fetch team members grouped by color
    let teamMembersMap = {}
    if (teamColors.length > 0) {
      const { data: tmData } = await supabase
        .from('participants').select('*')
        .in('team_color', teamColors).eq('race_type', 'adult')
        .order('team_role')
      if (tmData) {
        tmData.forEach(p => {
          if (!teamMembersMap[p.team_color]) teamMembersMap[p.team_color] = []
          teamMembersMap[p.team_color].push(p)
        })
      }
    }

    const rows = tData.map(r => {
      const splits = calcAdultSplits(r, startTs)
      if (r.team_color) {
        const members = teamMembersMap[r.team_color] || []
        const colorLabel = TEAM_COLORS.find(c => c.value === r.team_color)?.label || 'Team'
        const raceNumbers = members.map(m => `#${m.race_number}`).join(', ')
        return {
          id: r.id,
          isTeam: true,
          teamColor: r.team_color,
          displayName: `${colorLabel} Team`,
          memberNames: members.map(m => `${m.first_name} ${m.last_name}`).join(' / '),
          raceNumbers,
          gender: '—',
          age: '—',
          ...splits,
        }
      } else {
        const p = participantMap[r.participant_id] || {}
        return {
          id: r.id,
          isTeam: false,
          displayName: `${p.first_name} ${p.last_name}`,
          raceNumber: p.race_number,
          gender: p.gender,
          age: p.age,
          ...splits,
        }
      }
    }).sort((a, b) => (a.totalMs ?? Infinity) - (b.totalMs ?? Infinity))

    setResults(rows)
    setLastUpdate(new Date())
  }

  return (
    <div>
      <div className="page-title">Live Results — Adult Race</div>
      <div className="page-sub">
        Auto-refreshes every 10 seconds.
        {lastUpdate && ` Last updated: ${lastUpdate.toLocaleTimeString()}`}
      </div>

      {results.length === 0 ? (
        <div className="alert alert-info">No finishers yet.</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>#</th>
                  <th>Name</th>
                  <th>Age</th>
                  <th>Gender</th>
                  <th>Swim</th>
                  <th>T1</th>
                  <th>Bike</th>
                  <th>T2</th>
                  <th>Run</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 800, color: 'var(--adult-color)' }}>{i + 1}</td>
                    <td className="font-bold text-accent">
                      {r.isTeam ? r.raceNumbers : `#${r.raceNumber}`}
                    </td>
                    <td>
                      {r.isTeam ? (
                        <div>
                          <span style={teamColorStyle(r.teamColor)}>{r.displayName}</span>
                          <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: 2 }}>{r.memberNames}</div>
                        </div>
                      ) : (
                        <strong>{r.displayName}</strong>
                      )}
                    </td>
                    <td>{r.age}</td>
                    <td style={{ textTransform: 'capitalize' }}>{r.gender}</td>
                    <td style={{ fontFamily: 'monospace' }}>{formatDuration(r.swimMs)}</td>
                    <td style={{ fontFamily: 'monospace', color: 'var(--muted)' }}>{formatDuration(r.t1Ms)}</td>
                    <td style={{ fontFamily: 'monospace' }}>{formatDuration(r.bikeMs)}</td>
                    <td style={{ fontFamily: 'monospace', color: 'var(--muted)' }}>{formatDuration(r.t2Ms)}</td>
                    <td style={{ fontFamily: 'monospace' }}>{formatDuration(r.runMs)}</td>
                    <td style={{ color: 'var(--adult-color)', fontWeight: 800, fontFamily: 'monospace' }}>
                      {formatDuration(r.totalMs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
