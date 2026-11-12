import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LockScreen from './components/LockScreen';
import Navbar from './components/Navbar';
import { AppShellSkeleton, LockScreenSkeleton } from './components/Skeletons';
import TuitionsPage from './pages/TuitionsPage';
import TeachersPage from './pages/TeachersPage';

// UI-only layout hint so initial verification renders a matching non-sensitive skeleton.
function getLikelyAuthenticatedHint() {
  try {
    const raw = localStorage.getItem('tsf_auth_sync');
    if (!raw) return false;
    return JSON.parse(raw)?.type === 'LOGIN';
  } catch {
    return false;
  }
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    const variant = location.pathname === '/teachers' ? 'teacher' : 'tuition';
    return getLikelyAuthenticatedHint() ? (
      <AppShellSkeleton variant={variant} />
    ) : (
      <LockScreenSkeleton />
    );
  }

  if (!isAuthenticated) {
    return <LockScreen />;
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100/60 text-gray-900 flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<TuitionsPage />} />
          <Route path="/teachers" element={<TeachersPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Analytics />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
