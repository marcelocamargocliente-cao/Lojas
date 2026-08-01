import React from 'react';
import { 
  Building2, 
  TrendingUp, 
  AlertTriangle, 
  Truck, 
  BookOpen, 
  Calendar, 
  Clock, 
  Store, 
  ArrowUpRight, 
  Sparkles,
  Info
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const DashboardHome: React.FC = () => {
  const { usuarioProfile, empresa, selectedFilial, user } = useAuth();

  // Calculate trial days remaining
  const calculateRemainingDays = (): number => {
    if (!empresa?.trial_fim) return 7;
    const trialDate = new Date(empresa.trial_fim);
    const today = new Date();
    const diffTime = trialDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const remainingDays = calculateRemainingDays();
  const isUrgentTrial = remainingDays <= 2;

  const nomeExibicao = usuarioProfile?.nome || user?.email?.split('@')[0] || 'Gestor';
  const nomeEmpresaExibicao = empresa?.nome || 'Minha Loja';
  const nomeFilialExibicao = selectedFilial?.nome || 'Matriz';

  return (
    <div className="space-y-6">
      {/* Top Greeting & Trial Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 border border-[#E5E5E5] rounded-lg shadow-2xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 mb-1">
            <Store className="w-3.5 h-3.5 text-zinc-400" />
            <span>{nomeEmpresaExibicao}</span>
            <span>•</span>
            <span className="text-zinc-700 font-medium">Filial {nomeFilialExibicao}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Olá, {nomeExibicao}
          </h1>
          <p className="text-xs text-zinc-600 mt-1">
            Acompanhe em tempo real os principais indicadores da sua loja de materiais de construção.
          </p>
        </div>

        {/* Trial status indicator badge */}
        <div
          className={`p-4 rounded-lg border flex items-center gap-3 transition-all ${
            isUrgentTrial
              ? 'bg-[#F5D800] border-[#d2b800] text-zinc-950 font-medium shadow-xs'
              : 'bg-zinc-50 border-[#E5E5E5] text-zinc-800'
          }`}
        >
          <Clock className={`w-5 h-5 shrink-0 ${isUrgentTrial ? 'text-zinc-950' : 'text-zinc-600'}`} />
          <div className="text-xs">
            <p className="font-semibold text-xs leading-tight">
              {remainingDays > 0
                ? `Seu trial termina em ${remainingDays} ${remainingDays === 1 ? 'dia' : 'dias'}`
                : 'Seu período de trial expirou'}
            </p>
            <p className="text-[11px] opacity-80 mt-0.5">
              {isUrgentTrial
                ? 'Aproveite para garantir a assinatura do plano'
                : 'Acesso completo a todas as ferramentas liberado'}
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Indicadores de hoje
          </h2>
          <span className="text-[11px] text-zinc-500">
            Atualizado automaticamente
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Vendas hoje */}
          <div className="industrial-card p-5 relative overflow-hidden group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-zinc-600">Vendas hoje</span>
              <div className="w-8 h-8 rounded-lg bg-zinc-100 border border-[#E5E5E5] flex items-center justify-center text-zinc-700">
                <TrendingUp className="w-4 h-4 text-zinc-700" />
              </div>
            </div>
            <div className="text-2xl font-bold tracking-tight text-zinc-900">
              R$ 0,00
            </div>
            <div className="mt-2 flex items-center text-[11px] text-zinc-500 gap-1">
              <span>0 caixas abertos no momento</span>
            </div>
            <div className="absolute top-0 right-0 w-1 h-full bg-[#F5D800]" />
          </div>

          {/* Card 2: Estoque baixo */}
          <div className="industrial-card p-5 relative overflow-hidden group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-zinc-600">Estoque baixo</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              </div>
            </div>
            <div className="text-2xl font-bold tracking-tight text-zinc-900">
              0 <span className="text-sm font-normal text-zinc-500">itens</span>
            </div>
            <div className="mt-2 flex items-center text-[11px] text-zinc-500 gap-1">
              <span>Abaixo do ponto de reposição</span>
            </div>
          </div>

          {/* Card 3: Entregas pendentes */}
          <div className="industrial-card p-5 relative overflow-hidden group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-zinc-600">Entregas pendentes</span>
              <div className="w-8 h-8 rounded-lg bg-zinc-100 border border-[#E5E5E5] flex items-center justify-center text-zinc-700">
                <Truck className="w-4 h-4 text-zinc-700" />
              </div>
            </div>
            <div className="text-2xl font-bold tracking-tight text-zinc-900">
              0 <span className="text-sm font-normal text-zinc-500">entregas</span>
            </div>
            <div className="mt-2 flex items-center text-[11px] text-zinc-500 gap-1">
              <span>Logística de frete do dia</span>
            </div>
          </div>

          {/* Card 4: Fiado em aberto */}
          <div className="industrial-card p-5 relative overflow-hidden group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-zinc-600">Fiado em aberto</span>
              <div className="w-8 h-8 rounded-lg bg-zinc-100 border border-[#E5E5E5] flex items-center justify-center text-zinc-700">
                <BookOpen className="w-4 h-4 text-zinc-700" />
              </div>
            </div>
            <div className="text-2xl font-bold tracking-tight text-zinc-900">
              R$ 0,00
            </div>
            <div className="mt-2 flex items-center text-[11px] text-zinc-500 gap-1">
              <span>Contas a receber de clientes</span>
            </div>
          </div>
        </div>
      </div>

      {/* Industrial status notice & operational summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status of initial catalog */}
        <div className="lg:col-span-2 industrial-card p-6">
          <div className="flex items-center justify-between pb-4 border-b border-[#E5E5E5] mb-4">
            <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#F5D800]" />
              Estrutura corporativa e dados
            </h3>
            <span className="text-[11px] font-medium bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded border border-[#E5E5E5]">
              Multi-filial ativo
            </span>
          </div>

          <p className="text-xs text-zinc-600 leading-relaxed mb-4">
            Sua empresa está cadastrada e vinculada à filial <span className="font-semibold text-zinc-900">{nomeFilialExibicao}</span>. Todos os acessos e permissões são isolados via Row Level Security (RLS) diretamente no banco de dados.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-zinc-50 border border-[#E5E5E5] rounded-lg">
              <div className="font-medium text-zinc-900 mb-0.5">Empresa atrelada</div>
              <div className="text-zinc-600">{nomeEmpresaExibicao}</div>
            </div>
            <div className="p-3 bg-zinc-50 border border-[#E5E5E5] rounded-lg">
              <div className="font-medium text-zinc-900 mb-0.5">CNPJ cadastrado</div>
              <div className="text-zinc-600">{empresa?.cnpj || 'Não cadastrado'}</div>
            </div>
            <div className="p-3 bg-zinc-50 border border-[#E5E5E5] rounded-lg">
              <div className="font-medium text-zinc-900 mb-0.5">Filiais vinculadas</div>
              <div className="text-zinc-600">1 filial cadastrada no momento</div>
            </div>
            <div className="p-3 bg-zinc-50 border border-[#E5E5E5] rounded-lg">
              <div className="font-medium text-zinc-900 mb-0.5">Segurança RLS</div>
              <div className="text-green-700 font-medium">Filtro por empresa ativo</div>
            </div>
          </div>
        </div>

        {/* Quick Info / Next modules */}
        <div className="industrial-card p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 mb-3 flex items-center gap-2">
              <Info className="w-4 h-4 text-zinc-500" />
              Módulos do sistema
            </h3>
            <p className="text-xs text-zinc-600 leading-relaxed mb-4">
              Acesse a barra lateral para navegar entre os módulos de PDV, Estoque, Clientes, Entregas, Financeiro, Inventário, Chat e Configurações.
            </p>
          </div>

          <div className="pt-4 border-t border-[#E5E5E5]">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>Versão do sistema</span>
              <span className="font-mono font-medium text-zinc-900">v1.0.0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
