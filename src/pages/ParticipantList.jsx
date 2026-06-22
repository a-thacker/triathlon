import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { teamColorStyle, TEAM_COLORS, formatDuration, diffMs, calcAdultSplits } from '../lib/utils'

const SORT_OPTIONS = [
  { value: 'race_number_asc',   label: 'Number (Low to High)' },
  { value: 'race_number_desc',  label: 'Number (High to Low)' },
  { value: 'last_name_asc',     label: 'Name (A to Z)'        },
  { value: 'last_name_desc',    label: 'Name (Z to A)'        },
  { value: 'registration_asc',  label: 'Registered (Oldest)'  },
  { value: 'registration_desc', label: 'Registered (Newest)'  },
  { value: 'age_asc',           label: 'Age (Youngest)'       },
  { value: 'age_desc',          label: 'Age (Oldest)'         },
]

function sortParticipants(list, sortKey) {
  const s = [...list]
  switch (sortKey) {
    case 'race_number_asc':   return s.sort((a,b) => a.race_number - b.race_number)
    case 'race_number_desc':  return s.sort((a,b) => b.race_number - a.race_number)
    case 'last_name_asc':     return s.sort((a,b) => a.last_name.localeCompare(b.last_name))
    case 'last_name_desc':    return s.sort((a,b) => b.last_name.localeCompare(a.last_name))
    case 'registration_asc':  return s.sort((a,b) => new Date(a.registration_date) - new Date(b.registration_date))
    case 'registration_desc': return s.sort((a,b) => new Date(b.registration_date) - new Date(a.registration_date))
    case 'age_asc':           return s.sort((a,b) => (a.age ?? 0) - (b.age ?? 0))
    case 'age_desc':          return s.sort((a,b) => (b.age ?? 0) - (a.age ?? 0))
    default:                  return s
  }
}

const BADGE = ({ val, yes = 'Yes', no = 'No' }) => (
  <span className={`badge badge-${val ? 'yes' : 'no'}`}>{val ? yes : no}</span>
)

