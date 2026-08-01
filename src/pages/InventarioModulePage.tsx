import React, { useState, useEffect } from 'react';
import { 
  Boxes, 
  Plus, 
  Eye, 
  EyeOff, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  Layers, 
  ArrowRight,
  RefreshCw,
  XCircle
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Inventario } from '../types';
import { useAuth } from '../context/AuthContext';
import { NovoInventarioModal } from '../components/NovoInventarioModal';
import { ContagemInventarioPage } from './ContagemInventarioPage';
import { ReconciliacaoInventarioPage } from './ReconciliacaoInventarioPage';

export const InventarioModulePage: React.FC = () => {
  const { selectedFilial } = useAuth();

  const [inventarios, setInventarios] = useState<Inventario[]>([]);
  const [loading, setLoading] = useState(true);

  // View state: 'list' | 'contagem' | 'reconciliacao'
  const [currentView, setCurrentView] = useState<'list' | 'contagem' | 'reconciliacao'>('list');
  const [activeInventarioId, setActiveInventarioId] = useState<string | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    fetchInventarios();
  }, [selectedFilial]);

  const fetchInventarios = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('inventarios')
        .select('*, filial:filiais(*)')
        .order('created_at', { ascending: false });

      if (selectedFilial?.id) {
        query = query.eq('filial_id', selectedFilial.id);
      }

      const { data, error } = await query;

      if (error) {
        console.warn('Erro ao carregar inventarios:', error.message);
        setInventarios([]);
      } else if (data) {
        setInventarios(data);
      }
    } catch (err) {
      console.error('Erro ao conectar para inventarios:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatedInventario = (newInvId: string) => {
    setActiveInventarioId(newInvId);
    setCurrentView('contagem');
    fetchInventarios();
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('T');
    const dateParts = parts[0].split('-');
    const time = parts[1] ? parts[1].substring(0, 5) : '';
    if (dateParts.length === 3) return `${dateParts[2]}/${dateParts[1]}/${dateParts[0]} ${time}`;
    return dateStr;
  };

  if (currentView === 'contagem' && activeInventarioId) {
    return (
      <ContagemInventarioPage
        inventarioId={activeInventarioId}
        onVoltar={() => {
          setCurrentView('list');
          fetchInventarios();
        }}
        onIrReconciliacao={() => setCurrentView('reconciliacao')}
      />
    );
  }

  if (currentView === 'reconciliacao' && activeInventarioId) {
    return (
      <ReconciliacaoInventarioPage
        inventarioId={activeInventarioId}
        onVoltar={() => setCurrentView('contagem')}
        onFinalizado={() => {
          setCurrentView('list');
          setActiveInventarioId(null);
          fetchInventarios();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Module Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#E5E5E5]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#F5D800] text-black flex items-center justify-center font-bold border border-[#d2b800] shrink-0">
            <Boxes className="w-6 h-6 stroke-[2]" />
          </div>
          <div>
            <h1 className="text-base font-bold text-zinc-900">Módulo de Inventário & Contagem de Estoque</h1>
            <p className="text-xs text-zinc-500">
              Contagem cega ou aberta, leitor de código de barras por câmera, recontagem e reconciliação
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="px-4 py-2 bg-[#F5D800] hover:bg-[#e2c700] text-zinc-950 font-semibold text-xs rounded-lg transition-colors border border-[#d2b800] flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Iniciar Novo Inventário</span>
        </button>
      </div>

      {/* Inventarios List */}
      <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
        <div className="p-4 bg-zinc-50 border-b border-[#E5E5E5] flex items-center justify-between">
          <h2 className="font-bold text-xs text-zinc-900">Histórico de Inventários de Estoque</h2>
          <button
            onClick={fetchInventarios}
            className="p-1.5 text-zinc-500 hover:text-zinc-900 border border-[#E5E5E5] bg-white rounded-lg text-xs flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Atualizar</span>
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-zinc-500 flex flex-col items-center justify-center gap-2">
            <div className="w-6 h-6 border-2 border-zinc-300 border-t-[#F5D800] rounded-full animate-spin" />
            Carregando lista de inventários...
          </div>
        ) : inventarios.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 space-y-2">
            <Boxes className="w-10 h-10 text-zinc-300 mx-auto" />
            <p className="text-sm font-medium text-zinc-700">Nenhum inventário realizado ainda</p>
            <p className="text-xs text-zinc-400">
              Clique no botão "Iniciar Novo Inventário" para criar uma contagem cega ou aberta.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-[#E5E5E5] text-zinc-500 font-medium">
                <tr>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Tipo / Escopo</th>
                  <th className="p-3.5">Modo de Contagem</th>
                  <th className="p-3.5">Data de Criação</th>
                  <th className="p-3.5">Finalizado Em</th>
                  <th className="p-3.5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5]">
                {inventarios.map((inv) => {
                  return (
                    <tr key={inv.id} className="hover:bg-zinc-50 transition-colors">
                      {/* Status */}
                      <td className="p-3.5">
                        {inv.status === 'em_andamento' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-700" /> Em Andamento
                          </span>
                        ) : inv.status === 'finalizado' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Finalizado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-zinc-100 text-zinc-700">
                            Cancelado
                          </span>
                        )}
                      </td>

                      {/* Tipo / Escopo */}
                      <td className="p-3.5 font-bold text-zinc-900">
                        {inv.tipo === 'completo' ? 'Inventário Completo' : 'Inventário Cíclico'}
                        {inv.localizacao_filtro && (
                          <span className="block text-[10px] text-zinc-500 font-normal">
                            Setor: {inv.localizacao_filtro}
                          </span>
                        )}
                      </td>

                      {/* Modo */}
                      <td className="p-3.5">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded ${
                          inv.modo_contagem === 'cega' ? 'bg-zinc-900 text-white' : 'bg-amber-100 text-amber-950'
                        }`}>
                          {inv.modo_contagem === 'cega' ? <EyeOff className="w-3 h-3 text-[#F5D800]" /> : <Eye className="w-3 h-3" />}
                          Modo {inv.modo_contagem === 'cega' ? 'Cego' : 'Aberto'}
                        </span>
                      </td>

                      {/* Data Criacao */}
                      <td className="p-3.5 text-zinc-700">{formatDate(inv.created_at || inv.criado_em)}</td>

                      {/* Data Finalizado */}
                      <td className="p-3.5 text-zinc-700">{formatDate(inv.finalizado_em)}</td>

                      {/* Action */}
                      <td className="p-3.5 text-right">
                        {inv.status === 'em_andamento' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveInventarioId(inv.id);
                              setCurrentView('contagem');
                            }}
                            className="px-3 py-1.5 bg-[#F5D800] hover:bg-[#e2c700] text-zinc-950 font-bold rounded-lg text-xs border border-[#d2b800] flex items-center gap-1.5 ml-auto cursor-pointer shadow-2xs"
                          >
                            <span>Continuar Contagem</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveInventarioId(inv.id);
                              setCurrentView('reconciliacao');
                            }}
                            className="px-3 py-1.5 border border-[#E5E5E5] hover:bg-zinc-100 text-zinc-800 font-medium rounded-lg text-xs flex items-center gap-1 ml-auto cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-zinc-500" />
                            <span>Ver Relatório</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Novo Inventario */}
      <NovoInventarioModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreatedInventario}
      />
    </div>
  );
};
