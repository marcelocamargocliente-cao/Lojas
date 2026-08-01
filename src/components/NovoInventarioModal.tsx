import React, { useState } from 'react';
import { Boxes, Plus, Eye, EyeOff, Layers, MapPin, X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

interface NovoInventarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (inventarioId: string) => void;
}

export const NovoInventarioModal: React.FC<NovoInventarioModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { usuarioProfile, empresa, selectedFilial } = useAuth();

  const [tipo, setTipo] = useState<'completo' | 'ciclico'>('completo');
  const [modoContagem, setModoContagem] = useState<'cega' | 'aberta'>('cega');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [localizacaoFiltro, setLocalizacaoFiltro] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleCreateInventario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFilial?.id) {
      alert('Selecione uma filial ativa no topo da tela.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create inventarios record
      const { data: inv, error: invErr } = await supabase
        .from('inventarios')
        .insert([
          {
            empresa_id: empresa?.id || null,
            filial_id: selectedFilial.id,
            tipo,
            modo_contagem: modoContagem,
            status: 'em_andamento',
            categoria_filtro: tipo === 'ciclico' ? categoriaFiltro || null : null,
            localizacao_filtro: tipo === 'ciclico' ? localizacaoFiltro || null : null,
            criado_por: usuarioProfile?.id || null,
          },
        ])
        .select()
        .single();

      if (invErr || !inv) {
        alert('Erro ao iniciar inventário: ' + (invErr?.message || 'Falha ao salvar no banco'));
        setSubmitting(false);
        return;
      }

      // 2. Fetch products for this branch
      let queryProds = supabase
        .from('produtos_filial')
        .select('*, produto:produtos(*)')
        .eq('filial_id', selectedFilial.id);

      const { data: prodsFilial } = await queryProds;

      if (prodsFilial && prodsFilial.length > 0) {
        let filteredProds = prodsFilial;

        // Apply cyclical filters if applicable
        if (tipo === 'ciclico') {
          if (localizacaoFiltro.trim()) {
            filteredProds = filteredProds.filter((pf) =>
              (pf.localizacao_fisica || '').toLowerCase().includes(localizacaoFiltro.trim().toLowerCase())
            );
          }
        }

        // Insert items into inventario_itens
        const itensToInsert = filteredProds.map((pf) => ({
          inventario_id: inv.id,
          produto_id: pf.produto_id,
          quantidade_sistema: pf.estoque_fisico || 0,
          localizacao_fisica: pf.localizacao_fisica || 'Matriz',
        }));

        if (itensToInsert.length > 0) {
          await supabase.from('inventario_itens').insert(itensToInsert);
        }
      }

      onCreated(inv.id);
      onClose();
    } catch (err) {
      console.error('Erro ao criar inventario:', err);
      alert('Erro inesperado ao criar inventário.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in">
        
        {/* Modal Header */}
        <div className="p-4 border-b border-[#E5E5E5] bg-zinc-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#F5D800] text-black flex items-center justify-center font-bold border border-[#d2b800]">
              <Boxes className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-zinc-900">Novo Inventário de Estoque</h3>
              <p className="text-[11px] text-zinc-500">Filial: {selectedFilial?.nome || 'Matriz'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleCreateInventario} className="p-5 space-y-4 text-xs">
          {/* Tipo Selector */}
          <div>
            <label className="block font-semibold text-zinc-700 mb-1.5">Tipo de Contagem</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTipo('completo')}
                className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                  tipo === 'completo'
                    ? 'bg-amber-50/60 border-amber-500 text-zinc-950 font-bold'
                    : 'bg-white border-[#E5E5E5] text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                <Layers className="w-4 h-4 mb-1 text-amber-600" />
                <span className="block text-xs">Inventário Completo</span>
                <span className="text-[10px] text-zinc-500 font-normal">Todos os produtos da loja</span>
              </button>

              <button
                type="button"
                onClick={() => setTipo('ciclico')}
                className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                  tipo === 'ciclico'
                    ? 'bg-amber-50/60 border-amber-500 text-zinc-950 font-bold'
                    : 'bg-white border-[#E5E5E5] text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                <MapPin className="w-4 h-4 mb-1 text-amber-600" />
                <span className="block text-xs">Inventário Cíclico</span>
                <span className="text-[10px] text-zinc-500 font-normal">Filtrado por setor / corredor</span>
              </button>
            </div>
          </div>

          {/* Cyclical Filters if chosen */}
          {tipo === 'ciclico' && (
            <div className="p-3 bg-zinc-50 border border-[#E5E5E5] rounded-lg space-y-2">
              <label className="block text-[11px] font-semibold text-zinc-700">Filtro de Localização Física</label>
              <input
                type="text"
                value={localizacaoFiltro}
                onChange={(e) => setLocalizacaoFiltro(e.target.value)}
                placeholder="Ex: Corredor A, Prateleira 3, Depósito"
                className="w-full p-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
              />
            </div>
          )}

          {/* Mode Selector */}
          <div>
            <label className="block font-semibold text-zinc-700 mb-1.5">Modo de Contagem</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setModoContagem('cega')}
                className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                  modoContagem === 'cega'
                    ? 'bg-zinc-900 text-white border-zinc-900 font-bold'
                    : 'bg-white border-[#E5E5E5] text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                <EyeOff className="w-4 h-4 mb-1 text-[#F5D800]" />
                <span className="block text-xs">Contagem Cega</span>
                <span className="text-[10px] text-zinc-400 font-normal block">Esconde o estoque do sistema do operador</span>
              </button>

              <button
                type="button"
                onClick={() => setModoContagem('aberta')}
                className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                  modoContagem === 'aberta'
                    ? 'bg-zinc-900 text-white border-zinc-900 font-bold'
                    : 'bg-white border-[#E5E5E5] text-zinc-600 hover:bg-zinc-50'
                }`}
              >
                <Eye className="w-4 h-4 mb-1 text-[#F5D800]" />
                <span className="block text-xs">Contagem Aberta</span>
                <span className="text-[10px] text-zinc-400 font-normal block">Mostra a quantidade esperada ao lado</span>
              </button>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-[#E5E5E5] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-[#E5E5E5] hover:bg-zinc-100 rounded-lg text-zinc-700 font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-[#F5D800] hover:bg-[#e2c700] text-zinc-950 font-bold rounded-lg border border-[#d2b800] cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Gerando...' : 'Iniciar Inventário'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
