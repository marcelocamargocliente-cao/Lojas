import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Upload, 
  ArrowRight, 
  ArrowLeft, 
  Check, 
  AlertTriangle, 
  RotateCcw, 
  CheckCircle2, 
  XCircle, 
  Table, 
  HelpCircle,
  Package,
  Boxes,
  Users,
  Truck,
  FileText
} from 'lucide-react';
import Papa from 'papaparse';
import { supabase } from '../lib/supabaseClient';
import { Importacao, ImportacaoRegistro } from '../types';
import { useAuth } from '../context/AuthContext';

type EntityType = 'produtos' | 'estoque' | 'clientes' | 'fornecedores';

interface SystemField {
  key: string;
  label: string;
  required: boolean;
  type: 'string' | 'number';
}

const SYSTEM_FIELDS: Record<EntityType, SystemField[]> = {
  produtos: [
    { key: 'nome', label: 'Nome do Produto', required: true, type: 'string' },
    { key: 'codigo_barras', label: 'Código de Barras', required: false, type: 'string' },
    { key: 'sku', label: 'SKU', required: false, type: 'string' },
    { key: 'preco_venda', label: 'Preço de Venda', required: true, type: 'number' },
    { key: 'preco_custo', label: 'Preço de Custo', required: false, type: 'number' },
    { key: 'unidade_medida', label: 'Unidade (UN, KG, M)', required: false, type: 'string' },
    { key: 'categoria', label: 'Categoria', required: false, type: 'string' },
  ],
  estoque: [
    { key: 'codigo_barras', label: 'Código de Barras ou SKU', required: true, type: 'string' },
    { key: 'estoque_fisico', label: 'Quantidade em Estoque', required: true, type: 'number' },
    { key: 'localizacao_fisica', label: 'Localização Física (Prateleira)', required: false, type: 'string' },
  ],
  clientes: [
    { key: 'nome', label: 'Nome do Cliente', required: true, type: 'string' },
    { key: 'cpf', label: 'CPF ou CNPJ', required: false, type: 'string' },
    { key: 'telefone', label: 'Telefone / WhatsApp', required: false, type: 'string' },
    { key: 'endereco', label: 'Endereço Completo', required: false, type: 'string' },
    { key: 'limite_fiado', label: 'Limite de Fiado (R$)', required: false, type: 'number' },
  ],
  fornecedores: [
    { key: 'razao_social', label: 'Razão Social / Nome', required: true, type: 'string' },
    { key: 'cnpj', label: 'CNPJ', required: false, type: 'string' },
    { key: 'telefone', label: 'Telefone', required: false, type: 'string' },
    { key: 'email', label: 'E-mail', required: false, type: 'string' },
  ],
};

