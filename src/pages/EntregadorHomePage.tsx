import React, { useState, useEffect } from 'react';
import { Truck, Navigation, Phone, MapPin, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Calendar, Package } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Entrega, StatusEntrega } from '../types';
import { useAuth } from '../context/AuthContext';
import { ConfirmarEntregaModal } from '../components/ConfirmarEntregaModal';

export const EntregadorHomePage: React.FC = () => {
  const { user, empresa } = useAuth();

  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pendentes' | 'concluidas'>('pendentes');

  // Modal confirm state
  const [selectedEntrega, setSelectedEntrega] = useState<Entrega | null>(null);
  const [modalAction, setModalAction] = useState<
    'a_caminho' | 'entregue' | 'nao_entregue' | 'entregue_com_avaria' | null
  >(null);

  const fetchMinhasEntregas = async () => {
    setLoading(true);
    try {
      // Find entregas assigned to this entregador
      const { data: juncaoData } = await supabase
        .from('entrega_entregadores')
        .select('entrega_id')
        .eq('entregador_id', user?.id);

      const entregaIds = juncaoData?.map((j) => j.entrega_id) || [];

      if (entregaIds.length === 0) {
        setEntregas([]);
        setLoading(false);
        return;
      }

      const { data: entregasData } = await supabase
        .from('entregas')
        .select(`
          *,
          veiculo:veiculos(*),
          venda:vendas(
            *,
            cliente:clientes(*)
          )
        `)
        .in('id', entregaIds)
        .order('created_at', { ascending: false });

      if (entregasData) {
        setEntregas(entregasData as Entrega[]);
      }
    } catch (err) {
      console.error('Erro ao buscar minhas entregas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchMinhasEntregas();
    }
  }, [user?.id]);

  const abrirWaze = (endereco?: string) => {
    if (!endereco) {
      alert('Endereço de entrega não disponível.');
      return;
    }
    const url = `https://waze.com/ul?q=${encodeURIComponent(endereco)}&navigate=yes`;
    window.open(url, '_blank');
  };

  const pendentes = entregas.filter(
    (e) => e.status === 'atribuida' || e.status === 'a_caminho'
  );
  const concluidas = entregas.filter(
    (e) =>
      e.status === 'entregue' ||
      e.status === 'nao_entregue' ||
      e.status === 'entregue_com_avaria'
  );

  const listaExibicao = tab === 'pendentes' ? pendentes : concluidas;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E5E5]">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
            <Truck className="w-5 h-5 text-[#F5D800]" />
            Painel do Entregador
          </h1>
          <p className="text-xs text-zinc-600 mt-0.5">
            Suas entregas atribuídas para rota, navegação GPS e confirmação no local.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchMinhasEntregas}
          className="py-1.5 px-3 bg-white hover:bg-zinc-50 border border-[#E5E5E5] text-zinc-700 font-medium text-xs rounded-lg flex items-center gap-1.5 transition-colors self-start shrink-0 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Atualizar lista</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E5E5E5] gap-4">
        <button
          type="button"
          onClick={() => setTab('pendentes')}
          className={`pb-2.5 text-xs font-bold transition-colors cursor-pointer border-b-2 -mb-px ${
            tab === 'pendentes'
              ? 'border-[#F5D800] text-zinc-900'
              : 'border-transparent text-zinc-400 hover:text-zinc-600'
          }`}
        >
          Em Andamento ({pendentes.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('concluidas')}
          className={`pb-2.5 text-xs font-bold transition-colors cursor-pointer border-b-2 -mb-px ${
            tab === 'concluidas'
              ? 'border-[#F5D800] text-zinc-900'
              : 'border-transparent text-zinc-400 hover:text-zinc-600'
          }`}
        >
          Concluídas / Histórico ({concluidas.length})
        </button>
      </div>

      {/* Delivery Cards */}
      {loading ? (
        <div className="py-12 text-center text-xs text-zinc-500 space-y-2">
          <div className="w-6 h-6 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin mx-auto" />
          <p>Carregando entregas atribuídas...</p>
        </div>
      ) : listaExibicao.length === 0 ? (
        <div className="industrial-card p-12 text-center text-zinc-500 text-xs space-y-2">
          <Package className="w-8 h-8 text-zinc-300 mx-auto stroke-[1.5]" />
          <p className="font-semibold text-zinc-700">Nenhuma entrega nesta categoria.</p>
          <p className="text-[11px] text-zinc-400">
            {tab === 'pendentes'
              ? 'Você não possui rotas pendentes no momento.'
              : 'Nenhum histórico recente de entregas finalizadas.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {listaExibicao.map((entrega) => {
            const cliente = entrega.venda?.cliente;
            const endereco = cliente?.endereco;

            return (
              <div key={entrega.id} className="card-interativo p-5 space-y-4">
                {/* Header status */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E5E5E5]">
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                      Venda #{entrega.venda_id.substring(0, 8)}
                    </span>
                    <h3 className="text-sm font-bold text-zinc-900">
                      {cliente?.nome || 'Consumidor Final'}
                    </h3>
                  </div>

                  <div>
                    {entrega.status === 'atribuida' && (
                      <span className="px-2.5 py-1 text-[10px] font-bold bg-amber-100 text-amber-900 rounded border border-amber-300">
                        ROTA ATRIBUÍDA
                      </span>
                    )}
                    {entrega.status === 'a_caminho' && (
                      <span className="px-2.5 py-1 text-[10px] font-bold bg-blue-100 text-blue-900 rounded border border-blue-300 animate-pulse">
                        A CAMINHO DO LOCAL
                      </span>
                    )}
                    {entrega.status === 'entregue' && (
                      <span className="px-2.5 py-1 text-[10px] font-bold bg-green-100 text-green-900 rounded border border-green-300">
                        ENTREGUE
                      </span>
                    )}
                    {entrega.status === 'nao_entregue' && (
                      <span className="px-2.5 py-1 text-[10px] font-bold bg-red-100 text-red-900 rounded border border-red-300">
                        NÃO ENTREGUE
                      </span>
                    )}
                    {entrega.status === 'entregue_com_avaria' && (
                      <span className="px-2.5 py-1 text-[10px] font-bold bg-orange-100 text-orange-900 rounded border border-orange-300">
                        ENTREGUE COM AVARIA
                      </span>
                    )}
                  </div>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-zinc-50 border border-[#E5E5E5] rounded-lg space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-zinc-900">
                      <MapPin className="w-4 h-4 text-[#F5D800] shrink-0" />
                      <span>Endereço de Entrega:</span>
                    </div>
                    <p className="text-zinc-700 pl-5 leading-tight">
                      {endereco || 'Endereço não informado no cadastro.'}
                    </p>
                    {cliente?.cidade && (
                      <p className="text-zinc-500 text-[11px] pl-5">
                        {cliente.cidade} - {cliente.uf}
                      </p>
                    )}
                  </div>

                  <div className="p-3 bg-zinc-50 border border-[#E5E5E5] rounded-lg space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-zinc-900">
                      <Phone className="w-4 h-4 text-zinc-500 shrink-0" />
                      <span>Contato / Telefone:</span>
                    </div>
                    <p className="text-zinc-700 pl-5 font-mono">
                      {cliente?.telefone || 'Telefone não cadastrado'}
                    </p>

                    {entrega.veiculo && (
                      <p className="text-zinc-500 text-[11px] pl-5 pt-1">
                        Veículo: <strong className="text-zinc-900">{entrega.veiculo.placa}</strong> ({entrega.veiculo.modelo})
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => abrirWaze(endereco)}
                    className="py-2 px-3 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-lg flex items-center gap-2 cursor-pointer"
                  >
                    <Navigation className="w-4 h-4 text-[#F5D800]" />
                    <span>Navegar no Waze</span>
                  </button>

                  {tab === 'pendentes' && (
                    <div className="flex flex-wrap items-center gap-2">
                      {entrega.status === 'atribuida' && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedEntrega(entrega);
                            setModalAction('a_caminho');
                          }}
                          className="py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                        >
                          Iniciar Rota
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEntrega(entrega);
                          setModalAction('entregue');
                        }}
                        className="py-2 px-3 bg-[#F5D800] hover:bg-[#ebd000] text-zinc-950 font-bold text-xs rounded-lg border border-[#d2b800] flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Entregue</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEntrega(entrega);
                          setModalAction('entregue_com_avaria');
                        }}
                        className="py-2 px-3 bg-orange-100 hover:bg-orange-200 text-orange-900 font-bold text-xs rounded-lg border border-orange-300 flex items-center gap-1 cursor-pointer"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Avaria</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEntrega(entrega);
                          setModalAction('nao_entregue');
                        }}
                        className="py-2 px-3 bg-red-100 hover:bg-red-200 text-red-900 font-bold text-xs rounded-lg border border-red-300 flex items-center gap-1 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Não Entregue</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal */}
      {selectedEntrega && modalAction && (
        <ConfirmarEntregaModal
          entrega={selectedEntrega}
          tipoAcao={modalAction}
          onClose={() => {
            setSelectedEntrega(null);
            setModalAction(null);
          }}
          onSuccess={() => {
            setSelectedEntrega(null);
            setModalAction(null);
            fetchMinhasEntregas();
          }}
        />
      )}
    </div>
  );
};
