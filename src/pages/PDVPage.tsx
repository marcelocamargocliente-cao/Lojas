import React, { useState } from 'react';
import { 
  ShoppingCart, 
  UserCheck, 
  RotateCcw, 
  Trash2, 
  ArrowRight, 
  CheckCircle2, 
  Store,
  CreditCard,
  Building2,
  PackageCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { CartItem, Cliente } from '../types';
import { ClienteBusca } from '../components/ClienteBusca';
import { ClienteStatusModal } from '../components/ClienteStatusModal';
import { CarrinhoVenda } from '../components/CarrinhoVenda';
import { FinalizarVendaModal } from '../components/FinalizarVendaModal';
import { DevolucaoPage } from './DevolucaoPage';

export const PDVPage: React.FC = () => {
  const { usuarioProfile, user, selectedFilial, filiais } = useAuth();

  const [activeTab, setActiveTab] = useState<'venda' | 'devolucao'>('venda');

  // Customer state
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [showClienteStatusModal, setShowClienteStatusModal] = useState(false);

  // Cart state
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // Modal checkout state
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  // When a customer is picked from search
  const handleSelectClienteFromSearch = (cliente: Cliente | null) => {
    setSelectedCliente(cliente);
    if (cliente) {
      setShowClienteStatusModal(true);
    } else {
      setShowClienteStatusModal(false);
    }
  };

  const handleClearCart = () => {
    if (cartItems.length > 0 && confirm('Deseja realmente limpar todos os itens do carrinho?')) {
      setCartItems([]);
    }
  };

  const handleVendaConcluida = () => {
    setCartItems([]);
    setSelectedCliente(null);
    setShowCheckoutModal(false);
    setShowClienteStatusModal(false);
  };

  const totalVenda = cartItems.reduce((acc, item) => acc + item.subtotal, 0);

  // Format user role
  const formatCargo = (cargo?: string) => {
    if (!cargo) return 'Operador';
    const MapCargo: Record<string, string> = {
      super_admin: 'Super Admin',
      admin: 'Administrador',
      gerente: 'Gerente',
      vendedor: 'Vendedor',
      caixa: 'Operador de Caixa',
      estoquista: 'Estoquista',
      financeiro: 'Financeiro',
    };
    return MapCargo[cargo] || cargo;
  };

  return (
    <div className="space-y-6">
      {/* Top POS Header Bar */}
      <div className="bg-white border border-[#E5E5E5] rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#F5D800] text-black flex items-center justify-center font-bold border border-[#d2b800] shrink-0">
            <ShoppingCart className="w-5 h-5 stroke-[2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-zinc-900">
                Ponto de Venda — Balcão
              </h1>
              <span className="text-[10px] font-bold bg-zinc-900 text-[#F5D800] px-2 py-0.5 rounded">
                PDV ATIVO
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Filial: <span className="font-semibold text-zinc-800">{selectedFilial?.nome || 'Matriz'}</span>
            </p>
          </div>
        </div>

        {/* View mode tabs & Logged operator badge */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Tabs */}
          <div className="flex items-center bg-zinc-100 p-1 rounded-lg border border-[#E5E5E5]">
            <button
              type="button"
              onClick={() => setActiveTab('venda')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                activeTab === 'venda'
                  ? 'bg-white text-zinc-950 shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Venda no Balcão
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('devolucao')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                activeTab === 'devolucao'
                  ? 'bg-white text-zinc-950 shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Devoluções & Trocas
            </button>
          </div>

          {/* User badge */}
          <div className="px-3 py-1.5 bg-zinc-50 border border-[#E5E5E5] rounded-lg flex items-center gap-2 text-xs">
            <UserCheck className="w-4 h-4 text-zinc-600" />
            <div>
              <span className="font-semibold text-zinc-900 block leading-tight">
                {usuarioProfile?.nome || user?.email?.split('@')[0] || 'Vendedor'}
              </span>
              <span className="text-[10px] text-zinc-500 font-medium">
                {formatCargo(usuarioProfile?.cargo)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Mode 1: Main POS Sale Screen */}
      {activeTab === 'venda' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Left Section: Customer Search & Cart */}
          <div className="lg:col-span-2 space-y-5">
            {/* Unified Customer Search Component */}
            <div className="industrial-card p-4">
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-2">
                Identificação do Cliente
              </label>
              <ClienteBusca
                selectedCliente={selectedCliente}
                onSelectCliente={handleSelectClienteFromSearch}
              />
            </div>

            {/* Cart & Items Component */}
            <CarrinhoVenda
              items={cartItems}
              selectedFilial={selectedFilial}
              filiais={filiais}
              onUpdateItems={(newItems) => setCartItems(newItems)}
            />
          </div>

          {/* Right Section: Order Summary & Checkout Actions */}
          <div className="space-y-5">
            <div className="industrial-card p-5 space-y-4">
              <h2 className="text-xs font-bold text-zinc-900 uppercase tracking-wider pb-2 border-b border-[#E5E5E5]">
                Resumo da Venda
              </h2>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-zinc-600">
                  <span>Itens adicionados:</span>
                  <span className="font-semibold text-zinc-900">{cartItems.length}</span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>Cliente selecionado:</span>
                  <span className="font-semibold text-zinc-900 truncate max-w-[150px]">
                    {selectedCliente?.nome || 'Consumidor final'}
                  </span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>Filial da operação:</span>
                  <span className="font-semibold text-zinc-900">
                    {selectedFilial?.nome || 'Matriz'}
                  </span>
                </div>
              </div>

              {/* Big Total Box */}
              <div className="p-4 bg-zinc-900 rounded-lg text-white space-y-1">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                  Subtotal a Pagar
                </span>
                <span className="text-2xl font-black text-[#F5D800] block tracking-tight">
                  R$ {totalVenda.toFixed(2)}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  disabled={cartItems.length === 0}
                  onClick={() => setShowCheckoutModal(true)}
                  className="w-full py-3 px-4 bg-[#F5D800] hover:bg-[#ebd000] text-zinc-950 font-black text-sm rounded-lg border border-[#d2b800] flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <span>Finalizar venda (F9)</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </button>

                <button
                  type="button"
                  disabled={cartItems.length === 0}
                  onClick={handleClearCart}
                  className="w-full py-2 px-3 border border-[#E5E5E5] bg-white hover:bg-zinc-50 text-zinc-700 font-medium text-xs rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Limpar carrinho</span>
                </button>
              </div>
            </div>

            {/* Quick Tips Box */}
            <div className="p-4 bg-zinc-50 border border-[#E5E5E5] rounded-lg text-xs space-y-1 text-zinc-600">
              <span className="font-bold text-zinc-900 block mb-1">
                💡 Dicas de Balcão:
              </span>
              <p>• Suporta fracionamento decimal para metros e quilos.</p>
              <p>• O fiado exige aprovação e senha de Gerente.</p>
              <p>• A baixa de estoque é registrada no ato da venda.</p>
            </div>
          </div>
        </div>
      ) : (
        /* Mode 2: Devolution & Exchange View */
        <DevolucaoPage />
      )}

      {/* Customer Status Modal (Fired automatically on selection) */}
      {showClienteStatusModal && selectedCliente && (
        <ClienteStatusModal
          cliente={selectedCliente}
          onClose={() => setShowClienteStatusModal(false)}
          onConfirmProceed={() => setShowClienteStatusModal(false)}
          onCancelSelection={() => {
            setSelectedCliente(null);
            setShowClienteStatusModal(false);
          }}
        />
      )}

      {/* Checkout Modal */}
      {showCheckoutModal && (
        <FinalizarVendaModal
          items={cartItems}
          cliente={selectedCliente}
          selectedFilial={selectedFilial}
          onClose={() => setShowCheckoutModal(false)}
          onVendaConcluida={handleVendaConcluida}
        />
      )}
    </div>
  );
};
