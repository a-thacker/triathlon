import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatDuration, diffMs, TEAM_COLORS } from '../lib/utils'

function PrintTable({ title, rows, showSplits = false }) {
  return (
    <div style={{marginBottom:32, pageBreakInside:'avoid'}}>
      <h2 style={{fontSize:'1rem', fontWeight:700, borderBottom:'2px solid #000', paddingBottom:4, marginBottom:8}}>
        {title}
      </h2>
      <table style={{width:'100%', borderCollapse:'collapse', fontSize:'11px'}}>
        <thead>
          <tr style={{borderBottom:'1px solid #000'}}>
            <th style={{textAlign:'left', padding:'3px 6px'}}>Rank</th>
            <th style={{textAlign:'left', padding:'3px 6px'}}>#</th>
            <th style={{textAlign:'left', padding:'3px 6px'}}>Name</th>
            <th style={{textAlign:'left', padding:'3px 6px'}}>Age</th>
            <th style={{textAlign:'left', padding:'3px 6px'}}>Gender</th>
            {showSplits && <>
              <th style={{textAlign:'left', padding:'3px 6px'}}>Swim</th>
              <th style={{textAlign:'left', padding:'3px 6px'}}>T1</th>
              <th style={{textAlign:'left', padding:'3px 6px'}}>Bike</th>
              <th style={{textAlign:'left', padding:'3px 6px'}}>Run</th>
            </>}
            <th style={{textAlign:'left', padding:'3px 6px'}}>Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} style={{borderBottom:'1px solid #ddd'}}>
              <td style={{padding:'3px 6px'}}>{i+1}</td>
              <td style={{padding:'3px 6px', fontWeight:700}}>{r.raceNumber}</td>
              <td style={{padding:'3px 6px', fontWeight:700}}>{r.name}</td>
              <td style={{padding:'3px 6px'}}>{r.age}</td>
              <td style={{padding:'3px 6px', textTransform:'capitalize'}}>{r.gender}</td>
              {showSplits && <>
                <td style={{padding:'3px 6px', fontFamily:'monospace'}}>{formatDuration(r.swimMs)}</td>
                <td style={{padding:'3px 6px', fontFamily:'monospace'}}>{formatDuration(r.t1Ms)}</td>
                <td style={{padding:'3px 6px', fontFamily:'monospace'}}>{formatDuration(r.bikeMs)}</td>
                <td style={{padding:'3px 6px', fontFamily:'monospace'}}>{formatDuration(r.runMs)}</td>
              </>}
              <td style={{padding:'3px 6px', fontFamily:'monospace', fontWeight:700}}>{formatDuration(r.totalMs)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={10} style={{padding:'8px 6px', color:'#999'}}>No results.</td></tr>
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
    })).sort((a,b)=>(a.totalMs??Infinity)-(b.totalMs??Infinity))
    setKidsAll(kRows)

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
      teamLabel: TEAM_COLORS.find(c=>c.value===r.participants?.team_color)?.label || '',
      totalMs: diffMs(aStart, r.finish_time),
      swimMs:  diffMs(aStart, r.swim_complete),
      t1Ms:    diffMs(r.swim_complete, r.bike_complete),
      bikeMs:  diffMs(r.bike_complete, r.run_complete),
      runMs:   diffMs(r.run_complete, r.finish_time),
    })).sort((a,b)=>(a.totalMs??Infinity)-(b.totalMs??Infinity))
    setAdultsAll(aRows)
    setLoading(false)
  }

  if (loading) return <div>Loading...</div>

  const adultsIndividual = adultsAll.filter(r => !r.isTeam)
  const teams = adultsAll.filter(r => r.isTeam)

  return (
    <div style={{background:'#fff', color:'#000', padding:'24px', fontFamily:'Arial, sans-serif', maxWidth:900, margin:'0 auto'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24, borderBottom:'3px solid #000', paddingBottom:12}}>
        <div>
          <h1 style={{fontSize:'1.5rem', fontWeight:900, margin:0}}>Triathlon Race Results</h1>
          <div style={{color:'#666', fontSize:'0.9rem', marginTop:4}}>Official Results — {printDate}</div>
        </div>
        <button
          onClick={() => window.print()}
          style={{padding:'8px 18px', background:'#000', color:'#fff', border:'none', borderRadius:4, cursor:'pointer', fontWeight:700, fontSize:'0.9rem'}}
          className="no-print"
        >
          🖨 Print / Save PDF
        </button>
      </div>

      <PrintTable title="KIDS RACE — Overall Results" rows={kidsAll} />

      <div style={{pageBreakBefore:'always'}} />

      <PrintTable title="ADULT RACE — Overall Results (Individuals)" rows={adultsIndividual} showSplits />

      <PrintTable title="ADULT RACE — Men's Results" rows={adultsIndividual.filter(r=>r.gender==='male')} showSplits />

      <PrintTable title="ADULT RACE — Women's Results" rows={adultsIndividual.filter(r=>r.gender==='female')} showSplits />

      {teams.length > 0 && (
        <div style={{marginBottom:32}}>
          <h2 style={{fontSize:'1rem', fontWeight:700, borderBottom:'2px solid #000', paddingBottom:4, marginBottom:8}}>
            ADULT RACE — Team Results
          </h2>
          <table style={{width:'100%', borderCollapse:'collapse', fontSize:'11px'}}>
            <thead>
              <tr style={{borderBottom:'1px solid #000'}}>
                <th style={{textAlign:'left', padding:'3px 6px'}}>Rank</th>
                <th style={{textAlign:'left', padding:'3px 6px'}}>#</th>
                <th style={{textAlign:'left', padding:'3px 6px'}}>Team</th>
                <th style={{textAlign:'left', padding:'3px 6px'}}>Total</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t, i) => (
                <tr key={t.id} style={{borderBottom:'1px solid #ddd'}}>
                  <td style={{padding:'3px 6px'}}>{i+1}</td>
                  <td style={{padding:'3px 6px', fontWeight:700}}>{t.raceNumber}</td>
                  <td style={{padding:'3px 6px', fontWeight:700}}>{t.teamLabel} Team — {t.name}</td>
                  <td style={{padding:'3px 6px', fontFamily:'monospace', fontWeight:700}}>{formatDuration(t.totalMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{marginTop:40, borderTop:'1px solid #ccc', paddingTop:12, fontSize:'10px', color:'#999', textAlign:'center'}}>
        Generated by TriTime Timing System — {printDate}
      </div>
    </div>
  )
}
