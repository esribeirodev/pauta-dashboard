import React, { useEffect, useState } from 'react';
import {
  ExternalLink, FolderOpen, Trash2, X, Play, Maximize2
} from 'lucide-react';
import { supabase } from '../supabase';

const thumb = (id, width = 1200) =>
  `https://drive.google.com/thumbnail?id=${id}&sz=w${width}`;
const preview = id => `https://drive.google.com/file/d/${id}/preview`;
const view = id => `https://drive.google.com/file/d/${id}/view`;

/*
 * Galeria dos arquivos hospedados no Google Drive.
 * v2 — clique na mídia abre lightbox (expande na própria página),
 * botão de lixeira remove o arquivo do Drive e da demanda.
 */
export default function DriveGallery({ item = {}, onChanged }) {
  const [removedIds, setRemovedIds] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [lightbox, setLightbox] = useState(null);

  const driveFiles = (item.attachments || []).filter(
    file =>
      file.source === 'drive' &&
      file.drive_file_id &&
      !removedIds.includes(file.id)
  );

  /* Fecha o lightbox com Esc */
  useEffect(() => {
    if (!lightbox) return;
    const onKey = event => {
      if (event.key === 'Escape') setLightbox(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox]);

  async function openFolder() {
    const { data, error } = await supabase.functions.invoke('drive-manage', {
      body: { action: 'get_folder', contentId: item.id }
    });
    if (error || !data?.folderUrl) {
      alert(error?.message || data?.error || 'Não foi possível abrir a pasta.');
      return;
    }
    window.open(data.folderUrl, '_blank', 'noopener');
  }

  async function removeFile(file) {
    const ok = window.confirm(
      `Remover "${file.file_name}"?\nO arquivo será apagado do Drive e da demanda.`
    );
    if (!ok) return;

    setBusyId(file.id);
    const { data, error } = await supabase.functions.invoke('drive-manage', {
      body: { action: 'delete_file', contentId: item.id, attachmentId: file.id }
    });
    setBusyId(null);

    if (error || data?.error) {
      alert(error?.message || data?.error || 'Não foi possível remover o arquivo.');
      return;
    }

    setRemovedIds(previous => [...previous, file.id]);
    if (lightbox?.id === file.id) setLightbox(null);
    if (onChanged) onChanged();
  }

  const isImage = file => (file.mime_type || '').startsWith('image/');
  const isVideo = file => (file.mime_type || '').startsWith('video/');

  return (
    <div className="drive-gallery">
      <div className="drive-gallery-head">
        <b>Mídia no Drive {driveFiles.length ? `(${driveFiles.length})` : ''}</b>
        <button type="button" className="linklike" onClick={openFolder}>
          <FolderOpen size={14} /> Abrir pasta no Drive
        </button>
      </div>

      {driveFiles.length === 0 && (
        <p className="hint">Nenhuma mídia enviada ao Drive ainda.</p>
      )}

      <div className="drive-grid">
        {driveFiles.map(file => (
          <figure className="drive-card" key={file.id}>
            {(isImage(file) || isVideo(file)) ? (
              <button
                type="button"
                className="drive-thumb"
                title="Clique para expandir"
                onClick={() => setLightbox(file)}
              >
                <img
                  src={thumb(file.drive_file_id, 800)}
                  alt={file.file_name}
                  loading="lazy"
                />
                {isVideo(file) && (
                  <span className="drive-play">
                    <Play size={22} fill="currentColor" />
                  </span>
                )}
                <span className="drive-expand"><Maximize2 size={13} /></span>
              </button>
            ) : (
              <a
                className="drive-generic"
                href={view(file.drive_file_id)}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={16} /> {file.file_name}
              </a>
            )}

            <figcaption>
              <span title={file.file_name}>{file.file_name}</span>
              <button
                type="button"
                className="drive-delete"
                title="Remover arquivo"
                disabled={busyId === file.id}
                onClick={() => removeFile(file)}
              >
                <Trash2 size={13} />
              </button>
            </figcaption>
          </figure>
        ))}
      </div>

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <div className="lightbox-inner" onClick={event => event.stopPropagation()}>
            <div className="lightbox-head">
              <b title={lightbox.file_name}>{lightbox.file_name}</b>
              <div className="lightbox-actions">
                <a
                  className="lightbox-btn"
                  href={view(lightbox.drive_file_id)}
                  target="_blank"
                  rel="noreferrer"
                  title="Abrir no Drive"
                >
                  <ExternalLink size={15} />
                </a>
                <button
                  type="button"
                  className="lightbox-btn danger"
                  title="Remover arquivo"
                  disabled={busyId === lightbox.id}
                  onClick={() => removeFile(lightbox)}
                >
                  <Trash2 size={15} />
                </button>
                <button
                  type="button"
                  className="lightbox-btn"
                  title="Fechar (Esc)"
                  onClick={() => setLightbox(null)}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="lightbox-media">
              {isImage(lightbox) ? (
                <img src={thumb(lightbox.drive_file_id, 1600)} alt={lightbox.file_name} />
              ) : (
                <iframe
                  src={preview(lightbox.drive_file_id)}
                  title={lightbox.file_name}
                  allow="autoplay; fullscreen"
                  allowFullScreen
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
