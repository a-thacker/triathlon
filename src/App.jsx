import React from 'react'
import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Registration from './pages/Registration'
import ParticipantList from './pages/ParticipantList'
import CheckIn from './pages/CheckIn'
import KidsTiming from './pages/KidsTiming'
import AdultTiming from './pages/AdultTiming'
import LiveResultsKids from './pages/LiveResultsKids'
import LiveResultsAdult from './pages/LiveResultsAdult'
import FinalResults from './pages/FinalResults'
import PrintResults from './pages/PrintResults'

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        ⚡ <span>TriTime</span>
      </div>
      <nav>
        <div className="nav-section">Main</div>
        <NavLink className={({isActive})=>`nav-link${isActive?' active':''}`} to="/" end>Dashboard</NavLink>
        <NavLink className={({isActive})=>`nav-link${isActive?' active':''}`} to="/participants">Participants</NavLink>
        <NavLink className={({isActive})=>`nav-link${isActive?' active':''}`} to="/register">Registration</NavLink>
        <NavLink className={({isActive})=>`nav-link${isActive?' active':''}`} to="/checkin">Check-In</NavLink>

        <div className="nav-section">Timing</div>
        <NavLink className={({isActive})=>`nav-link${isActive?' active':''}`} to="/timing/kids">Kids Race</NavLink>
        <NavLink className={({isActive})=>`nav-link${isActive?' active':''}`} to="/timing/adult">Adult Race</NavLink>

        <div className="nav-section">Results</div>
        <NavLink className={({isActive})=>`nav-link${isActive?' active':''}`} to="/results/live/kids">Live — Kids</NavLink>
        <NavLink className={({isActive})=>`nav-link${isActive?' active':''}`} to="/results/live/adult">Live — Adult</NavLink>
        <NavLink className={({isActive})=>`nav-link${isActive?' active':''}`} to="/results/final">Final Results</NavLink>
        <NavLink className={({isActive})=>`nav-link${isActive?' active':''}`} to="/results/print">🖨 Print</NavLink>
      </nav>
    </aside>
  )
}

export default function App() {
  const location = useLocation()
  const isPrint = location.pathname === '/results/print'

  if (isPrint) {
    return (
      <Routes>
        <Route path="/results/print" element={<PrintResults />} />
      </Routes>
    )
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/register" element={<Registration />} />
          <Route path="/register/:id" element={<Registration />} />
          <Route path="/participants" element={<ParticipantList />} />
          <Route path="/checkin" element={<CheckIn />} />
          <Route path="/timing/kids" element={<KidsTiming />} />
          <Route path="/timing/adult" element={<AdultTiming />} />
          <Route path="/results/live/kids" element={<LiveResultsKids />} />
          <Route path="/results/live/adult" element={<LiveResultsAdult />} />
          <Route path="/results/final" element={<FinalResults />} />
          <Route path="/results/print" element={<PrintResults />} />
        </Routes>
      </main>
    </div>
  )
}
