import React, { useState, useEffect } from 'react';
import { 
  HelpCircle, 
  Plus, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Send, 
  MessageSquare, 
  ChevronRight, 
  X, 
  ShieldCheck,
  Bug,
  Lightbulb,
  FileText
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { ChamadoSuporte, ChamadoMensagem } from '../types';
import { useAuth } from '../context/AuthContext';
import { InputMaiusculo, TextareaMaiusculo } from '../components/InputMaiusculo';

export const ChamadosPage: React.FC = () => {
  const { usuarioProfile, empresa } = useAuth();

  const [chamados, setChamados] = useState<ChamadoSuporte[]>([]);
  const [selectedChamado, setSelectedChamado] = useState<ChamadoSuporte | null>(null);
  const [mensagens, setMensagens] = useState<ChamadoMensagem[]>([]);
  const [loading, setLoading] = useState(false);
  const [novoTexto, setNovoTexto] = useState('');

  // Modal for new ticket
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [categoria, setCategoria] = useState<'Bug' | 'Dúvida' | 'Sugestão' | 'Outro'>('Dúvida');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [enviandoTicket, setEnviandoTicket] = useState(false);

  useEffect(() => {
    fetchChamados();
  }, [usuarioProfile]);

  useEffect(() => {
    if (selectedChamado) {
      fetchMensagensChamado(selectedChamado.id);
    }
  }, [selectedChamado]);

  const fetchChamados = async () => {
    if (!usuarioProfile) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('chamados_suporte')
        .select('*, usuario:usuarios(*)')
        .eq('usuario_id', usuarioProfile.id)
        .order('created_at', { ascending: false });

      if (data) {
        setChamados(data);
        if (data.length > 0 && !selectedChamado) {
          setSelectedChamado(data[0]);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar chamados:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMensagensChamado = async (chamadoId: string) => {
    try {
      const { data } = await supabase
        .from('chamados_mensagens')
        .select('*, remetente:usuarios(*)')
        .eq('chamado_id', chamadoId)
        .order('created_at', { ascending: true });

      if (data) {
        setMensagens(data);
      }
    } catch (err) {
      console.error('Erro ao buscar mensagens do chamado:', err);
    }
  };

  const handleCriarChamado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !descricao.trim() || !usuarioProfile) return;

    setEnviandoTicket(true);
    try {
      // Estimated SLA based on category
      const prazoSla = new Date();
      if (categoria === 'Bug') prazoSla.setHours(prazoSla.getHours() + 12);
      else prazoSla.setHours(prazoSla.getHours() + 24);

      const { data: newTicket, error } = await supabase
        .from('chamados_suporte')
        .insert([
          {
            empresa_id: empresa?.id || null,
            usuario_id: usuarioProfile.id,
            categoria,
            titulo: titulo.trim(),
            descricao: descricao.trim(),
            status: 'aberto',
            prazo_estimado: prazoSla.toISOString(),
          },
        ])
        .select('*, usuario:usuarios(*)')
        .single();

      if (error) throw error;

      if (newTicket) {
        // Also insert initial message
        await supabase.from('chamados_mensagens').insert([
          {
            chamado_id: newTicket.id,
            remetente_id: usuarioProfile.id,
            mensagem: descricao.trim(),
            suporte_resposta: false,
          },
        ]);

        setModalNovoAberto(false);
        setTitulo('');
        setDescricao('');
        setCategoria('Dúvida');
        fetchChamados();
        setSelectedChamado(newTicket);
      }
    } catch (err) {
      console.error('Erro ao abrir chamado:', err);
      alert('Erro ao abrir chamado de suporte.');
    } finally {
      setEnviandoTicket(false);
    }
  };

  const handleEnviarMensagemThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoTexto.trim() || !selectedChamado || !usuarioProfile) return;

    const texto = novoTexto.trim();
    setNovoTexto('');

    try {
      await supabase.from('chamados_mensagens').insert([
        {
          chamado_id: selectedChamado.id,
          remetente_id: usuarioProfile.id,
          mensagem: texto,
          suporte_resposta: false,
        },
      ]);

      fetchMensagensChamado(selectedChamado.id);
    } catch (err) {
      console.error('Erro ao responder chamado:', err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolvido':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Resolvido
          </span>
        );
      case 'em_analise':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-bold">
            <Clock className="w-3 h-3 text-amber-600" />
            Em Análise
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded text-[10px] font-bold">
            <AlertCircle className="w-3 h-3 text-blue-600" />
            Aberto
          </span>
        );
    }
  };

  const getCategoriaIcon = (cat: string) => {
    switch (cat) {
      case 'Bug':
        return <Bug className="w-3.5 h-3.5 text-red-500" />;
      case 'Sugestão':
        return <Lightbulb className="w-3.5 h-3.5 text-amber-500" />;
      default:
        return <HelpCircle className="w-3.5 h-3.5 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-xl border border-[#E5E5E5] p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-amber-500" />
            Central de Suporte
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Abra chamados para tirar dúvidas, reportar falhas ou sugerir melhorias para a equipe de suporte.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalNovoAberto(true)}
          className="px-4 py-2 bg-[#F5D800] hover:bg-[#e2c700] text-zinc-950 font-bold rounded-xl text-xs border border-[#d2b800] flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4 text-zinc-950" />
          <span>Abrir Novo Chamado</span>
        </button>
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Left Column: Tickets List */}
        <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-2xs overflow-hidden flex flex-col h-[580px]">
          <div className="p-3.5 border-b border-[#E5E5E5] bg-zinc-50 flex items-center justify-between">
            <span className="font-bold text-xs text-zinc-800 uppercase tracking-wider">Meus Chamados ({chamados.length})</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#E5E5E5]">
            {loading ? (
              <div className="p-8 text-center text-xs text-zinc-400">Carregando chamados...</div>
            ) : chamados.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-400">Nenhum chamado aberto.</div>
            ) : (
              chamados.map((ticket) => {
                const isSelected = selectedChamado?.id === ticket.id;

                return (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => setSelectedChamado(ticket)}
                    className={`w-full p-3.5 text-left transition-colors cursor-pointer block ${
                      isSelected ? 'bg-amber-50/60 border-l-4 border-l-amber-500 font-semibold' : 'hover:bg-zinc-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5">
                        {getCategoriaIcon(ticket.categoria)}
                        <span className="text-[10px] text-zinc-500 font-semibold uppercase">{ticket.categoria}</span>
                      </div>
                      {getStatusBadge(ticket.status)}
                    </div>

                    <h4 className="text-xs font-bold text-zinc-900 truncate">{ticket.titulo}</h4>
                    <p className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">{ticket.descricao}</p>

                    <div className="mt-2 text-[10px] text-zinc-400 flex items-center justify-between">
                      <span>Criado em {new Date(ticket.created_at || '').toLocaleDateString('pt-BR')}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-300" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Ticket Thread Details */}
        <div className="md:col-span-2 bg-white rounded-xl border border-[#E5E5E5] shadow-2xs overflow-hidden flex flex-col h-[580px]">
          {selectedChamado ? (
            <>
              {/* Ticket Header & Status SLA */}
              <div className="p-4 border-b border-[#E5E5E5] bg-zinc-50/80 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    {getCategoriaIcon(selectedChamado.categoria)}
                    <span className="text-xs font-bold text-zinc-600 uppercase">{selectedChamado.categoria}</span>
                    {getStatusBadge(selectedChamado.status)}
                  </div>

                  {selectedChamado.prazo_estimado && (
                    <div className="text-[11px] text-zinc-600 bg-white border border-[#E5E5E5] px-2.5 py-1 rounded-lg flex items-center gap-1.5 font-medium">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <span>Prazo estimado: {new Date(selectedChamado.prazo_estimado).toLocaleDateString('pt-BR')} às {new Date(selectedChamado.prazo_estimado).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  )}
                </div>

                <h3 className="text-sm font-bold text-zinc-950">{selectedChamado.titulo}</h3>
              </div>

              {/* Thread Messages */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-zinc-50/30">
                {mensagens.map((msg) => {
                  const isSupport = msg.suporte_resposta;

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isSupport ? 'items-start' : 'items-end'}`}
                    >
                      <div
                        className={`max-w-lg p-3.5 rounded-xl text-xs space-y-1 shadow-2xs ${
                          isSupport
                            ? 'bg-amber-50 border border-amber-200 text-amber-950 rounded-bl-none'
                            : 'bg-zinc-900 text-white rounded-br-none'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4 font-bold text-[10px] pb-1 border-b border-black/10">
                          <span>{isSupport ? 'Equipe de Suporte' : 'Você'}</span>
                          <span className="opacity-70 font-normal">
                            {new Date(msg.created_at || '').toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap leading-relaxed mt-1">{msg.mensagem}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply Box */}
              {selectedChamado.status !== 'resolvido' ? (
                <form onSubmit={handleEnviarMensagemThread} className="p-3 border-t border-[#E5E5E5] bg-white flex items-center gap-2">
                  <InputMaiusculo
                    type="text"
                    value={novoTexto}
                    onChange={(e) => setNovoTexto(e.target.value)}
                    placeholder="Escreva uma resposta para este chamado..."
                    className="flex-1 p-2.5 bg-zinc-50 border border-[#E5E5E5] rounded-xl text-xs text-zinc-900 focus:outline-none focus:border-zinc-900 font-medium"
                  />
                  <button
                    type="submit"
                    disabled={!novoTexto.trim()}
                    className="px-4 py-2.5 bg-[#F5D800] hover:bg-[#e2c700] text-zinc-950 font-bold rounded-xl text-xs border border-[#d2b800] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
                  >
                    <span>Enviar</span>
                    <Send className="w-3.5 h-3.5 text-zinc-950" />
                  </button>
                </form>
              ) : (
                <div className="p-3 bg-emerald-50 border-t border-emerald-200 text-center text-xs font-bold text-emerald-800 flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Este chamado foi marcado como Resolvido.</span>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-zinc-400 gap-2">
              <HelpCircle className="w-10 h-10 text-zinc-300" />
              <span className="text-xs">Selecione um chamado ao lado para ver o histórico.</span>
            </div>
          )}
        </div>
      </div>

      {/* Modal: New Ticket */}
      {modalNovoAberto && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in">
            <div className="p-4 border-b border-[#E5E5E5] bg-zinc-50 flex items-center justify-between">
              <h3 className="font-bold text-sm text-zinc-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-500" />
                Abrir Chamado de Suporte
              </h3>
              <button onClick={() => setModalNovoAberto(false)} className="p-1 text-zinc-400 hover:text-zinc-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCriarChamado} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Categoria do Problema</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Dúvida', 'Bug', 'Sugestão', 'Outro'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoria(cat)}
                      className={`p-2 rounded-lg border text-center font-bold transition-colors cursor-pointer ${
                        categoria === cat
                          ? 'bg-zinc-900 text-white border-zinc-900'
                          : 'bg-zinc-50 text-zinc-700 border-[#E5E5E5]'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Assunto / Título Resumido</label>
                <InputMaiusculo
                  type="text"
                  required
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ex: Erro ao emitir comprovante no PDV"
                  className="w-full p-2.5 bg-zinc-50 border border-[#E5E5E5] rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-zinc-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Descrição Detalhada</label>
                <TextareaMaiusculo
                  required
                  rows={4}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Descreva o passo a passo do que aconteceu ou qual sua dúvida..."
                  className="w-full p-2.5 bg-zinc-50 border border-[#E5E5E5] rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-zinc-900"
                />
              </div>

              <div className="pt-2 border-t border-[#E5E5E5] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalNovoAberto(false)}
                  className="px-4 py-2 border border-[#E5E5E5] hover:bg-zinc-100 rounded-lg text-zinc-700 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={enviandoTicket || !titulo.trim() || !descricao.trim()}
                  className="px-4 py-2 bg-[#F5D800] hover:bg-[#e2c700] text-zinc-950 font-bold rounded-lg border border-[#d2b800] cursor-pointer disabled:opacity-50"
                >
                  {enviandoTicket ? 'Enviando...' : 'Criar Chamado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
