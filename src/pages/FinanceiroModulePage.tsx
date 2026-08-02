import React, { useState } from 'react';
import { 
  DollarSign, 
  Users, 
  FileCode2, 
  BarChart3, 
  Bell, 
  AlertTriangle 
} from 'lucide-react';
import { ContasPagarPage } from './ContasPagarPage';
import { PagamentosFuncionarioPage } from './PagamentosFuncionarioPage';
import { EntradaNotaFiscalPage } from './EntradaNotaFiscalPage';
import { BalancoMensalPage } from './BalancoMensalPage';
import { AlertaVencimentoModal } from '../components/AlertaVencimentoModal';

export const FinanceiroModulePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'contas' | 'pagamentos' | 'xml' | 'balanco'>('contas');
  const [alertasModalOpen, setAlertasModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Module Header with Notification Bell */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-[#E5E5E5] shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#F5D800] text-black flex items-center justify-center font-bold border border-[#d2b800] shrink-0">
            <DollarSign className="w-6 h-6 stroke-[2]" />
          </div>
          <div>
            <h1 className="text-base font-bold text-zinc-900">Módulo Financeiro</h1>
            <p className="text-xs text-zinc-500">
              Controle de contas a pagar, pagamentos de equipe, entrada de NF-e e balanço financeiro
            </p>
          </div>
        </div>

        {/* Notification Bell Button for Alert Pop-up */}
        <button
          type="button"
          onClick={() => setAlertasModalOpen(true)}
          className="relative px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shadow-2xs"
        >
          <Bell className="w-4 h-4 text-red-600 animate-bounce" />
          <span className="hidden sm:inline">Alertas de Vencimento</span>
          <span className="w-2 h-2 rounded-full bg-red-600 absolute top-1 right-1" />
        </button>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-1 border-b border-[#E5E5E5] overflow-x-auto pb-0.5">
        <button
          type="button"
          onClick={() => setActiveTab('contas')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'contas'
              ? 'border-zinc-950 text-zinc-950 bg-white rounded-t-lg'
              : 'border-transparent text-zinc-500 hover:text-zinc-800'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Contas a Pagar</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('pagamentos')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'pagamentos'
              ? 'border-zinc-950 text-zinc-950 bg-white rounded-t-lg'
              : 'border-transparent text-zinc-500 hover:text-zinc-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Pagamentos Equipe</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('xml')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'xml'
              ? 'border-zinc-950 text-zinc-950 bg-white rounded-t-lg'
              : 'border-transparent text-zinc-500 hover:text-zinc-800'
          }`}
        >
          <FileCode2 className="w-4 h-4" />
          <span>Entrada de Mercadoria</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('balanco')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'balanco'
              ? 'border-zinc-950 text-zinc-950 bg-white rounded-t-lg'
              : 'border-transparent text-zinc-500 hover:text-zinc-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Balanço Mensal</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="pt-2">
        {activeTab === 'contas' && <ContasPagarPage />}
        {activeTab === 'pagamentos' && <PagamentosFuncionarioPage />}
        {activeTab === 'xml' && <EntradaNotaFiscalPage />}
        {activeTab === 'balanco' && <BalancoMensalPage />}
      </div>

      {/* Alerta de Vencimento Pop-up Modal */}
      <AlertaVencimentoModal
        isOpen={alertasModalOpen}
        onClose={() => setAlertasModalOpen(false)}
      />
    </div>
  );
};
