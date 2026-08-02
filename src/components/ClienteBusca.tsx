import React, { useState, useEffect, useRef } from 'react';
import { Search, UserCheck, AlertTriangle, AlertCircle, UserX, Plus, MapPin, CreditCard, Phone, X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Cliente } from '../types';
import { useClickOutside } from '../hooks/useClickOutside';
import { InputMaiusculo } from './InputMaiusculo';

interface ClienteBuscaProps {
  selectedCliente: Cliente | null;
  onSelectCliente: (cliente: Cliente | null) => void;
}

export const ClienteBusca: React.FC<ClienteBuscaProps> = ({
  selectedCliente,
  onSelectCliente,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sugestoes, setSugestoes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(false);
  const [showNovoClienteModal, setShowNovoClienteModal] = useState(false);

  // Quick form for new client registration with separated address fields
  const [novoNome, setNovoNome] = useState('');
  const [novoCpf, setNovoCpf] = useState('');
  const [novoTelefone, setNovoTelefone] = useState('');
  const [novoRua, setNovoRua] = useState('');
  const [novoNumero, setNovoNumero] = useState('');
  const [novoBairro, setNovoBairro] = useState('');
  const [novoReferencia, setNovoReferencia] = useState('');
  const [savingCliente, setSavingCliente] = useState(false);
  const [clienteError, setClienteError] = useState<string | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or Escape key using reusable hook
  useClickOutside(wrapperRef, () => setOpenDropdown(false), openDropdown);

  // Search clients by CPF, Name or Address
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSugestoes([]);
      setOpenDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const queryText = `%${searchTerm.trim()}%`;
        const { data, error } = await supabase
          .from('clientes')
          .select('*')
          .or(`nome.ilike.${queryText},cpf.ilike.${queryText},endereco.ilike.${queryText}`)
          .limit(8);

        if (!error && data) {
          setSugestoes(data as Cliente[]);
          setOpenDropdown(true);
        }
      } catch (err) {
        console.error('Erro na busca de clientes:', err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleSelect = (cliente: Cliente) => {
    onSelectCliente(cliente);
    setSearchTerm('');
    setOpenDropdown(false);
  };

  const handleClearSelection = () => {
    onSelectCliente(null);
    setSearchTerm('');
  };

  const handleCadastrarNovoCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNome.trim()) return;

    setSavingCliente(true);
    setClienteError(null);
    try {
      // Build Rua / Logradouro for 'endereco' column, along with numero, bairro, referencia
      const ruaVal = novoRua.trim();
      const numVal = novoNumero.trim();
      const bairroVal = novoBairro.trim();
      const refVal = novoReferencia.trim();

      // If rua is empty, construct fallback address text
      let enderecoVal = ruaVal;
      if (!enderecoVal) {
        const partes = [];
        if (numVal) partes.push(`Nº ${numVal}`);
        if (bairroVal) partes.push(`Bairro: ${bairroVal}`);
        if (refVal) partes.push(`(Ref: ${refVal})`);
        enderecoVal = partes.join(', ');
      }

      const { data, error } = await supabase
        .from('clientes')
        .insert({
          nome: novoNome.trim(),
          cpf: novoCpf.trim() || null,
          telefone: novoTelefone.trim() || null,
          endereco: enderecoVal || null,
          numero: numVal || null,
          bairro: bairroVal || null,
          referencia: refVal || null,
          bloqueado: false,
          limite_fiado: 1000,
        })
        .select()
        .single();

      if (error) {
        setClienteError(`Erro de cadastro: ${error.message}`);
      } else if (data) {
        onSelectCliente(data as Cliente);
        setShowNovoClienteModal(false);
        setNovoNome('');
        setNovoCpf('');
        setNovoTelefone('');
        setNovoRua('');
        setNovoNumero('');
        setNovoBairro('');
        setNovoReferencia('');
        setClienteError(null);
      }
    } catch (err: any) {
      setClienteError(`Erro: ${err?.message || 'Falha ao salvar cliente'}`);
    } finally {
      setSavingCliente(false);
    }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      {/* Selected Customer View */}
      {selectedCliente ? (
        <div
          className={`p-3.5 rounded-lg border flex items-center justify-between transition-colors ${
            selectedCliente.bloqueado
              ? 'bg-red-50 border-red-300'
              : 'bg-amber-50/60 border-[#F5D800]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold shrink-0 ${
                selectedCliente.bloqueado
                  ? 'bg-red-100 text-red-700 border border-red-200'
                  : 'bg-[#F5D800] text-zinc-950 border border-[#d2b800]'
              }`}
            >
              {selectedCliente.bloqueado ? (
                <UserX className="w-5 h-5" />
              ) : (
                <UserCheck className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-zinc-900">
                  {selectedCliente.nome}
                </span>
                {selectedCliente.bloqueado && (
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-red-600 text-white rounded">
                    BLOQUEADO
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-600 mt-0.5">
                {selectedCliente.cpf && (
                  <span>CPF: {selectedCliente.cpf}</span>
                )}
                {selectedCliente.telefone && (
                  <span>Tel: {selectedCliente.telefone}</span>
                )}
                {selectedCliente.limite_fiado !== undefined && selectedCliente.limite_fiado !== null && (
                  <span className="font-medium text-zinc-800">
                    Limite fiado: R$ {selectedCliente.limite_fiado.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClearSelection}
            className="p-1.5 text-zinc-500 hover:text-zinc-900 border border-zinc-200 hover:border-zinc-400 bg-white rounded-lg transition-colors cursor-pointer"
            title="Trocar cliente"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        /* Unified Search Bar */
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
                <Search className="w-4 h-4" />
              </div>
              <InputMaiusculo
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => {
                  if (sugestoes.length > 0) setOpenDropdown(true);
                }}
                placeholder="Buscar cliente por CPF, Nome ou Endereço..."
                className="w-full pl-9 pr-8 py-2.5 bg-white border border-[#E5E5E5] rounded-lg text-xs md:text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition-colors"
              />
              {loading && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <div className="w-3.5 h-3.5 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowNovoClienteModal(true)}
              className="py-2.5 px-3 bg-white border border-[#E5E5E5] hover:bg-zinc-50 text-zinc-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
              title="Cadastrar cliente rápido"
            >
              <Plus className="w-4 h-4 text-zinc-700" />
              <span className="hidden sm:inline">Novo cliente</span>
            </button>
          </div>

          {/* Autocomplete Dropdown */}
          {openDropdown && (
            <div className="absolute left-0 right-0 mt-1 bg-white border border-[#E5E5E5] rounded-lg shadow-xl z-50 overflow-hidden max-h-72 overflow-y-auto divide-y divide-[#E5E5E5]">
              {sugestoes.length > 0 ? (
                sugestoes.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelect(c)}
                    className="w-full text-left p-3 hover:bg-amber-50/50 transition-colors flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-zinc-900 group-hover:text-black">
                          {c.nome}
                        </span>
                        {c.bloqueado && (
                          <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded border border-red-200">
                            BLOQUEADO
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-zinc-500 mt-1">
                        {c.cpf && <span>CPF: {c.cpf}</span>}
                        {c.endereco && (
                          <span className="truncate max-w-[200px]">
                            {c.endereco}
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="text-[11px] font-medium text-zinc-600 bg-zinc-100 px-2 py-1 rounded group-hover:bg-[#F5D800] group-hover:text-zinc-950 transition-colors">
                      Selecionar
                    </span>
                  </button>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-zinc-500">
                  Nenhum cliente encontrado com "{searchTerm}"
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal Novo Cliente Rápido */}
      {showNovoClienteModal && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="industrial-card p-6 max-w-md w-full bg-white">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E5] mb-4">
              <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#F5D800]" />
                Cadastrar novo cliente
              </h3>
              <button
                type="button"
                onClick={() => setShowNovoClienteModal(false)}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCadastrarNovoCliente} className="space-y-4">
              {clienteError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{clienteError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Nome completo *
                </label>
                <InputMaiusculo
                  type="text"
                  required
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  placeholder="Ex: João da Silva"
                  className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    CPF
                  </label>
                  <InputMaiusculo
                    type="text"
                    value={novoCpf}
                    onChange={(e) => setNovoCpf(e.target.value)}
                    placeholder="000.000.000-00"
                    className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Telefone
                  </label>
                  <InputMaiusculo
                    type="text"
                    value={novoTelefone}
                    onChange={(e) => setNovoTelefone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                  />
                </div>
              </div>

              {/* Address Section */}
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Rua / Logradouro
                </label>
                <InputMaiusculo
                  type="text"
                  value={novoRua}
                  onChange={(e) => setNovoRua(e.target.value)}
                  placeholder="Ex: Av. Brasil, Rua das Flores"
                  className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Número
                  </label>
                  <InputMaiusculo
                    type="text"
                    value={novoNumero}
                    onChange={(e) => setNovoNumero(e.target.value)}
                    placeholder="Ex: 123, S/N"
                    className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Bairro
                  </label>
                  <InputMaiusculo
                    type="text"
                    value={novoBairro}
                    onChange={(e) => setNovoBairro(e.target.value)}
                    placeholder="Ex: Centro"
                    className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Ponto de Referência
                </label>
                <InputMaiusculo
                  type="text"
                  value={novoReferencia}
                  onChange={(e) => setNovoReferencia(e.target.value)}
                  placeholder="Ex: Perto do mercado X, Portão azul"
                  className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E5E5]">
                <button
                  type="button"
                  onClick={() => setShowNovoClienteModal(false)}
                  className="px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-900 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingCliente}
                  className="px-4 py-2 bg-[#F5D800] text-zinc-950 font-semibold text-xs rounded-lg hover:bg-[#ebd000] border border-[#d2b800]"
                >
                  {savingCliente ? 'Salvando...' : 'Salvar e selecionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
