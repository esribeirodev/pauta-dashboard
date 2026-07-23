import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';

/*
 * Permissões dinâmicas por área de trabalho, com ajuste POR USUÁRIO.
 * Precedência: override do membro (workspace_members.overrides) > padrão do cargo.
 * - can(perm, wsId): usuário tem a permissão? (em qualquer área, ou na área específica)
 * - isGlobal: admin do sistema ou membro com all_workspaces
 * - workspaces: áreas VISÍVEIS para o usuário (todas, se global)
 */

function allowed(membership, perm) {
  const override = membership.overrides?.[perm];
  if (typeof override === 'boolean') return override;
  return membership.role?.permissions?.[perm] === true;
}

export function usePermissions(userId, role) {
  const [memberships, setMemberships] = useState([]);
  const [allWorkspaces, setAllWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !supabase) return;

    let cancelled = false;

    (async () => {
      const [membersResult, workspacesResult] = await Promise.all([
        supabase
          .from('workspace_members')
          .select('workspace_id, overrides, role:workspace_roles(id, name, permissions)')
          .eq('user_id', userId),
        supabase
          .from('workspaces')
          .select('id, name, active')
          .eq('active', true)
          .order('name')
      ]);

      if (cancelled) return;
      setMemberships(membersResult.data || []);
      setAllWorkspaces(workspacesResult.data || []);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [userId]);

  const isAdmin = role === 'admin';

  const isGlobal =
    isAdmin || memberships.some(m => allowed(m, 'all_workspaces'));

  const can = useCallback(
    (perm, wsId = null) => {
      if (isAdmin) return true;
      return memberships.some(
        m =>
          allowed(m, perm) &&
          (wsId == null ||
            m.workspace_id === wsId ||
            allowed(m, 'all_workspaces'))
      );
    },
    [memberships, isAdmin]
  );

  const workspaces = isGlobal
    ? allWorkspaces
    : allWorkspaces.filter(ws =>
        memberships.some(m => m.workspace_id === ws.id)
      );

  return { can, isGlobal, loading, memberships, workspaces };
}
