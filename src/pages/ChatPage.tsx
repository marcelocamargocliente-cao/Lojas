import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Send, 
  Trash2, 
  Edit3, 
  CheckCheck, 
  Check, 
  Megaphone, 
  Users, 
  User, 
  Search, 
  Plus, 
  Info, 
  X,
  Eye,
  ShieldAlert,
  Clock
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { ChatMensagem, ChatLeitura, Usuario } from '../types';
import { useAuth } from '../context/AuthContext';
import { NotificacaoTransmissaoBanner } from '../components/NotificacaoTransmissaoBanner';
import { InputMaiusculo, TextareaMaiusculo } from '../components/InputMaiusculo';

export const ChatPage: React.FC = () => {
  const { usuarioProfile, empresa, selectedFilial } = useAuth();

  const isManagerOrAdmin = ['super_admin', 'admin', 'gerente'].includes(usuarioProfile?.cargo || '');

  // Active contact or active broadcast view
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null);
  const [activeTab, setActiveTab] = useState<'individual' | 'transmissao'>('individual');

  const [mensagens, setMensagens] = useState<ChatMensagem[]>([]);
  const [loading, setLoading] = useState(false);
  const [novoTexto, setNovoTexto] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  // Editing state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  // Broadcast Modal state
  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);
  const [broadcastScope, setBroadcastScope] = useState<'filial' | 'empresa'>('filial');
  const [broadcastContent, setBroadcastContent] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // Read receipts modal for broadcast message
  const [receiptsModalMsg, setReceiptsModalMsg] = useState<ChatMensagem | null>(null);
  const [msgReceiptsList, setMsgReceiptsList] = useState<{ usuario_nome: string; lido_em: string }[]>([]);

  // Read status map for 1-on-1: msgId -> last read time string
  const [leiturasMap, setLeiturasMap] = useState<Record<string, string>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCotrabalhadores();
  }, [empresa, selectedFilial]);

  useEffect(() => {
    if (activeTab === 'individual' && selectedUser) {
      fetchMensagensIndividual(selectedUser.id);
    } else if (activeTab === 'transmissao') {
      fetchMensagensTransmissao();
    }
  }, [selectedUser, activeTab, usuarioProfile]);

  // Supabase Realtime Subscription for chat_mensagens & chat_leituras
  useEffect(() => {
    if (!usuarioProfile) return;

    const channel = supabase
      .channel('chat_realtime_channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_mensagens',
        },
        () => {
          if (activeTab === 'individual' && selectedUser) {
            fetchMensagensIndividual(selectedUser.id);
          } else if (activeTab === 'transmissao') {
            fetchMensagensTransmissao();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_leituras',
        },
        () => {
          if (activeTab === 'individual' && selectedUser) {
            fetchLeiturasForMsgs(mensagens.map((m) => m.id));
          } else if (activeTab === 'transmissao') {
            fetchMensagensTransmissao();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedUser, activeTab, usuarioProfile, mensagens]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  const fetchCotrabalhadores = async () => {
    if (!usuarioProfile) return;
    try {
      let query = supabase
        .from('usuarios')
        .select('*')
        .order('nome');

      if (empresa?.id) {
        query = query.eq('empresa_id', empresa.id);
      }

      const { data } = await query;
      if (data) {
        // Exclude logged in user
        const coWorkers = data.filter((u) => u.id !== usuarioProfile.id);
        setUsuarios(coWorkers);
        if (coWorkers.length > 0 && !selectedUser) {
          setSelectedUser(coWorkers[0]);
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar colaboradores para o chat:', err);
    }
  };

  const fetchMensagensIndividual = async (outrosUserId: string) => {
    if (!usuarioProfile) return;
    setLoading(true);
    try {
      // Query messages sent between logged user and target user
      const { data: rawMsgs } = await supabase
        .from('chat_mensagens')
        .select('*, remetente:usuarios!remetente_id(*), destinatario:usuarios!destinatario_id(*)')
        .eq('tipo', 'individual')
        .or(
          `and(remetente_id.eq.${usuarioProfile.id},destinatario_id.eq.${outrosUserId}),and(remetente_id.eq.${outrosUserId},destinatario_id.eq.${usuarioProfile.id})`
        )
        .order('created_at', { ascending: true });

      if (rawMsgs) {
        setMensagens(rawMsgs);
        
        // Mark unread messages sent by outrosUserId as read by current user
        const unreadFromOther = rawMsgs.filter(
          (m) => m.remetente_id === outrosUserId && !m.deletado
        );

        if (unreadFromOther.length > 0) {
          const leiturasToInsert = unreadFromOther.map((m) => ({
            mensagem_id: m.id,
            usuario_id: usuarioProfile.id,
            lido_em: new Date().toISOString(),
          }));

          await supabase
            .from('chat_leituras')
            .upsert(leiturasToInsert, { onConflict: 'mensagem_id,usuario_id' });
        }

        // Fetch read receipts for messages sent by current user
        const myMsgIds = rawMsgs.filter((m) => m.remetente_id === usuarioProfile.id).map((m) => m.id);
        await fetchLeiturasForMsgs(myMsgIds);
      }
    } catch (err) {
      console.error('Erro ao carregar historico de chat:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMensagensTransmissao = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('chat_mensagens')
        .select('*, remetente:usuarios(*)')
        .eq('tipo', 'transmissao')
        .order('created_at', { ascending: true });

      if (empresa?.id) {
        query = query.eq('empresa_id', empresa.id);
      }

      const { data: rawMsgs } = await query;
      if (rawMsgs) {
        // Fetch count of reads per broadcast message
        const msgIds = rawMsgs.map((m) => m.id);
        if (msgIds.length > 0) {
          const { data: leiturasData } = await supabase
            .from('chat_leituras')
            .select('mensagem_id, usuario_id, lido_em')
            .in('mensagem_id', msgIds);

          const leiturasByMsg = new Map<string, number>();
          if (leiturasData) {
            leiturasData.forEach((l) => {
              leiturasByMsg.set(l.mensagem_id, (leiturasByMsg.get(l.mensagem_id) || 0) + 1);
            });
          }

          const formatted = rawMsgs.map((m) => ({
            ...m,
            leituras_count: leiturasByMsg.get(m.id) || 0,
          }));
          setMensagens(formatted);
        } else {
          setMensagens(rawMsgs);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar transmissoes:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeiturasForMsgs = async (msgIds: string[]) => {
    if (msgIds.length === 0) return;
    try {
      const { data: leituras } = await supabase
        .from('chat_leituras')
        .select('mensagem_id, lido_em')
        .in('mensagem_id', msgIds);

      if (leituras) {
        const lMap: Record<string, string> = {};
        leituras.forEach((l) => {
          lMap[l.mensagem_id] = l.lido_em;
        });
        setLeiturasMap(lMap);
      }
    } catch (e) {
      console.warn('Erro ao carregar confirmações de leitura:', e);
    }
  };

  const handleEnviarMensagemIndividual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoTexto.trim() || !selectedUser || !usuarioProfile) return;

    const texto = novoTexto.trim();
    setNovoTexto('');

    try {
      await supabase.from('chat_mensagens').insert([
        {
          empresa_id: empresa?.id || null,
          filial_id: selectedFilial?.id || null,
          remetente_id: usuarioProfile.id,
          destinatario_id: selectedUser.id,
          tipo: 'individual',
          conteudo: texto,
          deletado: false,
        },
      ]);

      fetchMensagensIndividual(selectedUser.id);
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
      alert('Erro ao enviar mensagem.');
    }
  };

  const handleEditarMensagem = async (mensagemId: string) => {
    if (!editText.trim()) return;

    try {
      await supabase
        .from('chat_mensagens')
        .update({
          conteudo: editText.trim(),
          editado: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', mensagemId);

      setEditingMessageId(null);
      setEditText('');

      if (activeTab === 'individual' && selectedUser) {
        fetchMensagensIndividual(selectedUser.id);
      } else {
        fetchMensagensTransmissao();
      }
    } catch (err) {
      console.error('Erro ao editar mensagem:', err);
    }
  };

  const handleApagarMensagem = async (mensagemId: string) => {
    if (!confirm('Deseja apagar esta mensagem? Ela permanecerá marcada como apagada.')) return;

    try {
      await supabase
        .from('chat_mensagens')
        .update({
          deletado: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', mensagemId);

      if (activeTab === 'individual' && selectedUser) {
        fetchMensagensIndividual(selectedUser.id);
      } else {
        fetchMensagensTransmissao();
      }
    } catch (err) {
      console.error('Erro ao apagar mensagem:', err);
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastContent.trim() || !usuarioProfile) return;

    setSendingBroadcast(true);
    try {
      await supabase.from('chat_mensagens').insert([
        {
          empresa_id: empresa?.id || null,
          filial_id: broadcastScope === 'filial' ? selectedFilial?.id || null : null,
          remetente_id: usuarioProfile.id,
          tipo: 'transmissao',
          escopo_transmissao: broadcastScope,
          conteudo: broadcastContent.trim(),
          deletado: false,
        },
      ]);

      setBroadcastModalOpen(false);
      setBroadcastContent('');
      setActiveTab('transmissao');
      fetchMensagensTransmissao();
    } catch (err) {
      console.error('Erro ao enviar aviso de transmissão:', err);
      alert('Erro ao transmitir aviso para a equipe.');
    } finally {
      setSendingBroadcast(false);
    }
  };

  const handleVerLeiturasTransmissao = async (msg: ChatMensagem) => {
    setReceiptsModalMsg(msg);
    try {
      const { data: leituras } = await supabase
        .from('chat_leituras')
        .select('lido_em, usuario:usuarios(nome)')
        .eq('mensagem_id', msg.id);

      if (leituras) {
        const formatted = leituras.map((l: any) => ({
          usuario_nome: l.usuario?.nome || 'Usuário',
          lido_em: l.lido_em,
        }));
        setMsgReceiptsList(formatted);
      }
    } catch (err) {
      console.error('Erro ao carregar leituras da transmissao:', err);
    }
  };

  const formatHora = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const filteredUsuarios = usuarios.filter(
    (u) =>
      u.nome.toLowerCase().includes(searchFilter.toLowerCase()) ||
      u.email.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (u.cargo || '').toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Top Banner for Active Broadcast Notification */}
      <NotificacaoTransmissaoBanner />

      {/* Main Container */}
      <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden flex flex-col md:flex-row h-[650px] shadow-2xs">
        
        {/* Left Sidebar: Contacts & Tabs */}
        <div className="w-full md:w-80 border-r border-[#E5E5E5] bg-zinc-50 flex flex-col shrink-0">
          {/* Header */}
          <div className="p-4 border-b border-[#E5E5E5] space-y-3 bg-white">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-sm text-zinc-900 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-amber-500" />
                Chat Interno da Loja
              </h2>

              {/* Manager/Admin Broadcast Button */}
              {isManagerOrAdmin && (
                <button
                  type="button"
                  onClick={() => setBroadcastModalOpen(true)}
                  className="px-2.5 py-1 bg-[#F5D800] hover:bg-[#e2c700] text-zinc-950 font-bold rounded-lg text-[11px] border border-[#d2b800] flex items-center gap-1 cursor-pointer shadow-2xs"
                >
                  <Megaphone className="w-3.5 h-3.5 stroke-[2.2]" />
                  <span>Avisar Todos</span>
                </button>
              )}
            </div>

            {/* Navigation Tabs */}
            <div className="flex bg-zinc-100 p-1 rounded-lg border border-[#E5E5E5]">
              <button
                type="button"
                onClick={() => setActiveTab('individual')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'individual'
                    ? 'bg-white text-zinc-950 shadow-2xs'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Mensagens</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('transmissao')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'transmissao'
                    ? 'bg-[#FFF9E0] text-zinc-950 font-bold border border-[#F5D800] shadow-2xs'
                    : 'text-zinc-500 hover:text-zinc-800'
                }`}
              >
                <Megaphone className="w-3.5 h-3.5 text-amber-600" />
                <span>Mural Avisos</span>
              </button>
            </div>

            {/* Contact Search Input */}
            {activeTab === 'individual' && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Buscar colega de trabalho..."
                  className="w-full pl-8 pr-2.5 py-1.5 bg-zinc-50 border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                />
              </div>
            )}
          </div>

          {/* User List or Broadcast Summary */}
          {activeTab === 'individual' ? (
            <div className="flex-1 overflow-y-auto divide-y divide-[#E5E5E5]">
              {filteredUsuarios.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-400">
                  Nenhum colega encontrado.
                </div>
              ) : (
                filteredUsuarios.map((u) => {
                  const isSelected = selectedUser?.id === u.id;

                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setSelectedUser(u)}
                      className={`w-full p-3.5 text-left flex items-center gap-3 transition-colors cursor-pointer ${
                        isSelected ? 'bg-amber-50/60 border-l-4 border-l-amber-500 font-semibold' : 'hover:bg-white'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-full bg-zinc-200 text-zinc-800 flex items-center justify-center font-bold text-xs shrink-0 border border-zinc-300">
                        {u.nome.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-zinc-900 truncate block">{u.nome}</span>
                        </div>
                        <span className="text-[10px] text-zinc-500 capitalize block truncate">
                          {u.cargo ? u.cargo.replace('_', ' ') : 'Colaborador'}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          ) : (
            <div className="p-4 space-y-3 text-xs text-zinc-600">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1">
                <span className="font-bold text-amber-900 block flex items-center gap-1">
                  <Megaphone className="w-3.5 h-3.5 text-amber-600" />
                  Mural de Transmissão
                </span>
                <p className="text-[11px] text-amber-800">
                  Communicados gerais enviados pela gerência para toda a loja.
                </p>
              </div>

              {isManagerOrAdmin && (
                <button
                  type="button"
                  onClick={() => setBroadcastModalOpen(true)}
                  className="w-full py-2 bg-[#F5D800] hover:bg-[#e2c700] text-zinc-950 font-bold rounded-lg border border-[#d2b800] flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo Comunicado Oficial</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right Area: Conversation / Transmission Thread */}
        <div className="flex-1 flex flex-col bg-white">
          
          {/* Header of Active View */}
          <div className="p-3.5 border-b border-[#E5E5E5] bg-white flex items-center justify-between">
            {activeTab === 'individual' && selectedUser ? (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center font-bold text-xs">
                  {selectedUser.nome.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-xs text-zinc-900">{selectedUser.nome}</h3>
                  <span className="text-[10px] text-zinc-500 capitalize">
                    {selectedUser.cargo ? selectedUser.cargo.replace('_', ' ') : 'Colaborador'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-amber-500" />
                <div>
                  <h3 className="font-bold text-xs text-zinc-900">Mural de Avisos da Gerência</h3>
                  <span className="text-[10px] text-zinc-500">Transmissões oficiais ativas</span>
                </div>
              </div>
            )}
          </div>

          {/* Messages Feed */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-zinc-50/40">
            {loading ? (
              <div className="py-12 text-center text-xs text-zinc-400">Carregando mensagens...</div>
            ) : mensagens.length === 0 ? (
              <div className="py-16 text-center text-xs text-zinc-400 flex flex-col items-center justify-center gap-2">
                <MessageSquare className="w-8 h-8 text-zinc-300" />
                <span>Nenhuma mensagem encontrada neste canal.</span>
              </div>
            ) : (
              mensagens.map((msg) => {
                const isMe = msg.remetente_id === usuarioProfile?.id;
                const isBroadcast = msg.tipo === 'transmissao';
                const isDeleted = msg.deletado;
                const readTime = leiturasMap[msg.id];

                // Render Broadcast Box differently
                if (isBroadcast) {
                  return (
                    <div
                      key={msg.id}
                      className="p-4 rounded-xl bg-[#FFF9E0] border border-[#F5D800] space-y-2 shadow-2xs max-w-2xl mx-auto"
                    >
                      <div className="flex items-center justify-between border-b border-[#F5D800]/50 pb-2">
                        <div className="flex items-center gap-2">
                          <Megaphone className="w-4 h-4 text-amber-600" />
                          <span className="font-bold text-xs text-amber-950">
                            {msg.remetente?.nome || 'Gerência'}
                          </span>
                          <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded font-semibold uppercase">
                            {msg.escopo_transmissao === 'empresa' ? 'Toda a Empresa' : 'Sua Filial'}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-500">{formatHora(msg.created_at)}</span>
                      </div>

                      <p className="text-xs text-zinc-900 font-medium whitespace-pre-wrap">{msg.conteudo}</p>

                      {/* Read count footer */}
                      <div className="flex items-center justify-between text-[10px] text-zinc-600 pt-1 border-t border-[#F5D800]/30">
                        <span className="flex items-center gap-1 text-amber-900 font-semibold">
                          <Eye className="w-3.5 h-3.5 text-amber-600" />
                          Lido por {msg.leituras_count || 0} pessoa(s)
                        </span>

                        <button
                          type="button"
                          onClick={() => handleVerLeiturasTransmissao(msg)}
                          className="hover:underline text-zinc-800 font-semibold cursor-pointer"
                        >
                          Ver quem leu
                        </button>
                      </div>
                    </div>
                  );
                }

                // Render 1-on-1 normal message bubble
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-md rounded-xl p-3 text-xs space-y-1 relative group shadow-2xs ${
                        isDeleted
                          ? 'bg-zinc-200 text-zinc-500 italic border border-zinc-300'
                          : isMe
                          ? 'bg-zinc-900 text-white rounded-br-none'
                          : 'bg-white text-zinc-900 border border-[#E5E5E5] rounded-bl-none'
                      }`}
                    >
                      {/* Editing mode input inside bubble */}
                      {editingMessageId === msg.id ? (
                        <div className="space-y-2 min-w-[200px]">
                          <InputMaiusculo
                            type="text"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="w-full p-1.5 bg-zinc-800 text-white border border-zinc-600 rounded text-xs focus:outline-none"
                          />
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setEditingMessageId(null)}
                              className="px-2 py-0.5 text-[10px] bg-zinc-700 text-zinc-300 rounded"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => handleEditarMensagem(msg.id)}
                              className="px-2 py-0.5 text-[10px] bg-[#F5D800] text-zinc-950 font-bold rounded"
                            >
                              Salvar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="whitespace-pre-wrap leading-relaxed">
                            {isDeleted ? 'Mensagem apagada' : msg.conteudo}
                          </p>

                          {/* Footer with timestamp and read checkmark */}
                          <div
                            className={`flex items-center justify-end gap-1.5 text-[9px] ${
                              isMe ? 'text-zinc-400' : 'text-zinc-400'
                            }`}
                          >
                            {msg.editado && !isDeleted && <span>(editada)</span>}
                            <span>{formatHora(msg.created_at)}</span>

                            {/* Read Receipt Icon for sender */}
                            {isMe && !isDeleted && (
                              readTime ? (
                                <span className="inline-flex items-center gap-0.5 text-[#F5D800] font-semibold" title={`Visto às ${formatHora(readTime)}`}>
                                  <CheckCheck className="w-3.5 h-3.5" />
                                  <span>Visto às {formatHora(readTime)}</span>
                                </span>
                              ) : (
                                <Check className="w-3.5 h-3.5 text-zinc-400" title="Enviado" />
                              )
                            )}
                          </div>
                        </>
                      )}

                      {/* Action hover tools for sender's message */}
                      {isMe && !isDeleted && editingMessageId !== msg.id && (
                        <div className="absolute -top-2 right-1 hidden group-hover:flex items-center gap-1 bg-white border border-[#E5E5E5] rounded-md p-1 shadow-xs">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMessageId(msg.id);
                              setEditText(msg.conteudo);
                            }}
                            className="p-1 hover:bg-zinc-100 text-zinc-600 rounded"
                            title="Editar mensagem"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApagarMensagem(msg.id)}
                            className="p-1 hover:bg-red-50 text-red-600 rounded"
                            title="Apagar mensagem"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Send Input Bar for 1-on-1 */}
          {activeTab === 'individual' && selectedUser && (
            <form onSubmit={handleEnviarMensagemIndividual} className="p-3 border-t border-[#E5E5E5] bg-white flex items-center gap-2">
              <InputMaiusculo
                type="text"
                value={novoTexto}
                onChange={(e) => setNovoTexto(e.target.value)}
                placeholder={`Mensagem para ${selectedUser.nome}...`}
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
          )}
        </div>
      </div>

      {/* Broadcast Modal (Manager/Admin Only) */}
      {broadcastModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in">
            <div className="p-4 border-b border-[#E5E5E5] bg-amber-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-sm text-amber-950">Novo Aviso de Transmissão</h3>
              </div>
              <button onClick={() => setBroadcastModalOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendBroadcast} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Escopo do Comunicado</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBroadcastScope('filial')}
                    className={`p-2.5 rounded-lg border text-center font-bold transition-colors cursor-pointer ${
                      broadcastScope === 'filial'
                        ? 'bg-zinc-900 text-white border-zinc-900'
                        : 'bg-zinc-50 text-zinc-700 border-[#E5E5E5]'
                    }`}
                  >
                    Minha Filial Atual
                  </button>
                  <button
                    type="button"
                    onClick={() => setBroadcastScope('empresa')}
                    className={`p-2.5 rounded-lg border text-center font-bold transition-colors cursor-pointer ${
                      broadcastScope === 'empresa'
                        ? 'bg-zinc-900 text-white border-zinc-900'
                        : 'bg-zinc-50 text-zinc-700 border-[#E5E5E5]'
                    }`}
                  >
                    Toda a Empresa
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Mensagem do Comunicado</label>
                <TextareaMaiusculo
                  rows={4}
                  value={broadcastContent}
                  onChange={(e) => setBroadcastContent(e.target.value)}
                  placeholder="Digite o aviso oficial para toda a equipe..."
                  className="w-full p-2.5 bg-zinc-50 border border-[#E5E5E5] rounded-lg text-xs font-medium text-zinc-900 focus:outline-none focus:border-zinc-900"
                />
              </div>

              <div className="pt-2 border-t border-[#E5E5E5] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBroadcastModalOpen(false)}
                  className="px-4 py-2 border border-[#E5E5E5] hover:bg-zinc-100 rounded-lg text-zinc-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={sendingBroadcast || !broadcastContent.trim()}
                  className="px-4 py-2 bg-[#F5D800] hover:bg-[#e2c700] text-zinc-950 font-bold rounded-lg border border-[#d2b800] cursor-pointer disabled:opacity-50"
                >
                  {sendingBroadcast ? 'Transmitindo...' : 'Transmitir para Todos'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Broadcast Read Receipts Modal */}
      {receiptsModalMsg && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-xl max-w-sm w-full overflow-hidden animate-in fade-in">
            <div className="p-4 border-b border-[#E5E5E5] bg-zinc-50 flex items-center justify-between">
              <h3 className="font-bold text-xs text-zinc-900 flex items-center gap-2">
                <Eye className="w-4 h-4 text-amber-500" />
                Confirmações de Leitura ({msgReceiptsList.length})
              </h3>
              <button onClick={() => setReceiptsModalMsg(null)} className="p-1 text-zinc-400 hover:text-zinc-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 max-h-80 overflow-y-auto divide-y divide-[#E5E5E5] text-xs">
              {msgReceiptsList.length === 0 ? (
                <p className="text-zinc-400 text-center py-4">Nenhum colaborador visualizou ainda.</p>
              ) : (
                msgReceiptsList.map((item, idx) => (
                  <div key={idx} className="py-2 flex items-center justify-between">
                    <span className="font-bold text-zinc-900">{item.usuario_nome}</span>
                    <span className="text-[10px] text-emerald-700 font-semibold">
                      Visto às {formatHora(item.lido_em)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
