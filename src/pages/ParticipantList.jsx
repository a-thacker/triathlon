import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { teamColorStyle } from '../lib/utils'

export default function ParticipantList() {
  const navigate = useNavigate()
  const [participants, setParticipants] = useState([])
  const [search, setSearch] = useState('')
  const [filterRace, setFilterRace] = useState('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .order('race_type')
      .order('race_number')
    if (error) { console.error(error); return }
    setParticipants(data)
    setLoading(false)
  }

  const filtered = participants.filter(p => {
    if (filterRace !== 'all' && p.race_type !== filterRace) return false
    const q = search.toLowerCase().trim()
    if (!q) return true
    const num = String(p.race_number)
    const name = `${p.first_name} ${p.last_name}`.toLowerCase()
    return num.includes(q) || name.includes(q)
  })

  return (
    <div>
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6}}>
        <div className="page-title">Participants</div>
        <button className="btn btn-primary" onClick={() => navigate('/register')}>+ New</button>
      </div>
      <div className="page-sub">{participants.length} total registered</div>

      <div style={{display:'flex', gap:12, marginBottom:16, flexWrap:'wrap'}}>
        <div className="search-bar" style={{flex:1, minWidth:200}}>
          <span className="search-icon">🔍</span>
          <input
            className="form-input"
            style={{paddingLeft:36}}
            placeholder="Search by number, first name, or last name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
        </div>
        <select className="form-select" style={{width:160}} value={filterRace} onChange={e=>setFilterRace(e.target.value)}>
          <option value="all">All Races</option>
          <option value="kids">Kids</option>
          <option value="adult">Adult</option>
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
                  <th>Gender</th>
                  <th>Team</th>
                  <th>Paid</th>
                  <th>Checked In</th>
                  <th>Swag</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={10} className="text-muted" style={{padding:'20px', textAlign:'center'}}>No participants found.</td></tr>
                )}
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td className="font-bold text-accent">{p.race_number}</td>
                    <td>
                      <div className="font-bold">{p.first_name} {p.last_name}</div>
                    </td>
                    <td>
                      <span className={`badge badge-${p.race_type}`}>{p.race_type}</span>
                    </td>
                    <td>{p.age}</td>
                    <td style={{textTransform:'capitalize'}}>{p.gender}</td>
                    <td>
                      {p.is_team && p.team_color ? (
                        <span style={teamColorStyle(p.team_color)}>Team</span>
                      ) : '—'}
                    </td>
                    <td><span className={`badge badge-${p.paid?'yes':'no'}`}>{p.paid?'Yes':'No'}</span></td>
                    <td><span className={`badge badge-${p.checked_in?'yes':'no'}`}>{p.checked_in?'Yes':'No'}</span></td>
                    <td><span className={`badge badge-${p.received_swag_bag?'yes':'no'}`}>{p.received_swag_bag?'Yes':'No'}</span></td>
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
