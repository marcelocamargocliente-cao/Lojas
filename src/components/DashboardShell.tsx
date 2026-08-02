import React, { useState } from 'react';
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
  UserCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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


  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const currentPath = location.pathname;

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

            {navigationItems.map((item) => {
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

          {/* Seletor de Filial no topo */}
          <div className="relative">
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

        {/* Dynamic page content */}
        <main className="p-6 flex-1 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
