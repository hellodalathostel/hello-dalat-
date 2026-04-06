import { Navigate, NavLink, Outlet, Route, Routes } from 'react-router-dom'
import { FileText } from 'lucide-react'
import PrivateRoute from './components/PrivateRoute'
import DashboardPage from './pages/DashboardPage'
import FinancePage from './pages/FinancePage'
import InvoicePage from './pages/InvoicePage'
import LoginPage from './pages/LoginPage'

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
              Lịch đặt phòng
            </NavLink>
            <NavLink
              to="/finance"
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
        <Route path="/" element={<DashboardPage />} />
        <Route path="/finance" element={<FinancePage />} />
        <Route path="/invoices" element={<InvoicePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
