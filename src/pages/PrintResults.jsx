import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatDuration, diffMs, TEAM_COLORS, calcAdultSplits } from '../lib/utils'

function PrintTable({ title, rows, showSplits = false }) {
  const cellStyle = { padding: '3px 6px', borderBottom: '1px solid #ddd' }
  const headStyle = { padding: '3px 6px', textAlign: 'left', borderBottom: '2px solid #000', fontSize: '10px', textTransform: 'uppercase' }
  return (
    <div style={{ marginBottom: 28, pageBreakInside: 'avoid' }}>
      <h2 style={{ fontSize: '0.95rem', fontWeight: 700, borderBottom: '2px solid #000', paddingBottom: 4, marginBottom: 8 }}>
        {title}
      </h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
        <thead>
          <tr>
            <th style={headStyle}>Rank</th>
            <th style={headStyle}>#</th>
            <th style={headStyle}>Name</th>
            <th style={headStyle}>Age</th>
            <th style={headStyle}>Gender</th>
            {showSplits && <>
              <th style={headStyle}>Swim</th>
              <th style={headStyle}>T1</th>
              <th style={headStyle}>Bike</th>
              <th style={headStyle}>T2</th>
              <th style={headStyle}>Run</th>
            </>}
            <th style={headStyle}>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id}>
              <td style={cellStyle}>{i + 1}</td>
              <td style={{ ...cellStyle, fontWeight: 700 }}>{r.raceNumber}</td>
              <td style={{ ...cellStyle, fontWeight: 700 }}>{r.name}</td>
              <td style={cellStyle}>{r.age}</td>
              <td style={{ ...cellStyle, textTransform: 'capitalize' }}>{r.gender}</td>
              {showSplits && <>
                <td style={{ ...cellStyle, fontFamily: 'monospace' }}>{formatDuration(r.swimMs)}</td>
                <td style={{ ...cellStyle, fontFamily: 'monospace' }}>{formatDuration(r.t1Ms)}</td>
                <td style={{ ...cellStyle, fontFamily: 'monospace' }}>{formatDuration(r.bikeMs)}</td>
                <td style={{ ...cellStyle, fontFamily: 'monospace' }}>{formatDuration(r.t2Ms)}</td>
                <td style={{ ...cellStyle, fontFamily: 'monospace' }}>{formatDuration(r.runMs)}</td>
              </>}
              <td style={{ ...cellStyle, fontFamily: 'monospace', fontWeight: 700 }}>{formatDuration(r.totalMs)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={11} style={{ ...cellStyle, color: '#999' }}>No results.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export default function PrintResults() {
  const [kidsAll, setKidsAll] = useState([])
  const [adultsAll, setAdultsAll] = useState([])
  const [loading, setLoading] = useState(true)
  const [printDate] = useState(new Date().toLocaleDateString())

  useEffect(() => { load() }, [])

  async function load() {
    // Kids
    const { data: kEv } = await supabase.from('race_events').select('ts').eq('race_type', 'kids').eq('event_type', 'start').order('ts', { ascending: false }).limit(1)
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
    setKidsAll(kRows)

    // Adults
    const { data: aEv } = await supabase.from('race_events').select('ts').eq('race_type', 'adult').eq('event_type', 'start').order('ts', { ascending: false }).limit(1)
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
        teamLabel: TEAM_COLORS.find(c => c.value === r.participants?.team_color)?.label || '',
        ...splits,
      }
    }).sort((a, b) => (a.totalMs ?? Infinity) - (b.totalMs ?? Infinity))
    setAdultsAll(aRows)
    setLoading(false)
  }

  if (loading) return <div>Loading...</div>

  const individualsOnly = adultsAll.filter(r => !r.isTeam)
  const teams = adultsAll.filter(r => r.isTeam)

  return (
    <div style={{ background: '#fff', color: '#000', padding: '24px', fontFamily: 'Arial, sans-serif', maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, borderBottom: '3px solid #000', paddingBottom: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 900, margin: 0 }}>Triathlon Race Results</h1>
          <div style={{ color: '#666', fontSize: '0.85rem', marginTop: 4 }}>Official Results — {printDate}</div>
        </div>
        <button
          onClick={() => window.print()}
          style={{ padding: '8px 18px', background: '#000', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem' }}
          className="no-print"
        >
          Print / Save PDF
        </button>
      </div>

      <PrintTable title="Kids Race — Overall Results" rows={kidsAll} />

      <div style={{ pageBreakBefore: 'always' }} />

      <PrintTable title="Adult Race — Overall Results (Individuals)" rows={individualsOnly} showSplits />
      <PrintTable title="Adult Race — Men's Results" rows={individualsOnly.filter(r => r.gender === 'male')} showSplits />
      <PrintTable title="Adult Race — Women's Results" rows={individualsOnly.filter(r => r.gender === 'female')} showSplits />

      {/* Teams */}
      {teams.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700, borderBottom: '2px solid #000', paddingBottom: 4, marginBottom: 8 }}>
            Adult Race — Team Results
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr>
                {['Rank', '#', 'Team', 'Swim', 'T1', 'Bike', 'T2', 'Run', 'Total'].map(h => (
                  <th key={h} style={{ padding: '3px 6px', textAlign: 'left', borderBottom: '2px solid #000', fontSize: '10px', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teams.map((t, i) => (
                <tr key={t.id}>
                  <td style={{ padding: '3px 6px', borderBottom: '1px solid #ddd' }}>{i + 1}</td>
                  <td style={{ padding: '3px 6px', borderBottom: '1px solid #ddd', fontWeight: 700 }}>{t.raceNumber}</td>
                  <td style={{ padding: '3px 6px', borderBottom: '1px solid #ddd', fontWeight: 700 }}>{t.teamLabel} Team — {t.name}</td>
                  <td style={{ padding: '3px 6px', borderBottom: '1px solid #ddd', fontFamily: 'monospace' }}>{formatDuration(t.swimMs)}</td>
                  <td style={{ padding: '3px 6px', borderBottom: '1px solid #ddd', fontFamily: 'monospace' }}>{formatDuration(t.t1Ms)}</td>
                  <td style={{ padding: '3px 6px', borderBottom: '1px solid #ddd', fontFamily: 'monospace' }}>{formatDuration(t.bikeMs)}</td>
                  <td style={{ padding: '3px 6px', borderBottom: '1px solid #ddd', fontFamily: 'monospace' }}>{formatDuration(t.t2Ms)}</td>
                  <td style={{ padding: '3px 6px', borderBottom: '1px solid #ddd', fontFamily: 'monospace' }}>{formatDuration(t.runMs)}</td>
                  <td style={{ padding: '3px 6px', borderBottom: '1px solid #ddd', fontFamily: 'monospace', fontWeight: 700 }}>{formatDuration(t.totalMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 40, borderTop: '1px solid #ccc', paddingTop: 12, fontSize: '10px', color: '#999', textAlign: 'center' }}>
        Generated by TriTime Timing System — {printDate}
      </div>
    </div>
  )
}
