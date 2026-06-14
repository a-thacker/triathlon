import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatDuration, diffMs } from '../lib/utils'

export default function LiveResultsKids() {
  const [results, setResults]     = useState([])
  const [raceStart, setRaceStart] = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    load()
    const dataInterval  = setInterval(load, 10000)
    const clockInterval = setInterval(() => setNow(Date.now()), 1000)
    return () => { clearInterval(dataInterval); clearInterval(clockInterval) }
  }, [])

  async function load() {
    const { data: evData } = await supabase
      .from('race_events').select('ts')
      .eq('race_type', 'kids').eq('event_type', 'start')
      .order('ts', { ascending: false }).limit(1)
    const startTs = evData?.[0]?.ts || null
    setRaceStart(startTs)

    const { data: tData } = await supabase.from('timing_records')
      .select('*, participants(*)')
      .eq('race_type', 'kids').not('finish_time', 'is', null).eq('dnf', false)

    const sorted = (tData || []).filter(r => !r.participants?.exclude_from_results).map(r => ({
      id: r.id,
      raceNumber: r.participants?.race_number,
      name: `${r.participants?.first_name} ${r.participants?.last_name}`,
      age: r.participants?.age,
      gender: r.participants?.gender,
      totalMs: diffMs(startTs, r.finish_time),
    })).sort((a, b) => (a.totalMs ?? Infinity) - (b.totalMs ?? Infinity))

    setResults(sorted)
    setLastUpdate(new Date())
  }

  const elapsedMs = raceStart ? now - new Date(raceStart).getTime() : null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div className="page-title">Kids Race — Live</div>
        {elapsedMs != null && (
          <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '1.3rem', color: 'var(--kids-color)' }}>
            {formatDuration(elapsedMs)}
          </div>
        )}
      </div>
      <div className="page-sub">
        {raceStart ? `Race started ${new Date(raceStart).toLocaleTimeString()}` : 'Race not started yet.'}
        {lastUpdate && ` · Updated ${lastUpdate.toLocaleTimeString()}`}
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
                  <th>Total Time</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 800, color: 'var(--kids-color)' }}>{i + 1}</td>
                    <td className="font-bold text-accent">{r.raceNumber}</td>
                    <td className="font-bold">{r.name}</td>
                    <td>{r.age}</td>
                    <td style={{ textTransform: 'capitalize' }}>{r.gender}</td>
                    <td style={{ color: 'var(--kids-color)', fontWeight: 800, fontFamily: 'monospace' }}>
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
