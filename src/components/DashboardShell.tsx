import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import {
  Building2,
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  Truck,
  DollarSign,
  Boxes,
  MessageSquare,
  HelpCircle,
  FileSpreadsheet,
  Settings,
  LogOut,
  ChevronDown,
  Store,
  Menu,
  X,
  UserCheck,
  Lock,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Unlock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useClickOutside } from '../hooks/useClickOutside';
import { supabase } from '../lib/supabaseClient';
import { Usuario } from '../types';

export const DashboardShell: React.FC = () => {
  const { 
    usuarioProfile, 
    empresa, 
    filiais, 
    selectedFilial, 
    setSelectedFilial, 
    signOut,
    user
  } = useAuth();
  
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [filialDropdownOpen, setFilialDropdownOpen] = useState(false);

  // Filial selector ref & hook
  const filialDropdownRef = useRef<HTMLDivElement>(null);
  useClickOutside(filialDropdownRef, () => setFilialDropdownOpen(false), filialDropdownOpen);

  // Vendedor restriction and manager unlock state
  const isVendedor = usuarioProfile?.cargo === 'vendedor';
  const [unlockedManagerAccess, setUnlockedManagerAccess] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);

  // Unlock modal form fields
  const [gerentesList, setGerentesList] = useState<Usuario[]>([]);
  const [unlockEmail, setUnlockEmail] = useState('');
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlockLoading, setUnlockLoading] = useState(false);

  // Fetch managers for unlock dropdown
  useEffect(() => {
    async function loadGerentes() {
      if (empresa?.id) {
        const { data } = await supabase
          .from('usuarios')
          .select('*')
          .eq('empresa_id', empresa.id)
          .in('cargo', ['admin', 'super_admin', 'gerente']);

        if (data && data.length > 0) {
          setGerentesList(data as Usuario[]);
          setUnlockEmail(data[0].email);
        }
      }
    }
    loadGerentes();
  }, [empresa?.id]);

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError(null);

    if (!unlockEmail || !unlockPassword) {
      setUnlockError('Informe o e-mail e a senha do Gerente.');
      return;
    }

    setUnlockLoading(true);
    try {
      const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: unlockEmail.trim(),
        password: unlockPassword,
      });

      if (authErr || !authData.user) {
        setUnlockError('Senha ou e-mail de gerente incorretos.');
        setUnlockLoading(false);
        return;
      }

      // Verify manager role
      const { data: managerProfile } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();

      const cargo = (managerProfile as Usuario)?.cargo;
      if (!['admin', 'super_admin', 'gerente'].includes(cargo || '')) {
        setUnlockError('O usuário informado não possui perfil de Gerente ou Administrador.');
        setUnlockLoading(false);
        return;
      }

      // Record in audit log
      try {
        await supabase.from('logs_auditoria').insert([
          {
            empresa_id: empresa?.id || null,
            usuario_id: usuarioProfile?.id || user?.id,
            usuario_nome: usuarioProfile?.nome || user?.email,
            acao: 'Desbloqueio Temporario Acesso Gerencial',
            detalhes: `Acesso a Visão Geral / Financeiro liberado pelo gerente ${
              managerProfile?.nome || unlockEmail
            }`,
            created_at: new Date().toISOString(),
          },
        ]);
      } catch (auditErr) {
        console.warn('Registro de auditoria:', auditErr);
      }

      setUnlockedManagerAccess(true);
      setShowUnlockModal(false);
      setUnlockPassword('');
      setUnlockError(null);
    } catch (err: any) {
      setUnlockError(err?.message || 'Erro ao reautenticar gerente.');
    } finally {
      setUnlockLoading(false);
    }
  };

  const navigationItems = [
    { label: 'Visão geral', path: '/dashboard', icon: LayoutDashboard },
    { label: 'PDV', path: '/dashboard/pdv', icon: ShoppingCart },
    { label: 'Estoque', path: '/dashboard/estoque', icon: Package },
    { label: 'Clientes', path: '/dashboard/clientes', icon: Users },
    { label: 'Entregas', path: '/dashboard/entregas', icon: Truck },
    { label: 'Financeiro', path: '/dashboard/financeiro', icon: DollarSign },
    { label: 'Inventário', path: '/dashboard/inventario', icon: Boxes },
    { label: 'Chat interno', path: '/dashboard/chat', icon: MessageSquare },
    { label: 'Suporte', path: '/dashboard/suporte', icon: HelpCircle },
    { label: 'Importador', path: '/dashboard/importador', icon: FileSpreadsheet },
    { label: 'Configurações', path: '/dashboard/configuracoes', icon: Settings },
  ];

  // Filter out restricted items for Vendedor unless temporarily unlocked
  const visibleNavigationItems = navigationItems.filter((item) => {
    if (isVendedor && !unlockedManagerAccess) {
      if (item.path === '/dashboard' || item.path === '/dashboard/financeiro') {
        return false;
      }
    }
    return true;
  });

  const currentPath = location.pathname;

  // Check if current page is restricted for Vendedor
  const isRestrictedPathForVendedor =
    isVendedor &&
    !unlockedManagerAccess &&
    (currentPath === '/dashboard' || currentPath === '/dashboard/financeiro');


  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  // Format user role for display
  const formatCargo = (cargo?: string) => {
    if (!cargo) return 'Usuário';
    const MapCargo: Record<string, string> = {
      super_admin: 'Super admin',
      admin: 'Administrador',
      gerente: 'Gerente',
      vendedor: 'Vendedor',
      caixa: 'Caixa',
      estoquista: 'Estoquista',
      financeiro: 'Financeiro',
      comprador: 'Comprador',
      entregador: 'Entregador',
    };
    return MapCargo[cargo] || cargo;
  };

  return (
    <div className="min-h-screen bg-zinc-50/60 flex flex-col md:flex-row text-zinc-900">
      {/* Mobile Top Header */}
      <div className="md:hidden bg-white border-b border-[#E5E5E5] px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#F5D800] text-black flex items-center justify-center font-bold border border-[#E5E5E5]">
            <Building2 className="w-5 h-5" />
          </div>
          <span className="font-semibold text-sm text-zinc-900 truncate max-w-[180px]">
            {empresa?.nome || 'Gestão de Loja'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-zinc-600 hover:text-zinc-900 border border-[#E5E5E5] rounded-lg bg-white"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar navigation */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-white border-r border-[#E5E5E5] flex flex-col justify-between z-40 transition-transform duration-200 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div>
          {/* Brand header */}
          <div className="p-5 border-b border-[#E5E5E5] flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#F5D800] text-black flex items-center justify-center border border-[#E5E5E5] shrink-0">
              <Building2 className="w-5 h-5 stroke-[1.75]" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-sm text-zinc-900 leading-tight truncate">
                {empresa?.nome || 'Minha Loja'}
              </h2>
              <p className="text-xs text-zinc-500 truncate">
                CNPJ: {empresa?.cnpj || 'Não informado'}
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            <div className="px-3 py-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Módulos de gestão
            </div>

            {visibleNavigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPath === item.path || (item.path !== '/dashboard' && currentPath.startsWith(item.path));

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-[#F5D800] text-zinc-950 font-semibold border border-[#d2b800]'
                      : 'text-zinc-700 hover:bg-zinc-100/80 hover:text-zinc-900'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-zinc-950' : 'text-zinc-500'}`} />
                  <span className="truncate">{item.label}</span>
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-zinc-950" />
                  )}
                </Link>
              );
            })}

            {/* Special Vendedor Unlock Button in Sidebar */}
            {isVendedor && !unlockedManagerAccess && (
              <button
                type="button"
                onClick={() => setShowUnlockModal(true)}
                className="w-full mt-3 p-2.5 bg-amber-50 hover:bg-amber-100/80 text-amber-950 border border-amber-300 rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors shadow-2xs"
              >
                <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                <span className="truncate text-left">Solicitar Acesso Gerencial</span>
              </button>
            )}

            {isVendedor && unlockedManagerAccess && (
              <div className="mt-3 p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] font-semibold text-emerald-800 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Acesso Gerencial Ativo</span>
              </div>
            )}
          </nav>
        </div>

        {/* User profile footer */}
        <div className="p-4 border-t border-[#E5E5E5] bg-zinc-50/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-zinc-200 border border-[#E5E5E5] flex items-center justify-center text-xs font-semibold text-zinc-700 shrink-0">
                <UserCheck className="w-4 h-4 text-zinc-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-zinc-900 truncate">
                  {usuarioProfile?.nome || user?.email?.split('@')[0] || 'Usuário'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] font-medium bg-[#F5D800] text-zinc-900 px-1.5 py-0.5 rounded border border-[#d2b800]">
                    {formatCargo(usuarioProfile?.cargo)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full py-1.5 px-2.5 border border-[#E5E5E5] bg-white hover:bg-zinc-100 rounded-lg text-xs text-zinc-700 font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-zinc-500" />
            <span>Sair do sistema</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="bg-white border-b border-[#E5E5E5] px-6 py-3.5 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold text-zinc-900 hidden sm:block">
              Painel de controle de loja
            </h1>
          </div>

          {/* Seletor de Filial no topo com useClickOutside */}
          <div className="relative" ref={filialDropdownRef}>
            <button
              type="button"
              onClick={() => setFilialDropdownOpen(!filialDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-[#E5E5E5] hover:border-zinc-400 rounded-lg text-xs font-medium text-zinc-800 transition-colors shadow-2xs cursor-pointer"
            >
              <Store className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-zinc-500 font-normal">Filial:</span>
              <span className="font-semibold text-zinc-900">
                {selectedFilial?.nome || (filiais.length > 0 ? filiais[0].nome : 'Matriz')}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-zinc-400 ml-1" />
            </button>

            {filialDropdownOpen && (
              <div className="absolute right-0 mt-1 w-56 bg-white border border-[#E5E5E5] rounded-lg shadow-lg z-50 py-1 text-xs">
                <div className="px-3 py-1.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider border-b border-[#E5E5E5]">
                  Selecionar filial ativa
                </div>
                {filiais.length > 0 ? (
                  filiais.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        setSelectedFilial(f);
                        setFilialDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-zinc-50 ${
                        selectedFilial?.id === f.id ? 'font-semibold text-zinc-900 bg-amber-50/50' : 'text-zinc-700'
                      }`}
                    >
                      <span className="truncate">{f.nome}</span>
                      {selectedFilial?.id === f.id && (
                        <div className="w-2 h-2 rounded-full bg-[#F5D800]" />
                      )}
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-zinc-500 italic">
                    Filial Matriz (padrão)
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Dynamic page content or Restricted View */}
        <main className="p-6 flex-1 max-w-7xl w-full mx-auto">
          {isRestrictedPathForVendedor ? (
            <div className="max-w-xl mx-auto my-12 p-8 bg-white border border-[#E5E5E5] rounded-2xl shadow-sm text-center space-y-5">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 border border-amber-200 text-amber-800 flex items-center justify-center mx-auto">
                <Lock className="w-7 h-7 stroke-[2]" />
              </div>

              <div>
                <h2 className="text-lg font-bold text-zinc-900">
                  Acesso Restrito ao Perfil Vendedor
                </h2>
                <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
                  As abas <span className="font-semibold text-zinc-900">Visão Geral</span> e{' '}
                  <span className="font-semibold text-zinc-900">Financeiro</span> são restritas a
                  Gerentes e Administradores. Para visualizar este conteúdo temporariamente, solicite
                  o desbloqueio por senha de um Gerente.
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/pdv')}
                  className="w-full sm:w-auto px-4 py-2 border border-[#E5E5E5] hover:bg-zinc-100 rounded-lg text-xs font-semibold text-zinc-700 cursor-pointer"
                >
                  Ir para o PDV
                </button>

                <button
                  type="button"
                  onClick={() => setShowUnlockModal(true)}
                  className="w-full sm:w-auto px-5 py-2.5 bg-[#F5D800] hover:bg-[#ebd000] text-zinc-950 font-bold rounded-lg border border-[#d2b800] text-xs flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                >
                  <Unlock className="w-4 h-4" />
                  <span>Solicitar Acesso do Gerente</span>
                </button>
              </div>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>

      {/* Reauthentication Modal for Temporary Manager Unlock */}
      {showUnlockModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#E5E5E5] rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 bg-zinc-900 text-white flex items-center justify-between border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#F5D800] text-zinc-950 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Desbloqueio de Acesso Gerencial</h3>
                  <p className="text-[11px] text-zinc-400">
                    Autorização temporária de sessão para Vendedor
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowUnlockModal(false);
                  setUnlockError(null);
                }}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUnlockSubmit} className="p-5 space-y-4">
              <p className="text-xs text-zinc-600">
                Selecione ou digite as credenciais de um <span className="font-semibold text-zinc-900">Gerente ou Administrador</span> para liberar a visualização do Financeiro e Visão Geral nesta sessão.
              </p>

              {unlockError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{unlockError}</span>
                </div>
              )}

              {/* Manager email selection */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Gerente / Admin Autorizador
                </label>
                {gerentesList.length > 0 ? (
                  <select
                    value={unlockEmail}
                    onChange={(e) => setUnlockEmail(e.target.value)}
                    className="w-full p-2.5 bg-white border border-[#E5E5E5] rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-zinc-900"
                  >
                    {gerentesList.map((g) => (
                      <option key={g.id} value={g.email}>
                        {g.nome} ({g.email})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="email"
                    required
                    value={unlockEmail}
                    onChange={(e) => setUnlockEmail(e.target.value)}
                    placeholder="gerente@empresa.com"
                    className="w-full p-2.5 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Senha do Gerente / Admin
                </label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={unlockPassword}
                  onChange={(e) => setUnlockPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full p-2.5 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E5E5]">
                <button
                  type="button"
                  onClick={() => {
                    setShowUnlockModal(false);
                    setUnlockError(null);
                  }}
                  className="px-4 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-900 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={unlockLoading}
                  className="px-4 py-2 bg-[#F5D800] hover:bg-[#ebd000] text-zinc-950 font-bold text-xs rounded-lg border border-[#d2b800] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {unlockLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Autenticando...</span>
                    </>
                  ) : (
                    <span>Confirmar e Liberar</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
