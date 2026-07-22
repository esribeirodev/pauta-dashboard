export const ROLES = {
  admin: 'Administrador',
  supervisora: 'Supervisora',
  estrategista: 'Estrategista',
  design: 'Design',
  editora: 'Editora',
  videomaker: 'Videomaker'
};

export const MANAGERS = ['admin', 'supervisora', 'estrategista'];
export const CREATIVES = ['design', 'editora', 'videomaker'];
export const FINAL_APPROVERS = ['admin', 'supervisora'];

export const STATUS = {
  received: 'Recebida',
  in_production: 'Em produção',
  in_review: 'Aguardando aprovação final',
  done: 'Concluída',
  archived: 'Arquivada'
};

export const PRIORITY = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  urgente: 'Urgente'
};

export const TYPE = ['CARD', 'STORY', 'REELS', 'REELS EM COLLAB'];

export const FORWARD_TARGETS = {
  design: ['estrategista', 'supervisora', 'admin'],
  editora: ['estrategista', 'supervisora', 'admin'],
  videomaker: ['estrategista', 'supervisora', 'admin'],
  estrategista: ['supervisora', 'admin', 'design', 'editora', 'videomaker'],
  supervisora: ['admin', 'estrategista', 'design', 'editora', 'videomaker'],
  admin: ['supervisora', 'estrategista', 'design', 'editora', 'videomaker']
};

export const ITEM_SELECT = `*,
  creator:profiles!created_by(id, full_name, role),
  assignee:profiles!current_assignee(id, full_name, role),
  attachments:content_attachments(*)`;
