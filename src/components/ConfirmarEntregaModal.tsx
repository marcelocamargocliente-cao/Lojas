import React, { useState, useEffect } from 'react';
import { Camera, MapPin, CheckCircle2, X, AlertTriangle, ShieldAlert, Upload, Navigation } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Entrega, MotivoNaoEntrega, StatusEntrega } from '../types';
import { useAuth } from '../context/AuthContext';

interface ConfirmarEntregaModalProps {
  entrega: Entrega;
  tipoAcao: 'a_caminho' | 'entregue' | 'nao_entregue' | 'entregue_com_avaria';
  onClose: () => void;
  onSuccess: () => void;
}

export const ConfirmarEntregaModal: React.FC<ConfirmarEntregaModalProps> = ({
  entrega,
  tipoAcao,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Geolocation state
  const [geoCoords, setGeoCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gettingGeo, setGettingGeo] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Photo state
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);

  // Specific state for "nao_entregue"
  const [motivoNaoEntrega, setMotivoNaoEntrega] = useState<MotivoNaoEntrega>('ausente');
  const [obsNaoEntrega, setObsNaoEntrega] = useState('');

  // Specific state for "entregue_com_avaria"
  const [decisaoCliente, setDecisaoCliente] = useState<'aceitou' | 'recusou'>('aceitou');
  const [obsAvaria, setObsAvaria] = useState('');

  // Auto request geolocation on open if needed
  useEffect(() => {
    if (tipoAcao !== 'a_caminho') {
      obterGeolocalizacao();
    }
  }, [tipoAcao]);

  const obterGeolocalizacao = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocalização não é suportada neste dispositivo.');
      return;
    }

    setGettingGeo(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setGettingGeo(false);
      },
      (err) => {
        console.warn('Erro geolocalização:', err);
        setGeoError('Não foi possível obter a geolocalização exata.');
        setGettingGeo(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    // Validate photo requirement
    if (tipoAcao !== 'a_caminho' && !fotoPreview) {
      setErro('A foto de comprovação capturada pela câmera é obrigatória.');
      return;
    }

    setLoading(true);
    try {
      let novoStatus: StatusEntrega = 'a_caminho';
      if (tipoAcao === 'a_caminho') novoStatus = 'a_caminho';
      if (tipoAcao === 'entregue') novoStatus = 'entregue';
      if (tipoAcao === 'nao_entregue') novoStatus = 'nao_entregue';
      if (tipoAcao === 'entregue_com_avaria') novoStatus = 'entregue_com_avaria';

      // 1. Update status in `entregas`
      const { error: statusErr } = await supabase
        .from('entregas')
        .update({
          status: novoStatus,
          confirmado_por: user?.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', entrega.id);

      if (statusErr) throw statusErr;

      // 2. Save photo record if captured
      if (fotoPreview) {
        let fotoTipo: 'comprovante_entrega' | 'nao_entrega' | 'avaria' = 'comprovante_entrega';
        if (tipoAcao === 'nao_entregue') fotoTipo = 'nao_entrega';
        if (tipoAcao === 'entregue_com_avaria') fotoTipo = 'avaria';

        const { error: fotoErr } = await supabase.from('entrega_fotos').insert({
          entrega_id: entrega.id,
          tipo: fotoTipo,
          foto_url: fotoPreview,
          latitude: geoCoords?.latitude || null,
          longitude: geoCoords?.longitude || null,
        });

        if (fotoErr) console.warn('Erro ao gravar foto da entrega:', fotoErr);
      }

      // 3. Handle non-delivery reason record
      if (tipoAcao === 'nao_entregue') {
        const { error: naoEntErr } = await supabase.from('entrega_nao_entrega').insert({
          entrega_id: entrega.id,
          motivo: motivoNaoEntrega,
          observacao: obsNaoEntrega.trim() || null,
        });
        if (naoEntErr) console.warn('Erro ao gravar motivo não entrega:', naoEntErr);
      }

      // 4. Handle damage record
      if (tipoAcao === 'entregue_com_avaria') {
        const { error: avariaErr } = await supabase.from('entrega_avaria').insert({
          entrega_id: entrega.id,
          decisao_cliente: decisaoCliente,
          status_resolucao: 'pendente',
          observacao: obsAvaria.trim() || null,
        });
        if (avariaErr) console.warn('Erro ao gravar avaria:', avariaErr);
      }

      onSuccess();
    } catch (err: any) {
      setErro(err?.message || 'Falha ao confirmar entrega.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="industrial-card p-6 max-w-lg w-full bg-white shadow-2xl relative">
        <div className="flex items-center justify-between pb-3 border-b border-[#E5E5E5] mb-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-[#F5D800]" />
            <h3 className="text-sm font-bold text-zinc-900 capitalize">
              Confirmar: {tipoAcao.replace('_', ' ')}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-600 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {erro && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        <form onSubmit={handleConfirmar} className="space-y-4">
          {/* Summary */}
          <div className="p-3 bg-zinc-50 border border-[#E5E5E5] rounded-lg text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-zinc-500">Entrega:</span>
              <span className="font-mono font-bold text-zinc-900">
                #{entrega.venda_id.substring(0, 8)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Cliente:</span>
              <span className="font-semibold text-zinc-900 truncate max-w-[200px]">
                {entrega.venda?.cliente?.nome || 'Consumidor'}
              </span>
            </div>
          </div>

          {/* Action specific fields */}
          {tipoAcao === 'nao_entregue' && (
            <div>
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                Motivo da não entrega *
              </label>
              <select
                value={motivoNaoEntrega}
                onChange={(e: any) => setMotivoNaoEntrega(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900 mb-2"
              >
                <option value="ausente">Cliente ausente</option>
                <option value="cliente_recusou">Cliente recusou o recebimento</option>
                <option value="endereco_nao_localizado">Endereço não localizado</option>
                <option value="sem_acesso_local">Sem acesso ao local de entrega</option>
                <option value="avaria_transporte">Avaria total no transporte</option>
                <option value="reagendamento">Cliente solicitou reagendamento</option>
              </select>

              <textarea
                rows={2}
                value={obsNaoEntrega}
                onChange={(e) => setObsNaoEntrega(e.target.value)}
                placeholder="Observações adicionais do entregador..."
                className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
              />
            </div>
          )}

          {tipoAcao === 'entregue_com_avaria' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                  Decisão do cliente na hora do recebimento *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDecisaoCliente('aceitou')}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border text-center cursor-pointer ${
                      decisaoCliente === 'aceitou'
                        ? 'bg-amber-100 border-amber-400 text-amber-900'
                        : 'bg-white border-[#E5E5E5] text-zinc-700'
                    }`}
                  >
                    Aceitou com ressalva
                  </button>
                  <button
                    type="button"
                    onClick={() => setDecisaoCliente('recusou')}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border text-center cursor-pointer ${
                      decisaoCliente === 'recusou'
                        ? 'bg-red-100 border-red-400 text-red-900'
                        : 'bg-white border-[#E5E5E5] text-zinc-700'
                    }`}
                  >
                    Recusou o material
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                  Descrição da avaria
                </label>
                <textarea
                  rows={2}
                  value={obsAvaria}
                  onChange={(e) => setObsAvaria(e.target.value)}
                  placeholder="Ex: Sacos de cimento rasgados no descarregamento..."
                  className="w-full px-3 py-2 bg-white border border-[#E5E5E5] rounded-lg text-xs text-zinc-900 focus:outline-none focus:border-zinc-900"
                />
              </div>
            </div>
          )}

          {/* Photo Capture Section (For non a_caminho actions) */}
          {tipoAcao !== 'a_caminho' && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                Foto obrigatória da câmera *
              </label>

              <div className="border-2 border-dashed border-[#E5E5E5] rounded-lg p-4 text-center bg-zinc-50 relative">
                {fotoPreview ? (
                  <div className="space-y-2">
                    <img
                      src={fotoPreview}
                      alt="Comprovante"
                      className="max-h-40 mx-auto rounded border border-[#E5E5E5] object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setFotoPreview(null)}
                      className="text-[11px] text-red-600 font-semibold underline"
                    >
                      Tirar outra foto
                    </button>
                  </div>
                ) : (
                  <div>
                    <Camera className="w-8 h-8 text-zinc-400 mx-auto mb-2 stroke-[1.5]" />
                    <p className="text-xs font-semibold text-zinc-800">
                      Tirar foto no local
                    </p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      Aciona diretamente a câmera do celular/tablet
                    </p>

                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFotoChange}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Geolocation Tag */}
          {tipoAcao !== 'a_caminho' && (
            <div className="p-2.5 bg-zinc-100 rounded-lg text-xs flex items-center justify-between text-zinc-700 border border-[#E5E5E5]">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#F5D800]" />
                {gettingGeo ? (
                  <span>Obtendo localização do GPS...</span>
                ) : geoCoords ? (
                  <span className="font-mono text-[11px]">
                    GPS: {geoCoords.latitude.toFixed(5)}, {geoCoords.longitude.toFixed(5)}
                  </span>
                ) : (
                  <span className="text-red-600 font-medium">{geoError || 'GPS pendente'}</span>
                )}
              </div>

              {!geoCoords && (
                <button
                  type="button"
                  onClick={obterGeolocalizacao}
                  className="text-[10px] text-zinc-900 underline font-semibold"
                >
                  Tentar novamente
                </button>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E5E5]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-zinc-600 hover:text-zinc-900"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-[#F5D800] hover:bg-[#ebd000] text-zinc-950 font-bold text-xs rounded-lg border border-[#d2b800]"
            >
              {loading ? 'Confirmando...' : 'Confirmar e salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
