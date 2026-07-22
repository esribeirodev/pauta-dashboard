# PAUTA — Frontend Fase 1 (modular)

Novo fluxo por "Responsável Atual": Receber demanda → Produção → Encaminhar →
Aprovação (Aprovar e concluir / Encaminhar / Devolver para criador ou participante)
+ histórico visível + prioridade + indicador de prazo.

## Estrutura

```
src/
├── main.jsx                  bootstrap (createRoot + ErrorBoundary)
├── App.jsx                   shell, sessão, carregamento, roteamento de abas
├── supabase.js               (mantenha o seu atual — não incluído)
├── constants.js              ROLES, STATUS novos, PRIORITY, regras de encaminhamento
├── utils.js                  helpers (isManager, dueInfo, datas)
└── components/
    ├── ErrorBoundary.jsx
    ├── Login.jsx / Setup.jsx
    ├── StatusBadge.jsx        status + prioridade + indicador de prazo
    ├── ContentList.jsx
    ├── Dashboard.jsx          cards por perfil
    ├── KanbanManager.jsx      visão gestor (Recebidas | Em produção | Em aprovação)
    ├── KanbanCreative.jsx     visão criativo estilo Trello (3 colunas)
    ├── Approvals.jsx          fila = in_review onde current_assignee = eu
    ├── CalendarView.jsx
    ├── NewDemand.jsx          + campo prioridade
    ├── DemandDetail.jsx       Receber demanda / produção / aprovação
    ├── ForwardModal.jsx       encaminhar p/ requisitante ou usuário permitido
    ├── ReturnModal.jsx        devolver p/ criador OU participante + observação obrigatória
    ├── HistoryTimeline.jsx    histórico da demanda (content_events)
    └── Admin.jsx              usuários e clientes (como antes)
```

## Instalação

1. Substitua a pasta `src/` do projeto por esta (MANTENHA seu `src/supabase.js`
   e seu `src/styles.css` atuais).
2. Anexe o conteúdo de `styles_patch.css` ao FINAL do seu `src/styles.css`.
3. Rode `ajuste_profiles_policy.sql` no SQL Editor do Supabase (necessário para
   criativos enxergarem nomes de gestores no encaminhamento/histórico).
4. `npm run dev`.

## Teste de validação (fluxo completo)

1. Gestor cria demanda (com prioridade) → criativo vê em "Demandas recebidas";
2. Criativo clica "Receber demanda" → vai para "Em produção" (received_at);
3. Criativo salva link do Drive + anexos → "Encaminhar" → escolhe requisitante;
4. Gestor vê na aba Aprovações → abre → "Devolver" com observação → volta ao criativo;
5. Criativo corrige → encaminha de novo → gestor "Aprovar e concluir" → done;
6. Abra a demanda e confira a timeline do histórico com todos os eventos.
