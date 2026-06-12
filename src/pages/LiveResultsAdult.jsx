import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatDuration, diffMs, teamColorStyle, TEAM_COLORS, calcAdultSplits } from '../lib/utils'

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
      .from('race_events')
      .select('ts')
      .eq('race_type', 'adult')
      .eq('event_type', 'start')
      .order('ts', { ascending: false })
      .limit(1)

    const startTs = evData?.[0]?.ts || null

    const { data: tData } = await supabase
      .from('timing_records')
      .select('*, participants(*)')
      .eq('race_type', 'adult')
      .not('finish_time', 'is', null)
      .eq('dnf', false)

    const sorted = (tData || [])
      .map(r => {
        const splits = calcAdultSplits(r, startTs)
        return { ...r, ...splits }
      })
      .sort((a, b) => (a.totalMs ?? Infinity) - (b.totalMs ?? Infinity))

    setResults(sorted)
    setLastUpdate(new Date())
  }

  function teamLabel(color) {
    return TEAM_COLORS.find(c => c.value === color)?.label || 'Team'
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
                {results.map((r, i) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 800, color: 'var(--adult-color)' }}>{i + 1}</td>
                    <td className="font-bold text-accent">{r.participants?.race_number}</td>
                    <td className="font-bold">{r.participants?.first_name} {r.participants?.last_name}</td>
                    <td>{r.participants?.age}</td>
                    <td style={{ textTransform: 'capitalize' }}>{r.participants?.gender}</td>
                    <td>
                      {r.participants?.is_team && r.participants?.team_color
                        ? <span style={teamColorStyle(r.participants.team_color)}>{teamLabel(r.participants.team_color)}</span>
                        : '—'
                      }
                    </td>
                    <td style={{ fontFamily: 'monospace' }}>{formatDuration(r.swimMs)}</td>
                    <td style={{ fontFamily: 'monospace', color: 'var(--muted)' }}>{formatDuration(r.t1Ms)}</td>
                    <td style={{ fontFamily: 'monospace' }}>{formatDuration(r.bikeMs)}</td>
                    <td style={{ fontFamily: 'monospace', color: 'var(--muted)' }}>{formatDuration(r.t2Ms)}</td>
                    <td style={{ fontFamily: 'monospace' }}>{formatDuration(r.runMs)}</td>
                    <td style={{ color: 'var(--adult-color)', fontWeight: 800, fontSize: '1.05rem', fontFamily: 'monospace' }}>
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
