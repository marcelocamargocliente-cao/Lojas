import React, { useState, useEffect } from 'react';
import { 
  FileCode2, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Plus, 
  Building2, 
  Package, 
  DollarSign, 
  Clock, 
  RefreshCw,
  FileText
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Produto, MapeamentoProdutoFornecedor } from '../types';
import { useAuth } from '../context/AuthContext';

interface ParsedXmlItem {
  idTemp: string;
  codigoFornecedor: string;
  descricaoFornecedor: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  produtoIdMapeado: string | null;
  autoMapped: boolean;
}

interface ParsedXmlNota {
  numeroNota: string;
  chaveAcesso: string;
  fornecedorNome: string;
  fornecedorCnpj: string;
  valorBruto: number;
  valorImpostos: number;
  valorLiquido: number;
  vencimento: string | null;
  dataEmissao: string | null;
  itens: ParsedXmlItem[];
}

export const EntradaNotaFiscalPage: React.FC = () => {
  const { usuarioProfile, empresa, selectedFilial } = useAuth();

  const [step, setStep] = useState<'upload' | 'mapeamento' | 'sucesso'>('upload');
  const [loading, setLoading] = useState(false);
  const [parsedNota, setParsedNota] = useState<ParsedXmlNota | null>(null);
  const [produtosDisponiveis, setProdutosDisponiveis] = useState<Produto[]>([]);
  
  // Mapping state: itemIdTemp -> produto_id
  const [itemMappings, setItemMappings] = useState<Record<string, string>>({});
  
  // Quick new product modal state
  const [quickProductModalOpen, setQuickProductModalOpen] = useState(false);
  const [quickItemTarget, setQuickItemTarget] = useState<ParsedXmlItem | null>(null);
  const [novoNomeProd, setNovoNomeProd] = useState('');
  const [novoPrecoVenda, setNovoPrecoVenda] = useState('');
  const [novoCodigo, setNovoCodigo] = useState('');

  const [savingMapping, setSavingMapping] = useState(false);
  const [notaIdSalva, setNotaIdSalva] = useState<string | null>(null);

  useEffect(() => {
    fetchProdutos();
  }, [empresa]);

  const fetchProdutos = async () => {
    try {
      const { data } = await supabase
        .from('produtos')
        .select('*')
        .order('nome');
      if (data) setProdutosDisponiveis(data);
    } catch (err) {
      console.warn('Erro ao carregar produtos para mapeamento:', err);
    }
  };

  // XML Parser Function
  const parseNfeXml = async (xmlString: string): Promise<ParsedXmlNota> => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

    const getTagText = (parent: Element | Document, tag: string) => {
      const el = parent.getElementsByTagName(tag)[0];
      return el ? el.textContent || '' : '';
    };

    // Extract infNFe / ide
    const infNFe = xmlDoc.getElementsByTagName('infNFe')[0];
    const chaveAcesso = infNFe ? infNFe.getAttribute('Id')?.replace('NFe', '') || '' : '';

    const ide = xmlDoc.getElementsByTagName('ide')[0];
    const numeroNota = ide ? getTagText(ide, 'nNF') : '0000';
    const dhEmi = ide ? getTagText(ide, 'dhEmi') || getTagText(ide, 'dEmi') : '';

    // Emitente (Fornecedor)
    const emit = xmlDoc.getElementsByTagName('emit')[0];
    const fornecedorNome = emit ? getTagText(emit, 'xNome') : 'Fornecedor Desconhecido';
    const fornecedorCnpj = emit ? getTagText(emit, 'CNPJ') || getTagText(emit, 'CPF') : '';

    // Total
    const icmsTot = xmlDoc.getElementsByTagName('ICMSTot')[0];
    const valorBruto = icmsTot ? parseFloat(getTagText(icmsTot, 'vProd') || '0') : 0;
    const valorLiquido = icmsTot ? parseFloat(getTagText(icmsTot, 'vNF') || '0') : valorBruto;
    const vST = icmsTot ? parseFloat(getTagText(icmsTot, 'vST') || '0') : 0;
    const vIPI = icmsTot ? parseFloat(getTagText(icmsTot, 'vIPI') || '0') : 0;
    const valorImpostos = vST + vIPI;

    // Duplicatas (Vencimento)
    const dup = xmlDoc.getElementsByTagName('dup')[0];
    const vencimento = dup ? getTagText(dup, 'dVenc') : null;

    // Items
    const detList = xmlDoc.getElementsByTagName('det');
    const itens: ParsedXmlItem[] = [];

    for (let i = 0; i < detList.length; i++) {
      const det = detList[i];
      const prod = det.getElementsByTagName('prod')[0];
      if (prod) {
        const cProd = getTagText(prod, 'cProd');
        const xProd = getTagText(prod, 'xProd');
        const qCom = parseFloat(getTagText(prod, 'qCom') || '1');
        const vUnCom = parseFloat(getTagText(prod, 'vUnCom') || '0');
        const vProd = parseFloat(getTagText(prod, 'vProd') || '0');

        itens.push({
          idTemp: `item_${i}_${cProd}`,
          codigoFornecedor: cProd,
          descricaoFornecedor: xProd,
          quantidade: qCom,
          valorUnitario: vUnCom,
          valorTotal: vProd || qCom * vUnCom,
          produtoIdMapeado: null,
          autoMapped: false,
        });
      }
    }

    return {
      numeroNota,
      chaveAcesso,
      fornecedorNome,
      fornecedorCnpj,
      valorBruto,
      valorImpostos,
      valorLiquido,
      vencimento,
      dataEmissao: dhEmi ? dhEmi.split('T')[0] : null,
      itens,
    };
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xml')) {
      alert('Por favor, selecione um arquivo XML de Nota Fiscal (NF-e).');
      return;
    }

    setLoading(true);
    try {
      const text = await file.text();
      const parsed = await parseNfeXml(text);

      if (!parsed.itens || parsed.itens.length === 0) {
        alert('Não foi possível extrair produtos do arquivo XML informado.');
        setLoading(false);
        return;
      }

      // Fetch existing supplier mappings
      const { data: mappings } = await supabase
        .from('mapeamento_produto_fornecedor')
        .select('*')
        .eq('fornecedor_cnpj', parsed.fornecedorCnpj);

      const mappingMap = new Map<string, string>();
      if (mappings) {
        mappings.forEach((m) => mappingMap.set(m.codigo_fornecedor, m.produto_id));
      }

      // Pre-fill item mappings
      const initialMap: Record<string, string> = {};
      const updatedItens = parsed.itens.map((item) => {
        const mappedId = mappingMap.get(item.codigoFornecedor);
        if (mappedId) {
          initialMap[item.idTemp] = mappedId;
          return { ...item, produtoIdMapeado: mappedId, autoMapped: true };
        }
        return item;
      });

      setParsedNota({ ...parsed, itens: updatedItens });
      setItemMappings(initialMap);
      setStep('mapeamento');
    } catch (err) {
      console.error('Erro ao ler XML:', err);
      alert('Erro ao processar o arquivo XML.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewProduct = async () => {
    if (!quickItemTarget || !novoNomeProd.trim()) return;

    try {
      const { data: newProd, error } = await supabase
        .from('produtos')
        .insert([
          {
            empresa_id: empresa?.id || null,
            codigo: novoCodigo || quickItemTarget.codigoFornecedor,
            nome: novoNomeProd.trim(),
            preco_venda: parseFloat(novoPrecoVenda) || quickItemTarget.valorUnitario * 1.3,
            descricao: `Importado de NF-e ${parsedNota?.numeroNota || ''}`,
          },
        ])
        .select()
        .single();

      if (error) {
        alert('Erro ao criar produto: ' + error.message);
      } else if (newProd) {
        setProdutosDisponiveis((prev) => [...prev, newProd]);
        // Set mapping for this item
        setItemMappings((prev) => ({
          ...prev,
          [quickItemTarget.idTemp]: newProd.id,
        }));
        setQuickProductModalOpen(false);
        setQuickItemTarget(null);
        setNovoNomeProd('');
        setNovoPrecoVenda('');
        setNovoCodigo('');
      }
    } catch (err) {
      console.error('Erro ao cadastrar produto rápido:', err);
    }
  };

  const handleConfirmarEntrada = async () => {
    if (!parsedNota) return;

    // Check if all items have a product mapped
    const unmapped = parsedNota.itens.filter((item) => !itemMappings[item.idTemp]);
    if (unmapped.length > 0) {
      alert(`Existem ${unmapped.length} item(ns) sem produto mapeado. Associe todos os produtos antes de prosseguir.`);
      return;
    }

    setSavingMapping(true);
    try {
      // 1. Insert into notas_fiscais_entrada
      const { data: notaSalva, error: notaErr } = await supabase
        .from('notas_fiscais_entrada')
        .insert([
          {
            empresa_id: empresa?.id || null,
            filial_id: selectedFilial?.id || null,
            numero_nota: parsedNota.numeroNota,
            chave_acesso: parsedNota.chaveAcesso,
            fornecedor_nome: parsedNota.fornecedorNome,
            fornecedor_cnpj: parsedNota.fornecedorCnpj,
            valor_bruto: parsedNota.valorBruto,
            valor_impostos: parsedNota.valorImpostos,
            valor_liquido: parsedNota.valorLiquido,
            data_emissao: parsedNota.dataEmissao,
            vencimento: parsedNota.vencimento,
            status: 'processado',
          },
        ])
        .select()
        .single();

      const nId = notaSalva?.id || `nf_${Date.now()}`;
      setNotaIdSalva(nId);

      // 2. Insert into notas_fiscais_itens
      const itensToInsert = parsedNota.itens.map((item) => ({
        nota_id: nId,
        codigo_fornecedor: item.codigoFornecedor,
        descricao_fornecedor: item.descricaoFornecedor,
        quantidade: item.quantidade,
        valor_unitario: item.valorUnitario,
        valor_total: item.valorTotal,
        produto_id_mapeado: itemMappings[item.idTemp],
      }));

      await supabase.from('notas_fiscais_itens').insert(itensToInsert);

      // 3. Save mappings in mapeamento_produto_fornecedor
      const mappingsToUpsert = parsedNota.itens.map((item) => ({
        empresa_id: empresa?.id || null,
        fornecedor_cnpj: parsedNota.fornecedorCnpj,
        codigo_fornecedor: item.codigoFornecedor,
        produto_id: itemMappings[item.idTemp],
      }));

      await supabase
        .from('mapeamento_produto_fornecedor')
        .upsert(mappingsToUpsert, { onConflict: 'fornecedor_cnpj,codigo_fornecedor' });

      // 4. Try RPC confirmar_entrada_nota_fiscal OR manual stock update fallback
      try {
        const { error: rpcErr } = await supabase.rpc('confirmar_entrada_nota_fiscal', {
          p_nota_id: nId,
          p_filial_id: selectedFilial?.id || null,
          p_usuario_id: usuarioProfile?.id || null,
          p_vencimento: parsedNota.vencimento || new Date().toISOString().split('T')[0],
        });

        if (rpcErr) {
          console.warn('RPC confirmar_entrada_nota_fiscal fallthrough, realizando atualizacao direta:', rpcErr.message);
          // Fallback direct updates: Increment stock for each item & create bill
          for (const item of parsedNota.itens) {
            const prodId = itemMappings[item.idTemp];
            if (prodId && selectedFilial?.id) {
              const { data: pf } = await supabase
                .from('produtos_filial')
                .select('estoque_fisico, estoque_virtual')
                .eq('produto_id', prodId)
                .eq('filial_id', selectedFilial.id)
                .single();

              const estAtual = pf ? pf.estoque_fisico || 0 : 0;
              await supabase.from('produtos_filial').upsert({
                produto_id: prodId,
                filial_id: selectedFilial.id,
                estoque_fisico: estAtual + item.quantidade,
                estoque_virtual: estAtual + item.quantidade,
              });
            }
          }

          // Create bill in contas_pagar
          await supabase.from('contas_pagar').insert([
            {
              empresa_id: empresa?.id || null,
              filial_id: selectedFilial?.id || null,
              fornecedor_nome: parsedNota.fornecedorNome,
              descricao: `NF-e ${parsedNota.numeroNota} - ${parsedNota.fornecedorNome}`,
              categoria: 'Fornecedores',
              valor: parsedNota.valorLiquido,
              vencimento: parsedNota.vencimento || new Date().toISOString().split('T')[0],
              forma_pagamento: 'boleto',
              status: 'pendente',
            },
          ]);
        }
      } catch (e) {
        console.warn('Fallback ativacao de entrada:', e);
      }

      setStep('sucesso');
    } catch (err) {
      console.error('Erro ao confirmar entrada de nota:', err);
      alert('Erro ao dar entrada na Nota Fiscal.');
    } finally {
      setSavingMapping(false);
    }
  };

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="pb-4 border-b border-[#E5E5E5]">
        <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
          <FileCode2 className="w-5 h-5 text-amber-500" />
          Entrada de Mercadoria via XML de NF-e
        </h2>
        <p className="text-xs text-zinc-500">
          Importação automática de notas fiscais, mapeamento inteligente de produtos e atualização de estoque
        </p>
      </div>

      {/* Steps Indicator */}
      <div className="flex items-center justify-center gap-4 max-w-xl mx-auto py-2">
        <div className={`flex items-center gap-2 text-xs font-semibold ${step === 'upload' ? 'text-zinc-950 font-bold' : 'text-zinc-400'}`}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center border text-xs ${step === 'upload' ? 'bg-[#F5D800] border-[#d2b800] text-black' : 'bg-zinc-100 border-[#E5E5E5]'}`}>
            1
          </div>
          <span>Upload do XML</span>
        </div>

        <div className="w-8 h-px bg-[#E5E5E5]" />

        <div className={`flex items-center gap-2 text-xs font-semibold ${step === 'mapeamento' ? 'text-zinc-950 font-bold' : 'text-zinc-400'}`}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center border text-xs ${step === 'mapeamento' ? 'bg-[#F5D800] border-[#d2b800] text-black' : 'bg-zinc-100 border-[#E5E5E5]'}`}>
            2
          </div>
          <span>Mapeamento de Produtos</span>
        </div>

        <div className="w-8 h-px bg-[#E5E5E5]" />

        <div className={`flex items-center gap-2 text-xs font-semibold ${step === 'sucesso' ? 'text-emerald-700 font-bold' : 'text-zinc-400'}`}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center border text-xs ${step === 'sucesso' ? 'bg-emerald-600 text-white' : 'bg-zinc-100 border-[#E5E5E5]'}`}>
            3
          </div>
          <span>Estoque Atualizado</span>
        </div>
      </div>

      {/* STEP 1: UPLOAD XML */}
      {step === 'upload' && (
        <div className="bg-white p-8 rounded-xl border border-[#E5E5E5] max-w-2xl mx-auto text-center space-y-6">
          <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 text-amber-700 mx-auto flex items-center justify-center">
            <Upload className="w-7 h-7" />
          </div>

          <div>
            <h3 className="font-bold text-base text-zinc-900">Selecione o arquivo XML da NF-e</h3>
            <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">
              O sistema fará a leitura instantânea do fornecedor, valores dos produtos, impostos e sugerirá o mapeamento dos itens.
            </p>
          </div>

          <div className="border-2 border-dashed border-[#E5E5E5] hover:border-zinc-400 rounded-xl p-8 transition-colors cursor-pointer bg-zinc-50/50">
            <input
              type="file"
              id="xml-input"
              accept=".xml"
              onChange={handleFileUpload}
              className="hidden"
            />
            <label htmlFor="xml-input" className="cursor-pointer flex flex-col items-center gap-2">
              <FileCode2 className="w-8 h-8 text-zinc-400" />
              <span className="text-xs font-semibold text-zinc-800">
                {loading ? 'Lendo e analisando XML...' : 'Clique para navegar ou solte o arquivo .xml aqui'}
              </span>
              <span className="text-[11px] text-zinc-400">Suporta arquivos padrão NF-e modelo 55</span>
            </label>
          </div>
        </div>
      )}

      {/* STEP 2: MAPEAMENTO DE PRODUTOS */}
      {step === 'mapeamento' && parsedNota && (
        <div className="space-y-6">
          {/* Header summary of imported note */}
          <div className="bg-white p-4 rounded-xl border border-[#E5E5E5] grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <span className="text-[10px] font-semibold text-zinc-400 uppercase">Fornecedor</span>
              <p className="font-bold text-xs text-zinc-900 truncate">{parsedNota.fornecedorNome}</p>
              <p className="text-[10px] text-zinc-500">CNPJ: {parsedNota.fornecedorCnpj}</p>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-zinc-400 uppercase">Número NF-e</span>
              <p className="font-bold text-xs text-zinc-900">Nota nº {parsedNota.numeroNota}</p>
              <p className="text-[10px] text-zinc-500">Emissão: {parsedNota.dataEmissao || '-'}</p>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-zinc-400 uppercase">Valor Líquido / Fatura</span>
              <p className="font-bold text-xs text-zinc-900">{formatMoney(parsedNota.valorLiquido)}</p>
              <p className="text-[10px] text-zinc-500">Impostos ST/IPI: {formatMoney(parsedNota.valorImpostos)}</p>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-zinc-400 uppercase">Vencimento a Pagar</span>
              <p className="font-bold text-xs text-amber-800 flex items-center gap-1 mt-0.5">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                {parsedNota.vencimento ? parsedNota.vencimento : 'À Vista / Não informado'}
              </p>
            </div>
          </div>

          {/* Mapping Table */}
          <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
            <div className="p-4 border-b border-[#E5E5E5] bg-zinc-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-xs text-zinc-900">
                  Mapeamento de Produtos ({parsedNota.itens.length} itens na nota)
                </h3>
                <p className="text-[11px] text-zinc-500">
                  Vincule cada item da nota fiscal a um produto do seu catálogo ou crie um novo.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setStep('upload')}
                className="px-3 py-1.5 border border-[#E5E5E5] bg-white hover:bg-zinc-100 rounded-lg text-xs font-medium text-zinc-700"
              >
                Trocar XML
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 border-b border-[#E5E5E5] text-zinc-500 font-medium">
                  <tr>
                    <th className="p-3.5">Cód. / Item na NF-e</th>
                    <th className="p-3.5">Qtd na NF</th>
                    <th className="p-3.5">Custo Unit.</th>
                    <th className="p-3.5">Total Item</th>
                    <th className="p-3.5">Produto Correspondente no Sistema</th>
                    <th className="p-3.5 text-right">Novo Produto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5E5]">
                  {parsedNota.itens.map((item) => {
                    const currentMappedId = itemMappings[item.idTemp] || '';

                    return (
                      <tr key={item.idTemp} className="hover:bg-zinc-50/80 transition-colors">
                        {/* Item na NF */}
                        <td className="p-3.5">
                          <span className="font-bold text-zinc-900 block">{item.descricaoFornecedor}</span>
                          <span className="text-[10px] text-zinc-400 font-mono">
                            Cód Fornecedor: {item.codigoFornecedor}
                          </span>
                        </td>

                        {/* Qtd */}
                        <td className="p-3.5 font-bold text-zinc-900">
                          {item.quantidade}
                        </td>

                        {/* Custo Unit */}
                        <td className="p-3.5 font-medium text-zinc-800">
                          {formatMoney(item.valorUnitario)}
                        </td>

                        {/* Total */}
                        <td className="p-3.5 font-bold text-zinc-900">
                          {formatMoney(item.valorTotal)}
                        </td>

                        {/* Mapeamento Selector */}
                        <td className="p-3.5">
                          <div className="flex items-center gap-2">
                            <select
                              value={currentMappedId}
                              onChange={(e) => {
                                const val = e.target.value;
                                setItemMappings((prev) => ({ ...prev, [item.idTemp]: val }));
                              }}
                              className={`w-full p-2 border rounded-lg text-xs font-medium focus:outline-none ${
                                currentMappedId
                                  ? 'bg-emerald-50/50 border-emerald-300 text-emerald-950 font-semibold'
                                  : 'bg-red-50/50 border-red-300 text-red-900 font-medium'
                              }`}
                            >
                              <option value="">-- SELECIONE O PRODUTO --</option>
                              {produtosDisponiveis.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.nome} {p.codigo ? `[${p.codigo}]` : ''} - Venda: R${p.preco_venda}
                                </option>
                              ))}
                            </select>

                            {item.autoMapped && (
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-semibold shrink-0">
                                Auto
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Novo Produto Button */}
                        <td className="p-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setQuickItemTarget(item);
                              setNovoNomeProd(item.descricaoFornecedor);
                              setNovoCodigo(item.codigoFornecedor);
                              setNovoPrecoVenda((item.valorUnitario * 1.35).toFixed(2));
                              setQuickProductModalOpen(true);
                            }}
                            className="px-2.5 py-1.5 border border-[#E5E5E5] hover:bg-zinc-100 text-zinc-800 font-semibold rounded-lg text-[11px] flex items-center gap-1 ml-auto cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5 text-amber-600" />
                            <span>Criar produto</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Confirm Entry Footer */}
            <div className="p-4 bg-zinc-50 border-t border-[#E5E5E5] flex items-center justify-between">
              <div className="text-xs text-zinc-600">
                O mapeamento realizado será salvo em <code className="bg-zinc-200 px-1 py-0.5 rounded text-[10px]">mapeamento_produto_fornecedor</code> para pré-preenchimento automático em futuras notas.
              </div>

              <button
                type="button"
                onClick={handleConfirmarEntrada}
                disabled={savingMapping}
                className="px-6 py-2.5 bg-[#F5D800] hover:bg-[#e2c700] text-zinc-950 font-bold text-xs rounded-lg transition-colors border border-[#d2b800] shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{savingMapping ? 'Processando entrada...' : 'Confirmar Entrada & Gerar Fatura'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: SUCCESS CONFIRMATION */}
      {step === 'sucesso' && parsedNota && (
        <div className="bg-white p-8 rounded-xl border border-emerald-200 bg-emerald-50/20 max-w-xl mx-auto text-center space-y-6 animate-in fade-in">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center border border-emerald-300">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h3 className="font-bold text-lg text-emerald-950">Entrada de Mercadoria Concluída!</h3>
            <p className="text-xs text-emerald-800 mt-1">
              Nota fiscal nº <strong>{parsedNota.numeroNota}</strong> do fornecedor <strong>{parsedNota.fornecedorNome}</strong> processada com sucesso.
            </p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-[#E5E5E5] text-left text-xs space-y-2 text-zinc-700">
            <div className="flex justify-between border-b pb-1.5">
              <span className="text-zinc-500">Estoque Atualizado:</span>
              <span className="font-bold text-zinc-900">{parsedNota.itens.length} produto(s) movimentados</span>
            </div>
            <div className="flex justify-between border-b pb-1.5">
              <span className="text-zinc-500">Conta a Pagar Gerada:</span>
              <span className="font-bold text-zinc-900">{formatMoney(parsedNota.valorLiquido)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Vencimento da Fatura:</span>
              <span className="font-bold text-amber-800">{parsedNota.vencimento || 'À vista'}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setStep('upload');
              setParsedNota(null);
              setItemMappings({});
            }}
            className="px-6 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer"
          >
            Importar Outra Nota Fiscal
          </button>
        </div>
      )}

      {/* Quick New Product Modal */}
      {quickProductModalOpen && quickItemTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-xl max-w-md w-full overflow-hidden animate-in fade-in">
            <div className="p-4 border-b border-[#E5E5E5] bg-zinc-50 flex items-center justify-between">
              <h3 className="font-bold text-sm text-zinc-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-500" />
                Cadastrar Novo Produto Rapidamente
              </h3>
              <button
                type="button"
                onClick={() => setQuickProductModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-medium text-zinc-700 mb-1">Nome do Produto no Sistema</label>
                <input
                  type="text"
                  value={novoNomeProd}
                  onChange={(e) => setNovoNomeProd(e.target.value)}
                  className="w-full p-2 bg-white border border-[#E5E5E5] rounded-lg text-xs font-semibold text-zinc-900 focus:outline-none focus:border-zinc-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-zinc-700 mb-1">Código de Barras / SKU</label>
                  <input
                    type="text"
                    value={novoCodigo}
                    onChange={(e) => setNovoCodigo(e.target.value)}
                    className="w-full p-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 mb-1">Preço de Venda Sugerido (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={novoPrecoVenda}
                    onChange={(e) => setNovoPrecoVenda(e.target.value)}
                    className="w-full p-2 bg-white border border-[#E5E5E5] rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-zinc-900"
                  />
                  <span className="text-[10px] text-zinc-400 mt-0.5 block">Custo NF: R${quickItemTarget.valorUnitario}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-[#E5E5E5] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setQuickProductModalOpen(false)}
                  className="px-4 py-2 border border-[#E5E5E5] hover:bg-zinc-100 rounded-lg text-zinc-700"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreateNewProduct}
                  className="px-4 py-2 bg-[#F5D800] hover:bg-[#e2c700] text-zinc-950 font-bold rounded-lg border border-[#d2b800]"
                >
                  Cadastrar & Mapear
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
