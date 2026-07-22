import React from 'react';
import { ExternalLink, FolderOpen } from 'lucide-react';
import { supabase } from '../supabase';

const thumb = (id, width = 1200) =>
  `https://drive.google.com/thumbnail?id=${id}&sz=w${width}`;
const preview = id => `https://drive.google.com/file/d/${id}/preview`;
const view = id => `https://drive.google.com/file/d/${id}/view`;

/* Galeria dos arquivos hospedados no Google Drive */
export default function DriveGallery({ item = {} }) {
  const driveFiles = (item.attachments || []).filter(
    file => file.source === 'drive' && file.drive_file_id
  );

  async function openFolder() {
    const { data, error } = await supabase.functions.invoke('drive-manager', {
      body: { action: 'get_folder', contentId: item.id }
    });
    if (error || !data?.folderUrl) {
      alert(error?.message || data?.error || 'Não foi possível abrir a pasta.');
      return;
    }
    window.open(data.folderUrl, '_blank', 'noopener');
  }

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
        {driveFiles.map(file => {
          const isImage = (file.mime_type || '').startsWith('image/');
          const isVideo = (file.mime_type || '').startsWith('video/');

          return (
            <figure className="drive-card" key={file.id}>
              {isImage && (
                <a href={view(file.drive_file_id)} target="_blank" rel="noreferrer">
                  <img
                    src={thumb(file.drive_file_id, 800)}
                    alt={file.file_name}
                    loading="lazy"
                  />
                </a>
              )}

              {isVideo && (
                <iframe
                  src={preview(file.drive_file_id)}
                  title={file.file_name}
                  allow="autoplay; fullscreen"
                  allowFullScreen
                />
              )}

              {!isImage && !isVideo && (
                <a
                  className="drive-generic"
                  href={view(file.drive_file_id)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={16} /> {file.file_name}
                </a>
              )}

              <figcaption title={file.file_name}>{file.file_name}</figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}
