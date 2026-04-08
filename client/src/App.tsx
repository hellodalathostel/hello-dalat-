import { Navigate, NavLink, Outlet, Route, Routes } from 'react-router-dom'
import { FileText, Users } from 'lucide-react'
import PrivateRoute from './components/PrivateRoute'
import DashboardPage from './pages/DashboardPage'
import FinancePage from './pages/FinancePage'
import GroupBookingDetailPage from './pages/GroupBookingDetailPage'
import GroupBookingsPage from './pages/GroupBookingsPage'
import InvoicePage from './pages/InvoicePage'
import LoginPage from './pages/LoginPage'
import OverviewPage from './pages/OverviewPage'

function PrivateLayout() {
  return (
    <PrivateRoute>
      <div className="min-h-screen bg-[#f6f3e8]">
        <header className="sticky top-0 z-30 border-b border-primary/10 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 md:px-8">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `rounded-xl px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              Tổng quan
            </NavLink>
            <NavLink
              to="/calendar"
              className={({ isActive }) =>
                `rounded-xl px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              Lịch đặt phòng
            </NavLink>
            <NavLink
              to="/finance?tab=revenue"
              className={({ isActive }) =>
                `rounded-xl px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              Tài chính
            </NavLink>
            <NavLink
              to="/finance?tab=expense"
              className={({ isActive }) =>
                `rounded-xl px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              Chi phí
            </NavLink>
            <NavLink
              to="/finance?tab=debt"
              className={({ isActive }) =>
                `rounded-xl px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              Công nợ
            </NavLink>
            <NavLink
              to="/finance?tab=profit"
              className={({ isActive }) =>
                `rounded-xl px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              Báo cáo lợi nhuận
            </NavLink>
            <NavLink
              to="/invoices"
              className={({ isActive }) =>
                `inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              <FileText className="h-4 w-4" />
              Hóa đơn
            </NavLink>
            <NavLink
              to="/group-bookings"
              className={({ isActive }) =>
                `inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-slate-600 hover:bg-slate-100'
                }`
              }
            >
              <Users className="h-4 w-4" />
              Booking đoàn
            </NavLink>
          </div>
        </header>

        <Outlet />
      </div>
    </PrivateRoute>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<PrivateLayout />}>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/calendar" element={<DashboardPage />} />
        <Route path="/finance" element={<FinancePage />} />
        <Route path="/invoices" element={<InvoicePage />} />
        <Route path="/group-bookings" element={<GroupBookingsPage />} />
        <Route path="/group-bookings/:groupId" element={<GroupBookingDetailPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