export default function ParticipantList() {
  const navigate = useNavigate()
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [search,      setSearch]      = useState('')
  const [filterRace,  setFilterRace]  = useState('all')
  const [filterCI,    setFilterCI]    = useState('all')   // checked in
  const [filterPaid,  setFilterPaid]  = useState('all')
  const [filterSwag,  setFilterSwag]  = useState('all')
  const [filterGender,setFilterGender]= useState('all')
  const [filterType,  setFilterType]  = useState('all')   // team or individual
  const [sortKey,     setSortKey]     = useState('race_number_asc')

  useEffect(() => { load() }, [])

  async function load() {
    const { data, error } = await supabase
      .from('participants').select('*')
    if (error) { console.error(error); return }
    setParticipants(data)
    setLoading(false)
  }

  function applyFilters(list) {
    return list.filter(p => {
      if (filterRace !== 'all' && p.race_type !== filterRace) return false
      if (filterCI   !== 'all' && String(p.checked_in) !== filterCI) return false
      if (filterPaid !== 'all' && String(p.paid) !== filterPaid) return false
      if (filterSwag !== 'all' && String(p.received_swag_bag) !== filterSwag) return false
      if (filterGender !== 'all' && p.gender !== filterGender) return false
      if (filterType === 'team'       && !p.is_team) return false
      if (filterType === 'individual' &&  p.is_team) return false
      const q = search.toLowerCase().trim()
      if (!q) return true
      return String(p.race_number).includes(q) ||
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(q)
    })
  }

  const filtered = sortParticipants(applyFilters(participants), sortKey)

  const activeFilters = [filterRace, filterCI, filterPaid, filterSwag, filterGender, filterType]
    .filter(f => f !== 'all').length

  function resetFilters() {
    setFilterRace('all'); setFilterCI('all'); setFilterPaid('all')
    setFilterSwag('all'); setFilterGender('all'); setFilterType('all')
    setSearch(''); setSortKey('race_number_asc')
  }

  const sel = { background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '7px 10px', fontSize: '0.82rem', cursor: 'pointer' }

  async function exportResultsCSV() {
    // Fetch race start times for both race types
    const { data: evData } = await supabase.from('race_events')
      .select('race_type, event_type, ts')
      .eq('event_type', 'start')
      .order('ts', { ascending: false })
    const raceStarts = {}
    ;(evData || []).forEach(e => { if (!raceStarts[e.race_type]) raceStarts[e.race_type] = e.ts })

    // Fetch all timing records
    const { data: tData } = await supabase.from('timing_records').select('*')
    const timingByParticipant = {}
    const timingByTeam = {}
    ;(tData || []).forEach(r => {
      if (r.participant_id) timingByParticipant[r.participant_id] = r
      if (r.team_color)     timingByTeam[`${r.team_color}:${r.race_type}`] = r
    })

    const teamColorLabel = (color) =>
      color ? (TEAM_COLORS.find(c => c.value === color)?.label || color) : ''

    const fmt = (ms) => ms != null ? formatDuration(ms) : ''

    const headers = [
      'race_number', 'first_name', 'last_name', 'age', 'gender', 'race_type',
      'team', 'team_color',
      // Kids only
      'finish_time',
      // Adult splits
      'swim', 't1', 'bike', 't2', 'run', 'total',
      'dnf',
    ]

    const rows = participants
      .slice()
      .sort((a, b) => {
        if (a.race_type !== b.race_type) return a.race_type.localeCompare(b.race_type)
        return a.race_number - b.race_number
      })
      .map(p => {
        const raceStart = raceStarts[p.race_type] || null
        let rec = null
        if (p.is_team && p.team_color) {
          rec = timingByTeam[`${p.team_color}:${p.race_type}`] || null
        } else {
          rec = timingByParticipant[p.id] || null
        }

        let swim = '', t1 = '', bike = '', t2 = '', run = '', total = '', finish = '', dnf = ''

        if (rec) {
          dnf = rec.dnf ? 'true' : 'false'
          if (p.race_type === 'adult') {
            const splits = calcAdultSplits(rec, raceStart)
            swim  = fmt(splits.swimMs)
            t1    = fmt(splits.t1Ms)
            bike  = fmt(splits.bikeMs)
            t2    = fmt(splits.t2Ms)
            run   = fmt(splits.runMs)
            total = fmt(splits.totalMs)
          } else {
            // Kids: just finish time
            finish = fmt(diffMs(raceStart, rec.finish_time))
            total  = finish
          }
        }

        return [
          p.race_number,
          p.first_name,
          p.last_name,
          p.age ?? '',
          p.gender ?? '',
          p.race_type === 'adult' ? 'Adult' : 'Kids',
          p.is_team ? 'Yes' : 'No',
          teamColorLabel(p.team_color),
          finish,
          swim, t1, bike, t2, run, total,
          dnf,
        ].map(v => {
          const s = String(v)
          return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
        })
      })

    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `results_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  function exportRosterCSV() {
    const teamColorLabel = (color) =>
      color ? (TEAM_COLORS.find(c => c.value === color)?.label || color) : ''

    const headers = [
      'race_number', 'first_name', 'last_name', 'age', 'gender', 'race_type',
      'registration_date', 'checked_in', 'paid', 'received_swag_bag', 'tshirt_size',
      'is_team', 'team_color', 'team_role', 'exclude_from_results',
    ]

    const rows = participants
      .slice()
      .sort((a, b) => a.race_number - b.race_number)
      .map(p => [
        p.race_number, p.first_name, p.last_name,
        p.age ?? '', p.gender ?? '', p.race_type,
        p.registration_date ?? '',
        p.checked_in ? 'true' : 'false',
        p.paid ? 'true' : 'false',
        p.received_swag_bag ? 'true' : 'false',
        p.tshirt_size ?? '',
        p.is_team ? 'true' : 'false',
        teamColorLabel(p.team_color),
        p.team_role ?? '',
        p.exclude_from_results ? 'true' : 'false',
      ].map(v => {
        const s = String(v)
        return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
      }))

    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `roster_${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div className="page-title">Participants</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={exportRosterCSV} disabled={participants.length === 0} title="Registration data only">
            Export Roster
          </button>
          <button className="btn btn-ghost" onClick={exportResultsCSV} disabled={participants.length === 0} title="Includes all race times and splits">
            Export Results
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/app/register')}>+ New</button>
        </div>
      </div>
      <div className="page-sub">{participants.length} total · {filtered.length} shown</div>

      {/* Search */}
      <div className="search-bar" style={{ marginBottom: 10 }}>
        <span className="search-icon">🔍</span>
        <input
          className="form-input"
          style={{ paddingLeft: 36 }}
          placeholder="Search by number or name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
      </div>

      {/* Filter + sort row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        <select style={sel} value={filterRace} onChange={e => setFilterRace(e.target.value)}>
          <option value="all">All Races</option>
          <option value="kids">Kids</option>
          <option value="adult">Adult</option>
        </select>

        <select style={sel} value={filterCI} onChange={e => setFilterCI(e.target.value)}>
          <option value="all">All Check-In</option>
          <option value="true">Checked In</option>
          <option value="false">Not Checked In</option>
        </select>

        <select style={sel} value={filterPaid} onChange={e => setFilterPaid(e.target.value)}>
          <option value="all">All Payment</option>
          <option value="true">Paid</option>
          <option value="false">Unpaid</option>
        </select>

        <select style={sel} value={filterSwag} onChange={e => setFilterSwag(e.target.value)}>
          <option value="all">All Swag</option>
          <option value="true">Got Swag</option>
          <option value="false">No Swag</option>
        </select>

        <select style={sel} value={filterGender} onChange={e => setFilterGender(e.target.value)}>
          <option value="all">All Genders</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>

        <select style={sel} value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="all">Teams + Individuals</option>
          <option value="team">Teams Only</option>
          <option value="individual">Individuals Only</option>
        </select>

        <select style={{ ...sel, minWidth: 170 }} value={sortKey} onChange={e => setSortKey(e.target.value)}>
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        {(activeFilters > 0 || search) && (
          <button
            onClick={resetFilters}
            style={{ ...sel, color: 'var(--danger)', borderColor: 'var(--danger)', background: 'transparent', fontWeight: 700 }}
          >
            Clear ({activeFilters + (search ? 1 : 0)})
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-muted">Loading...</div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
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
                  <th>Size</th>
                  <th>Registered</th>
                  <th>Paid</th>
                  <th>Checked In</th>
                  <th>Swag</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={11} className="text-muted" style={{ padding: '20px', textAlign: 'center' }}>
                    No participants match the current filters.
                  </td></tr>
                )}
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td className="font-bold text-accent">{p.race_number}</td>
                    <td>
                      <div className="font-bold">{p.first_name} {p.last_name}</div>
                      {p.exclude_from_results && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--danger)', fontWeight: 700, marginTop: 2 }}>
                          Excluded from results
                        </div>
                      )}
                    </td>
                    <td><span className={`badge badge-${p.race_type}`}>{p.race_type}</span></td>
                    <td>{p.age}</td>
                    <td style={{ textTransform: 'capitalize' }}>{p.gender}</td>
                    <td>
                      {p.is_team && p.team_color
                        ? <span style={teamColorStyle(p.team_color)}>
                            {TEAM_COLORS.find(c => c.value === p.team_color)?.label || 'Team'}
                          </span>
                        : <span className="text-muted text-sm">—</span>
                      }
                    </td>
                    <td>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: p.tshirt_size ? 'var(--text)' : 'var(--muted)' }}>
                        {p.tshirt_size || '—'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
                      {p.registration_date ? new Date(p.registration_date).toLocaleDateString() : '—'}
                    </td>
                    <td><BADGE val={p.paid} /></td>
                    <td><BADGE val={p.checked_in} yes="In" no="No" /></td>
                    <td><BADGE val={p.received_swag_bag} yes="Got It" no="No" /></td>
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
