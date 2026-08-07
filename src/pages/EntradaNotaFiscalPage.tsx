import React, { useState, useEffect, useRef } from 'react';
import { useClickOutside } from '../hooks/useClickOutside';
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
  FileText,
  Search,
  PenTool,
  Trash2,
  Edit3,
  X,
  PlusCircle,
  FileSpreadsheet
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';
import { Produto, Fornecedor } from '../types';
import { useAuth } from '../context/AuthContext';
import { InputMaiusculo } from '../components/InputMaiusculo';

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
  chaveAcesso?: string | null;
  fornecedorNome: string;
  fornecedorCnpj: string;
  valorBruto: number;
  valorImpostos: number;
  valorLiquido: number;
  vencimento: string | null;
  dataEmissao: string | null;
  itens: ParsedXmlItem[];
}

interface ItemManual {
  idTemp: string;
  produtoId: string | null;
  codigo: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorImposto: number;
  valorBruto: number;
  valorLiquido: number;
}

export const EntradaNotaFiscalPage: React.FC = () => {
  const { usuarioProfile, empresa, selectedFilial } = useAuth();

  // Primary mode state: 'xml' | 'manual'
  const [modoEntrada, setModoEntrada] = useState<'xml' | 'manual'>('xml');

  // Wizard step: 'upload' | 'mapeamento' | 'sucesso'
  const [step, setStep] = useState<'upload' | 'mapeamento' | 'sucesso'>('upload');
  const [loading, setLoading] = useState(false);

  // Common catalog state
  const [produtosDisponiveis, setProdutosDisponiveis] = useState<Produto[]>([]);
  const [fornecedoresList, setFornecedoresList] = useState<Fornecedor[]>([]);

  // XML Mode State
  const [parsedNota, setParsedNota] = useState<ParsedXmlNota | null>(null);
  const [itemMappings, setItemMappings] = useState<Record<string, string>>({});
  const [savingMapping, setSavingMapping] = useState(false);

  // Manual Mode Header State
  const [selectedFornecedorId, setSelectedFornecedorId] = useState('');
  const [numeroNotaManual, setNumeroNotaManual] = useState('');
  const [dataEmissaoManual, setDataEmissaoManual] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [vencimentoManual, setVencimentoManual] = useState('');

  // Manual Mode Item Form State
  const [searchProdutoTerm, setSearchProdutoTerm] = useState('');
  const [selectedProduto, setSelectedProduto] = useState<Produto | null>(null);
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  const [itemDescricao, setItemDescricao] = useState('');
  const [itemUnidade, setItemUnidade] = useState('UN');
  const [itemQuantidade, setItemQuantidade] = useState('1');
  const [itemValorUnitario, setItemValorUnitario] = useState('');
  const [itemValorImposto, setItemValorImposto] = useState('0');
  const [itemValorBruto, setItemValorBruto] = useState('');
  const [itemValorLiquido, setItemValorLiquido] = useState('');
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

  // Stacked Items List for Manual Mode
  const [itensManual, setItensManual] = useState<ItemManual[]>([]);

  // Ref for product search container (close autocomplete on click outside or Esc)
  const productSearchContainerRef = useRef<HTMLDivElement>(null);

  // Quick Supplier Modal
  const [quickSupplierModalOpen, setQuickSupplierModalOpen] = useState(false);
  const [novoFornecedorNome, setNovoFornecedorNome] = useState('');
  const [novoFornecedorCnpj, setNovoFornecedorCnpj] = useState('');
  const [novoFornecedorEmail, setNovoFornecedorEmail] = useState('');
  const [novoFornecedorTelefone, setNovoFornecedorTelefone] = useState('');
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [supplierError, setSupplierError] = useState<string | null>(null);

  // Close product search dropdown on click outside or Escape key using reusable hook
  useClickOutside(productSearchContainerRef, () => setShowProductDropdown(false), showProductDropdown);

  // Quick New Product Modal
  const [quickProductModalOpen, setQuickProductModalOpen] = useState(false);
  const [quickItemTarget, setQuickItemTarget] = useState<ParsedXmlItem | null>(null);
  const [novoNomeProd, setNovoNomeProd] = useState('');
  const [novoPrecoVenda, setNovoPrecoVenda] = useState('');
  const [novoCodigo, setNovoCodigo] = useState('');
  const [novaUnidadeProd, setNovaUnidadeProd] = useState('UN');

  useEffect(() => {
    fetchProdutos();
    fetchFornecedores();
  }, [empresa]);

  const fetchProdutos = async () => {
    try {
      const { data } = await supabase
        .from('produtos')
        .select('*')
        .order('nome');
      if (data) setProdutosDisponiveis(data);
    } catch (err) {
      console.warn('Erro ao carregar produtos:', err);
    }
  };

  const fetchFornecedores = async () => {
    try {
      const { data } = await supabase
        .from('fornecedores')
        .select('*')
        .order('nome');
      if (data) setFornecedoresList(data);
    } catch (err) {
      console.warn('Erro ao carregar fornecedores:', err);
    }
  };

  // Auto-calculate Bruto and Líquido in Manual Item Form
  const handleQuantityOrPriceChange = (
    qtdStr: string,
    unitPriceStr: string,
    taxStr: string
  ) => {
    const qtd = parseFloat(qtdStr) || 0;
    const unitPrice = parseFloat(unitPriceStr) || 0;
    const tax = parseFloat(taxStr) || 0;

    const bruto = qtd * unitPrice;
    const liquido = bruto + tax;

    setItemValorBruto(bruto > 0 ? bruto.toFixed(2) : '');
    setItemValorLiquido(liquido > 0 ? liquido.toFixed(2) : '');
  };

  // Handle product selection in manual mode search autocomplete
  const handleSelectProdutoManual = (prod: Produto) => {
    setSelectedProduto(prod);
    setSearchProdutoTerm(`${prod.nome} ${prod.codigo ? `[${prod.codigo}]` : ''}`);
    setItemDescricao(prod.nome);
    setItemUnidade(prod.unidade || 'UN');
    setShowProductDropdown(false);

    if (prod.preco_venda) {
      setItemValorUnitario(prod.preco_venda.toString());
      handleQuantityOrPriceChange(itemQuantidade, prod.preco_venda.toString(), itemValorImposto);
    }
  };

  // Add or Update Item in Stacked List
  const handleAddOrUpdateItemManual = () => {
    if (!itemDescricao.trim()) {
      alert('Por favor, selecione um produto ou digite a descrição do item.');
      return;
    }

    const qtd = parseFloat(itemQuantidade) || 0;
    const unitPrice = parseFloat(itemValorUnitario) || 0;
    const tax = parseFloat(itemValorImposto) || 0;
    const bruto = parseFloat(itemValorBruto) || qtd * unitPrice;
    const liquido = parseFloat(itemValorLiquido) || bruto + tax;

    if (qtd <= 0) {
      alert('A quantidade deve ser maior que zero.');
      return;
    }

    const newItem: ItemManual = {
      idTemp: editingItemIndex !== null ? itensManual[editingItemIndex].idTemp : `item_man_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      produtoId: selectedProduto?.id || null,
      codigo: selectedProduto?.codigo || '',
      descricao: itemDescricao.trim(),
      unidade: itemUnidade.trim() || 'UN',
      quantidade: qtd,
      valorUnitario: unitPrice,
      valorImposto: tax,
      valorBruto: bruto,
      valorLiquido: liquido,
    };

    if (editingItemIndex !== null) {
      // Update existing
      const copy = [...itensManual];
      copy[editingItemIndex] = newItem;
      setItensManual(copy);
      setEditingItemIndex(null);
    } else {
      // Add new
      setItensManual((prev) => [...prev, newItem]);
    }

    // Reset item form fields
    resetItemForm();
  };

  const resetItemForm = () => {
    setSelectedProduto(null);
    setSearchProdutoTerm('');
    setItemDescricao('');
    setItemUnidade('UN');
    setItemQuantidade('1');
    setItemValorUnitario('');
    setItemValorImposto('0');
    setItemValorBruto('');
    setItemValorLiquido('');
    setEditingItemIndex(null);
    setShowProductDropdown(false);
  };

  const handleEditItemManual = (index: number) => {
    const item = itensManual[index];
    setEditingItemIndex(index);

    if (item.produtoId) {
      const prod = produtosDisponiveis.find((p) => p.id === item.produtoId);
      setSelectedProduto(prod || null);
    } else {
      setSelectedProduto(null);
    }

    setSearchProdutoTerm(item.descricao);
    setItemDescricao(item.descricao);
    setItemUnidade(item.unidade);
    setItemQuantidade(item.quantidade.toString());
    setItemValorUnitario(item.valorUnitario.toString());
    setItemValorImposto(item.valorImposto.toString());
    setItemValorBruto(item.valorBruto.toString());
    setItemValorLiquido(item.valorLiquido.toString());
  };

  const handleRemoveItemManual = (index: number) => {
    setItensManual((prev) => prev.filter((_, i) => i !== index));
    if (editingItemIndex === index) {
      resetItemForm();
    }
  };

  // Quick Create Supplier Function
  const handleCreateNewSupplier = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSupplierError(null);

    if (!novoFornecedorNome.trim()) {
      setSupplierError('Por favor, informe o nome / razão social do fornecedor.');
      return;
    }

    setSavingSupplier(true);
    try {
      const { data, error } = await supabase
        .from('fornecedores')
        .insert([
          {
            empresa_id: empresa?.id || null,
            nome: novoFornecedorNome.trim(),
            cnpj: novoFornecedorCnpj.replace(/\D/g, '') || null,
            email: novoFornecedorEmail.trim() || null,
            telefone: novoFornecedorTelefone.trim() || null,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error('Erro ao cadastrar fornecedor:', error);
        setSupplierError(`Erro ao cadastrar fornecedor: ${error.message}`);
      } else if (data) {
        setFornecedoresList((prev) => [...prev, data]);
        setSelectedFornecedorId(data.id);
        setQuickSupplierModalOpen(false);
        setNovoFornecedorNome('');
        setNovoFornecedorCnpj('');
        setNovoFornecedorEmail('');
        setNovoFornecedorTelefone('');
        setSupplierError(null);
      }
    } catch (err: any) {
      console.error('Erro ao criar fornecedor rápido:', err);
      setSupplierError(`Erro ao criar fornecedor: ${err.message || err}`);
    } finally {
      setSavingSupplier(false);
    }
  };

  // Quick Create Product Function
  const handleCreateNewProduct = async () => {
    if (!novoNomeProd.trim()) {
      alert('Por favor, preencha o nome do produto.');
      return;
    }

    try {
      const { data: newProd, error } = await supabase
        .from('produtos')
        .insert([
          {
            empresa_id: empresa?.id || null,
            codigo: novoCodigo.trim() || null,
            nome: novoNomeProd.trim(),
            unidade: novaUnidadeProd.trim() || 'UN',
            preco_venda: parseFloat(novoPrecoVenda) || 0,
            descricao: `Cadastrado na entrada de mercadoria ${numeroNotaManual ? `NF ${numeroNotaManual}` : ''}`,
          },
        ])
        .select()
        .single();

      if (error) {
        alert('Erro ao criar produto: ' + error.message);
      } else if (newProd) {
        setProdutosDisponiveis((prev) => [...prev, newProd]);

        if (modoEntrada === 'manual') {
          handleSelectProdutoManual(newProd);
        } else if (quickItemTarget) {
          setItemMappings((prev) => ({
            ...prev,
            [quickItemTarget.idTemp]: newProd.id,
          }));
        }

        setQuickProductModalOpen(false);
        setQuickItemTarget(null);
        setNovoNomeProd('');
        setNovoPrecoVenda('');
        setNovoCodigo('');
        setNovaUnidadeProd('UN');
      }
    } catch (err) {
      console.error('Erro ao cadastrar produto rápido:', err);
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

    const infNFe = xmlDoc.getElementsByTagName('infNFe')[0];
    const chaveAcesso = infNFe ? infNFe.getAttribute('Id')?.replace('NFe', '') || '' : '';

    const ide = xmlDoc.getElementsByTagName('ide')[0];
    const numeroNota = ide ? getTagText(ide, 'nNF') : '0000';
    const dhEmi = ide ? getTagText(ide, 'dhEmi') || getTagText(ide, 'dEmi') : '';

    const emit = xmlDoc.getElementsByTagName('emit')[0];
    const fornecedorNome = emit ? getTagText(emit, 'xNome') : 'Fornecedor Desconhecido';
    const fornecedorCnpj = emit ? getTagText(emit, 'CNPJ') || getTagText(emit, 'CPF') : '';

    const icmsTot = xmlDoc.getElementsByTagName('ICMSTot')[0];
    const valorBruto = icmsTot ? parseFloat(getTagText(icmsTot, 'vProd') || '0') : 0;
    const valorLiquido = icmsTot ? parseFloat(getTagText(icmsTot, 'vNF') || '0') : valorBruto;
    const vST = icmsTot ? parseFloat(getTagText(icmsTot, 'vST') || '0') : 0;
    const vIPI = icmsTot ? parseFloat(getTagText(icmsTot, 'vIPI') || '0') : 0;
    const valorImpostos = vST + vIPI;

    const dup = xmlDoc.getElementsByTagName('dup')[0];
    const vencimento = dup ? getTagText(dup, 'dVenc') : null;

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

      const { data: mappings } = await supabase
        .from('mapeamento_produto_fornecedor')
        .select('*')
        .eq('fornecedor_cnpj', parsed.fornecedorCnpj);

      const mappingMap = new Map<string, string>();
      if (mappings) {
        mappings.forEach((m) => mappingMap.set(m.codigo_fornecedor, m.produto_id));
      }

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

  // Confirm XML Entry
  const handleConfirmarEntradaXML = async () => {
    if (!parsedNota) return;

    const unmapped = parsedNota.itens.filter((item) => !itemMappings[item.idTemp]);
    if (unmapped.length > 0) {
      alert(`Existem ${unmapped.length} item(ns) sem produto mapeado. Associe todos os produtos antes de prosseguir.`);
      return;
    }

    setSavingMapping(true);
    try {
      const resolvedFilialId = selectedFilial?.id ?? (
        await supabase
          .from('filiais')
          .select('id')
          .eq('empresa_id', empresa?.id)
          .single()
      ).data?.id;

      if (!resolvedFilialId) {
        toast.error('Nenhuma filial encontrada. Cadastre uma filial primeiro.');
        setSavingMapping(false);
        return;
      }

      const { data: notaSalva } = await supabase
        .from('notas_fiscais_entrada')
        .insert([
          {
            empresa_id: empresa?.id || null,
            filial_id: resolvedFilialId,
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

      const mappingsToUpsert = parsedNota.itens.map((item) => ({
        empresa_id: empresa?.id || null,
        fornecedor_cnpj: parsedNota.fornecedorCnpj,
        codigo_fornecedor: item.codigoFornecedor,
        produto_id: itemMappings[item.idTemp],
      }));

      await supabase
        .from('mapeamento_produto_fornecedor')
        .upsert(mappingsToUpsert, { onConflict: 'fornecedor_cnpj,codigo_fornecedor' });

      await processFinalEntry(nId, parsedNota.vencimento, parsedNota.fornecedorNome, parsedNota.numeroNota, parsedNota.valorLiquido, parsedNota.itens.map(i => ({ produtoId: itemMappings[i.idTemp], quantidade: i.quantidade })), resolvedFilialId);

      setStep('sucesso');
    } catch (err) {
      console.error('Erro ao confirmar entrada XML:', err);
      alert('Erro ao dar entrada na Nota Fiscal.');
    } finally {
      setSavingMapping(false);
    }
  };

  // Confirm Manual Entry
  const handleConfirmarEntradaManual = async () => {
    if (!numeroNotaManual.trim()) {
      alert('Por favor, informe o número da nota fiscal.');
      return;
    }

    if (!selectedFornecedorId) {
      alert('Por favor, selecione um fornecedor.');
      return;
    }

    if (itensManual.length === 0) {
      alert('Por favor, adicione pelo menos um item à nota fiscal antes de confirmar.');
      return;
    }

    const fornecedor = fornecedoresList.find((f) => f.id === selectedFornecedorId);
    const fornecedorNome = fornecedor?.nome || 'Fornecedor Avulso';
    const fornecedorCnpj = fornecedor?.cnpj_cpf || '';

    const totalBruto = itensManual.reduce((sum, item) => sum + item.valorBruto, 0);
    const totalImpostos = itensManual.reduce((sum, item) => sum + item.valorImposto, 0);
    const totalLiquido = itensManual.reduce((sum, item) => sum + item.valorLiquido, 0);

    setSavingMapping(true);
    try {
      const resolvedFilialId = selectedFilial?.id ?? (
        await supabase
          .from('filiais')
          .select('id')
          .eq('empresa_id', empresa?.id)
          .single()
      ).data?.id;

      if (!resolvedFilialId) {
        toast.error('Nenhuma filial encontrada. Cadastre uma filial primeiro.');
        setSavingMapping(false);
        return;
      }

      // 1. Insert into notas_fiscais_entrada
      const { data: notaSalva, error: notaErr } = await supabase
        .from('notas_fiscais_entrada')
        .insert([
          {
            empresa_id: empresa?.id || null,
            filial_id: resolvedFilialId,
            numero_nota: numeroNotaManual.trim(),
            chave_acesso: null,
            fornecedor_nome: fornecedorNome,
            fornecedor_cnpj: fornecedorCnpj,
            valor_bruto: totalBruto,
            valor_impostos: totalImpostos,
            valor_liquido: totalLiquido,
            data_emissao: dataEmissaoManual || new Date().toISOString().split('T')[0],
            vencimento: vencimentoManual || null,
            status: 'processado',
          },
        ])
        .select()
        .single();

      if (notaErr) {
        throw new Error(notaErr.message);
      }

      const nId = notaSalva?.id || `nf_man_${Date.now()}`;

      // 2. Insert into notas_fiscais_itens
      const itensToInsert = itensManual.map((item) => ({
        nota_id: nId,
        codigo_fornecedor: item.codigo || 'MANUAL',
        descricao_fornecedor: item.descricao,
        quantidade: item.quantidade,
        valor_unitario: item.valorUnitario,
        valor_total: item.valorLiquido,
        produto_id_mapeado: item.produtoId,
      }));

      await supabase.from('notas_fiscais_itens').insert(itensToInsert);

      // 3. Save mappings in mapeamento_produto_fornecedor
      if (fornecedorCnpj) {
        const mappingsToUpsert = itensManual
          .filter((item) => item.produtoId)
          .map((item) => ({
            empresa_id: empresa?.id || null,
            fornecedor_cnpj: fornecedorCnpj,
            codigo_fornecedor: item.codigo || item.descricao.substring(0, 20),
            produto_id: item.produtoId!,
          }));

        if (mappingsToUpsert.length > 0) {
          await supabase
            .from('mapeamento_produto_fornecedor')
            .upsert(mappingsToUpsert, { onConflict: 'fornecedor_cnpj,codigo_fornecedor' });
        }
      }

      // 4. Process RPC and stock/bills update
      await processFinalEntry(
        nId,
        vencimentoManual || null,
        fornecedorNome,
        numeroNotaManual,
        totalLiquido,
        itensManual.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade })),
        resolvedFilialId
      );

      // Create synthetic parsedNota for success view display
      setParsedNota({
        numeroNota: numeroNotaManual,
        chaveAcesso: null,
        fornecedorNome,
        fornecedorCnpj,
        valorBruto: totalBruto,
        valorImpostos: totalImpostos,
        valorLiquido: totalLiquido,
        vencimento: vencimentoManual || null,
        dataEmissao: dataEmissaoManual || null,
        itens: itensManual.map((im) => ({
          idTemp: im.idTemp,
          codigoFornecedor: im.codigo || 'MANUAL',
          descricaoFornecedor: im.descricao,
          quantidade: im.quantidade,
          valorUnitario: im.valorUnitario,
          valorTotal: im.valorLiquido,
          produtoIdMapeado: im.produtoId,
          autoMapped: true,
        })),
      });

      setStep('sucesso');
    } catch (err: any) {
      console.error('Erro ao confirmar entrada manual:', err);
      alert('Erro ao processar entrada manual de mercadoria: ' + (err.message || ''));
    } finally {
      setSavingMapping(false);
    }
  };

  // Helper function to call RPC or direct fallback stock & bill updates
  const processFinalEntry = async (
    nId: string,
    vencimento: string | null,
    fornecedorNome: string,
    numeroNota: string,
    valorLiquido: number,
    itemsToUpdate: { produtoId: string | null; quantidade: number }[],
    resolvedFilialId: string
  ) => {
    try {
      const { error: rpcErr } = await supabase.rpc('confirmar_entrada_nota_fiscal', {
        p_nota_id: nId,
        p_filial_id: resolvedFilialId,
        p_usuario_id: usuarioProfile?.id || null,
        p_vencimento: vencimento || new Date().toISOString().split('T')[0],
      });

      if (rpcErr) {
        console.warn('RPC confirmar_entrada_nota_fiscal fallthrough, realizando atualizacao direta:', rpcErr.message);
        // Direct Fallback Updates
        for (const item of itemsToUpdate) {
          if (item.produtoId) {
            const { data: pf } = await supabase
              .from('produtos_filial')
              .select('estoque_fisico, estoque_virtual')
              .eq('produto_id', item.produtoId)
              .eq('filial_id', resolvedFilialId)
              .single();

            const estAtual = pf ? pf.estoque_fisico || 0 : 0;
            await supabase.from('produtos_filial').upsert({
              produto_id: item.produtoId,
              filial_id: resolvedFilialId,
              estoque_fisico: estAtual + item.quantidade,
              estoque_virtual: estAtual + item.quantidade,
            });
          }
        }

        // Create bill in contas_pagar
        await supabase.from('contas_pagar').insert([
          {
            empresa_id: empresa?.id || null,
            filial_id: resolvedFilialId,
            fornecedor_nome: fornecedorNome,
            descricao: `NF-e ${numeroNota} - ${fornecedorNome}`,
            categoria: 'Fornecedores',
            valor: valorLiquido,
            vencimento: vencimento || new Date().toISOString().split('T')[0],
            forma_pagamento: 'boleto',
            status: 'pendente',
          },
        ]);
      }
    } catch (e) {
      console.warn('Fallback ativacao de entrada:', e);
    }
  };

  const formatMoney = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  // Filtered product suggestions for autocomplete
  const filteredProducts = produtosDisponiveis.filter((p) => {
    if (!searchProdutoTerm) return true;
    const term = searchProdutoTerm.toLowerCase();
    return (
      p.nome.toLowerCase().includes(term) ||
      (p.codigo && p.codigo.toLowerCase().includes(term))
    );
  });

  // Totals for Manual Mode
  const totalBrutoManual = itensManual.reduce((acc, i) => acc + i.valorBruto, 0);
  const totalImpostosManual = itensManual.reduce((acc, i) => acc + i.valorImposto, 0);
  const totalLiquidoManual = itensManual.reduce((acc, i) => acc + i.valorLiquido, 0);

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="pb-4 border-b border-[#E5E5E5] flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
            <FileCode2 className="w-5 h-5 text-amber-500" />
            Entrada de Mercadoria / Lançamento de NF-e
          </h2>
          <p className="text-xs text-zinc-500">
            Importação por arquivo XML de nota fiscal ou lançamento manual de notas físicas
          </p>
        </div>

        {/* Entry Mode Switcher (XML vs Manual) when in Step 1 */}
        {step === 'upload' && (
          <div className="inline-flex p-1 bg-zinc-100 rounded-lg border border-[#E5E5E5]">
            <button
              type="button"
              onClick={() => setModoEntrada('xml')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                modoEntrada === 'xml'
                  ? 'bg-white text-zinc-950 shadow-2xs border border-[#E5E5E5]'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5 text-amber-600" />
              <span>Importar XML de NF-e</span>
            </button>

            <button
              type="button"
              onClick={() => setModoEntrada('manual')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                modoEntrada === 'manual'
                  ? 'bg-[#F5D800] text-zinc-950 font-bold border border-[#d2b800] shadow-2xs'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>Lançar Manualmente</span>
            </button>
          </div>
        )}
      </div>

      {/* Steps Indicator */}
      <div className="flex items-center justify-center gap-4 max-w-xl mx-auto py-1">
        <div className={`flex items-center gap-2 text-xs font-semibold ${step === 'upload' ? 'text-zinc-950 font-bold' : 'text-zinc-400'}`}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center border text-xs ${step === 'upload' ? 'bg-[#F5D800] border-[#d2b800] text-black' : 'bg-zinc-100 border-[#E5E5E5]'}`}>
            1
          </div>
          <span>{modoEntrada === 'xml' ? 'Upload do XML' : 'Dados da Nota'}</span>
        </div>

        <div className="w-8 h-px bg-[#E5E5E5]" />

        <div className={`flex items-center gap-2 text-xs font-semibold ${step === 'mapeamento' ? 'text-zinc-950 font-bold' : 'text-zinc-400'}`}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center border text-xs ${step === 'mapeamento' ? 'bg-[#F5D800] border-[#d2b800] text-black' : 'bg-zinc-100 border-[#E5E5E5]'}`}>
            2
          </div>
          <span>{modoEntrada === 'xml' ? 'Mapeamento de Produtos' : 'Conferência'}</span>
        </div>

        <div className="w-8 h-px bg-[#E5E5E5]" />

        <div className={`flex items-center gap-2 text-xs font-semibold ${step === 'sucesso' ? 'text-emerald-700 font-bold' : 'text-zinc-400'}`}>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center border text-xs ${step === 'sucesso' ? 'bg-emerald-600 text-white' : 'bg-zinc-100 border-[#E5E5E5]'}`}>
            3
          </div>
          <span>Estoque Atualizado</span>
        </div>
      </div>

      {/* MODE 1: XML UPLOAD */}
      {step === 'upload' && modoEntrada === 'xml' && (
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

      {/* MODE 2: LANÇAR MANUALMENTE */}
      {step === 'upload' && modoEntrada === 'manual' && (
        <div className="space-y-6">
          {/* Header Note Info Form */}
          <div className="bg-white p-5 rounded-xl border border-[#E5E5E5] space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3">
              <h3 className="font-bold text-xs text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-4 h-4 text-amber-500" />
                Cabeçalho da Nota Fiscal
              </h3>
              <span className="text-[11px] text-zinc-400">Preencha os dados do fornecedor e documento</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Fornecedor Selector with Quick Add */}
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-medium text-xs text-zinc-700">
                    Fornecedor <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setQuickSupplierModalOpen(true)}
                    className="text-[11px] text-amber-700 hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Cadastrar novo fornecedor</span>
                  </button>
                </div>

                <select
                  value={selectedFornecedorId}
                  onChange={(e) => setSelectedFornecedorId(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#E5E5E5] rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-zinc-900"
                >
                  <option value="">-- Selecione o fornecedor --</option>
                  {fornecedoresList.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome} {f.cnpj_cpf ? `(CNPJ/CPF: ${f.cnpj_cpf})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Número da Nota */}
              <div>
                <label className="block font-medium text-xs text-zinc-700 mb-1">
                  Número da Nota <span className="text-red-500">*</span>
                </label>
                <InputMaiusculo
                  type="text"
                  value={numeroNotaManual}
                  onChange={(e) => setNumeroNotaManual(e.target.value)}
                  placeholder="Ex: 001234"
                  className="w-full p-2.5 bg-white border border-[#E5E5E5] rounded-lg text-xs font-semibold text-zinc-900 focus:outline-none focus:border-zinc-900"
                />
              </div>

              {/* Data de Emissão */}
              <div>
                <label className="block font-medium text-xs text-zinc-700 mb-1">
                  Data de Emissão <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={dataEmissaoManual}
                  onChange={(e) => setDataEmissaoManual(e.target.value)}
                  className="w-full p-2.5 bg-white border border-[#E5E5E5] rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-zinc-900"
                />
              </div>
            </div>

            {/* Optional Vencimento */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#E5E5E5]">
              <div>
                <label className="block font-medium text-xs text-zinc-700 mb-1">
                  Vencimento da Fatura a Pagar <span className="text-zinc-400 font-normal">(Gera Conta a Pagar)</span>
                </label>
                <input
                  type="date"
                  value={vencimentoManual}
                  onChange={(e) => setVencimentoManual(e.target.value)}
                  className="w-full p-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                />
              </div>
            </div>
          </div>

          {/* Form to Add Item to Note */}
          <div className="bg-white p-5 rounded-xl border border-[#E5E5E5] space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5E5E5] pb-3">
              <h3 className="font-bold text-xs text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-500" />
                Lançar Item da Nota Fiscal
              </h3>
              <span className="text-[11px] text-zinc-400">
                {editingItemIndex !== null ? 'Editando item da lista' : 'Informe o produto e os valores'}
              </span>
            </div>

            {/* Product Search / Autocomplete Form */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Product Autocomplete */}
              <div className="md:col-span-2 relative" ref={productSearchContainerRef}>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-medium text-xs text-zinc-700">
                    Buscar Produto no Catálogo <span className="text-red-500">*</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setNovoNomeProd(searchProdutoTerm);
                      setQuickProductModalOpen(true);
                    }}
                    className="text-[11px] text-amber-700 hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Cadastrar novo produto</span>
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <InputMaiusculo
                    type="text"
                    value={searchProdutoTerm}
                    onFocus={() => setShowProductDropdown(true)}
                    onClick={() => setShowProductDropdown(true)}
                    onChange={(e) => {
                      setSearchProdutoTerm(e.target.value);
                      setItemDescricao(e.target.value);
                      setShowProductDropdown(true);
                      if (selectedProduto && e.target.value !== selectedProduto.nome) {
                        setSelectedProduto(null);
                      }
                    }}
                    placeholder="Digite o nome ou código de barras do produto..."
                    className="w-full pl-9 pr-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs font-semibold text-zinc-900 focus:outline-none focus:border-zinc-900"
                  />

                  {selectedProduto && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                      Encontrado
                    </span>
                  )}
                </div>

                {/* Autocomplete Dropdown */}
                {showProductDropdown && filteredProducts.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#E5E5E5] rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto">
                    {filteredProducts.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectProdutoManual(p)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-amber-50/60 border-b border-[#E5E5E5] last:border-0 flex items-center justify-between"
                      >
                        <div>
                          <span className="font-bold text-zinc-900 block">{p.nome}</span>
                          <span className="text-[10px] text-zinc-500">
                            Cód: {p.codigo || 'Sem cód'} | Un: {p.unidade || 'UN'}
                          </span>
                        </div>
                        <span className="font-semibold text-zinc-900 text-xs">
                          R$ {p.preco_venda || 0}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Descrição e Unidade */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block font-medium text-xs text-zinc-700 mb-1">
                    Descrição na Nota
                  </label>
                  <InputMaiusculo
                    type="text"
                    value={itemDescricao}
                    onChange={(e) => setItemDescricao(e.target.value)}
                    placeholder="Ex: Cimento CP-II 50kg"
                    className="w-full p-2 bg-white border border-[#E5E5E5] rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-zinc-900"
                  />
                </div>

                <div>
                  <label className="block font-medium text-xs text-zinc-700 mb-1">
                    Unidade
                  </label>
                  <InputMaiusculo
                    type="text"
                    value={itemUnidade}
                    onChange={(e) => setItemUnidade(e.target.value)}
                    placeholder="UN"
                    className="w-full p-2 bg-white border border-[#E5E5E5] rounded-lg text-xs font-semibold text-zinc-900 uppercase focus:outline-none focus:border-zinc-900 text-center"
                  />
                </div>
              </div>
            </div>

            {/* Quantidade, Valor Unitario, Impostos, Valor Bruto, Valor Liquido */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
              <div>
                <label className="block font-medium text-xs text-zinc-700 mb-1">
                  Quantidade <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={itemQuantidade}
                  onChange={(e) => {
                    setItemQuantidade(e.target.value);
                    handleQuantityOrPriceChange(e.target.value, itemValorUnitario, itemValorImposto);
                  }}
                  className="w-full p-2 bg-white border border-[#E5E5E5] rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-zinc-900"
                />
              </div>

              <div>
                <label className="block font-medium text-xs text-zinc-700 mb-1">
                  Valor Unitário (R$) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={itemValorUnitario}
                  onChange={(e) => {
                    setItemValorUnitario(e.target.value);
                    handleQuantityOrPriceChange(itemQuantidade, e.target.value, itemValorImposto);
                  }}
                  placeholder="0.00"
                  className="w-full p-2 bg-white border border-[#E5E5E5] rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-zinc-900"
                />
              </div>

              <div>
                <label className="block font-medium text-xs text-zinc-700 mb-1">
                  Impostos ICMS/IPI (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={itemValorImposto}
                  onChange={(e) => {
                    setItemValorImposto(e.target.value);
                    handleQuantityOrPriceChange(itemQuantidade, itemValorUnitario, e.target.value);
                  }}
                  placeholder="0.00"
                  className="w-full p-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-800 focus:outline-none focus:border-zinc-900"
                />
              </div>

              <div>
                <label className="block font-medium text-xs text-zinc-700 mb-1">
                  Valor Bruto (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={itemValorBruto}
                  onChange={(e) => setItemValorBruto(e.target.value)}
                  placeholder="Calculado"
                  className="w-full p-2 bg-zinc-50 border border-[#E5E5E5] rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-zinc-900"
                />
              </div>

              <div>
                <label className="block font-medium text-xs text-zinc-700 mb-1">
                  Valor Líquido (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={itemValorLiquido}
                  onChange={(e) => setItemValorLiquido(e.target.value)}
                  placeholder="Calculado"
                  className="w-full p-2 bg-amber-50/50 border border-amber-300 rounded-lg text-xs font-bold text-zinc-950 focus:outline-none focus:border-zinc-900"
                />
              </div>
            </div>

            {/* Action Button: Add Item */}
            <div className="flex items-center justify-end gap-2 pt-2">
              {editingItemIndex !== null && (
                <button
                  type="button"
                  onClick={resetItemForm}
                  className="px-3 py-2 border border-[#E5E5E5] bg-white hover:bg-zinc-100 rounded-lg text-xs text-zinc-700 font-medium"
                >
                  Cancelar Edição
                </button>
              )}

              <button
                type="button"
                onClick={handleAddOrUpdateItemManual}
                className="px-5 py-2 bg-[#F5D800] hover:bg-[#e2c700] text-zinc-950 font-bold text-xs rounded-lg transition-colors border border-[#d2b800] flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Plus className="w-4 h-4" />
                <span>{editingItemIndex !== null ? 'Atualizar Item na Lista' : 'Adicionar Item à Nota'}</span>
              </button>
            </div>
          </div>

          {/* Stacked Items List Table */}
          <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
            <div className="p-4 bg-zinc-50 border-b border-[#E5E5E5] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-xs text-zinc-900">
                  Itens Lançados nesta Nota ({itensManual.length})
                </h3>
                <p className="text-[11px] text-zinc-500">
                  Confira os itens empilhados antes de finalizar a entrada no estoque.
                </p>
              </div>
            </div>

            {itensManual.length === 0 ? (
              <div className="p-8 text-center text-zinc-400 text-xs">
                Nenhum item adicionado à nota ainda. Preencha o formulário acima e clique em "Adicionar Item à Nota".
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 border-b border-[#E5E5E5] text-zinc-500 font-medium">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">Produto / Descrição</th>
                      <th className="p-3">Qtd / Un.</th>
                      <th className="p-3">Valor Unit.</th>
                      <th className="p-3">Imposto</th>
                      <th className="p-3">Valor Bruto</th>
                      <th className="p-3">Valor Líquido</th>
                      <th className="p-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E5E5]">
                    {itensManual.map((item, idx) => (
                      <tr key={item.idTemp} className="hover:bg-zinc-50 transition-colors">
                        <td className="p-3 font-mono text-zinc-400">{idx + 1}</td>
                        <td className="p-3">
                          <span className="font-bold text-zinc-900 block">{item.descricao}</span>
                          {item.produtoId ? (
                            <span className="text-[10px] text-emerald-700 font-medium">
                              ✓ Mapeado para produto do catálogo
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-700 italic">
                              Sem vínculo direto com ID
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-bold text-zinc-900">
                          {item.quantidade} <span className="text-zinc-500 font-normal uppercase text-[10px]">{item.unidade}</span>
                        </td>
                        <td className="p-3 font-medium text-zinc-800">{formatMoney(item.valorUnitario)}</td>
                        <td className="p-3 text-zinc-600">{formatMoney(item.valorImposto)}</td>
                        <td className="p-3 font-semibold text-zinc-900">{formatMoney(item.valorBruto)}</td>
                        <td className="p-3 font-bold text-zinc-950">{formatMoney(item.valorLiquido)}</td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleEditItemManual(idx)}
                              className="p-1.5 text-zinc-600 hover:text-zinc-900 border border-[#E5E5E5] hover:bg-zinc-100 rounded-lg"
                              title="Editar item"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleRemoveItemManual(idx)}
                              className="p-1.5 text-red-600 hover:text-red-800 border border-red-200 hover:bg-red-50 rounded-lg"
                              title="Remover item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Totals Summary Footer */}
            {itensManual.length > 0 && (
              <div className="p-4 bg-zinc-50 border-t border-[#E5E5E5] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4 text-xs">
                  <div>
                    <span className="text-[10px] text-zinc-400 font-semibold uppercase block">Total Bruto</span>
                    <span className="font-bold text-zinc-800">{formatMoney(totalBrutoManual)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 font-semibold uppercase block">Impostos</span>
                    <span className="font-semibold text-zinc-700">{formatMoney(totalImpostosManual)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 font-semibold uppercase block">Total Líquido Fatura</span>
                    <span className="font-extrabold text-sm text-zinc-950">{formatMoney(totalLiquidoManual)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleConfirmarEntradaManual}
                  disabled={savingMapping}
                  className="px-6 py-2.5 bg-[#F5D800] hover:bg-[#e2c700] text-zinc-950 font-bold text-xs rounded-lg transition-colors border border-[#d2b800] shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{savingMapping ? 'Processando lançamento...' : 'Finalizar Lançamento Manual & Gerar Fatura'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 2: MAPEAMENTO DE PRODUTOS (XML MODE) */}
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
                Voltar
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
                        <td className="p-3.5">
                          <span className="font-bold text-zinc-900 block">{item.descricaoFornecedor}</span>
                          <span className="text-[10px] text-zinc-400 font-mono">
                            Cód Fornecedor: {item.codigoFornecedor}
                          </span>
                        </td>

                        <td className="p-3.5 font-bold text-zinc-900">
                          {item.quantidade}
                        </td>

                        <td className="p-3.5 font-medium text-zinc-800">
                          {formatMoney(item.valorUnitario)}
                        </td>

                        <td className="p-3.5 font-bold text-zinc-900">
                          {formatMoney(item.valorTotal)}
                        </td>

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

            <div className="p-4 bg-zinc-50 border-t border-[#E5E5E5] flex items-center justify-between">
              <div className="text-xs text-zinc-600">
                O mapeamento realizado será salvo para pré-preenchimento automático em futuras notas do mesmo fornecedor.
              </div>

              <button
                type="button"
                onClick={handleConfirmarEntradaXML}
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
              setItensManual([]);
              setNumeroNotaManual('');
              setSelectedFornecedorId('');
            }}
            className="px-6 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer"
          >
            Dar Entrada em Outra Nota Fiscal
          </button>
        </div>
      )}

      {/* Quick Supplier Creation Modal */}
      {quickSupplierModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-xl max-w-md w-full overflow-hidden animate-in fade-in">
            <div className="p-4 border-b border-[#E5E5E5] bg-zinc-50 flex items-center justify-between">
              <h3 className="font-bold text-sm text-zinc-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-500" />
                Cadastrar Novo Fornecedor
              </h3>
              <button
                type="button"
                onClick={() => setQuickSupplierModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewSupplier} className="p-5 space-y-3 text-xs">
              {supplierError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{supplierError}</span>
                </div>
              )}

              <div>
                <label className="block font-medium text-zinc-700 mb-1">
                  Nome / Razão Social <span className="text-red-500">*</span>
                </label>
                <InputMaiusculo
                  type="text"
                  required
                  value={novoFornecedorNome}
                  onChange={(e) => {
                    setNovoFornecedorNome(e.target.value);
                    if (supplierError) setSupplierError(null);
                  }}
                  placeholder="Ex: Ambev Distribuidora Ltda"
                  className="w-full p-2 bg-white border border-[#E5E5E5] rounded-lg text-xs font-semibold text-zinc-900 focus:outline-none focus:border-zinc-900"
                />
              </div>

              <div>
                <label className="block font-medium text-zinc-700 mb-1">CNPJ / CPF</label>
                <InputMaiusculo
                  type="text"
                  value={novoFornecedorCnpj}
                  onChange={(e) => setNovoFornecedorCnpj(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  className="w-full p-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-zinc-700 mb-1">E-mail</label>
                  <input
                    type="email"
                    value={novoFornecedorEmail}
                    onChange={(e) => setNovoFornecedorEmail(e.target.value)}
                    placeholder="contato@fornecedor.com"
                    className="w-full p-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 mb-1">Telefone / WhatsApp</label>
                  <InputMaiusculo
                    type="text"
                    value={novoFornecedorTelefone}
                    onChange={(e) => setNovoFornecedorTelefone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="w-full p-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-[#E5E5E5] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setQuickSupplierModalOpen(false)}
                  className="px-4 py-2 border border-[#E5E5E5] hover:bg-zinc-100 rounded-lg text-zinc-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingSupplier}
                  onClick={(e) => handleCreateNewSupplier(e)}
                  className="px-4 py-2 bg-[#F5D800] hover:bg-[#e2c700] text-zinc-950 font-bold rounded-lg border border-[#d2b800] cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {savingSupplier ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <span>Salvar Fornecedor</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick New Product Modal */}
      {quickProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-xl max-w-md w-full overflow-hidden animate-in fade-in">
            <div className="p-4 border-b border-[#E5E5E5] bg-zinc-50 flex items-center justify-between">
              <h3 className="font-bold text-sm text-zinc-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-500" />
                Cadastrar Novo Produto no Catálogo
              </h3>
              <button
                type="button"
                onClick={() => setQuickProductModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-medium text-zinc-700 mb-1">Nome do Produto no Sistema</label>
                <InputMaiusculo
                  type="text"
                  value={novoNomeProd}
                  onChange={(e) => setNovoNomeProd(e.target.value)}
                  className="w-full p-2 bg-white border border-[#E5E5E5] rounded-lg text-xs font-semibold text-zinc-900 focus:outline-none focus:border-zinc-900"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-zinc-700 mb-1">Cód. Barras / SKU</label>
                  <InputMaiusculo
                    type="text"
                    value={novoCodigo}
                    onChange={(e) => setNovoCodigo(e.target.value)}
                    className="w-full p-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 mb-1">Unidade</label>
                  <InputMaiusculo
                    type="text"
                    value={novaUnidadeProd}
                    onChange={(e) => setNovaUnidadeProd(e.target.value)}
                    placeholder="UN"
                    className="w-full p-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 uppercase focus:outline-none focus:border-zinc-900 text-center"
                  />
                </div>

                <div>
                  <label className="block font-medium text-zinc-700 mb-1">Preço Venda (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={novoPrecoVenda}
                    onChange={(e) => setNovoPrecoVenda(e.target.value)}
                    className="w-full p-2 bg-white border border-[#E5E5E5] rounded-lg text-xs font-bold text-zinc-900 focus:outline-none focus:border-zinc-900"
                  />
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
                  Cadastrar & Selecionar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
