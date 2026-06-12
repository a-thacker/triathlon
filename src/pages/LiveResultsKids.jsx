import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatDuration, diffMs } from '../lib/utils'

export default function LiveResultsKids() {
  const [results, setResults] = useState([])
  const [raceStart, setRaceStart] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)

  useEffect(() => {
    load()
    const interval = setInterval(load, 10000)
    return () => clearInterval(interval)
  }, [])

  async function load() {
    const { data: evData } = await supabase
      .from('race_events')
      .select('*')
      .eq('race_type', 'kids')
      .eq('event_type', 'start')
      .order('ts', { ascending: false })
      .limit(1)

    const startTs = evData?.[0]?.ts || null
    setRaceStart(startTs)

    const { data: tData } = await supabase
      .from('timing_records')
      .select('*, participants(*)')
      .eq('race_type', 'kids')
      .not('finish_time', 'is', null)
      .eq('dnf', false)

    const sorted = (tData || [])
      .map(r => ({
        ...r,
        totalMs: diffMs(startTs, r.finish_time),
      }))
      .sort((a, b) => (a.totalMs ?? Infinity) - (b.totalMs ?? Infinity))

    setResults(sorted)
    setLastUpdate(new Date())
  }

  return (
    <div>
      <div className="page-title">Live Results — Kids Race</div>
      <div className="page-sub">
        Auto-refreshes every 10 seconds.
        {lastUpdate && ` Last updated: ${lastUpdate.toLocaleTimeString()}`}
      </div>

      {results.length === 0 ? (
        <div className="alert alert-info">No finishers yet.</div>
      ) : (
        <div className="card" style={{padding:0, overflow:'hidden'}}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>#</th>
                  <th>Name</th>
                  <th>Age</th>
                  <th>Gender</th>
                  <th>Total Time</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={r.id}>
                    <td style={{fontSize:'1.1rem', fontWeight:800, color:'var(--kids-color)'}}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </td>
                    <td className="font-bold text-accent">{r.participants?.race_number}</td>
                    <td className="font-bold">{r.participants?.first_name} {r.participants?.last_name}</td>
                    <td>{r.participants?.age}</td>
                    <td style={{textTransform:'capitalize'}}>{r.participants?.gender}</td>
                    <td style={{color:'var(--kids-color)', fontWeight:800, fontSize:'1.05rem', fontFamily:'monospace'}}>
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