export const ImportadorPage: React.FC = () => {
  const { usuarioProfile, empresa, selectedFilial } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [tipoImportacao, setTipoImportacao] = useState<EntityType>('produtos');
  const [arquivo, setArquivo] = useState<File | null>(null);

  // CSV parsed state
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, any>[]>([]);
  
  // Mapping state: systemFieldKey -> csvHeader
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  // Validation/Preview rows
  const [validatedRows, setValidatedRows] = useState<{
    linha: number;
    dadosMapeados: Record<string, any>;
    valid: boolean;
    erro?: string;
  }[]>([]);

  // Import execution
  const [executando, setExecutando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [importacaoConcluida, setImportacaoConcluida] = useState<Importacao | null>(null);

  // Reversion
  const [revertendo, setRevertendo] = useState(false);
  const [revertidoComSucesso, setRevertidoComSucesso] = useState(false);

  // STEP 1: Handle File Selection & Parse CSV
  const handleFileChange = (file: File) => {
    setArquivo(file);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (results) => {
        if (results.meta.fields && results.data) {
          const headers = results.meta.fields;
          setCsvHeaders(headers);
          setCsvRows(results.data as Record<string, any>[]);

          // Auto-guess mapping based on header similarity
          const initialMap: Record<string, string> = {};
          SYSTEM_FIELDS[tipoImportacao].forEach((sysField) => {
            const match = headers.find((h) =>
              h.toLowerCase().includes(sysField.key.toLowerCase()) ||
              h.toLowerCase().includes(sysField.label.toLowerCase())
            );
            if (match) {
              initialMap[sysField.key] = match;
            }
          });
          setColumnMapping(initialMap);
        }
      },
      error: (err) => {
        alert('Erro ao ler arquivo CSV: ' + err.message);
      },
    });
  };

  // STEP 2 -> STEP 3: Perform Validation
  const handleIrParaPreview = () => {
    const requiredSysFields = SYSTEM_FIELDS[tipoImportacao].filter((f) => f.required);
    const missingRequired = requiredSysFields.filter((rf) => !columnMapping[rf.key]);

    if (missingRequired.length > 0) {
      alert(`Por favor, mapeie os campos obrigatórios: ${missingRequired.map((f) => f.label).join(', ')}`);
      return;
    }

    // Validate each row
    const validated = csvRows.map((row, index) => {
      const mappedData: Record<string, any> = {};
      let isValid = true;
      let errorMsg = '';

      // Extract mapped fields
      SYSTEM_FIELDS[tipoImportacao].forEach((sysField) => {
        const csvCol = columnMapping[sysField.key];
        let val = csvCol ? row[csvCol] : undefined;

        if (sysField.type === 'number' && val !== undefined && val !== null && val !== '') {
          // Clean currency symbols or commas
          val = String(val).replace('R$', '').replace(/\s/g, '').replace(',', '.');
          val = parseFloat(val);
          if (isNaN(val)) val = 0;
        }

        mappedData[sysField.key] = val;
      });

      // Check mandatory rules
      requiredSysFields.forEach((reqField) => {
        const v = mappedData[reqField.key];
        if (v === undefined || v === null || v === '') {
          isValid = false;
          errorMsg += `[${reqField.label}] é obrigatório. `;
        }
      });

      return {
        linha: index + 1,
        dadosMapeados: mappedData,
        valid: isValid,
        erro: errorMsg.trim(),
      };
    });

    setValidatedRows(validated);
    setStep(3);
  };

  // STEP 3 -> STEP 4: Process Import into Database
  const handleExecutarImportacao = async () => {
    if (!usuarioProfile) return;
    setExecutando(true);
    setProgresso(0);

    const validRows = validatedRows.filter((r) => r.valid);
    const total = validRows.length;

    try {
      // 1. Create Import Record Header
      const { data: importHeader, error: headerErr } = await supabase
        .from('importacoes')
        .select('*')
        .single();

      // Insert new import entry
      const { data: newImportHeader, error: insErr } = await supabase
        .from('importacoes')
        .insert([
          {
            empresa_id: empresa?.id || null,
            usuario_id: usuarioProfile.id,
            tipo: tipoImportacao,
            status: 'importado',
            nome_arquivo: arquivo?.name || 'importacao.csv',
            total_linhas: csvRows.length,
            linhas_sucesso: total,
            linhas_erro: csvRows.length - total,
            mapeamento_colunas: columnMapping,
          },
        ])
        .select('*')
        .single();

      if (insErr) throw insErr;

      const importId = newImportHeader.id;
      let okCount = 0;

      // 2. Insert mapped rows into destination table and importacao_registros
      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        let createdEntityId = null;

        if (tipoImportacao === 'produtos') {
          const { data: prod } = await supabase
            .from('produtos')
            .insert([
              {
                empresa_id: empresa?.id || null,
                nome: row.dadosMapeados.nome,
                codigo_barras: row.dadosMapeados.codigo_barras || null,
                sku: row.dadosMapeados.sku || null,
                preco_venda: row.dadosMapeados.preco_venda,
                preco_custo: row.dadosMapeados.preco_custo || 0,
                unidade_medida: row.dadosMapeados.unidade_medida || 'UN',
              },
            ])
            .select('id')
            .single();

          if (prod) createdEntityId = prod.id;
        } else if (tipoImportacao === 'clientes') {
          const cleanCpf = row.dadosMapeados.cpf ? String(row.dadosMapeados.cpf).replace(/\D/g, '') : null;
          const { data: cli } = await supabase
            .from('clientes')
            .insert([
              {
                empresa_id: empresa?.id || null,
                nome: row.dadosMapeados.nome,
                cpf: cleanCpf,
                telefone: row.dadosMapeados.telefone || null,
                endereco: row.dadosMapeados.endereco || null,
                limite_fiado: row.dadosMapeados.limite_fiado || 0,
              },
            ])
            .select('id')
            .single();

          if (cli) createdEntityId = cli.id;
        } else if (tipoImportacao === 'fornecedores') {
          const cleanCnpj = row.dadosMapeados.cnpj ? String(row.dadosMapeados.cnpj).replace(/\D/g, '') : null;
          const { data: forn } = await supabase
            .from('fornecedores')
            .insert([
              {
                empresa_id: empresa?.id || null,
                razao_social: row.dadosMapeados.razao_social,
                cnpj: cleanCnpj,
                telefone: row.dadosMapeados.telefone || null,
                email: row.dadosMapeados.email || null,
              },
            ])
            .select('id')
            .single();

          if (forn) createdEntityId = forn.id;
        } else if (tipoImportacao === 'estoque') {
          // Find product by barcode or SKU and update stock in branch
          const { data: prod } = await supabase
            .from('produtos')
            .select('id')
            .or(`codigo_barras.eq.${row.dadosMapeados.codigo_barras},sku.eq.${row.dadosMapeados.codigo_barras}`)
            .limit(1)
            .maybeSingle();

          if (prod && selectedFilial?.id) {
            createdEntityId = prod.id;
            await supabase
              .from('produtos_filial')
              .upsert(
                {
                  produto_id: prod.id,
                  filial_id: selectedFilial.id,
                  estoque_fisico: row.dadosMapeados.estoque_fisico,
                  localizacao_fisica: row.dadosMapeados.localizacao_fisica || null,
                },
                { onConflict: 'produto_id,filial_id' }
              );
          }
        }

        // Insert into importacao_registros
        await supabase.from('importacao_registros').insert([
          {
            importacao_id: importId,
            linha_numero: row.linha,
            dados_originais: csvRows[row.linha - 1] || {},
            dados_mapeados: row.dadosMapeados,
            status: 'ok',
            entidade_criada_id: createdEntityId,
          },
        ]);

        okCount++;
        setProgresso(Math.round(((i + 1) / total) * 100));
      }

      setImportacaoConcluida(newImportHeader);
      setStep(4);
    } catch (err) {
      console.error('Erro na execução da importação:', err);
      alert('Erro ao importar registros.');
    } finally {
      setExecutando(false);
    }
  };

  // Revert Import RPC call
  const handleReverterImportacao = async () => {
    if (!importacaoConcluida) return;

    if (!confirm('Tem certeza de que deseja reverter esta importação? Todos os registros criados serão apagados do sistema.')) return;

    setRevertendo(true);
    try {
      // Invoke RPC reverter_importacao(p_importacao_id, p_tipo)
      const { error } = await supabase.rpc('reverter_importacao', {
        p_importacao_id: importacaoConcluida.id,
        p_tipo: tipoImportacao,
      });

      if (error) {
        // Fallback: manually delete entries created in importacao_registros
        const { data: regs } = await supabase
          .from('importacao_registros')
          .select('entidade_criada_id')
          .eq('importacao_id', importacaoConcluida.id);

        if (regs && regs.length > 0) {
          const ids = regs.map((r) => r.entidade_criada_id).filter(Boolean);
          if (ids.length > 0) {
            if (tipoImportacao === 'produtos') await supabase.from('produtos').delete().in('id', ids);
            if (tipoImportacao === 'clientes') await supabase.from('clientes').delete().in('id', ids);
            if (tipoImportacao === 'fornecedores') await supabase.from('fornecedores').delete().in('id', ids);
          }
        }

        await supabase
          .from('importacoes')
          .update({ status: 'revertido' })
          .eq('id', importacaoConcluida.id);
      }

      setRevertidoComSucesso(true);
    } catch (err) {
      console.error('Erro ao reverter importação:', err);
      alert('Erro ao reverter importação.');
    } finally {
      setRevertendo(false);
    }
  };

  const getTipoIcon = (tipo: EntityType) => {
    switch (tipo) {
      case 'produtos':
        return <Package className="w-4 h-4 text-amber-500" />;
      case 'estoque':
        return <Boxes className="w-4 h-4 text-amber-500" />;
      case 'clientes':
        return <Users className="w-4 h-4 text-amber-500" />;
      case 'fornecedores':
        return <Truck className="w-4 h-4 text-amber-500" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl border border-[#E5E5E5] p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-amber-500" />
            Importador de Dados
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Importe produtos, saldos de estoque, clientes ou fornecedores via planilha CSV com validação automática.
          </p>
        </div>

        {/* Wizard Stepper Pills */}
        <div className="flex items-center gap-1.5 bg-zinc-100 p-1.5 rounded-xl border border-[#E5E5E5] text-[11px] font-bold">
          <span className={`px-2.5 py-1 rounded-lg ${step === 1 ? 'bg-[#F5D800] text-zinc-950' : 'text-zinc-500'}`}>
            1. Arquivo
          </span>
          <span className={`px-2.5 py-1 rounded-lg ${step === 2 ? 'bg-[#F5D800] text-zinc-950' : 'text-zinc-500'}`}>
            2. Mapeamento
          </span>
          <span className={`px-2.5 py-1 rounded-lg ${step === 3 ? 'bg-[#F5D800] text-zinc-950' : 'text-zinc-500'}`}>
            3. Validação
          </span>
          <span className={`px-2.5 py-1 rounded-lg ${step === 4 ? 'bg-[#F5D800] text-zinc-950' : 'text-zinc-500'}`}>
            4. Resultado
          </span>
        </div>
      </div>

      {/* Wizard Step Content */}
      <div className="bg-white rounded-xl border border-[#E5E5E5] p-6 shadow-2xs">
        
        {/* STEP 1: Select Type & Upload File */}
        {step === 1 && (
          <div className="space-y-6 max-w-2xl mx-auto">
            <div>
              <label className="block text-xs font-bold text-zinc-800 mb-2">1. Selecione o tipo de dados para importar</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(['produtos', 'estoque', 'clientes', 'fornecedores'] as EntityType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setTipoImportacao(type);
                      setColumnMapping({});
                    }}
                    className={`p-3 rounded-xl border text-left transition-colors cursor-pointer flex flex-col items-center justify-center gap-2 ${
                      tipoImportacao === type
                        ? 'bg-amber-50 border-[#F5D800] text-zinc-950 font-bold shadow-2xs'
                        : 'bg-zinc-50 border-[#E5E5E5] text-zinc-600 hover:bg-zinc-100'
                    }`}
                  >
                    {getTipoIcon(type)}
                    <span className="text-xs capitalize">{type}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-800 mb-2">2. Selecione o arquivo CSV (.csv, .txt)</label>
              <label className="border-2 border-dashed border-zinc-300 hover:border-zinc-900 rounded-xl p-8 flex flex-col items-center justify-center gap-3 bg-zinc-50/50 cursor-pointer transition-colors">
                <Upload className="w-8 h-8 text-amber-500" />
                <div className="text-center">
                  <span className="text-xs font-bold text-zinc-900 block">Clique para selecionar ou arraste o arquivo CSV</span>
                  <span className="text-[11px] text-zinc-400 block mt-0.5">Arquivos CSV exportados do Excel ou ERPs</span>
                </div>
                <input
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileChange(e.target.files[0]);
                    }
                  }}
                />
              </label>

              {arquivo && (
                <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-900 font-medium">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span>{arquivo.name} ({csvRows.length} linhas detectadas)</span>
                  </div>
                  <span className="text-[10px] bg-emerald-200 px-2 py-0.5 rounded font-bold uppercase">Pronto</span>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-[#E5E5E5] flex justify-end">
              <button
                type="button"
                disabled={!arquivo || csvRows.length === 0}
                onClick={() => setStep(2)}
                className="px-5 py-2.5 bg-[#F5D800] hover:bg-[#e2c700] text-zinc-950 font-bold rounded-xl text-xs border border-[#d2b800] flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-2xs"
              >
                <span>Avançar para Mapeamento</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Column Mapping */}
        {step === 2 && (
          <div className="space-y-6 max-w-3xl mx-auto">
            <div>
              <h3 className="font-bold text-sm text-zinc-900 mb-1">Mapeamento de Colunas</h3>
              <p className="text-xs text-zinc-500">
                Associe cada campo do sistema à coluna correspondente no seu arquivo CSV.
              </p>
            </div>

            <div className="divide-y divide-[#E5E5E5] border border-[#E5E5E5] rounded-xl overflow-hidden bg-white">
              <div className="bg-zinc-100 p-3 text-xs font-bold text-zinc-700 grid grid-cols-2 gap-4">
                <span>Campo do Sistema ({tipoImportacao})</span>
                <span>Coluna Correspondente no CSV</span>
              </div>

              {SYSTEM_FIELDS[tipoImportacao].map((sysField) => (
                <div key={sysField.key} className="p-3.5 grid grid-cols-1 sm:grid-cols-2 items-center gap-4 text-xs">
                  <div>
                    <span className="font-bold text-zinc-900 flex items-center gap-1">
                      {sysField.label}
                      {sysField.required && <span className="text-red-500 font-bold">*</span>}
                    </span>
                    <span className="text-[10px] text-zinc-400 block font-normal">Tipo: {sysField.type}</span>
                  </div>

                  <select
                    value={columnMapping[sysField.key] || ''}
                    onChange={(e) =>
                      setColumnMapping({ ...columnMapping, [sysField.key]: e.target.value })
                    }
                    className="w-full p-2 bg-zinc-50 border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900 font-medium"
                  >
                    <option value="">-- Não importar / Ignorar --</option>
                    {csvHeaders.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-[#E5E5E5] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 border border-[#E5E5E5] hover:bg-zinc-100 text-zinc-700 font-semibold text-xs rounded-xl flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar</span>
              </button>

              <button
                type="button"
                onClick={handleIrParaPreview}
                className="px-5 py-2.5 bg-[#F5D800] hover:bg-[#e2c700] text-zinc-950 font-bold rounded-xl text-xs border border-[#d2b800] flex items-center gap-2 cursor-pointer shadow-2xs"
              >
                <span>Validar e Ver Prévia</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Preview & Validation */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E5E5] pb-3">
              <div>
                <h3 className="font-bold text-sm text-zinc-900">Prévia e Validação das Linhas</h3>
                <p className="text-xs text-zinc-500">
                  {validatedRows.filter((r) => r.valid).length} de {validatedRows.length} linhas estão prontas para importação.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-md font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {validatedRows.filter((r) => r.valid).length} OK
                </span>
                <span className="bg-red-100 text-red-800 px-2.5 py-1 rounded-md font-bold flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5" />
                  {validatedRows.filter((r) => !r.valid).length} Erros
                </span>
              </div>
            </div>

            {/* Validation Table */}
            <div className="border border-[#E5E5E5] rounded-xl overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-100 text-zinc-700 font-bold border-b border-[#E5E5E5] sticky top-0">
                  <tr>
                    <th className="p-3">Linha</th>
                    <th className="p-3">Status</th>
                    {SYSTEM_FIELDS[tipoImportacao].map((f) => (
                      <th key={f.key} className="p-3">
                        {f.label}
                      </th>
                    ))}
                    <th className="p-3">Observação / Erro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5E5]">
                  {validatedRows.map((row) => (
                    <tr key={row.linha} className={row.valid ? 'hover:bg-zinc-50' : 'bg-red-50/60'}>
                      <td className="p-3 font-semibold text-zinc-600">#{row.linha}</td>
                      <td className="p-3">
                        {row.valid ? (
                          <span className="text-emerald-700 font-bold flex items-center gap-1">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            Pronto
                          </span>
                        ) : (
                          <span className="text-red-700 font-bold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                            Inválido
                          </span>
                        )}
                      </td>
                      {SYSTEM_FIELDS[tipoImportacao].map((f) => (
                        <td key={f.key} className="p-3 text-zinc-900 font-medium">
                          {String(row.dadosMapeados[f.key] ?? '')}
                        </td>
                      ))}
                      <td className="p-3 text-red-700 font-semibold">{row.erro || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Progress bar during execution */}
            {executando && (
              <div className="p-4 bg-amber-50 border border-[#F5D800] rounded-xl space-y-2">
                <div className="flex justify-between text-xs font-bold text-amber-950">
                  <span>Processando importação no banco de dados...</span>
                  <span>{progresso}%</span>
                </div>
                <div className="w-full bg-amber-200 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-zinc-900 h-full transition-all duration-300"
                    style={{ width: `${progresso}%` }}
                  />
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-[#E5E5E5] flex items-center justify-between">
              <button
                type="button"
                disabled={executando}
                onClick={() => setStep(2)}
                className="px-4 py-2 border border-[#E5E5E5] hover:bg-zinc-100 text-zinc-700 font-semibold text-xs rounded-xl flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Ajustar Mapeamento</span>
              </button>

              <button
                type="button"
                disabled={executando || validatedRows.filter((r) => r.valid).length === 0}
                onClick={handleExecutarImportacao}
                className="px-6 py-2.5 bg-[#F5D800] hover:bg-[#e2c700] text-zinc-950 font-bold rounded-xl text-xs border border-[#d2b800] flex items-center gap-2 cursor-pointer shadow-2xs disabled:opacity-50"
              >
                {executando ? 'Importando...' : 'Confirmar e Importar Registros'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Summary & Revert Option */}
        {step === 4 && (
          <div className="space-y-6 max-w-2xl mx-auto text-center py-6">
            {!revertidoComSucesso ? (
              <div className="space-y-4">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10" />
                </div>

                <div>
                  <h3 className="text-lg font-bold text-zinc-950">Importação Concluída com Sucesso!</h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    Os dados foram gravados na base de dados de {tipoImportacao}.
                  </p>
                </div>

                <div className="bg-zinc-50 border border-[#E5E5E5] rounded-xl p-4 grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-zinc-500 block">Total Processado</span>
                    <span className="font-bold text-zinc-900 text-sm">{importacaoConcluida?.total_linhas || 0}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">Registros Inseridos</span>
                    <span className="font-bold text-emerald-700 text-sm">{importacaoConcluida?.linhas_sucesso || 0}</span>
                  </div>
                </div>

                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-left">
                  <span className="font-bold text-xs text-amber-900 block flex items-center gap-1.5">
                    <RotateCcw className="w-4 h-4 text-amber-600" />
                    Opção de Reversão de Segurança
                  </span>
                  <p className="text-xs text-amber-800">
                    Se você importou dados incorretos por engano, você pode desfazer esta operação a qualquer momento.
                  </p>

                  <button
                    type="button"
                    disabled={revertendo}
                    onClick={handleReverterImportacao}
                    className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-xs cursor-pointer flex items-center gap-1.5 shadow-2xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{revertendo ? 'Revertendo...' : 'Reverter esta Importação'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                  <RotateCcw className="w-10 h-10" />
                </div>

                <div>
                  <h3 className="text-lg font-bold text-zinc-950">Importação Revertida!</h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    Os registros criados por este lote foram removidos do sistema.
                  </p>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-[#E5E5E5] flex justify-center">
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setArquivo(null);
                  setCsvRows([]);
                  setCsvHeaders([]);
                  setValidatedRows([]);
                  setImportacaoConcluida(null);
                  setRevertidoComSucesso(false);
                }}
                className="px-6 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white font-bold rounded-xl text-xs cursor-pointer shadow-2xs"
              >
                Nova Importação
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
