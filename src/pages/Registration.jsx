import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { TEAM_COLORS } from '../lib/utils'

const BLANK = {
  first_name: '',
  last_name: '',
  age: '',
  gender: 'male',
  race_type: 'adult',
  paid: false,
  received_swag_bag: false,
  is_team: false,
  team_color: '',
}

export default function Registration() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (isEdit) loadParticipant()
  }, [id])

  async function loadParticipant() {
    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .eq('id', id)
      .single()
    if (error) { setError('Participant not found'); return }
    setForm({
      first_name: data.first_name,
      last_name: data.last_name,
      age: data.age ?? '',
      gender: data.gender ?? 'male',
      race_type: data.race_type,
      paid: data.paid,
      received_swag_bag: data.received_swag_bag,
      is_team: data.is_team,
      team_color: data.team_color ?? '',
    })
  }

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function getNextRaceNumber(race_type) {
    const { data } = await supabase
      .from('participants')
      .select('race_number')
      .eq('race_type', race_type)
      .order('race_number', { ascending: false })
      .limit(1)
    return data && data.length > 0 ? data[0].race_number + 1 : 1
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError('First and last name are required.')
      return
    }
    if (!form.age || isNaN(Number(form.age))) {
      setError('A valid age is required.')
      return
    }
    if (form.is_team && !form.team_color) {
      setError('Please select a team color.')
      return
    }

    setSaving(true)

    if (isEdit) {
      const { error: err } = await supabase
        .from('participants')
        .update({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          age: Number(form.age),
          gender: form.gender,
          race_type: form.race_type,
          paid: form.paid,
          received_swag_bag: form.received_swag_bag,
          is_team: form.is_team,
          team_color: form.is_team ? form.team_color : null,
        })
        .eq('id', id)
      setSaving(false)
      if (err) { setError(err.message); return }
      setSuccess('Participant updated.')
    } else {
      const race_number = await getNextRaceNumber(form.race_type)
      const { error: err } = await supabase
        .from('participants')
        .insert({
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          age: Number(form.age),
          gender: form.gender,
          race_type: form.race_type,
          race_number,
          registration_date: new Date().toISOString().slice(0, 10),
          paid: form.paid,
          received_swag_bag: form.received_swag_bag,
          is_team: form.is_team,
          team_color: form.is_team ? form.team_color : null,
        })
      setSaving(false)
      if (err) { setError(err.message); return }
      setSuccess(`Registered! Race #${race_number} assigned.`)
      setForm(BLANK)
    }
  }

  return (
    <div style={{maxWidth: 560}}>
      <div className="page-title">{isEdit ? 'Edit Participant' : 'New Registration'}</div>
      <div className="page-sub">{isEdit ? 'Update participant information.' : 'Register a new participant. Race number will be assigned automatically.'}</div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-ok">{success}</div>}

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">First Name *</label>
              <input
                className="form-input"
                value={form.first_name}
                onChange={e => set('first_name', e.target.value)}
                placeholder="Jane"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name *</label>
              <input
                className="form-input"
                value={form.last_name}
                onChange={e => set('last_name', e.target.value)}
                placeholder="Smith"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Age *</label>
              <input
                className="form-input"
                type="number"
                min="1"
                max="120"
                value={form.age}
                onChange={e => set('age', e.target.value)}
                placeholder="34"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Gender</label>
              <select className="form-select" value={form.gender} onChange={e => set('gender', e.target.value)}>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Race Type</label>
            <select className="form-select" value={form.race_type} onChange={e => set('race_type', e.target.value)} disabled={isEdit}>
              <option value="adult">Adult Race</option>
              <option value="kids">Kids Race</option>
            </select>
            {isEdit && <p className="text-muted text-sm" style={{marginTop:4}}>Race type cannot be changed after registration.</p>}
          </div>

          <div className="form-row" style={{marginBottom:12}}>
            <label className="checkbox-label">
              <input type="checkbox" checked={form.paid} onChange={e => set('paid', e.target.checked)} />
              Paid
            </label>
            <label className="checkbox-label">
              <input type="checkbox" checked={form.received_swag_bag} onChange={e => set('received_swag_bag', e.target.checked)} />
              Received Swag Bag
            </label>
          </div>

          {form.race_type === 'adult' && (
            <>
              <div className="form-group" style={{marginTop:8}}>
                <label className="checkbox-label">
                  <input type="checkbox" checked={form.is_team} onChange={e => set('is_team', e.target.checked)} />
                  Team Entry
                </label>
              </div>

              {form.is_team && (
                <div className="form-group">
                  <label className="form-label">Team Color *</label>
                  <select className="form-select" value={form.team_color} onChange={e => set('team_color', e.target.value)}>
                    <option value="">Select color...</option>
                    {TEAM_COLORS.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                  {form.team_color && (
                    <div style={{marginTop:8, display:'flex', alignItems:'center', gap:8}}>
                      <div style={{width:28, height:28, borderRadius:6, background:form.team_color, border:'2px solid var(--border)'}} />
                      <span>{TEAM_COLORS.find(c=>c.value===form.team_color)?.label} Team</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <div style={{display:'flex', gap:12, marginTop:8}}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Register Participant'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => navigate('/participants')}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
