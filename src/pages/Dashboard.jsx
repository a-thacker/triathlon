import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link } from 'react-router-dom'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data, error } = await supabase
      .from('participants')
      .select('race_type, checked_in, paid')

    if (error) { console.error(error); return }

    // Fetch timing records to count swim completions and finishers
    const { data: timing } = await supabase
      .from('timing_records')
      .select('race_type, swim_complete, finish_time, dnf, team_color, participant_id')

    const kidsFinished  = (timing || []).filter(t => t.race_type === 'kids' && t.finish_time && !t.dnf).length
    const adultsSwum    = (timing || []).filter(t => t.race_type === 'adult' && t.swim_complete && !t.dnf).length
    const adultsFinished= (timing || []).filter(t => t.race_type === 'adult' && t.finish_time && !t.dnf).length

    const kids = data.filter(p => p.race_type === 'kids')
    const adults = data.filter(p => p.race_type === 'adult')

    setStats({
      kidsTotal: kids.length,
      adultsTotal: adults.length,
      kidsCheckedIn: kids.filter(p => p.checked_in).length,
      adultsCheckedIn: adults.filter(p => p.checked_in).length,
      kidsPaid: kids.filter(p => p.paid).length,
      adultsPaid: adults.filter(p => p.paid).length,
      totalCheckedIn: data.filter(p => p.checked_in).length,
      totalPaid: data.filter(p => p.paid).length,
      total: data.length,
      kidsFinished,
      adultsSwum,
      adultsFinished,
    })
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  if (loading) return <div className="text-muted">Loading...</div>

  return (
    <div>
      <div className="page-title">Dashboard</div>
      <div className="page-sub">Race day overview</div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-number">{stats.total}</div>
          <div className="stat-label">Total Registered</div>
        </div>
        <div className="stat-card">
          <div className="stat-number" style={{color:'var(--kids-color)'}}>{stats.kidsTotal}</div>
          <div className="stat-label">Kids Registered</div>
        </div>
        <div className="stat-card">
          <div className="stat-number" style={{color:'var(--adult-color)'}}>{stats.adultsTotal}</div>
          <div className="stat-label">Adults Registered</div>
        </div>
        <div className="stat-card">
          <div className="stat-number" style={{color:'var(--success)'}}>{stats.totalCheckedIn}</div>
          <div className="stat-label">Checked In</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.kidsCheckedIn}</div>
          <div className="stat-label">Kids Checked In</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.adultsCheckedIn}</div>
          <div className="stat-label">Adults Checked In</div>
        </div>
        <div className="stat-card">
          <div className="stat-number" style={{color:'var(--success)'}}>{stats.totalPaid}</div>
          <div className="stat-label">Total Paid</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.kidsTotal - stats.kidsPaid + stats.adultsTotal - stats.adultsPaid}</div>
          <div className="stat-label">Unpaid</div>
        </div>
      </div>

      {/* Race progress section */}
      <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)', marginBottom: 10 }}>
        Race Progress
      </div>
      <div className="stat-grid" style={{ marginBottom: 28 }}>
        <div className="stat-card">
          <div className="stat-number" style={{color:'var(--kids-color)'}}>{stats.kidsFinished ?? 0}</div>
          <div className="stat-label">Kids Finished</div>
        </div>
        <div className="stat-card">
          <div className="stat-number" style={{color:'var(--adult-color)'}}>{stats.adultsSwum ?? 0}</div>
          <div className="stat-label">Adults Swim Done</div>
        </div>
        <div className="stat-card">
          <div className="stat-number" style={{color:'var(--success)'}}>{stats.adultsFinished ?? 0}</div>
          <div className="stat-label">Adults Finished</div>
        </div>
      </div>

      <div style={{display:'flex', gap:'12px', flexWrap:'wrap'}}>
        <Link to="/app/checkin" className="btn btn-primary btn-lg">Go to Check-In</Link>
        <Link to="/app/timing/kids" className="btn btn-ghost btn-lg">Kids Timing</Link>
        <Link to="/app/timing/adult" className="btn btn-ghost btn-lg">Adult Timing</Link>
      </div>
    </div>
  )
}
