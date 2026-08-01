import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  ChevronLeft, 
  Boxes, 
  TrendingDown, 
  TrendingUp, 
  MapPin, 
  Save, 
  Info,
  Layers
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Inventario, InventarioItem } from '../types';
import { useAuth } from '../context/AuthContext';

interface ReconciliacaoInventarioPageProps {
  inventarioId: string;
  onVoltar: () => void;
  onFinalizado: () => void;
}

export const ReconciliacaoInventarioPage: React.FC<ReconciliacaoInventarioPageProps> = ({
  inventarioId,
  onVoltar,
  onFinalizado,
}) => {
  const { selectedFilial } = useAuth();

  const [inventario, setInventario] = useState<Inventario | null>(null);
  const [itens, setItens] = useState<InventarioItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Motivos por item ID
  const [motivosMap, setMotivosMap] = useState<Record<string, 'quebra' | 'extravio' | 'erro_recebimento' | 'outro'>>({});
  const [finalizing, setFinalizing] = useState(false);

  useEffect(() => {
    fetchData();
  }, [inventarioId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: inv } = await supabase
        .from('inventarios')
        .select('*, filial:filiais(*)')
        .eq('id', inventarioId)
        .single();

      if (inv) setInventario(inv);

      const { data: rawItens } = await supabase
        .from('inventario_itens')
        .select('*, produto:produtos(*)')
        .eq('inventario_id', inventarioId);

      if (rawItens) {
        setItens(rawItens);
        // Pre-fill motives map
        const initialMotives: Record<string, any> = {};
        rawItens.forEach((i) => {
          if (i.motivo_ajuste) initialMotives[i.id] = i.motivo_ajuste;
        });
        setMotivosMap(initialMotives);
      }
    } catch (err) {
      console.error('Erro ao carregar dados para reconciliacao:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMotivoChange = (itemId: string, motivo: 'quebra' | 'extravio' | 'erro_recebimento' | 'outro') => {
    setMotivosMap((prev) => ({ ...prev, [itemId]: motivo }));
  };

  const handleFinalizarInventario = async () => {
    if (!inventario) return;

    // Check if any item with non-zero divergence lacks a motivo
    const unselectedDivergentItens = itens.filter((i) => {
      const cnt = i.quantidade_contada ?? i.quantidade_sistema;
      const diff = cnt - i.quantidade_sistema;
      return diff !== 0 && !motivosMap[i.id];
    });

    if (unselectedDivergentItens.length > 0) {
      alert(`Selecione o motivo de ajuste para todos os ${unselectedDivergentItens.length} itens com divergência antes de finalizar.`);
      return;
    }

    setFinalizing(true);
    try {
      // 1. Update each item's motivo_ajuste & final count in inventario_itens
      for (const item of itens) {
        const cnt = item.quantidade_contada ?? item.quantidade_sistema;
        const diff = cnt - item.quantidade_sistema;
        const motivo = motivosMap[item.id] || null;

        await supabase
          .from('inventario_itens')
          .update({
            quantidade_contada: cnt,
            divergencia: diff,
            motivo_ajuste: motivo,
          })
          .eq('id', item.id);

        // 2. Update stock in produtos_filial
        if (inventario.filial_id && item.produto_id) {
          await supabase
            .from('produtos_filial')
            .upsert({
              produto_id: item.produto_id,
              filial_id: inventario.filial_id,
              estoque_fisico: cnt,
              estoque_virtual: cnt,
            });
        }
      }

      // 3. Mark inventarios status as 'finalizado'
      await supabase
        .from('inventarios')
        .update({
          status: 'finalizado',
          finalizado_em: new Date().toISOString(),
        })
        .eq('id', inventario.id);

      onFinalizado();
    } catch (err) {
      console.error('Erro ao finalizar inventario:', err);
      alert('Erro ao finalizar inventário.');
    } finally {
      setFinalizing(false);
    }
  };

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-xs text-zinc-500 flex flex-col items-center justify-center gap-2">
        <div className="w-8 h-8 border-3 border-zinc-200 border-t-[#F5D800] rounded-full animate-spin" />
        Carregando balanço de reconciliação...
      </div>
    );
  }

  const itensComDivergencia = itens.filter((i) => {
    const cnt = i.quantidade_contada ?? i.quantidade_sistema;
    return cnt - i.quantidade_sistema !== 0;
  });

  const itensSemDivergencia = itens.filter((i) => {
    const cnt = i.quantidade_contada ?? i.quantidade_sistema;
    return cnt - i.quantidade_sistema === 0;
  });

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#E5E5E5] flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onVoltar}
            className="p-2 border border-[#E5E5E5] hover:bg-zinc-100 rounded-lg text-zinc-700 cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-base font-bold text-zinc-900">Reconciliação e Ajuste de Estoque</h2>
            <p className="text-xs text-zinc-500">
              Verifique as divergências e selecione os motivos antes de atualizar o saldo físico da loja.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleFinalizarInventario}
          disabled={finalizing}
          className="px-5 py-2.5 bg-[#F5D800] hover:bg-[#e2c700] text-zinc-950 font-bold text-xs rounded-lg border border-[#d2b800] flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
        >
          <CheckCircle2 className="w-4 h-4 text-zinc-950" />
          <span>{finalizing ? 'Finalizando...' : 'Finalizar Inventário & Atualizar Estoque'}</span>
        </button>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-[#E5E5E5]">
          <span className="text-xs font-medium text-zinc-500 block">Total de Itens Auditados</span>
          <span className="text-xl font-bold text-zinc-900 mt-1 block">{itens.length} produtos</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20">
          <span className="text-xs font-medium text-emerald-700 block">Sem Divergência (100% Ok)</span>
          <span className="text-xl font-bold text-emerald-900 mt-1 block">{itensSemDivergencia.length} produtos</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-300 bg-amber-50/30">
          <span className="text-xs font-medium text-amber-800 block">Itens com Divergência de Saldo</span>
          <span className="text-xl font-bold text-amber-950 mt-1 block">{itensComDivergencia.length} produtos</span>
        </div>
      </div>

      {/* Reconciliacao Table */}
      <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
        <div className="p-4 bg-zinc-50 border-b border-[#E5E5E5] flex items-center justify-between">
          <h3 className="font-bold text-xs text-zinc-900">
            Comparativo Sistema vs Contado ({itensComDivergencia.length} com divergência)
          </h3>
          <span className="text-[11px] text-zinc-500">
            * É obrigatório selecionar o motivo do ajuste para itens divergentes.
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 border-b border-[#E5E5E5] text-zinc-500 font-medium">
              <tr>
                <th className="p-3.5">Produto</th>
                <th className="p-3.5">Setor / Local</th>
                <th className="p-3.5">Qtd Sistema</th>
                <th className="p-3.5">Qtd Contada</th>
                <th className="p-3.5">Divergência</th>
                <th className="p-3.5">Motivo do Ajuste de Estoque</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E5]">
              {itens.map((item) => {
                const sys = item.quantidade_sistema || 0;
                const cnt = item.quantidade_contada ?? sys;
                const diff = cnt - sys;
                const temDivergencia = diff !== 0;

                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-zinc-50 transition-colors ${
                      temDivergencia ? 'bg-amber-50/30' : ''
                    }`}
                  >
                    {/* Produto */}
                    <td className="p-3.5">
                      <span className="font-bold text-zinc-900 block">{item.produto?.nome}</span>
                      <span className="text-[10px] text-zinc-400">Cód: {item.produto?.codigo || '-'}</span>
                    </td>

                    {/* Localizacao */}
                    <td className="p-3.5">
                      <span className="inline-flex items-center gap-1 font-semibold text-[11px] bg-zinc-100 text-zinc-800 px-2 py-0.5 rounded">
                        <MapPin className="w-3 h-3 text-zinc-500" />
                        {item.localizacao_fisica || 'Matriz'}
                      </span>
                    </td>

                    {/* Qtd Sistema */}
                    <td className="p-3.5 font-bold text-zinc-700">{sys}</td>

                    {/* Qtd Contada */}
                    <td className="p-3.5 font-bold text-zinc-900">{cnt}</td>

                    {/* Divergencia */}
                    <td className="p-3.5 font-bold">
                      {diff === 0 ? (
                        <span className="text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Ok (0)
                        </span>
                      ) : diff > 0 ? (
                        <span className="text-blue-700 flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5 text-blue-600" /> +{diff} (Sobra)
                        </span>
                      ) : (
                        <span className="text-red-700 flex items-center gap-1">
                          <TrendingDown className="w-3.5 h-3.5 text-red-600" /> {diff} (Falta)
                        </span>
                      )}
                    </td>

                    {/* Motivo Selector */}
                    <td className="p-3.5">
                      {temDivergencia ? (
                        <select
                          value={motivosMap[item.id] || ''}
                          onChange={(e) => handleMotivoChange(item.id, e.target.value as any)}
                          className={`w-full p-2 border rounded-lg text-xs font-semibold focus:outline-none ${
                            motivosMap[item.id]
                              ? 'bg-white border-zinc-900 text-zinc-900'
                              : 'bg-red-50 border-red-300 text-red-900'
                          }`}
                        >
                          <option value="">-- SELECIONE O MOTIVO * --</option>
                          <option value="quebra">Avaria / Quebra de Produto</option>
                          <option value="extravio">Extravio / Furto</option>
                          <option value="erro_recebimento">Erro de Recebimento de NF</option>
                          <option value="outro">Outro Motivo Ajuste</option>
                        </select>
                      ) : (
                        <span className="text-zinc-400 italic text-[11px]">Sem ajuste necessário</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
