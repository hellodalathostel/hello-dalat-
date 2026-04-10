import { lazy, Suspense } from 'react'
import { Link, Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { FileText, Users } from 'lucide-react'
import PrivateRoute from './components/PrivateRoute'

const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const FinancePage = lazy(() => import('./pages/FinancePage'))
const GroupBookingDetailPage = lazy(() => import('./pages/GroupBookingDetailPage'))
const GroupBookingsPage = lazy(() => import('./pages/GroupBookingsPage'))
const InvoicePage = lazy(() => import('./pages/InvoicePage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const OverviewPage = lazy(() => import('./pages/OverviewPage'))

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-xl px-3 py-2 text-sm font-medium transition ${
    isActive ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-100'
  }`

const navLinkClassWithIcon = ({ isActive }: { isActive: boolean }) =>
  `inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition ${
    isActive ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-100'
  }`

function FinanceTabLink({ tab, children }: { tab: string; children: React.ReactNode }) {
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const isActive = location.pathname === '/finance' && params.get('tab') === tab
  return (
    <Link
      to={`/finance?tab=${tab}`}
      className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
        isActive ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {children}
    </Link>
  )
}

const PageLoader = (
  <div className="flex min-h-[50vh] items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-primary" />
  </div>
)

function PrivateLayout() {
  return (
    <PrivateRoute>
      <div className="min-h-screen bg-[#f6f3e8]">
        <header className="sticky top-0 z-30 border-b border-primary/10 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 md:px-8">
            <NavLink to="/" end className={navLinkClass}>
              Tổng quan
            </NavLink>
            <NavLink to="/calendar" className={navLinkClass}>
              Lịch đặt phòng
            </NavLink>
            <FinanceTabLink tab="revenue">Tài chính</FinanceTabLink>
            <FinanceTabLink tab="expense">Chi phí</FinanceTabLink>
            <FinanceTabLink tab="debt">Công nợ</FinanceTabLink>
            <FinanceTabLink tab="profit">Báo cáo lợi nhuận</FinanceTabLink>
            <NavLink to="/invoices" className={navLinkClassWithIcon}>
              <FileText className="h-4 w-4" />
              Hóa đơn
            </NavLink>
            <NavLink to="/group-bookings" className={navLinkClassWithIcon}>
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
    <Suspense fallback={PageLoader}>
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
    </Suspense>
  )
}

export default App
