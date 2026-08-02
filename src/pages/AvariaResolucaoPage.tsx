import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert, FileText, Image, RefreshCw, X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Entrega, EntregaAvaria, EntregaFoto } from '../types';
import { useAuth } from '../context/AuthContext';
import { TextareaMaiusculo } from '../components/InputMaiusculo';

export const AvariaResolucaoPage: React.FC = () => {
  const { empresa } = useAuth();

  const [entregasAvaria, setEntregasAvaria] = useState<Entrega[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Selected for resolution modal
  const [selectedEntrega, setSelectedEntrega] = useState<Entrega | null>(null);
  const [decisaoFinal, setDecisaoFinal] = useState('');
  const [salvando, setSalvando] = useState(false);

  const fetchEntregasAvaria = async () => {
    setLoading(true);
    setErro(null);
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
          entrega_fotos(*),
          entrega_avaria(*)
        `)
        .eq('status', 'entregue_com_avaria')
        .order('created_at', { ascending: false });

      if (empresa?.id) {
        query = query.eq('empresa_id', empresa.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data) {
        setEntregasAvaria(data as Entrega[]);
      }
    } catch (err: any) {
      setErro(err?.message || 'Erro ao carregar entregas com avaria.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntregasAvaria();
  }, [empresa?.id]);

  const handleSalvarResolucao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntrega || !decisaoFinal.trim()) return;

    setSalvando(true);
    try {
      const avariaRecord = selectedEntrega.entrega_avaria?.[0];
      if (avariaRecord) {
        const { error } = await supabase
          .from('entrega_avaria')
          .update({
            status_resolucao: 'resolvido',
            decisao_final: decisaoFinal.trim(),
          })
          .eq('id', avariaRecord.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('entrega_avaria').insert({
          entrega_id: selectedEntrega.id,
          decisao_cliente: 'recusou',
          status_resolucao: 'resolvido',
          decisao_final: decisaoFinal.trim(),
        });

        if (error) throw error;
      }

      setSelectedEntrega(null);
      setDecisaoFinal('');
      fetchEntregasAvaria();
    } catch (err: any) {
      alert(`Erro ao salvar resolução: ${err?.message}`);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E5E5]">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            Gestão de Ocorrências & Avarias de Transporte
          </h1>
          <p className="text-xs text-zinc-600 mt-0.5">
            Analise fotos de comprovantes de avaria e defina a tratativa para o cliente ou reposição de estoque.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchEntregasAvaria}
          className="py-1.5 px-3 bg-white hover:bg-zinc-50 border border-[#E5E5E5] text-zinc-700 font-medium text-xs rounded-lg flex items-center gap-1.5 transition-colors self-start shrink-0 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Atualizar</span>
        </button>
      </div>

      {erro && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-xs text-zinc-500 space-y-2">
          <div className="w-6 h-6 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin mx-auto" />
          <p>Carregando registros de avaria...</p>
        </div>
      ) : entregasAvaria.length === 0 ? (
        <div className="industrial-card p-12 text-center text-zinc-500 text-xs space-y-2">
          <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto stroke-[1.5]" />
          <p className="font-semibold text-zinc-800">Nenhuma avaria pendente de resolução.</p>
          <p className="text-[11px] text-zinc-400">
            Todas as entregas foram concluídas sem relatar danos ou as avarias já foram solucionadas.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {entregasAvaria.map((entrega) => {
            const avariaObj = entrega.entrega_avaria?.[0];
            const fotosAvaria = entrega.entrega_fotos || [];
            const cliente = entrega.venda?.cliente;

            return (
              <div key={entrega.id} className="industrial-card p-5 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#E5E5E5]">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-zinc-400 block uppercase">
                        Venda #{entrega.venda_id.substring(0, 8)}
                      </span>
                      <h3 className="text-sm font-bold text-zinc-900">
                        {cliente?.nome || 'Cliente não identificado'}
                      </h3>
                    </div>

                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded border uppercase ${
                        avariaObj?.status_resolucao === 'resolvido'
                          ? 'bg-green-100 text-green-900 border-green-300'
                          : 'bg-amber-100 text-amber-900 border-amber-300'
                      }`}
                    >
                      {avariaObj?.status_resolucao === 'resolvido' ? 'RESOLVIDO' : 'PENDENTE DE RESOLUÇÃO'}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-zinc-700">
                    <p>
                      <strong>Decisão do cliente na entrega:</strong>{' '}
                      <span className="capitalize font-semibold text-zinc-900">
                        {avariaObj?.decisao_cliente === 'aceitou' ? 'Aceitou com ressalva' : 'Recusou o material'}
                      </span>
                    </p>
                    {avariaObj?.observacao && (
                      <p className="p-2 bg-zinc-50 border border-[#E5E5E5] rounded text-zinc-600 text-[11px]">
                        "{avariaObj.observacao}"
                      </p>
                    )}
                    {avariaObj?.decisao_final && (
                      <p className="p-2 bg-green-50 border border-green-200 text-green-900 rounded text-[11px] font-medium">
                        <strong>Tratativa final:</strong> {avariaObj.decisao_final}
                      </p>
                    )}
                  </div>

                  {/* Photos */}
                  {fotosAvaria.length > 0 && (
                    <div className="pt-2">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                        Fotos de comprovação:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {fotosAvaria.map((f) => (
                          <a
                            key={f.id}
                            href={f.foto_url}
                            target="_blank"
                            rel="noreferrer"
                            className="block relative group"
                          >
                            <img
                              src={f.foto_url}
                              alt="Foto avaria"
                              className="w-16 h-16 object-cover rounded border border-[#E5E5E5] hover:opacity-90"
                            />
                            {f.latitude && (
                              <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] text-center font-mono py-0.5">
                                GPS OK
                              </span>
                            )}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-[#E5E5E5]">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedEntrega(entrega);
                      setDecisaoFinal(avariaObj?.decisao_final || '');
                    }}
                    className="w-full py-2 px-3 bg-[#F5D800] hover:bg-[#ebd000] text-zinc-950 font-bold text-xs rounded-lg border border-[#d2b800] text-center cursor-pointer"
                  >
                    Definir / Atualizar Resolução
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Resolution Modal */}
      {selectedEntrega && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="industrial-card p-6 max-w-md w-full bg-white">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E5] mb-4">
              <h3 className="text-sm font-bold text-zinc-900">
                Tratativa da Avaria — Venda #{selectedEntrega.venda_id.substring(0, 8)}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedEntrega(null)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSalvarResolucao} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                  Selecione ou digite a solução dada ao cliente *
                </label>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <button
                    type="button"
                    onClick={() => setDecisaoFinal('Estorno / Crédito na conta do cliente')}
                    className="py-1 px-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-[11px] rounded border border-[#E5E5E5] cursor-pointer"
                  >
                    Estorno / Crédito
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecisaoFinal('Envio imediato de novo material em substituição')}
                    className="py-1 px-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-[11px] rounded border border-[#E5E5E5] cursor-pointer"
                  >
                    Troca do produto
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecisaoFinal('Desconto comercial concedido sobre a avaria')}
                    className="py-1 px-2.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-[11px] rounded border border-[#E5E5E5] cursor-pointer"
                  >
                    Desconto Comercial
                  </button>
                </div>

                <TextareaMaiusculo
                  rows={3}
                  required
                  value={decisaoFinal}
                  onChange={(e) => setDecisaoFinal(e.target.value)}
                  placeholder="Descreva detalhadamente a tratativa final para encerramento do chamado..."
                  className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E5E5]">
                <button
                  type="button"
                  onClick={() => setSelectedEntrega(null)}
                  className="px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-900"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="px-4 py-2 bg-[#F5D800] text-zinc-950 font-bold text-xs rounded-lg border border-[#d2b800] hover:bg-[#ebd000]"
                >
                  {salvando ? 'Salvando...' : 'Concluir Resolução'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
