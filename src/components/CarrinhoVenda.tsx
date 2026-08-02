import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Trash2, AlertTriangle, Building2, Package, Layers, X, Edit3 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { CartItem, Filial, Produto, ProdutoFilial } from '../types';

interface CarrinhoVendaProps {
  items: CartItem[];
  selectedFilial: Filial | null;
  filiais: Filial[];
  onUpdateItems: (items: CartItem[]) => void;
}

export const CarrinhoVenda: React.FC<CarrinhoVendaProps> = ({
  items,
  selectedFilial,
  filiais,
  onUpdateItems,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sugestoesProdutos, setSugestoesProdutos] = useState<Produto[]>([]);
  const [loadingProdutos, setLoadingProdutos] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(false);

  // Modal for checking stock in other branches
  const [modalEstoqueFiliais, setModalEstoqueFiliais] = useState<{
    produto: Produto;
    estoquePorFilial: { filialNome: string; estoqueFisico: number; endereco?: string | null }[];
  } | null>(null);

  const [loadingEstoqueFiliais, setLoadingEstoqueFiliais] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpenDropdown(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Search products by name or code
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSugestoesProdutos([]);
      setOpenDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoadingProdutos(true);
      try {
        const queryText = `%${searchTerm.trim()}%`;
        const { data, error } = await supabase
          .from('produtos')
          .select('*')
          .or(`nome.ilike.${queryText},codigo.ilike.${queryText}`)
          .limit(8);

        if (!error && data) {
          setSugestoesProdutos(data as Produto[]);
          setOpenDropdown(true);
        }
      } catch (err) {
        console.error('Erro na busca de produtos:', err);
      } finally {
        setLoadingProdutos(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Add product to cart with branch stock check
  const handleAddProduto = async (produto: Produto) => {
    setSearchTerm('');
    setOpenDropdown(false);

    let estoqueBranch = 999;
    let localizacao = '';

    if (selectedFilial?.id) {
      const { data: pFilial } = await supabase
        .from('produtos_filial')
        .select('*')
        .eq('produto_id', produto.id)
        .eq('filial_id', selectedFilial.id)
        .maybeSingle();

      if (pFilial) {
        estoqueBranch = Number((pFilial as ProdutoFilial).estoque_fisico || 0);
        localizacao = (pFilial as ProdutoFilial).localizacao_fisica || '';
      } else {
        estoqueBranch = 0;
      }
    }

    // Check if already in cart
    const existingIndex = items.findIndex((i) => i.produto_id === produto.id);
    if (existingIndex >= 0) {
      const updated = [...items];
      const newQty = updated[existingIndex].quantidade + 1;
      updated[existingIndex].quantidade = newQty;
      updated[existingIndex].subtotal = newQty * updated[existingIndex].preco_unitario;
      onUpdateItems(updated);
    } else {
      const newItem: CartItem = {
        produto_id: produto.id,
        nome: produto.nome,
        codigo: produto.codigo,
        unidade: produto.unidade || 'UN',
        quantidade: 1,
        preco_unitario: Number(produto.preco_venda || 0),
        subtotal: Number(produto.preco_venda || 0),
        estoque_disponivel: estoqueBranch,
        localizacao: localizacao,
      };
      onUpdateItems([...items, newItem]);
    }
  };

  const handleUpdateQuantity = (index: number, newQty: number) => {
    const qty = Math.max(0.01, Number(newQty) || 0.01);
    const updated = [...items];
    updated[index].quantidade = qty;
    updated[index].subtotal = qty * updated[index].preco_unitario;
    onUpdateItems(updated);
  };

  const handleUpdatePrice = (index: number, newPrice: number) => {
    const price = Math.max(0, Number(newPrice) || 0);
    const updated = [...items];
    updated[index].preco_unitario = price;
    updated[index].subtotal = updated[index].quantidade * price;
    onUpdateItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    const updated = items.filter((_, i) => i !== index);
    onUpdateItems(updated);
  };

  // Check stock in other branches
  const handleConsultarOutrasFiliais = async (produtoId: string, produtoNome: string) => {
    setLoadingEstoqueFiliais(true);
    try {
      const { data: pFiliais } = await supabase
        .from('produtos_filial')
        .select('*, filiais(nome, endereco)')
        .eq('produto_id', produtoId);

      const list: { filialNome: string; estoqueFisico: number; endereco?: string | null }[] = [];

      if (pFiliais) {
        pFiliais.forEach((pf: any) => {
          list.push({
            filialNome: pf.filiais?.nome || 'Filial sem nome',
            estoqueFisico: Number(pf.estoque_fisico || 0),
            endereco: pf.filiais?.endereco,
          });
        });
      }

      setModalEstoqueFiliais({
        produto: { id: produtoId, nome: produtoNome, preco_venda: 0 },
        estoquePorFilial: list,
      });
    } catch (err) {
      console.error('Erro ao consultar estoque em outras filiais:', err);
    } finally {
      setLoadingEstoqueFiliais(false);
    }
  };

  const totalGeral = items.reduce((acc, item) => acc + item.subtotal, 0);

  return (
    <div className="space-y-4" ref={wrapperRef}>
      {/* Product Autocomplete Search Bar */}
      <div className="relative">
        <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
          Adicionar produto ao carrinho
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => {
              if (sugestoesProdutos.length > 0) setOpenDropdown(true);
            }}
            placeholder="Digite o código ou nome do material (ex: Cano PVC 25mm, Cimento, Pregos)..."
            className="w-full pl-9 pr-8 py-2.5 bg-white border border-[#E5E5E5] rounded-lg text-xs md:text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
          />
          {loadingProdutos && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              <div className="w-3.5 h-3.5 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Autocomplete Dropdown */}
        {openDropdown && (
          <div className="absolute left-0 right-0 mt-1 bg-white border border-[#E5E5E5] rounded-lg shadow-xl z-40 overflow-hidden max-h-80 overflow-y-auto divide-y divide-[#E5E5E5]">
            {sugestoesProdutos.length > 0 ? (
              sugestoesProdutos.map((prod) => (
                <button
                  key={prod.id}
                  type="button"
                  onClick={() => handleAddProduto(prod)}
                  className="w-full text-left p-3 hover:bg-amber-50/60 transition-colors flex items-center justify-between group cursor-pointer"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      {prod.codigo && (
                        <span className="text-[10px] font-mono bg-zinc-100 text-zinc-700 px-1.5 py-0.5 rounded border border-[#E5E5E5]">
                          {prod.codigo}
                        </span>
                      )}
                      <span className="font-semibold text-xs text-zinc-900 group-hover:text-black">
                        {prod.nome}
                      </span>
                    </div>
                    {prod.descricao && (
                      <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-1">
                        {prod.descricao}
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-bold text-xs text-zinc-900 block">
                      R$ {Number(prod.preco_venda || 0).toFixed(2)}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      Un: {prod.unidade || 'UN'}
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <div className="p-4 text-center text-xs text-zinc-500">
                Nenhum produto encontrado com "{searchTerm}"
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cart Items Table */}
      <div className="industrial-card overflow-hidden">
        <div className="p-3.5 bg-zinc-50 border-b border-[#E5E5E5] flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-900">
            <Package className="w-4 h-4 text-zinc-700" />
            <span>Itens da venda ({items.length})</span>
          </div>

          <span className="text-xs font-medium text-zinc-500">
            Suporta quantidade fracionada
          </span>
        </div>

        {items.length === 0 ? (
          <div className="p-12 text-center text-zinc-400 space-y-2">
            <Package className="w-8 h-8 mx-auto text-zinc-300 stroke-[1.5]" />
            <p className="text-xs font-medium text-zinc-500">
              O carrinho está vazio. Busque e selecione produtos acima.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-50/80 border-b border-[#E5E5E5] text-zinc-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Item / Produto</th>
                  <th className="py-2.5 px-3 w-28">Estoque Filial</th>
                  <th className="py-2.5 px-3 w-28">Qtd (M, KG, UN)</th>
                  <th className="py-2.5 px-3 w-28">Preço Un (R$)</th>
                  <th className="py-2.5 px-3 w-28 text-right">Subtotal</th>
                  <th className="py-2.5 px-3 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E5E5]">
                {items.map((item, idx) => {
                  const estoqueInsuficiente = item.quantidade > item.estoque_disponivel;

                  return (
                    <tr key={`${item.produto_id}-${idx}`} className="hover:bg-zinc-50/60 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-semibold text-zinc-900 text-xs">
                          {item.nome}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-500 mt-0.5">
                          {item.codigo && <span>Cód: {item.codigo}</span>}
                          <span>Unidade: {item.unidade}</span>
                          {item.localizacao && (
                            <span>Corredor: {item.localizacao}</span>
                          )}
                        </div>
                      </td>

                      {/* Stock in current branch */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`font-semibold text-xs ${
                              estoqueInsuficiente
                                ? 'text-red-600 font-bold'
                                : 'text-zinc-800'
                            }`}
                          >
                            {item.estoque_disponivel} {item.unidade}
                          </span>

                          {estoqueInsuficiente && (
                            <button
                              type="button"
                              onClick={() =>
                                handleConsultarOutrasFiliais(item.produto_id, item.nome)
                              }
                              className="text-[10px] text-amber-800 font-medium bg-amber-100/90 hover:bg-amber-200 px-1.5 py-0.5 rounded border border-amber-300 flex items-center gap-1 w-fit transition-colors cursor-pointer"
                            >
                              <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0" />
                              <span>Ver em outras filiais</span>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Fractional Quantity Input */}
                      <td className="py-3 px-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={item.quantidade}
                          onChange={(e) => handleUpdateQuantity(idx, parseFloat(e.target.value))}
                          className="w-20 px-2 py-1 bg-white border border-[#E5E5E5] rounded text-xs text-zinc-900 font-semibold focus:outline-none focus:border-zinc-900 text-center"
                        />
                      </td>

                      {/* Unit Price */}
                      <td className="py-3 px-3">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.preco_unitario}
                          onChange={(e) => handleUpdatePrice(idx, parseFloat(e.target.value))}
                          className="w-24 px-2 py-1 bg-white border border-[#E5E5E5] rounded text-xs text-zinc-900 font-semibold focus:outline-none focus:border-zinc-900"
                        />
                      </td>

                      {/* Subtotal */}
                      <td className="py-3 px-3 text-right font-bold text-xs text-zinc-900">
                        R$ {item.subtotal.toFixed(2)}
                      </td>

                      {/* Remove Button */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-zinc-400 hover:text-red-600 p-1 rounded transition-colors"
                          title="Remover item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Total Bar */}
        <div className="p-4 bg-zinc-900 text-white flex items-center justify-between border-t border-zinc-800">
          <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
            Total da venda:
          </span>
          <span className="text-xl font-bold tracking-tight text-[#F5D800]">
            R$ {totalGeral.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Modal: Estoque em Outras Filiais */}
      {modalEstoqueFiliais && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="industrial-card p-6 max-w-md w-full bg-white">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E5] mb-4">
              <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#F5D800]" />
                Estoque em outras filiais
              </h3>
              <button
                type="button"
                onClick={() => setModalEstoqueFiliais(null)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mb-4">
              <span className="text-xs font-bold text-zinc-900 block">
                {modalEstoqueFiliais.produto.nome}
              </span>
              <p className="text-[11px] text-zinc-500">
                Consulta de disponibilidade da rede
              </p>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {modalEstoqueFiliais.estoquePorFilial.map((st, i) => (
                <div
                  key={i}
                  className="p-3 bg-zinc-50 border border-[#E5E5E5] rounded-lg flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-semibold text-zinc-900 block">
                      {st.filialNome}
                    </span>
                    {st.endereco && (
                      <span className="text-[10px] text-zinc-500">{st.endereco}</span>
                    )}
                  </div>
                  <span
                    className={`font-bold px-2 py-1 rounded text-xs ${
                      st.estoqueFisico > 0
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {st.estoqueFisico} em estoque
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-4 mt-4 border-t border-[#E5E5E5] flex justify-end">
              <button
                type="button"
                onClick={() => setModalEstoqueFiliais(null)}
                className="px-4 py-2 bg-zinc-900 text-white font-medium text-xs rounded-lg"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
