-- Ajuste final: criativos precisam ler perfis ativos para exibir nomes
-- (criador, responsável, histórico) e escolher destinatários no encaminhamento.
-- Antes, apenas gestores liam todos os perfis.
create policy profiles_select_active_authenticated
on public.profiles
for select to authenticated
using (active = true);
