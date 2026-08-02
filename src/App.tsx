import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificacaoRealtimeProvider } from './components/NotificacaoRealtimeProvider';
import { LoginPage } from './pages/LoginPage';
import { OnboardingWizard } from './pages/OnboardingWizard';
import { DashboardShell } from './components/DashboardShell';
import { DashboardHome } from './pages/DashboardHome';
import { PDVPage } from './pages/PDVPage';
import { EntregasModulePage } from './pages/EntregasModulePage';
import { FinanceiroModulePage } from './pages/FinanceiroModulePage';
import { InventarioModulePage } from './pages/InventarioModulePage';
import { ChatPage } from './pages/ChatPage';
import { ChamadosPage } from './pages/ChamadosPage';
import { ImportadorPage } from './pages/ImportadorPage';
import { EntradaNotaFiscalPage } from './pages/EntradaNotaFiscalPage';
import { ModulePlaceholderPage } from './pages/ModulePlaceholderPage';

// Protected Route Component
const ProtectedLayout: React.FC = () => {
  const { session, loading, usuarioProfile } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
        <div className="w-8 h-8 border-3 border-zinc-200 border-t-[#F5D800] rounded-full animate-spin mb-3" />
        <span className="text-xs font-medium text-zinc-600">Carregando sistema...</span>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // If user has no company profile created yet, force redirect to onboarding
  if (usuarioProfile && !usuarioProfile.empresa_id) {
    return <Navigate to="/cadastro" replace />;
  }

  return (
    <NotificacaoRealtimeProvider>
      <Outlet />
    </NotificacaoRealtimeProvider>
  );
};

// Public Route Guard (redirect to dashboard if already logged in)
const PublicOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
        <div className="w-8 h-8 border-3 border-zinc-200 border-t-[#F5D800] rounded-full animate-spin mb-3" />
        <span className="text-xs font-medium text-zinc-600">Verificando autenticação...</span>
      </div>
    );
  }

  if (session) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Auth Routes */}
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />

          <Route path="/cadastro" element={<OnboardingWizard />} />

          {/* Protected Dashboard Routes */}
          <Route element={<ProtectedLayout />}>
            <Route path="/dashboard" element={<DashboardShell />}>
              <Route index element={<DashboardHome />} />
              <Route path="pdv" element={<PDVPage />} />
              <Route path="estoque" element={<EntradaNotaFiscalPage />} />
              <Route path="clientes" element={<ModulePlaceholderPage />} />
              <Route path="entregas" element={<EntregasModulePage />} />
              <Route path="financeiro" element={<FinanceiroModulePage />} />
              <Route path="inventario" element={<InventarioModulePage />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="suporte" element={<ChamadosPage />} />
              <Route path="importador" element={<ImportadorPage />} />
              <Route path="configuracoes" element={<ModulePlaceholderPage />} />
            </Route>
          </Route>

          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
