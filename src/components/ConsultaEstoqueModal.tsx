import React, { useState, useEffect, useRef } from 'react';
import { Search, Package, Building2, X, RefreshCw, Layers, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Filial, Produto } from '../types';
import { useClickOutside } from '../hooks/useClickOutside';

interface ConsultaEstoqueModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedFilial: Filial | null;
  empresaId?: string;
}

interface ItemEstoqueFilial {
  filialId: string;
  filialNome: string;
  estoqueFisico: number;
  localizacao?: string | null;
  precoVenda?: number | null;
}

interface ProdutoComEstoque {
  produto: Produto;
  estoques: ItemEstoqueFilial[];
}

export const ConsultaEstoqueModal: React.FC<ConsultaEstoqueModalProps> = ({
  isOpen,
  onClose,
  selectedFilial,
  empresaId,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState<ProdutoComEstoque[]>([]);
  const [filiaisList, setFiliaisList] = useState<Filial[]>([]);

  const modalRef = useRef<HTMLDivElement>(null);

  // Close modal on outside click or Esc
  useClickOutside(modalRef, onClose, isOpen);

  // Fetch all company branches on mount
  useEffect(() => {
    async function loadFiliais() {
      if (!isOpen) return;
      try {
        const { data } = await supabase
          .from('filiais')
          .select('*')
          .order('nome');
        if (data) setFiliaisList(data as Filial[]);
      } catch (err) {
        console.error('Erro ao carregar filiais para consulta:', err);
      }
    }
    loadFiliais();
  }, [isOpen]);

  // Perform stock search
  const handleSearch = async (term: string) => {
    if (!term.trim()) {
      setResultados([]);
      return;
    }

    setLoading(true);
    try {
      const q = `%${term.trim()}%`;
      // Search products
      const { data: prods, error: prodErr } = await supabase
        .from('produtos')
        .select('*')
        .or(`nome.ilike.${q},codigo.ilike.${q},descricao.ilike.${q}`)
        .limit(10);

      if (prodErr || !prods) {
        setResultados([]);
        return;
      }

      // For each product, fetch stock across all branches
      const prodIds = prods.map((p) => p.id);
      if (prodIds.length === 0) {
        setResultados([]);
        return;
      }

      const { data: estoquesData } = await supabase
        .from('produtos_filiais')
        .select('*, filial:filiais(nome)')
        .in('produto_id', prodIds);

      const listaCompleta: ProdutoComEstoque[] = prods.map((prod) => {
        const estoquesFiliais: ItemEstoqueFilial[] = (filiaisList.length > 0 ? filiaisList : [{ id: 'matriz', nome: 'Matriz', empresa_id: '' }]).map((f) => {
          const itemEf = estoquesData?.find((ef: any) => ef.produto_id === prod.id && ef.filial_id === f.id);
          return {
            filialId: f.id,
            filialNome: f.nome,
            estoqueFisico: itemEf ? Number(itemEf.estoque_fisico || 0) : 0,
            localizacao: itemEf?.localizacao_fisica || null,
            precoVenda: itemEf?.preco_venda || prod.preco_venda,
          };
        });

        return {
          produto: prod as Produto,
          estoques: estoquesFiliais,
        };
      });

      setResultados(listaCompleta);
    } catch (err) {
      console.error('Erro ao consultar estoque geral:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.trim()) {
        handleSearch(searchTerm);
      } else {
        setResultados([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, filiaisList]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div
        ref={modalRef}
        className="bg-white border border-[#E5E5E5] rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[85vh] overflow-hidden"
      >
        {/* Modal Header */}
        <div className="p-4 bg-zinc-900 text-white flex items-center justify-between border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#F5D800] text-zinc-950 flex items-center justify-center font-bold">
              <Package className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                Consulta de Estoque Multilojas
              </h3>
              <p className="text-xs text-zinc-400">
                Verifique a disponibilidade do produto na filial atual ({selectedFilial?.nome || 'Matriz'}) e em todas as demais filiais
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 bg-zinc-50 border-b border-[#E5E5E5] shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Digite o nome ou código do produto para consultar estoque..."
              className="w-full pl-9 pr-10 py-2.5 bg-white border border-[#E5E5E5] rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-zinc-900 shadow-2xs"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Results Area */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center text-zinc-500 gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-[#F5D800]" />
              <span className="text-xs font-medium">Buscando disponibilidades nas filiais...</span>
            </div>
          )}

          {!loading && !searchTerm.trim() && (
            <div className="py-12 text-center text-zinc-400 space-y-2">
              <Package className="w-10 h-10 mx-auto stroke-1" />
              <p className="text-xs font-medium text-zinc-600">
                Digite um termo de busca no campo acima para pesquisar.
              </p>
              <p className="text-[11px] text-zinc-400">
                Esta consulta é instantânea e não altera o carrinho da venda em andamento.
              </p>
            </div>
          )}

          {!loading && searchTerm.trim() && resultados.length === 0 && (
            <div className="py-12 text-center text-zinc-500 space-y-2">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
              <p className="text-xs font-semibold text-zinc-800">
                Nenhum produto localizado para "{searchTerm}"
              </p>
              <p className="text-[11px] text-zinc-500">
                Verifique a grafia ou tente buscar por código de barras.
              </p>
            </div>
          )}

          {!loading &&
            resultados.map(({ produto, estoques }) => {
              const totalEstoqueRede = estoques.reduce((acc, curr) => acc + curr.estoqueFisico, 0);

              return (
                <div
                  key={produto.id}
                  className="border border-[#E5E5E5] rounded-xl bg-white overflow-hidden shadow-2xs"
                >
                  {/* Product Title Bar */}
                  <div className="p-3 bg-zinc-50 border-b border-[#E5E5E5] flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-zinc-900">{produto.nome}</span>
                        {produto.codigo && (
                          <span className="text-[10px] bg-zinc-200 text-zinc-700 px-1.5 py-0.5 rounded font-mono">
                            Cód: {produto.codigo}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-zinc-500">
                        Preço padrão: R$ {Number(produto.preco_venda || 0).toFixed(2)} / {produto.unidade || 'UN'}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-zinc-400 block">Total Rede</span>
                      <span
                        className={`text-sm font-black ${
                          totalEstoqueRede > 0 ? 'text-emerald-700' : 'text-red-600'
                        }`}
                      >
                        {totalEstoqueRede} {produto.unidade || 'un'}
                      </span>
                    </div>
                  </div>

                  {/* Stock Breakdown Grid */}
                  <div className="p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {estoques.map((ef) => {
                      const isAtual = selectedFilial?.id === ef.filialId;
                      const temEstoque = ef.estoqueFisico > 0;

                      return (
                        <div
                          key={ef.filialId}
                          className={`p-2.5 rounded-lg border text-xs flex flex-col justify-between ${
                            isAtual
                              ? 'border-[#F5D800] bg-amber-50/40 ring-1 ring-[#F5D800]'
                              : 'border-[#E5E5E5] bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-zinc-800 truncate flex items-center gap-1">
                              <Building2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                              {ef.filialNome}
                            </span>
                            {isAtual && (
                              <span className="text-[9px] bg-[#F5D800] text-zinc-950 font-bold px-1 rounded">
                                ESTA LOJA
                              </span>
                            )}
                          </div>

                          <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-zinc-100">
                            <span className="text-[11px] text-zinc-500">Estoque:</span>
                            <span
                              className={`font-black text-sm ${
                                temEstoque ? 'text-emerald-600' : 'text-red-500'
                              }`}
                            >
                              {ef.estoqueFisico} {produto.unidade || 'un'}
                            </span>
                          </div>

                          {ef.localizacao && (
                            <span className="text-[10px] text-zinc-400 block mt-1 truncate">
                              Loc: {ef.localizacao}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-zinc-50 border-t border-[#E5E5E5] flex items-center justify-between text-xs text-zinc-500 shrink-0">
          <span>Pressione <kbd className="px-1.5 py-0.5 bg-white border border-zinc-300 rounded font-mono text-[10px]">Esc</kbd> para fechar</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-900 text-white font-semibold rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            Fechar Consulta
          </button>
        </div>
      </div>
    </div>
  );
};
