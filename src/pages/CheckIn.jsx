import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { teamColorStyle } from '../lib/utils'

export default function CheckIn() {
  const navigate = useNavigate()
  const [participants, setParticipants] = useState([])
  const [search, setSearch] = useState('')
  const [filterRace, setFilterRace] = useState('all')
  const [loading, setLoading] = useState(true)
  const [raceStarted, setRaceStarted] = useState({ kids: false, adult: false })
  const searchRef = useRef()

  useEffect(() => { load(); checkRaceStarted() }, [])

  async function load() {
    const { data } = await supabase.from('participants').select('*').order('race_type').order('race_number')
    setParticipants(data || [])
    setLoading(false)
  }

  async function checkRaceStarted() {
    const { data } = await supabase.from('race_events').select('race_type, event_type').eq('event_type', 'start')
    const started = { kids: false, adult: false }
    if (data) data.forEach(e => { started[e.race_type] = true })
    setRaceStarted(started)
  }

  const filtered = participants.filter(p => {
    if (filterRace !== 'all' && p.race_type !== filterRace) return false
    const q = search.toLowerCase().trim()
    if (!q) return true
    const num = String(p.race_number)
    const name = `${p.first_name} ${p.last_name}`.toLowerCase()
    return num.includes(q) || name.includes(q)
  })

  async function toggleCheckedIn(p) {
    const { error } = await supabase
      .from('participants')
      .update({ checked_in: !p.checked_in })
      .eq('id', p.id)
    if (!error) setParticipants(ps => ps.map(x => x.id === p.id ? { ...x, checked_in: !x.checked_in } : x))
  }

  async function togglePaid(p) {
    const { error } = await supabase
      .from('participants')
      .update({ paid: !p.paid })
      .eq('id', p.id)
    if (!error) setParticipants(ps => ps.map(x => x.id === p.id ? { ...x, paid: !x.paid } : x))
  }

  async function toggleSwag(p) {
    const { error } = await supabase
      .from('participants')
      .update({ received_swag_bag: !p.received_swag_bag })
      .eq('id', p.id)
    if (!error) setParticipants(ps => ps.map(x => x.id === p.id ? { ...x, received_swag_bag: !x.received_swag_bag } : x))
  }

  return (
    <div>
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6}}>
        <div className="page-title">Check-In</div>
        <div style={{display:'flex', gap:8}}>
          <button
            className="btn btn-primary"
            disabled={raceStarted.kids && raceStarted.adult}
            onClick={() => navigate('/register')}
          >
            + Day-of Registration
          </button>
        </div>
      </div>
      <div className="page-sub">Search by number or name to check in participants.</div>

      {raceStarted.kids && (
        <div className="alert alert-warn">Kids race has started — registration is locked for kids.</div>
      )}
      {raceStarted.adult && (
        <div className="alert alert-warn">Adult race has started — registration is locked for adults.</div>
      )}

      <div style={{display:'flex', gap:12, marginBottom:16, flexWrap:'wrap'}}>
        <div className="search-bar" style={{flex:1, minWidth:200}}>
          <span className="search-icon">🔍</span>
          <input
            ref={searchRef}
            className="form-input"
            style={{paddingLeft:36}}
            placeholder="Search by number or name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
        </div>
        <select className="form-select" style={{width:160}} value={filterRace} onChange={e => setFilterRace(e.target.value)}>
          <option value="all">All Races</option>
          <option value="kids">Kids Only</option>
          <option value="adult">Adults Only</option>
        </select>
      </div>

      {loading ? (
        <div className="text-muted">Loading...</div>
      ) : (
        <div className="card" style={{padding:0, overflow:'hidden'}}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Race</th>
                  <th>Age</th>
                  <th>Team</th>
                  <th>Check In</th>
                  <th>Paid</th>
                  <th>Swag Bag</th>
                  <th>Edit</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="text-muted" style={{padding:'20px', textAlign:'center'}}>No participants found.</td></tr>
                )}
                {filtered.map(p => (
                  <tr key={p.id} style={p.checked_in ? {opacity:0.7} : {}}>
                    <td className="font-bold text-accent" style={{fontSize:'1.1rem'}}>{p.race_number}</td>
                    <td>
                      <div className="font-bold" style={{fontSize:'1rem'}}>{p.first_name} {p.last_name}</div>
                    </td>
                    <td><span className={`badge badge-${p.race_type}`}>{p.race_type}</span></td>
                    <td>{p.age}</td>
                    <td>
                      {p.is_team && p.team_color
                        ? <span style={teamColorStyle(p.team_color)}>Team</span>
                        : '—'
                      }
                    </td>
                    <td>
                      <button
                        className={`btn btn-sm ${p.checked_in ? 'btn-success' : 'btn-ghost'}`}
                        onClick={() => toggleCheckedIn(p)}
                        style={{minWidth:90}}
                      >
                        {p.checked_in ? '✓ In' : 'Check In'}
                      </button>
                    </td>
                    <td>
                      <button
                        className={`btn btn-sm ${p.paid ? 'btn-success' : 'btn-ghost'}`}
                        onClick={() => togglePaid(p)}
                        style={{minWidth:80}}
                      >
                        {p.paid ? '✓ Paid' : 'Mark Paid'}
                      </button>
                    </td>
                    <td>
                      <button
                        className={`btn btn-sm ${p.received_swag_bag ? 'btn-success' : 'btn-ghost'}`}
                        onClick={() => toggleSwag(p)}
                        style={{minWidth:80}}
                      >
                        {p.received_swag_bag ? '✓ Got It' : 'Give Swag'}
                      </button>
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/app/register/${p.id}`)}>Edit</button>
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
