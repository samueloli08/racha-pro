import React, { useEffect, useState } from 'react';
import { Download, Loader2, Share2, X } from 'lucide-react';
import { canvasToBlob, renderShareCard, ShareCardData } from '../../utils/shareCard';
import { useToast } from '../ui/Toast';

interface ShareCardModalProps {
  data: ShareCardData;
  onClose: () => void;
}

const FILE_NAME = 'rachapro-stories.png';

export const ShareCardModal: React.FC<ShareCardModalProps> = ({ data, onClose }) => {
  const toast = useToast();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;

    const generate = async () => {
      try {
        if (document.fonts?.ready) {
          await document.fonts.ready;
        }
      } catch {
        // segue com fallback se fonts API não responder
      }
      if (cancelled) return;
      const canvas = renderShareCard(data);
      const result = await canvasToBlob(canvas);
      if (cancelled) return;
      if (!result) {
        setFailed(true);
        return;
      }
      url = URL.createObjectURL(result);
      setBlob(result);
      setPreviewUrl(url);
    };
    void generate();

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [data]);

  const handleDownload = () => {
    if (!previewUrl) return;
    const link = document.createElement('a');
    link.href = previewUrl;
    link.download = FILE_NAME;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.show('Imagem baixada!');
  };

  const handleShare = async () => {
    if (!blob) return;
    const file = new File([blob], FILE_NAME, { type: 'image/png' });
    try {
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Resumo do Racha — RachaPro' });
        return;
      }
      handleDownload();
    } catch {
      // usuário cancelou o compartilhamento
    }
  };

  const canNativeShare = typeof navigator.share === 'function';

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rp-card flex max-h-[94vh] w-full max-w-md animate-sheet-in flex-col gap-3.5 rounded-[28px] bg-white p-5 text-[#0D1510]"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="rp-eyebrow">STORIES · 9:16</p>
            <h3 className="text-base font-extrabold tracking-[-0.03em] text-[#0D1510]">
              Card do Racha
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#0D1510]/10 bg-[#F6F9F2] text-[#647468] hover:text-[#0D1510]"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl border border-[#0D1510]/10 bg-[#0F1712] p-2">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Prévia do card de Stories com o pódio do racha"
              className="max-h-[58vh] w-auto max-w-full rounded-xl object-contain"
            />
          ) : failed ? (
            <p className="p-8 text-sm text-[#FCA5A5]">Não foi possível gerar a imagem.</p>
          ) : (
            <div className="flex items-center gap-2 p-10 font-mono text-xs text-[#C9D3C4]">
              <Loader2 className="h-4 w-4 animate-spin text-[#BEF264]" /> Gerando card...
            </div>
          )}
        </div>

        <div className={`grid gap-2 ${canNativeShare ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <button
            type="button"
            onClick={handleDownload}
            disabled={!blob}
            className="rp-btn-primary flex min-h-[48px] items-center justify-center gap-2 rounded-2xl text-xs disabled:opacity-40"
          >
            <Download className="h-4 w-4" /> Baixar PNG
          </button>
          {canNativeShare && (
            <button
              type="button"
              onClick={handleShare}
              disabled={!blob}
              className="rp-btn-secondary flex min-h-[48px] items-center justify-center gap-2 rounded-2xl text-xs disabled:opacity-40"
            >
              <Share2 className="h-4 w-4 text-[#3F6212]" /> Compartilhar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
