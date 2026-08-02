import React, { useState, useEffect } from 'react';
import { Truck, AlertTriangle, CheckCircle2, Clock, MapPin, Users, Settings, Plus, RefreshCw, Filter, Eye, Navigation } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Entrega, StatusEntrega } from '../types';
import { useAuth } from '../context/AuthContext';
import { AtribuirEntregaModal } from '../components/AtribuirEntregaModal';

export const GerenteEntregasPage: React.FC<{ onNavigate?: (page: string) => void }> = ({
  onNavigate,
}) => {
  const { empresa } = useAuth();

  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');

  // Modal Atribuir State
  const [vendaParaAtribuir, setVendaParaAtribuir] = useState<any | null>(null);

  // Photos detail modal
  const [entregaDetalhe, setEntregaDetalhe] = useState<Entrega | null>(null);

  const fetchTodasEntregas = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('entregas')
        .select(`
          *,
          veiculo:veiculos(*),
          venda:vendas(
            *,
            cliente:clientes(*)
          ),
          entrega_entregadores(
            *,
            entregador:usuarios(*)
          ),
          entrega_fotos(*),
          entrega_avaria(*),
          entrega_nao_entrega(*)
        `)
        .order('created_at', { ascending: false });

      if (empresa?.id) {
        query = query.eq('empresa_id', empresa.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data) {
        setEntregas(data as Entrega[]);
      }
    } catch (err) {
      console.error('Erro ao buscar entregas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodasEntregas();
  }, [empresa?.id]);

  const entregasFiltradas = entregas.filter((e) => {
    if (filtroStatus === 'todos') return true;
    return e.status === filtroStatus;
  });

  // KPIs
  const totalEntregas = entregas.length;
  const emRota = entregas.filter((e) => e.status === 'a_caminho').length;
  const concluidas = entregas.filter((e) => e.status === 'entregue').length;
  const avarias = entregas.filter((e) => e.status === 'entregue_com_avaria').length;
  const naoEntregues = entregas.filter((e) => e.status === 'nao_entregue').length;

  return (
    <div className="space-y-6">
      {/* Header & Quick Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E5E5E5]">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
            <Truck className="w-5 h-5 text-[#F5D800]" />
            Painel Geral de Entregas & Logística
          </h1>
          <p className="text-xs text-zinc-600 mt-0.5">
            Monitoramento em tempo real de frotas, entregadores em rota e ocorrências do dia.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {onNavigate && (
            <>
              <button
                type="button"
                onClick={() => onNavigate('veiculos')}
                className="py-1.5 px-3 bg-white hover:bg-zinc-50 border border-[#E5E5E5] text-zinc-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Frota de Veículos
              </button>
              <button
                type="button"
                onClick={() => onNavigate('avarias')}
                className="py-1.5 px-3 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Ocorrências ({avarias})</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('config_comissao')}
                className="py-1.5 px-3 bg-white hover:bg-zinc-50 border border-[#E5E5E5] text-zinc-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
              >
                <Settings className="w-3.5 h-3.5 text-zinc-500" />
                <span>Comissões</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={fetchTodasEntregas}
            className="p-1.5 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Atualizar dados"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div 
          onClick={() => setFiltroStatus('todos')}
          className={`card-interativo p-3.5 space-y-1 ${filtroStatus === 'todos' ? 'card-selected' : ''}`}
        >
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
            Total Entregas
          </span>
          <span className="text-xl font-bold font-mono text-zinc-900 block">
            {totalEntregas}
          </span>
        </div>

        <div 
          onClick={() => setFiltroStatus('a_caminho')}
          className={`card-interativo p-3.5 space-y-1 bg-blue-50/50 border-blue-200 ${filtroStatus === 'a_caminho' ? 'card-selected' : ''}`}
        >
          <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">
            Em Rota
          </span>
          <span className="text-xl font-bold font-mono text-blue-900 block">
            {emRota}
          </span>
        </div>

        <div 
          onClick={() => setFiltroStatus('entregue')}
          className={`card-interativo p-3.5 space-y-1 bg-green-50/50 border-green-200 ${filtroStatus === 'entregue' ? 'card-selected' : ''}`}
        >
          <span className="text-[10px] font-bold text-green-800 uppercase tracking-wider block">
            Entregues
          </span>
          <span className="text-xl font-bold font-mono text-green-900 block">
            {concluidas}
          </span>
        </div>

        <div 
          onClick={() => setFiltroStatus('entregue_com_avaria')}
          className={`card-interativo p-3.5 space-y-1 bg-amber-50/50 border-amber-200 ${filtroStatus === 'entregue_com_avaria' ? 'card-selected' : ''}`}
        >
          <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
            Com Avaria
          </span>
          <span className="text-xl font-bold font-mono text-amber-900 block">
            {avarias}
          </span>
        </div>

        <div 
          onClick={() => setFiltroStatus('nao_entregue')}
          className={`card-interativo p-3.5 space-y-1 bg-red-50/50 border-red-200 col-span-2 sm:col-span-1 ${filtroStatus === 'nao_entregue' ? 'card-selected' : ''}`}
        >
          <span className="text-[10px] font-bold text-red-800 uppercase tracking-wider block">
            Não Entregues
          </span>
          <span className="text-xl font-bold font-mono text-red-900 block">
            {naoEntregues}
          </span>
        </div>
      </div>

      {/* Table & Filter */}
      <div className="industrial-card overflow-hidden">
        <div className="p-3.5 bg-zinc-50 border-b border-[#E5E5E5] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
            Listagem Geral de Entregas ({entregasFiltradas.length})
          </span>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-zinc-400" />
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="px-2.5 py-1 bg-white border border-[#E5E5E5] rounded text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
            >
              <option value="todos">Todos os status</option>
              <option value="atribuida">Atribuída</option>
              <option value="a_caminho">A caminho (Em rota)</option>
              <option value="entregue">Entregue</option>
              <option value="nao_entregue">Não entregue</option>
              <option value="entregue_com_avaria">Com avaria</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-zinc-500 space-y-2">
            <div className="w-5 h-5 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin mx-auto" />
            <p>Carregando entregas...</p>
          </div>
        ) : entregasFiltradas.length === 0 ? (
          <div className="p-10 text-center text-zinc-500 text-xs">
            Nenhuma entrega encontrada para o filtro selecionado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-[#E5E5E5] text-zinc-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Venda / Cliente</th>
                  <th className="py-2.5 px-3">Endereço</th>
                  <th className="py-2.5 px-3">Veículo</th>
                  <th className="py-2.5 px-3">Entregadores</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5]">
                {entregasFiltradas.map((e) => {
                  const cliente = e.venda?.cliente;
                  const entregadoresNomes =
                    e.entrega_entregadores?.map((item) => item.entregador?.nome).join(', ') ||
                    'Nenhum';

                  return (
                    <tr key={e.id} className="hover:bg-zinc-50">
                      <td className="py-3 px-3">
                        <span className="font-mono font-bold text-zinc-900 block">
                          #{e.venda_id.substring(0, 8)}
                        </span>
                        <span className="text-[11px] text-zinc-500 font-medium">
                          {cliente?.nome || 'Consumidor'}
                        </span>
                      </td>

                      <td className="py-3 px-3 max-w-[200px]">
                        <span className="truncate block text-zinc-700">
                          {cliente?.endereco || 'Não informado'}
                        </span>
                      </td>

                      <td className="py-3 px-3 font-mono">
                        {e.veiculo ? (
                          <span className="px-1.5 py-0.5 bg-zinc-100 border border-[#E5E5E5] rounded text-[11px]">
                            {e.veiculo.placa}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td className="py-3 px-3 text-zinc-700 font-medium">
                        {entregadoresNomes}
                      </td>

                      <td className="py-3 px-3">
                        {e.status === 'atribuida' && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-900 rounded border border-amber-300">
                            ATRIBUÍDA
                          </span>
                        )}
                        {e.status === 'a_caminho' && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-900 rounded border border-blue-300">
                            EM ROTA
                          </span>
                        )}
                        {e.status === 'entregue' && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-green-100 text-green-900 rounded border border-green-300">
                            ENTREGUE
                          </span>
                        )}
                        {e.status === 'nao_entregue' && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-red-100 text-red-900 rounded border border-red-300">
                            NÃO ENTREGUE
                          </span>
                        )}
                        {e.status === 'entregue_com_avaria' && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-orange-100 text-orange-900 rounded border border-orange-300">
                            COM AVARIA
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => setEntregaDetalhe(e)}
                          className="p-1 text-zinc-600 hover:text-zinc-900 transition-colors"
                          title="Ver detalhes e fotos"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details modal */}
      {entregaDetalhe && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="industrial-card p-6 max-w-lg w-full bg-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E5] mb-4">
              <h3 className="text-sm font-bold text-zinc-900">
                Detalhes da Entrega — #{entregaDetalhe.venda_id.substring(0, 8)}
              </h3>
              <button
                type="button"
                onClick={() => setEntregaDetalhe(null)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3 bg-zinc-50 rounded border border-[#E5E5E5] space-y-1">
                <p>
                  <strong>Cliente:</strong> {entregaDetalhe.venda?.cliente?.nome || 'Consumidor'}
                </p>
                <p>
                  <strong>Endereço:</strong> {entregaDetalhe.venda?.cliente?.endereco || 'Não informado'}
                </p>
                <p>
                  <strong>Veículo:</strong> {entregaDetalhe.veiculo?.placa} ({entregaDetalhe.veiculo?.modelo})
                </p>
              </div>

              {/* Photos recorded */}
              {entregaDetalhe.entrega_fotos && entregaDetalhe.entrega_fotos.length > 0 && (
                <div>
                  <h4 className="font-bold text-zinc-900 mb-2 uppercase text-[10px] tracking-wider">
                    Fotos de Comprovação Registradas
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {entregaDetalhe.entrega_fotos.map((f) => (
                      <div key={f.id} className="border border-[#E5E5E5] rounded p-2 text-center bg-zinc-50">
                        <img
                          src={f.foto_url}
                          alt="Comprovante"
                          className="w-full h-32 object-cover rounded mb-1"
                        />
                        <span className="text-[10px] text-zinc-500 font-mono block uppercase">
                          Tipo: {f.tipo}
                        </span>
                        {f.latitude && (
                          <span className="text-[9px] text-zinc-400 font-mono block">
                            GPS: {f.latitude.toFixed(4)}, {f.longitude?.toFixed(4)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
