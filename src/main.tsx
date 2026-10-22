import { useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Coffee,
  FileText,
  House,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  Users,
  X,
} from "lucide-react";
import "./styles.css";

import {
  api,
  localDate,
  dateLabel,
  duration,
  modality,
  initials,
  monthRange,
  setCsrf,
} from "./lib";
import type { User, Entry, Day, View } from "./lib";
import {
  Brand,
  Badge,
  Login,
  ErrorMessage,
  Stat,
  WeekChart,
  Modal,
  EntryModal,
  Calendar,
  DayModal,
  UserModal,
  PasswordModal,
} from "./components";
function App() {
  const [user, setUser] = useState<User | null>(null),
    [boot, setBoot] = useState(true),
    [today, setToday] = useState(localDate(new Date()));
  const [view, setView] = useState<View>("dashboard"),
    [month, setMonth] = useState(today.slice(0, 7)),
    [entries, setEntries] = useState<Entry[]>([]),
    [days, setDays] = useState<Day[]>([]),
    [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [search, setSearch] = useState("");
  const [entryModal, setEntryModal] = useState<Entry | null | false>(false),
    [dayModal, setDayModal] = useState<string | null>(null),
    [userModal, setUserModal] = useState<User | null | false>(false),
    [passwordModal, setPasswordModal] = useState(false),
    [deleteEntry, setDeleteEntry] = useState<Entry | null>(null);
  const [reportUser, setReportUser] = useState(""),
    [from, setFrom] = useState(monthRange(today.slice(0, 7)).from),
    [to, setTo] = useState(monthRange(today.slice(0, 7)).to);
  const [saving, setSaving] = useState(false),
    [modalError, setModalError] = useState("");
  const isAdmin = user?.role === "admin";
  const loadSequence = useRef(0);
  useEffect(() => {
    api<{ user: User | null; csrf: string; today: string }>("/session")
      .then((s) => {
        setCsrf(s.csrf);
        setUser(s.user);
        setToday(s.today);
        setMonth(s.today.slice(0, 7));
        setFrom(monthRange(s.today.slice(0, 7)).from);
        setTo(monthRange(s.today.slice(0, 7)).to);
      })
      .catch((e) => setError(e.message))
      .finally(() => setBoot(false));
    const expired = () => {
      setUser(null);
      setEntries([]);
      setUsers([]);
      setDays([]);
      setError("Sua sessão expirou. Entre novamente.");
    };
    window.addEventListener("session-expired", expired);
    return () => window.removeEventListener("session-expired", expired);
  }, []);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    setModalError("");
  }, [entryModal, dayModal, userModal, passwordModal, deleteEntry]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (user)
        api<{ today: string }>("/session")
          .then((s) => setToday(s.today))
          .catch(() => {});
    }, 60000);
    return () => clearInterval(timer);
  }, [user]);
  async function load() {
    if (!user) return;
    const sequence = ++loadSequence.current;
    setLoading(true);
    setError("");
    try {
      const range = view === "reports" ? { from, to } : monthRange(month);
      const query = `from=${range.from}&to=${range.to}`;
      const [es, ds, us] = await Promise.all([
        api<Entry[]>(
          "/entries?" +
            query +
            (view === "reports"
              ? reportUser
                ? "&user_id=" + reportUser
                : ""
              : "&user_id=" + user.id),
        ),
        api<Day[]>("/calendar?" + new URLSearchParams(monthRange(month))),
        isAdmin ? api<User[]>("/users") : Promise.resolve([]),
      ]);
      if (sequence === loadSequence.current) {
        setEntries(es);
        setDays(ds);
        setUsers(us);
      }
    } catch (e) {
      if (sequence === loadSequence.current) setError((e as Error).message);
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [user, view, month, from, to, reportUser]);
  async function mutate(
    fn: () => Promise<unknown>,
    message: string,
    close: () => void,
  ) {
    setSaving(true);
    setModalError("");
    try {
      await fn();
      close();
      setToast(message);
      await load();
    } catch (e) {
      setModalError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  if (boot)
    return (
      <div className="boot">
        <Brand />
        <LoaderCircle className="spin" />
        Preparando seu espaço…
      </div>
    );
  if (!user)
    return (
      <Login
        error={error}
        onLogin={async (email, password) => {
          setError("");
          try {
            const s = await api<{ user: User; csrf: string; today: string }>(
              "/login",
              "POST",
              { email, password },
            );
            setCsrf(s.csrf);
            setEntries([]);
            setDays([]);
            setUsers([]);
            setUser(s.user);
            setToday(s.today);
            setView("dashboard");
          } catch (e) {
            setError((e as Error).message);
            throw e;
          }
        }}
      />
    );
  const nav = [
    { id: "dashboard", label: "Visão geral", icon: LayoutDashboard },
    { id: "entries", label: "Meus lançamentos", icon: Clock3 },
    { id: "calendar", label: "Calendário", icon: CalendarDays },
    ...(isAdmin
      ? [
          { id: "reports", label: "Relatórios", icon: FileText },
          { id: "users", label: "Equipe", icon: Users },
        ]
      : []),
  ];
  const titles = {
    dashboard: "Visão geral",
    entries: "Meus lançamentos",
    calendar: "Calendário",
    reports: "Relatórios da equipe",
    users: "Pessoas da equipe",
  };
  const ownEntries = entries.filter((e) => e.user_id === user.id),
    total = entries.reduce((n, e) => n + e.minutes, 0),
    todayEntries = ownEntries.filter((e) => e.date === today),
    todayMinutes = todayEntries.reduce((n, e) => n + e.minutes, 0);
  const daysWorked = new Set(entries.map((e) => e.date)).size,
    extra = entries
      .filter((e) => e.extra || e.on_call)
      .reduce((n, e) => n + e.minutes, 0);
  const filtered = entries.filter((e) =>
    (e.description + " " + e.user_name + " " + e.jira_url + " " + e.trello_url)
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const holidayToday = days.find((d) => d.date === today && d.holiday);
  const canEdit = (e: Entry) =>
    isAdmin || (e.user_id === user.id && e.date === today);
  const currentNote = days.find((d) => d.date === dayModal);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand-link"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setView("dashboard");
          }}
          aria-label="Sirius Wink, início"
        >
          <Brand />
        </a>
        <span className="workspace-tag">SEU TEMPO, BEM CUIDADO</span>
        <div className="nav-section-label">WORKSPACE</div>
        <nav>
          {nav.map((n) => (
            <button
              key={n.id}
              className={view === n.id ? "nav-item active" : "nav-item"}
              onClick={() => {
                setView(n.id as View);
                setSearch("");
              }}
            >
              <n.icon size={19} />
              {n.label}
              {view === n.id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="hybrid-card">
            <div className="hybrid-icon">
              <House size={19} />
              <BriefcaseBusiness size={19} />
            </div>
            <strong>O melhor dos dois mundos.</strong>
            <p>
              Seg e sex, de onde você estiver.
              <br />
              Ter a qui, juntos na Sirius.
            </p>
            <span>
              Nosso jeito de trabalhar <ArrowUpRight size={13} />
            </span>
          </div>
          <button
            className="profile"
            onClick={() => setPasswordModal(true)}
            title="Alterar minha senha"
          >
            <span className="avatar">{initials(user.name)}</span>
            <span>
              <strong>{user.name}</strong>
              <small>{isAdmin ? "Administrador" : "Colaborador"}</small>
            </span>
            <MoreHorizontal size={18} />
          </button>
          <button
            className="logout"
            onClick={async () => {
              try {
                await api("/logout", "POST", {});
                setUser(null);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <LogOut size={16} />
            Sair da conta
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={14} />
            <strong>{titles[view]}</strong>
          </div>
          <div className="topbar-right">
            <span className="live-dot" />
            Horário de Brasília{" "}
            <span className="top-avatar">{initials(user.name)}</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {view === "dashboard"
                  ? "UM DIA DE CADA VEZ"
                  : view === "users"
                    ? "QUEM FAZ A SIRIUS"
                    : "ORGANIZAÇÃO QUE FAZ A DIFERENÇA"}
              </div>
              <h1>
                {view === "dashboard" ? (
                  <>
                    Olá, {user.name.split(" ")[0]}{" "}
                    <span className="greeting-sun">☀</span>
                  </>
                ) : (
                  titles[view]
                )}
              </h1>
              <p>
                {view === "dashboard"
                  ? "Cada hora conta. Faça o seu tempo valer."
                  : view === "entries"
                    ? "Seu trabalho registrado, seu dia em equilíbrio."
                    : view === "calendar"
                      ? "Feriados, observações e o ritmo da nossa equipe."
                      : view === "reports"
                        ? "Uma visão clara do tempo de cada pessoa."
                        : "Gerencie acessos e mantenha todo mundo conectado."}
              </p>
            </div>
            <div className="heading-actions">
              {view === "users" ? (
                <button
                  className="button primary"
                  onClick={() => setUserModal(null)}
                >
                  <Plus size={18} />
                  Adicionar pessoa
                </button>
              ) : view === "calendar" ? (
                isAdmin && (
                  <button
                    className="button primary"
                    onClick={() =>
                      setDayModal(
                        month === today.slice(0, 7) ? today : month + "-01",
                      )
                    }
                  >
                    <Plus size={18} />
                    Adicionar ao calendário
                  </button>
                )
              ) : (
                <button
                  className="button primary"
                  onClick={() => setEntryModal(null)}
                >
                  <Plus size={18} />
                  Novo lançamento
                </button>
              )}
            </div>
          </div>
          {error && (
            <div className="alert error" role="alert">
              {error}
              <button onClick={() => void load()}>Tentar novamente</button>
            </div>
          )}
          {view === "dashboard" && (
            <div className="today-banner">
              <div className="today-icon">
                <Sun size={24} />
              </div>
              <div>
                <strong>
                  {dateLabel(today, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </strong>
                <p>
                  {holidayToday
                    ? holidayToday.title
                    : modality(today) === "Remoto"
                      ? "Hoje o escritório é onde você está. Bom trabalho!"
                      : modality(today) === "Presencial"
                        ? "Hoje é dia de encontrar a equipe na Sirius."
                        : "Um tempo para recarregar. Cuide do seu equilíbrio."}
                </p>
              </div>
              <Badge
                tone={
                  holidayToday
                    ? "rose"
                    : modality(today) === "Remoto"
                      ? "blue"
                      : "green"
                }
              >
                {holidayToday ? (
                  <CalendarDays size={13} />
                ) : modality(today) === "Remoto" ? (
                  <House size={13} />
                ) : (
                  <BriefcaseBusiness size={13} />
                )}{" "}
                {holidayToday ? "Feriado" : modality(today)}
              </Badge>
            </div>
          )}
          {(view === "dashboard" ||
            view === "entries" ||
            view === "reports") && (
            <>
              <div className="section-toolbar">
                <div className="section-heading">
                  <span className="section-dot" />
                  <strong>
                    {view === "reports"
                      ? "Resumo do período"
                      : "Seu tempo em números"}
                  </strong>
                  <span className="muted">
                    {view === "reports"
                      ? "Todas as horas, em um lugar"
                      : "Uma visão do seu mês"}
                  </span>
                </div>
                {view !== "reports" && (
                  <label className="month-select">
                    <CalendarDays size={15} />
                    <input
                      aria-label="Mês dos lançamentos"
                      type="month"
                      value={month}
                      onChange={(e) =>
                        setMonth(e.target.value || today.slice(0, 7))
                      }
                    />
                  </label>
                )}
              </div>
              {view === "reports" && (
                <div className="report-filters panel">
                  <label>
                    De
                    <input
                      type="date"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                    />
                  </label>
                  <label>
                    Até
                    <input
                      type="date"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                    />
                  </label>
                  <label>
                    Pessoa
                    <select
                      value={reportUser}
                      onChange={(e) => setReportUser(e.target.value)}
                    >
                      <option value="">Toda a equipe</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                          {!u.active ? " (inativo)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <a
                    className="button secondary"
                    href={
                      "/api/entries?" +
                      new URLSearchParams({
                        from,
                        to,
                        ...(reportUser ? { user_id: reportUser } : {}),
                        format: "csv",
                      })
                    }
                  >
                    <ArrowDownToLine size={16} />
                    Exportar CSV
                  </a>
                </div>
              )}
              <div className="stats-grid">
                <Stat
                  title={
                    view === "reports" ? "Horas no período" : "Horas no mês"
                  }
                  value={duration(total)}
                  icon={<Clock3 size={18} />}
                  foot={`${entries.length} lançamentos registrados`}
                  tone="orange"
                />
                <Stat
                  title="Dias com lançamentos"
                  value={String(daysWorked).padStart(2, "0")}
                  suffix="dias"
                  icon={<CalendarDays size={18} />}
                  foot="Presença que faz a diferença"
                />
                <Stat
                  title={
                    view === "reports"
                      ? "Média por dia registrado"
                      : "Horas de hoje"
                  }
                  value={duration(
                    view === "reports"
                      ? daysWorked
                        ? Math.round(total / daysWorked)
                        : 0
                      : todayMinutes,
                  )}
                  icon={<Activity size={18} />}
                  foot={
                    view === "reports"
                      ? "Soma da equipe / dias com registros"
                      : todayEntries.length
                        ? `${todayEntries.length} lançamentos no dia`
                        : "Seu dia está começando"
                  }
                />
                <Stat
                  title="Extras e plantões"
                  value={duration(extra)}
                  icon={<Sparkles size={18} />}
                  foot="Tempo com dedicação a mais"
                />
              </div>
            </>
          )}
          {view === "dashboard" && (
            <div className="dashboard-middle">
              <section className="panel week-panel">
                <div className="panel-heading">
                  <div>
                    <h2>O ritmo da sua semana</h2>
                    <p>Cada período é parte da sua história.</p>
                  </div>
                  <Badge tone="neutral">
                    {month === today.slice(0, 7)
                      ? "Semana atual"
                      : "Primeira semana do mês"}
                  </Badge>
                </div>
                <WeekChart entries={ownEntries} today={today} month={month} />
              </section>
              <section className="balance-panel">
                <div className="balance-decoration">✦</div>
                <span className="small-caps">MAIS FOCO. MAIS EQUILÍBRIO.</span>
                <h2>
                  Seu tempo merece
                  <br />
                  uma boa gestão.
                </h2>
                <p>
                  Registre suas atividades e tenha
                  <br />
                  mais clareza sobre o seu dia.
                </p>
                <button onClick={() => setEntryModal(null)}>
                  Vamos registrar? <ArrowRight size={17} />
                </button>
                <div className="balance-lines" />
              </section>
            </div>
          )}
          {(view === "dashboard" ||
            view === "entries" ||
            view === "reports") && (
            <section className="panel entries-panel">
              <div className="panel-heading">
                <div>
                  <h2>
                    {view === "dashboard"
                      ? "Seus últimos lançamentos"
                      : view === "reports"
                        ? "Lançamentos da equipe"
                        : "Histórico de lançamentos"}{" "}
                    <span className="count-pill">{entries.length}</span>
                  </h2>
                  <p>
                    {view === "dashboard"
                      ? "O que você fez, organizado por aqui."
                      : "Consulte os detalhes e acompanhe os períodos registrados."}
                  </p>
                </div>
                {view === "dashboard" ? (
                  <button
                    className="text-button"
                    onClick={() => setView("entries")}
                  >
                    Ver todos <ArrowRight size={15} />
                  </button>
                ) : (
                  <div className="search-input">
                    <Search size={16} />
                    <input
                      placeholder="Buscar atividade ou pessoa"
                      aria-label="Buscar lançamentos"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                )}
              </div>
              {loading ? (
                <div className="empty-state">
                  <LoaderCircle className="spin" />
                  Carregando lançamentos…
                </div>
              ) : filtered.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">
                    <Coffee size={28} />
                  </span>
                  <h3>Ainda temos uma página em branco.</h3>
                  <p>
                    {search
                      ? "Nenhum lançamento corresponde à sua busca."
                      : "Registre seu primeiro período e comece a organizar seu tempo."}
                  </p>
                  {!search && (
                    <button
                      className="button secondary"
                      onClick={() => setEntryModal(null)}
                    >
                      <Plus size={16} />
                      Registrar horas
                    </button>
                  )}
                </div>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Data</th>
                        {view === "reports" && <th>Pessoa</th>}
                        <th>Atividade</th>
                        <th>Horários</th>
                        <th>Total</th>
                        <th>Modalidade</th>
                        <th aria-label="Ações" />
                      </tr>
                    </thead>
                    <tbody>
                      {(view === "dashboard"
                        ? filtered.slice(0, 5)
                        : filtered
                      ).map((e) => (
                        <tr key={e.id}>
                          <td>
                            <div className="date-cell">
                              <strong>{dateLabel(e.date)}</strong>
                              <span>
                                {dateLabel(e.date, { weekday: "long" })}
                              </span>
                            </div>
                          </td>
                          {view === "reports" && (
                            <td>
                              <strong className="person-name">
                                {e.user_name}
                              </strong>
                            </td>
                          )}
                          <td>
                            <div className="activity-cell">
                              <strong>
                                {e.description || "Atividade vinculada"}
                              </strong>
                              <div>
                                {e.jira_url && (
                                  <a
                                    href={e.jira_url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Jira <ArrowUpRight size={11} />
                                  </a>
                                )}
                                {e.trello_url && (
                                  <a
                                    href={e.trello_url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Trello <ArrowUpRight size={11} />
                                  </a>
                                )}
                                {!!e.extra && (
                                  <Badge tone="orange">Extra</Badge>
                                )}
                                {!!e.on_call && (
                                  <Badge tone="purple">Plantão</Badge>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="times-cell">
                              <span>
                                {e.start} <span>→</span> {e.end}
                              </span>
                              {e.return_time && (
                                <span>
                                  {e.return_time} <span>→</span> {e.final_end}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <strong className="total-hours">
                              {duration(e.minutes)}
                            </strong>
                          </td>
                          <td>
                            <Badge
                              tone={
                                e.mode === "Remoto"
                                  ? "blue"
                                  : e.mode === "Presencial"
                                    ? "green"
                                    : "neutral"
                              }
                            >
                              {e.mode === "Remoto" ? (
                                <House size={12} />
                              ) : (
                                <BriefcaseBusiness size={12} />
                              )}{" "}
                              {e.mode}
                            </Badge>
                          </td>
                          <td>
                            <div className="row-actions">
                              {canEdit(e) ? (
                                <>
                                  <button
                                    aria-label={"Editar lançamento " + e.id}
                                    title="Editar lançamento"
                                    onClick={() => setEntryModal(e)}
                                  >
                                    <Pencil size={15} />
                                  </button>
                                  <button
                                    aria-label={"Excluir lançamento " + e.id}
                                    title="Excluir lançamento"
                                    onClick={() => setDeleteEntry(e)}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </>
                              ) : (
                                <span title="Alterações disponíveis apenas no dia atual">
                                  <ShieldCheck size={16} />
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="panel-footer">
                <span>
                  <ShieldCheck size={14} />{" "}
                  {isAdmin
                    ? "Você tem acesso para corrigir qualquer lançamento."
                    : "Você pode editar e excluir seus lançamentos do dia atual."}
                </span>
                <span>Tempo bem registrado. Dia bem resolvido.</span>
              </div>
            </section>
          )}
          {view === "calendar" && (
            <Calendar
              month={month}
              setMonth={setMonth}
              today={today}
              days={days}
              isAdmin={isAdmin}
              onDay={setDayModal}
            />
          )}
          {view === "users" && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>
                    Nossa equipe{" "}
                    <span className="count-pill">{users.length}</span>
                  </h2>
                  <p>
                    Novos acessos são criados exclusivamente pela administração.
                  </p>
                </div>
                <Badge tone="green">
                  <ShieldCheck size={13} />
                  Acesso controlado
                </Badge>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Pessoa</th>
                      <th>E-mail</th>
                      <th>Perfil</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <div className="team-person">
                            <span className="avatar">{initials(u.name)}</span>
                            <strong>{u.name}</strong>
                          </div>
                        </td>
                        <td>{u.email}</td>
                        <td>
                          <Badge
                            tone={u.role === "admin" ? "purple" : "neutral"}
                          >
                            {u.role === "admin"
                              ? "Administrador"
                              : "Colaborador"}
                          </Badge>
                        </td>
                        <td>
                          <Badge tone={u.active ? "green" : "rose"}>
                            {u.active ? "Ativo" : "Inativo"}
                          </Badge>
                        </td>
                        <td>
                          <button
                            className="icon-button"
                            title={"Editar " + u.name}
                            onClick={() => setUserModal(u)}
                          >
                            <Pencil size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          <footer className="main-footer">
            <span>
              sirius wink<span className="orange-text">.</span>
            </span>
            <span>Feito para o seu tempo render melhor.</span>
            <span>Gestão inteligente de horas</span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
          <button aria-label="Fechar aviso" onClick={() => setToast("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {entryModal !== false && (
        <EntryModal
          existing={entryModal}
          user={user}
          users={users.filter(
            (u) => u.active || (entryModal && u.id === entryModal.user_id),
          )}
          today={today}
          saving={saving}
          error={modalError}
          onClose={() => setEntryModal(false)}
          onSave={(draft) =>
            mutate(
              () =>
                api(
                  "/entries" + (entryModal ? "/" + entryModal.id : ""),
                  entryModal ? "PUT" : "POST",
                  draft,
                ),
              "Lançamento salvo com sucesso.",
              () => setEntryModal(false),
            )
          }
        />
      )}
      {dayModal && (
        <DayModal
          date={dayModal}
          day={currentNote}
          isAdmin={isAdmin}
          saving={saving}
          error={modalError}
          onClose={() => setDayModal(null)}
          onSave={(date, draft) =>
            mutate(
              () => api("/calendar/" + date, "PUT", draft),
              "Calendário atualizado.",
              () => setDayModal(null),
            )
          }
          onDelete={() =>
            mutate(
              () => api("/calendar/" + dayModal, "DELETE"),
              "Observação removida.",
              () => setDayModal(null),
            )
          }
        />
      )}
      {userModal !== false && (
        <UserModal
          user={userModal}
          saving={saving}
          error={modalError}
          onClose={() => setUserModal(false)}
          onSave={(draft) =>
            mutate(
              () =>
                api(
                  "/users" + (userModal ? "/" + userModal.id : ""),
                  userModal ? "PUT" : "POST",
                  draft,
                ),
              "Pessoa salva com sucesso.",
              () => {
                setUserModal(false);
                if (userModal?.id === user.id)
                  setUser({ ...user, ...(draft as Partial<User>) } as User);
              },
            )
          }
        />
      )}
      {deleteEntry && (
        <Modal
          title="Excluir lançamento?"
          subtitle="Esta ação remove o período do histórico de horas."
          onClose={() => setDeleteEntry(null)}
        >
          <p className="confirm-text">
            {dateLabel(deleteEntry.date, {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}{" "}
            · {deleteEntry.start} – {deleteEntry.final_end || deleteEntry.end}
            <br />
            {deleteEntry.description || "Atividade vinculada"}
          </p>
          <ErrorMessage error={modalError} />
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setDeleteEntry(null)}
            >
              Cancelar
            </button>
            <button
              disabled={saving}
              className="button danger"
              onClick={() =>
                mutate(
                  () => api("/entries/" + deleteEntry.id, "DELETE"),
                  "Lançamento excluído.",
                  () => setDeleteEntry(null),
                )
              }
            >
              {saving ? "Excluindo…" : "Excluir lançamento"}
            </button>
          </div>
        </Modal>
      )}
      {passwordModal && (
        <PasswordModal
          saving={saving}
          error={modalError}
          onClose={() => setPasswordModal(false)}
          onSave={(b) =>
            mutate(
              () => api("/password", "PUT", b),
              "Senha alterada com sucesso.",
              () => setPasswordModal(false),
            )
          }
        />
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
