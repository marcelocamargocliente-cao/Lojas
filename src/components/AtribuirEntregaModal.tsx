import React, { useState, useEffect } from 'react';
import { Truck, Users, Check, X, AlertCircle, Building2, Package } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Venda, Veiculo, Usuario } from '../types';
import { useAuth } from '../context/AuthContext';

interface AtribuirEntregaModalProps {
  venda: Venda;
  onClose: () => void;
  onSuccess: () => void;
}

export const AtribuirEntregaModal: React.FC<AtribuirEntregaModalProps> = ({
  venda,
  onClose,
  onSuccess,
}) => {
  const { empresa, user } = useAuth();

  const [entregadores, setEntregadores] = useState<Usuario[]>([]);
  const [selectedEntregadorIds, setSelectedEntregadorIds] = useState<string[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [selectedVeiculoId, setSelectedVeiculoId] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // Fetch deliverers
        const { data: entData } = await supabase
          .from('usuarios')
          .select('*')
          .eq('empresa_id', empresa?.id)
          .eq('cargo', 'entregador');

        if (entData) {
          setEntregadores(entData as Usuario[]);
        }

        // Fetch active vehicles
        const { data: veicData } = await supabase
          .from('veiculos')
          .select('*')
          .eq('empresa_id', empresa?.id)
          .eq('status', 'ativo');

        if (veicData) {
          setVeiculos(veicData as Veiculo[]);
          if (veicData.length > 0) {
            setSelectedVeiculoId(veicData[0].id);
          }
        }
      } catch (err: any) {
        setErro(err?.message || 'Erro ao carregar dados de entregadores e veículos.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [empresa?.id]);

  const toggleEntregador = (id: string) => {
    if (selectedEntregadorIds.includes(id)) {
      setSelectedEntregadorIds(selectedEntregadorIds.filter((item) => item !== id));
    } else {
      setSelectedEntregadorIds([...selectedEntregadorIds, id]);
    }
  };

  const handleConfirmarAtribuicao = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (selectedEntregadorIds.length === 0) {
      setErro('Selecione pelo menos um entregador.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Insert into `entregas`
      const { data: entregaData, error: entregaErr } = await supabase
        .from('entregas')
        .insert({
          empresa_id: empresa?.id,
          venda_id: venda.id,
          veiculo_id: selectedVeiculoId || null,
          status: 'atribuida',
          atribuido_por: user?.id,
        })
        .select()
        .single();

      if (entregaErr) {
        throw entregaErr;
      }

      const entregaId = entregaData.id;

      // 2. Insert into `entrega_entregadores`
      const juncaoPayload = selectedEntregadorIds.map((entregadorId) => ({
        entrega_id: entregaId,
        entregador_id: entregadorId,
      }));

      const { error: juncaoErr } = await supabase
        .from('entrega_entregadores')
        .insert(juncaoPayload);

      if (juncaoErr) {
        console.warn('Erro ao atribuir entregadores:', juncaoErr);
      }

      onSuccess();
    } catch (err: any) {
      setErro(err?.message || 'Falha ao atribuir entrega.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="industrial-card p-6 max-w-lg w-full bg-white shadow-2xl relative">
        <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E5] mb-4">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-[#F5D800]" />
            <div>
              <h3 className="text-sm font-bold text-zinc-900">
                Atribuir Entrega — Venda #{venda.id.substring(0, 8)}
              </h3>
              <p className="text-[11px] text-zinc-500">
                Cliente: {venda.cliente?.nome || 'Consumidor final'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {erro && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        {loading ? (
          <div className="py-8 text-center text-xs text-zinc-500 space-y-2">
            <div className="w-5 h-5 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin mx-auto" />
            <p>Carregando entregadores e veículos...</p>
          </div>
        ) : (
          <form onSubmit={handleConfirmarAtribuicao} className="space-y-4">
            {/* Delivery details summary */}
            <div className="p-3 bg-zinc-50 border border-[#E5E5E5] rounded-lg text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-zinc-500">Endereço de entrega:</span>
                <span className="font-semibold text-zinc-900 truncate max-w-[220px]">
                  {venda.cliente?.endereco || 'Não informado'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Valor da venda:</span>
                <span className="font-bold text-zinc-900">
                  R$ {Number(venda.valor_total || 0).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Select Vehicle */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                Veículo para a rota
              </label>
              {veiculos.length === 0 ? (
                <p className="text-xs text-amber-800 bg-amber-50 p-2 border border-amber-200 rounded">
                  Nenhum veículo ativo cadastrado na frota. Cadastre no menu Veículos.
                </p>
              ) : (
                <select
                  value={selectedVeiculoId}
                  onChange={(e) => setSelectedVeiculoId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                >
                  {veiculos.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.placa} — {v.modelo} ({v.tipo.toUpperCase()})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Multi-select Deliverers */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                Selecione um ou mais Entregadores
              </label>
              {entregadores.length === 0 ? (
                <p className="text-xs text-red-800 bg-red-50 p-2 border border-red-200 rounded">
                  Nenhum entregador cadastrado no sistema (cargo = entregador).
                </p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto border border-[#E5E5E5] p-2 rounded-lg bg-zinc-50/50">
                  {entregadores.map((ent) => {
                    const isSelected = selectedEntregadorIds.includes(ent.id);
                    return (
                      <div
                        key={ent.id}
                        onClick={() => toggleEntregador(ent.id)}
                        className={`p-2.5 rounded border text-xs flex items-center justify-between cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-amber-50 border-[#F5D800] font-semibold text-zinc-950'
                            : 'bg-white border-[#E5E5E5] text-zinc-700 hover:bg-zinc-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-zinc-500" />
                          <span>{ent.nome}</span>
                        </div>
                        {isSelected && (
                          <span className="w-5 h-5 rounded-full bg-[#F5D800] text-zinc-950 flex items-center justify-center font-bold">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E5E5]">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-900"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-[#F5D800] hover:bg-[#ebd000] text-zinc-950 font-bold text-xs rounded-lg border border-[#d2b800]"
              >
                {submitting ? 'Atribuindo...' : 'Confirmar atribuição'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
