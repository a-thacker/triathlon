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
import EditTimes      from './pages/EditTimes'
import RaceClock      from './pages/RaceClock'
import PrintResults   from './pages/PrintResults'

function Sidebar({ collapsed, onToggle }) {
  const navigate = useNavigate()

  function logout() {
    sessionStorage.removeItem('organizer_auth')
    navigate('/')
  }

  return (
    <aside className="sidebar" style={{
      width: collapsed ? 48 : 220,
      transition: 'width 0.2s ease',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      {/* Logo row with toggle button */}
      <div className="sidebar-logo" style={{
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        padding: collapsed ? '20px 0 12px' : '20px 16px 12px',
      }}>
        {!collapsed && <span>TriTimer</span>}
        <button
          onClick={onToggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--muted)', fontSize: '1rem', padding: '2px 4px',
            lineHeight: 1, flexShrink: 0,
          }}
        >
          {collapsed ? '›' : '‹'}
        </button>
      </div>

      {/* Nav — hidden when collapsed */}
      {!collapsed && (
        <nav>
          <div className="nav-section">Main</div>
          <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/app" end>Dashboard</NavLink>
          <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/app/participants">Participants</NavLink>
          <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/app/register">Registration</NavLink>
          <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/app/checkin">Check-In</NavLink>

          <div className="nav-section">Timing</div>
          <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/app/timing/kids">Kids Race</NavLink>
          <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/app/timing/adult">Adult Race</NavLink>

          <div className="nav-section">Display</div>
          <a className="nav-link" href="/clock/kids" target="_blank" rel="noopener noreferrer">Race Clock — Kids</a>
          <a className="nav-link" href="/clock/adult" target="_blank" rel="noopener noreferrer">Race Clock — Adult</a>

          <div className="nav-section">Results</div>
          <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/app/results/live/kids">Live — Kids</NavLink>
          <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/app/results/live/adult">Live — Adult</NavLink>
          <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/app/results/final">Final Results</NavLink>
          <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/app/results/print">Print</NavLink>
          <NavLink className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} to="/app/results/edit-times">Edit Times</NavLink>
        </nav>
      )}

      {!collapsed && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', marginTop: 'auto' }}>
          <button className="btn btn-ghost btn-sm w-full" onClick={logout}>Log Out</button>
        </div>
      )}
    </aside>
  )
}

function OrganizerLayout() {
  const [collapsed, setCollapsed] = React.useState(false)
  return (
    <div className="app-layout">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
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
          <Route path="results/edit-times"  element={<EditTimes />} />
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

      {/* Full-screen race clock — no sidebar, no auth, for TV/display use */}
      <Route path="/clock/:raceType" element={<RaceClock />} />
      {/* Organizer app — protected */}
      <Route path="/app/*" element={
        <RequireAuth>
          <OrganizerLayout />
        </RequireAuth>
      } />
    </Routes>
  )
}
