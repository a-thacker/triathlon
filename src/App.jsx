import React from 'react'
import { Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom'

// Public pages
import Landing        from './pages/Landing'
import OrganizerLogin from './pages/OrganizerLogin'
import PublicResults  from './pages/PublicResults'

// Organizer pages
import RequireAuth    from './components/RequireAuth'
import Dashboard      from './pages/Dashboard'
import Registration   from './pages/Registration'
import ParticipantList from './pages/ParticipantList'
import CheckIn        from './pages/CheckIn'
import KidsTiming     from './pages/KidsTiming'
import AdultTiming    from './pages/AdultTiming'
import LiveResultsKids   from './pages/LiveResultsKids'
import LiveResultsAdult  from './pages/LiveResultsAdult'
import FinalResults   from './pages/FinalResults'
import PrintResults   from './pages/PrintResults'

function Sidebar() {
  const navigate = useNavigate()

  function logout() {
    sessionStorage.removeItem('organizer_auth')
    navigate('/')
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span>TriTimer</span>
      </div>
      <nav>
        <div className="nav-section">Main</div>
        <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/app" end>Dashboard</NavLink>
        <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/app/participants">Participants</NavLink>
        <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/app/register">Registration</NavLink>
        <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/app/checkin">Check-In</NavLink>

        <div className="nav-section">Timing</div>
        <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/app/timing/kids">Kids Race</NavLink>
        <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/app/timing/adult">Adult Race</NavLink>

        <div className="nav-section">Results</div>
        <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/app/results/live/kids">Live — Kids</NavLink>
        <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/app/results/live/adult">Live — Adult</NavLink>
        <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/app/results/final">Final Results</NavLink>
        <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/app/results/print">Print</NavLink>
      </nav>
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', marginTop: 'auto' }}>
        <button className="btn btn-ghost btn-sm w-full" onClick={logout}>Log Out</button>
      </div>
    </aside>
  )
}

function OrganizerLayout() {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="register"             element={<Registration />} />
          <Route path="register/:id"         element={<Registration />} />
          <Route path="participants"         element={<ParticipantList />} />
          <Route path="checkin"              element={<CheckIn />} />
          <Route path="timing/kids"          element={<KidsTiming />} />
          <Route path="timing/adult"         element={<AdultTiming />} />
          <Route path="results/live/kids"    element={<LiveResultsKids />} />
          <Route path="results/live/adult"   element={<LiveResultsAdult />} />
          <Route path="results/final"        element={<FinalResults />} />
          <Route path="results/print"        element={<PrintResults />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/"        element={<Landing />} />
      <Route path="/login"   element={<OrganizerLogin />} />
      <Route path="/results" element={<PublicResults />} />

      {/* Print — no sidebar, no auth needed if you want to share it */}
      <Route path="/print"   element={<PrintResults />} />

      {/* Organizer app — protected */}
      <Route path="/app/*" element={
        <RequireAuth>
          <OrganizerLayout />
        </RequireAuth>
      } />
    </Routes>
  )
}
