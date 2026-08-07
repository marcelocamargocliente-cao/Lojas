import React, { useState, useEffect } from 'react';
import { Truck, Plus, Edit2, Trash2, Search, AlertCircle, CheckCircle2, ShieldAlert, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';
import { Veiculo } from '../types';
import { useAuth } from '../context/AuthContext';
import { InputMaiusculo } from '../components/InputMaiusculo';

export const VeiculosPage: React.FC = () => {
  const { empresa } = useAuth();

  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingVeiculo, setEditingVeiculo] = useState<Veiculo | null>(null);

  // Form State
  const [placa, setPlaca] = useState('');
  const [modelo, setModelo] = useState('');
  const [marca, setMarca] = useState('');
  const [ano, setAno] = useState<number>(new Date().getFullYear());
  const [tipo, setTipo] = useState<'caminhao' | 'moto' | 'carro' | 'van'>('caminhao');
  const [status, setStatus] = useState<'ativo' | 'manutencao' | 'inativo'>('ativo');
  const [saving, setSaving] = useState(false);

  const fetchVeiculos = async () => {
    setLoading(true);
    setErro(null);
    try {
      let query = supabase.from('veiculos').select('*').order('created_at', { ascending: false });
      if (empresa?.id) {
        query = query.eq('empresa_id', empresa.id);
      }
      const { data, error } = await query;
      if (error) {
        setErro(`Erro ao carregar veículos: ${error.message}`);
      } else if (data) {
        setVeiculos(data as Veiculo[]);
      }
    } catch (err: any) {
      setErro(err?.message || 'Falha ao buscar veículos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVeiculos();
  }, [empresa?.id]);

  const handleOpenNewModal = () => {
    setEditingVeiculo(null);
    setPlaca('');
    setModelo('');
    setMarca('');
    setAno(new Date().getFullYear());
    setTipo('caminhao');
    setStatus('ativo');
    setShowModal(true);
  };

  const handleOpenEditModal = (v: Veiculo) => {
    setEditingVeiculo(v);
    setPlaca(v.placa);
    setModelo(v.modelo);
    setMarca(v.marca || '');
    setAno(v.ano || new Date().getFullYear());
    setTipo(v.tipo);
    setStatus(v.status);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!placa.trim() || !modelo.trim()) {
      alert('Placa e Modelo são obrigatórios.');
      return;
    }

    setSaving(true);
    try {
      const resolvedFilialId = (
        await supabase
          .from('filiais')
          .select('id')
          .eq('empresa_id', empresa?.id)
          .single()
      ).data?.id;

      if (!resolvedFilialId) {
        toast.error('Nenhuma filial encontrada. Cadastre uma filial primeiro.');
        setSaving(false);
        return;
      }

      if (editingVeiculo) {
        const { error } = await supabase
          .from('veiculos')
          .update({
            placa: placa.trim().toUpperCase(),
            modelo: modelo.trim(),
            marca: marca.trim() || null,
            ano: ano || null,
            tipo: tipo,
            status: status,
          })
          .eq('id', editingVeiculo.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from('veiculos').insert({
          empresa_id: empresa?.id,
          placa: placa.trim().toUpperCase(),
          modelo: modelo.trim(),
          marca: marca.trim() || null,
          ano: ano || null,
          tipo: tipo,
          status: status,
        });

        if (error) throw error;
      }

      setShowModal(false);
      fetchVeiculos();
    } catch (err: any) {
      alert(`Erro ao salvar veículo: ${err?.message || 'Falha na operação'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente remover este veículo da frota?')) return;
    try {
      const { error } = await supabase.from('veiculos').delete().eq('id', id);
      if (error) {
        alert(`Não foi possível remover: ${error.message}`);
      } else {
        fetchVeiculos();
      }
    } catch (err: any) {
      alert(`Erro: ${err?.message}`);
    }
  };

  const veiculosFiltrados = veiculos.filter(
    (v) =>
      v.placa.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.modelo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.marca && v.marca.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E5E5E5]">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
            <Truck className="w-5 h-5 text-[#F5D800]" />
            Cadastro de Frota & Veículos
          </h1>
          <p className="text-xs text-zinc-600 mt-0.5">
            Gerencie os veículos utilizados para realização de entregas e fretes da empresa.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenNewModal}
          className="py-2 px-4 bg-[#F5D800] hover:bg-[#ebd000] text-zinc-950 font-bold text-xs rounded-lg border border-[#d2b800] flex items-center gap-2 transition-colors shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar veículo</span>
        </button>
      </div>

      {erro && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {/* Filter bar */}
      <div className="industrial-card p-4">
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
            <Search className="w-4 h-4" />
          </div>
          <InputMaiusculo
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por placa, modelo ou marca..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
          />
        </div>
      </div>

      {/* Vehicles Table */}
      <div className="industrial-card overflow-hidden">
        <div className="p-3.5 bg-zinc-50 border-b border-[#E5E5E5] flex items-center justify-between">
          <span className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
            Veículos da frota ({veiculosFiltrados.length})
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-zinc-500 space-y-2">
            <div className="w-5 h-5 border-2 border-zinc-200 border-t-zinc-900 rounded-full animate-spin mx-auto" />
            <p>Carregando veículos...</p>
          </div>
        ) : veiculosFiltrados.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 text-xs space-y-1">
            <Truck className="w-8 h-8 text-zinc-300 mx-auto stroke-[1.5]" />
            <p className="font-medium text-zinc-700">Nenhum veículo cadastrado.</p>
            <p className="text-[11px] text-zinc-400">Clique no botão acima para adicionar um veículo à frota.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-50 border-b border-[#E5E5E5] text-zinc-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Placa</th>
                  <th className="py-2.5 px-3">Modelo / Marca</th>
                  <th className="py-2.5 px-3">Tipo</th>
                  <th className="py-2.5 px-3">Ano</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5]">
                {veiculosFiltrados.map((v) => (
                  <tr key={v.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-zinc-900">
                      <span className="px-2 py-0.5 bg-zinc-100 border border-[#E5E5E5] rounded">
                        {v.placa}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-zinc-900 block">{v.modelo}</span>
                      {v.marca && <span className="text-[11px] text-zinc-500">{v.marca}</span>}
                    </td>
                    <td className="py-3 px-3 capitalize text-zinc-700 font-medium">
                      {v.tipo}
                    </td>
                    <td className="py-3 px-3 text-zinc-600">{v.ano || '—'}</td>
                    <td className="py-3 px-3">
                      {v.status === 'ativo' && (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-green-100 text-green-800 rounded border border-green-200">
                          ATIVO
                        </span>
                      )}
                      {v.status === 'manutencao' && (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded border border-amber-200">
                          EM MANUTENÇÃO
                        </span>
                      )}
                      {v.status === 'inativo' && (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-zinc-100 text-zinc-600 rounded border border-[#E5E5E5]">
                          INATIVO
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right space-x-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(v)}
                        className="p-1 text-zinc-600 hover:text-zinc-900 transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(v.id)}
                        className="p-1 text-zinc-400 hover:text-red-600 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Add/Edit */}
      {showModal && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="industrial-card p-6 max-w-md w-full bg-white">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E5] mb-4">
              <h3 className="text-sm font-bold text-zinc-900">
                {editingVeiculo ? 'Editar Veículo' : 'Cadastrar Novo Veículo'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Placa do Veículo *
                </label>
                <InputMaiusculo
                  type="text"
                  required
                  value={placa}
                  onChange={(e) => setPlaca(e.target.value)}
                  placeholder="ABC-1D23 / ABC1234"
                  className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs font-mono font-bold uppercase text-zinc-900 focus:outline-none focus:border-zinc-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Modelo *
                  </label>
                  <InputMaiusculo
                    type="text"
                    required
                    value={modelo}
                    onChange={(e) => setModelo(e.target.value)}
                    placeholder="Ex: Cargo 815 / CG 160"
                    className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Marca
                  </label>
                  <InputMaiusculo
                    type="text"
                    value={marca}
                    onChange={(e) => setMarca(e.target.value)}
                    placeholder="Ex: Ford / Honda"
                    className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Ano
                  </label>
                  <input
                    type="number"
                    value={ano}
                    onChange={(e) => setAno(parseInt(e.target.value) || new Date().getFullYear())}
                    className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Tipo
                  </label>
                  <select
                    value={tipo}
                    onChange={(e: any) => setTipo(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                  >
                    <option value="caminhao">Caminhão</option>
                    <option value="moto">Moto</option>
                    <option value="carro">Carro</option>
                    <option value="van">Van</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e: any) => setStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="manutencao">Manutenção</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E5E5]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-900"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-[#F5D800] text-zinc-950 font-bold text-xs rounded-lg border border-[#d2b800] hover:bg-[#ebd000]"
                >
                  {saving ? 'Salvar...' : 'Salvar veículo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
