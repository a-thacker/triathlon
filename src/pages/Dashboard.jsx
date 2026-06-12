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

      <div style={{display:'flex', gap:'12px', flexWrap:'wrap'}}>
        <Link to="/checkin" className="btn btn-primary btn-lg">Go to Check-In</Link>
        <Link to="/timing/kids" className="btn btn-ghost btn-lg">Kids Timing</Link>
        <Link to="/timing/adult" className="btn btn-ghost btn-lg">Adult Timing</Link>
      </div>
    </div>
  )
}
