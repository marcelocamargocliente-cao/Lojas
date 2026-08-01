import React, { useState } from 'react';
import { Truck, Navigation, AlertTriangle, DollarSign, Wallet, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { GerenteEntregasPage } from './GerenteEntregasPage';
import { EntregadorHomePage } from './EntregadorHomePage';
import { VeiculosPage } from './VeiculosPage';
import { AvariaResolucaoPage } from './AvariaResolucaoPage';
import { ConfigComissaoPage } from './ConfigComissaoPage';
import { MeusGanhosPage } from './MeusGanhosPage';

export const EntregasModulePage: React.FC = () => {
  const { usuarioProfile } = useAuth();
  const isEntregador = usuarioProfile?.cargo === 'entregador';

  const [activeTab, setActiveTab] = useState<
    'painel' | 'minhas_rotas' | 'veiculos' | 'avarias' | 'config_comissao' | 'meus_ganhos'
  >(isEntregador ? 'minhas_rotas' : 'painel');

  return (
    <div className="space-y-6">
      {/* Sub-navigation bar inside Entregas module */}
      <div className="industrial-card p-1.5 flex flex-wrap gap-1 bg-white">
        {!isEntregador && (
          <button
            type="button"
            onClick={() => setActiveTab('painel')}
            className={`py-2 px-3 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'painel'
                ? 'bg-[#F5D800] text-zinc-950 border border-[#d2b800]'
                : 'text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Painel Geral</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveTab('minhas_rotas')}
          className={`py-2 px-3 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'minhas_rotas'
              ? 'bg-[#F5D800] text-zinc-950 border border-[#d2b800]'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
        >
          <Navigation className="w-4 h-4" />
          <span>Minhas Rotas</span>
        </button>

        {!isEntregador && (
          <>
            <button
              type="button"
              onClick={() => setActiveTab('veiculos')}
              className={`py-2 px-3 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'veiculos'
                  ? 'bg-[#F5D800] text-zinc-950 border border-[#d2b800]'
                  : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              <Truck className="w-4 h-4" />
              <span>Frota de Veículos</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('avarias')}
              className={`py-2 px-3 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'avarias'
                  ? 'bg-[#F5D800] text-zinc-950 border border-[#d2b800]'
                  : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              <span>Tratativa de Avarias</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('config_comissao')}
              className={`py-2 px-3 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'config_comissao'
                  ? 'bg-[#F5D800] text-zinc-950 border border-[#d2b800]'
                  : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Regras de Comissão</span>
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => setActiveTab('meus_ganhos')}
          className={`py-2 px-3 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'meus_ganhos'
              ? 'bg-[#F5D800] text-zinc-950 border border-[#d2b800]'
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
        >
          <Wallet className="w-4 h-4 text-green-700" />
          <span>Extrato de Ganhos</span>
        </button>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'painel' && (
          <GerenteEntregasPage onNavigate={(page: any) => setActiveTab(page)} />
        )}
        {activeTab === 'minhas_rotas' && <EntregadorHomePage />}
        {activeTab === 'veiculos' && <VeiculosPage />}
        {activeTab === 'avarias' && <AvariaResolucaoPage />}
        {activeTab === 'config_comissao' && <ConfigComissaoPage />}
        {activeTab === 'meus_ganhos' && <MeusGanhosPage />}
      </div>
    </div>
  );
};
