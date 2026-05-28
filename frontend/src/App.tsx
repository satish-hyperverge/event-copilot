import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { Mic, Menu, X, Table2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useSync } from '@/hooks/useSync'
import { useUIStore } from '@/store/uiStore'
import { eventsApi } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'

// Pages (lazy would be ideal for prod, keeping simple for hackathon)
import Dashboard from '@/pages/Dashboard'
import AttendeeList from '@/pages/AttendeeList'
import AttendeeProfile from '@/pages/AttendeeProfile'
import LeadCapture from '@/pages/LeadCapture'
import CaptureList from '@/pages/CaptureList'
import OutreachHub from '@/pages/OutreachHub'
import FollowUpDashboard from '@/pages/FollowUpDashboard'
import Schedule from '@/pages/Schedule'

const NAV = [
  { to: '/capture', icon: Mic, label: 'Capture' },
  { to: '/captures', icon: Table2, label: 'Saved Leads' },
]

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { activeEventId, setActiveEventId } = useUIStore()
  useSync()

  const { data: events } = useQuery({
    queryKey: ['events'],
    queryFn: () => eventsApi.list(),
  })

  // Auto-select first event if none selected
  useEffect(() => {
    if (!activeEventId && events && events.length > 0) {
      setActiveEventId(events[0].id)
    }
  }, [events, activeEventId, setActiveEventId])

  return (
    <BrowserRouter>
      <div className="min-h-screen flex">
        {/* Sidebar */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-40 w-56 bg-brand-900 text-white flex flex-col
            transform transition-transform duration-200
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            lg:translate-x-0 lg:static lg:z-auto
          `}
        >
          {/* Logo */}
          <div className="h-12 flex items-center px-4 border-b border-brand-800">
            <span className="text-sm font-semibold tracking-wide text-brand-100">Event Co-pilot</span>
            <button
              className="ml-auto lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {NAV.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-700 text-white'
                      : 'text-brand-200 hover:bg-brand-800 hover:text-white'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </NavLink>
            ))}
          </nav>

        </aside>

        {/* Overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar (mobile) */}
          <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-3 lg:hidden sticky top-0 z-20">
            <button onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5 text-gray-600" />
            </button>
            <span className="font-semibold text-gray-800">LeadPlatform</span>
          </header>

          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<Navigate to="/capture" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/attendees" element={<AttendeeList />} />
              <Route path="/attendees/:id" element={<AttendeeProfile />} />
              <Route path="/capture" element={<LeadCapture />} />
              <Route path="/captures" element={<CaptureList />} />
              <Route path="/outreach" element={<OutreachHub />} />
              <Route path="/followups" element={<FollowUpDashboard />} />
              <Route path="/schedule" element={<Schedule />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}
