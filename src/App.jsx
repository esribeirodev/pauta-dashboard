import React, { useEffect, useState } from 'react';
import {
  CalendarDays, CheckCircle2, ClipboardList, FolderKanban,
  LayoutDashboard, LogOut, Menu, Plus, Search, Settings, ShieldCheck
} from 'lucide-react';
import { supabase } from './supabase';
import { ROLES, ITEM_SELECT } from './constants';
import { isCreative, isManager } from './utils';
import { usePermissions } from './hooks/usePermissions';
import Login from './components/Login';
import Setup from './components/Setup';
import Dashboard from './components/Dashboard';
import KanbanManager from './components/KanbanManager';
import KanbanCreative from './components/KanbanCreative';
import Approvals from './components/Approvals';
import CalendarView from './components/CalendarView';
import NewDemand from './components/NewDemand';
import DemandDetail from './components/DemandDetail';
import Admin from './components/Admin';
import AdminWorkspaces from './components/AdminWorkspaces';
import NotificationBell from './components/NotificationBell';
import SearchOverlay from './components/SearchOverlay';
import SettingsModal from './components/SettingsModal';

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState('dashboard');
  const [clients, setClients] = useState([]);
  const [adminClients, setAdminClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [items, setItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState(null);
  const [month, setMonth] = useState(new Date());
  const [selectedWorkspace, setSelectedWorkspace] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  /* Áreas de trabalho e permissões dinâmicas */
  const { workspaces } = usePermissions(session?.user?.id, profile?.role);
  const multiArea = workspaces.length > 1;

  useEffect(() => {
    if (!workspaces.length) return;
    if (!workspaces.some(ws => ws.id === selectedWorkspace)) {
      setSelectedWorkspace(workspaces[0].id);
    }
  }, [workspaces]);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const { data } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) load();
  }, [session]);

  /* Ctrl+K / Cmd+K abre a busca global */
  useEffect(() => {
    function onKeyDown(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setShowSearch(previous => !previous);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  async function load() {
    const [profileResult, clientsResult, allClientsResult, usersResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
      supabase.from('clients').select('*').eq('active', true).order('name'),
      supabase.from('clients').select('*').order('active', { ascending: false }).order('name'),
      supabase.from('profiles').select('id, full_name, role, active').order('full_name')
    ]);

    const profileData = profileResult.data;
    const activeClients = clientsResult.data || [];

    setProfile(profileData);
    setClients(activeClients);
    setAdminClients(allClientsResult.data || []);
    setUsers(usersResult.data || []);

    if (isCreative(profileData?.role)) {
      await loadMyItems();
      return;
    }

    const stillExists = activeClients.some(client => client.id === selectedClient);
    const nextClientId = stillExists ? selectedClient : activeClients[0]?.id || '';

    setSelectedClient(nextClientId);

    if (nextClientId) {
      await loadItems(nextClientId);
    } else {
      setItems([]);
    }
  }

  async function loadItems(clientId = selectedClient) {
    if (!clientId) {
      setItems([]);
      return;
    }

    const { data, error } = await supabase
      .from('content_items')
      .select(ITEM_SELECT)
      .eq('client_id', clientId)
      .is('deleted_at', null)
      .order('due_at', { ascending: true, nullsFirst: false });

    if (error) {
      setNotice({ type: 'error', text: `Erro ao carregar demandas: ${error.message}` });
      setItems([]);
      return;
    }

    setItems(data || []);
  }

  async function loadMyItems() {
    const { data, error } = await supabase
      .from('content_items')
      .select(ITEM_SELECT)
      .is('deleted_at', null)
      .order('due_at', { ascending: true, nullsFirst: false });

    if (error) {
      setNotice({ type: 'error', text: `Erro ao carregar suas demandas: ${error.message}` });
      setItems([]);
      return;
    }

    setItems(data || []);
  }

  async function refresh() {
    setModal(null);
    if (isCreative(profile?.role)) {
      await loadMyItems();
    } else {
      await loadItems(selectedClient);
    }
  }

  /* Abrir demanda vinda de notificação ou busca: pode não estar na lista atual */
  async function openFromNotification(contentId) {
    const exists = items.some(item => item.id === contentId);

    if (!exists) {
      const { data } = await supabase
        .from('content_items')
        .select(ITEM_SELECT)
        .eq('id', contentId)
        .maybeSingle();

      if (data) {
        setItems(previous => [data, ...previous.filter(item => item.id !== data.id)]);
      } else {
        setNotice({ type: 'error', text: 'Esta demanda não está mais disponível.' });
        return;
      }
    }

    setModal({ type: 'detail', id: contentId });
  }

  const role = profile?.role;
  const creative = isCreative(role);
  const managers = isManager(role);
  const admin = role === 'admin';
  const userId = session?.user?.id;

  if (!supabase) return <Setup />;
  if (!session) return <Login />;

  const nav = creative
    ? [
        ['dashboard', 'Dashboard', LayoutDashboard],
        ['tasks', 'Minhas tarefas', ClipboardList],
        ['calendar', 'Calendário', CalendarDays]
      ]
    : [
        ['dashboard', 'Dashboard', LayoutDashboard],
        ['production', 'Produção', FolderKanban],
        ['approvals', 'Aprovações', CheckCircle2],
        ['calendar', 'Calendário', CalendarDays]
      ];

  if (admin) nav.push(['admin', 'Administração', ShieldCheck]);

  /* Com 2+ áreas visíveis, filtra as demandas pela área selecionada.
     Com área única (hoje), nada muda. */
  const visibleItems = multiArea && selectedWorkspace
    ? items.filter(item => !item.workspace_id || item.workspace_id === selectedWorkspace)
    : items;

  const currentItem = items.find(item => item.id === modal?.id);

  const noticeText = typeof notice === 'object' && notice !== null ? notice.text : notice;
  const noticeIsError = typeof notice === 'object' && notice !== null && notice.type === 'error';

  return (
    <div className="shell">
      <header>
        <button
          className="icon mobile"
          onClick={() => document.querySelector('aside')?.classList.toggle('open')}
        >
          <Menu />
        </button>

        <div className="brand"><i />PAUTA</div>

        {multiArea && (
          <select
            className="client-select"
            value={selectedWorkspace}
            onChange={event => setSelectedWorkspace(event.target.value)}
            title="Área de trabalho"
          >
            {workspaces.map(ws => (
              <option value={ws.id} key={ws.id}>{ws.name}</option>
            ))}
          </select>
        )}

        {!creative && (
          <select
            className="client-select"
            value={selectedClient}
            onChange={async event => {
              const clientId = event.target.value;
              setSelectedClient(clientId);
              await loadItems(clientId);
            }}
          >
            {clients.map(client => (
              <option value={client.id} key={client.id}>{client.name}</option>
            ))}
          </select>
        )}

        <div className="header-actions">
          <button
            className="icon"
            title="Buscar demandas (Ctrl+K)"
            onClick={() => setShowSearch(true)}
          >
            <Search />
          </button>
          {userId && (
            <NotificationBell user={userId} onOpenContent={openFromNotification} />
          )}
          <span className="user-pill">
            <b>{profile?.full_name}</b>
            <small>{ROLES[role] || role}</small>
          </span>
          <button className="icon" onClick={() => supabase.auth.signOut()}>
            <LogOut />
          </button>
        </div>
      </header>

      <div className="body">
        <aside>
          <nav>
            {nav.map(([id, label, Icon]) => (
              <button
                key={id}
                className={tab === id ? 'active' : ''}
                onClick={() => setTab(id)}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </nav>
          <div className="aside-bottom">
            <button onClick={() => setShowSettings(true)}>
              <Settings size={17} />Configurações
            </button>
          </div>
        </aside>

        <main>
          <div className="page-head">
            <div>
              <p className="eyebrow">
                {creative
                  ? 'Fila pessoal'
                  : clients.find(client => client.id === selectedClient)?.name}
              </p>
              <h1>{nav.find(entry => entry[0] === tab)?.[1]}</h1>
              <p className="sub">
                {creative
                  ? 'Receba, produza e encaminhe suas demandas.'
                  : 'Acompanhe o planejamento, produção e aprovação da equipe.'}
              </p>
            </div>

            {managers && (
              <button className="primary" onClick={() => setModal({ type: 'new' })}>
                <Plus size={17} />
                Nova demanda
              </button>
            )}
          </div>

          {tab === 'dashboard' && (
            <Dashboard
              items={visibleItems}
              role={role}
              user={userId}
              open={id => setModal({ type: 'detail', id })}
            />
          )}

          {tab === 'production' && (
            <KanbanManager items={visibleItems} open={id => setModal({ type: 'detail', id })} />
          )}

          {tab === 'tasks' && (
            <KanbanCreative
              items={visibleItems}
              user={userId}
              open={id => setModal({ type: 'detail', id })}
            />
          )}

          {tab === 'approvals' && (
            <Approvals
              items={visibleItems}
              user={userId}
              open={id => setModal({ type: 'detail', id })}
            />
          )}

          {tab === 'calendar' && (
            <CalendarView items={visibleItems} month={month} setMonth={setMonth} />
          )}

          {tab === 'admin' && (
            <>
              <Admin
                users={users}
                clients={adminClients}
                reload={load}
                setNotice={setNotice}
              />
              <AdminWorkspaces users={users} setNotice={setNotice} />
            </>
          )}
        </main>
      </div>

      {modal?.type === 'new' && (
        <NewDemand
          users={users}
          clients={clients}
          clientId={selectedClient}
          creator={userId}
          role={role}
          workspaces={workspaces}
          workspaceId={selectedWorkspace}
          close={() => setModal(null)}
          saved={refresh}
        />
      )}

      {modal?.type === 'detail' && currentItem && (
        <DemandDetail
          item={currentItem}
          role={role}
          user={userId}
          users={users}
          close={() => setModal(null)}
          saved={refresh}
        />
      )}

      {showSearch && (
        <SearchOverlay
          clientId={!creative ? selectedClient : undefined}
          onOpen={async id => {
            setShowSearch(false);
            await openFromNotification(id);
          }}
          onClose={() => setShowSearch(false)}
        />
      )}

      {showSettings && userId && (
        <SettingsModal
          user={userId}
          onClose={() => setShowSettings(false)}
          onSaved={load}
        />
      )}

      {noticeText && (
        <div
          className={noticeIsError ? 'toast error' : 'toast'}
          onClick={() => setNotice('')}
        >
          {noticeText}
        </div>
      )}
    </div>
  );
}
