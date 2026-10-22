import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  House,
  LoaderCircle,
  Mail,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

import {
  localDate,
  parseDate,
  dateLabel,
  duration,
  modality,
  blankEntry,
} from "./lib";
import type { User, Entry, Day, EntryDraft } from "./lib";
export function Brand() {
  return (
    <div className="brand">
      <div className="brand-star">✦</div>
      <div>
        sirius
        <span>
          wink<span className="brand-dot">.</span>
        </span>
      </div>
    </div>
  );
}
export function Badge({
  children,
  tone = "green",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={"badge " + tone}>{children}</span>;
}
export function ErrorMessage({ error }: { error: string }) {
  return error ? (
    <div className="alert error" role="alert">
      {error}
    </div>
  ) : null;
}
export function Login({
  onLogin,
  error,
}: {
  onLogin: (email: string, password: string) => Promise<void>;
  error: string;
}) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="login-page">
      <section className="login-story">
        <Brand />
        <div className="login-story-content">
          <span className="small-caps">MENOS COMPLICAÇÃO. MAIS TEMPO.</span>
          <h1>
            Um novo olhar
            <br />
            para cada <em>hora.</em>
          </h1>
          <p>
            Trabalho, pausas e conquistas.
            <br />
            Tudo tem seu tempo. Cuide do seu com a Sirius.
          </p>
          <div className="orbit-art">
            <div className="orbit one" />
            <div className="orbit two" />
            <div className="orbit three" />
            <div className="orbit-center">✦</div>
            <div className="orbit-tag tag-one">
              <Clock3 size={16} /> Seu dia, em equilíbrio.
            </div>
            <div className="orbit-tag tag-two">
              <Check size={16} /> Cada hora conta.
            </div>
          </div>
        </div>
        <span className="login-foot">Gestão inteligente de horas.</span>
      </section>
      <section className="login-form-area">
        <form
          className="login-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await onLogin(email, password);
            } catch {
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="login-symbol">✦</div>
          <span className="eyebrow">BEM-VINDO AO SIRIUS WINK</span>
          <h2>Que bom ter você aqui.</h2>
          <p>Entre na sua conta e dê o próximo passo no seu dia.</p>
          <ErrorMessage error={error} />
          <label>
            E-mail corporativo
            <div className="input-icon">
              <Mail size={17} />
              <input
                type="email"
                placeholder="voce@sirius.com.br"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </label>
          <label>
            Senha
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Sua senha de acesso"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="button primary login-submit" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <>
                Entrar no meu espaço <ArrowRight size={18} />
              </>
            )}
          </button>
          <div className="login-note">
            <ShieldCheck size={18} />
            <span>
              Seu acesso é criado pela administração da Sirius.
              <br />
              Precisa de ajuda? Fale com o administrador.
            </span>
          </div>
        </form>
        <span className="login-copyright">
          Sirius Wink · Seu tempo, bem cuidado.
        </span>
      </section>
    </div>
  );
}
export function Stat({
  title,
  value,
  suffix,
  icon,
  foot,
  tone,
}: {
  title: string;
  value: string;
  suffix?: string;
  icon: React.ReactNode;
  foot: string;
  tone?: string;
}) {
  return (
    <div className={"stat-card " + (tone || "")}>
      <div className="stat-top">
        <span>{title}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <div className="stat-value">
        {value}
        {suffix && <small>{suffix}</small>}
      </div>
      <div className="stat-foot">
        <span className="tiny-dot" />
        {foot}
      </div>
    </div>
  );
}
export function WeekChart({
  entries,
  today,
  month,
}: {
  entries: Entry[];
  today: string;
  month: string;
}) {
  const base = parseDate(month === today.slice(0, 7) ? today : month + "-01");
  const weekday = base.getDay();
  base.setDate(base.getDate() - (weekday === 0 ? 6 : weekday - 1));
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    const date = localDate(d);
    return {
      date,
      total: entries
        .filter((e) => e.date === date)
        .reduce((n, e) => n + e.minutes, 0),
      name: ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"][i],
    };
  });
  const max = Math.max(600, ...week.map((d) => d.total));
  return (
    <div className="week-chart">
      <div className="chart-y">
        <span>{Math.ceil(max / 60)}h</span>
        <span>{Math.ceil(max / 120)}h</span>
        <span>0h</span>
      </div>
      <div className="chart-plot">
        <div className="chart-grid" />
        {week.map((d) => (
          <div
            key={d.date}
            className={"chart-column " + (d.date === today ? "current" : "")}
          >
            <div className="bar-space">
              <span className="bar-label">
                {d.total ? duration(d.total) : "—"}
              </span>
              <div
                title={dateLabel(d.date) + ": " + duration(d.total)}
                className="chart-bar"
                style={{ height: Math.max(3, (d.total / max) * 100) + "%" }}
              />
            </div>
            <span>{d.name}</span>
            <small>{dateLabel(d.date, { day: "2-digit" })}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
export function Modal({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    const handler = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    dialog?.addEventListener("cancel", handler);
    return () => {
      dialog?.removeEventListener("cancel", handler);
      dialog?.close();
    };
  }, []);
  return (
    <dialog
      ref={dialogRef}
      className="modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <div className="modal-heading">
        <div>
          <span className="eyebrow">SIRIUS WINK</span>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button
          className="icon-button"
          aria-label="Fechar janela"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function EntryModal({
  existing,
  user,
  users,
  today,
  saving,
  error,
  onSave,
  onClose,
}: {
  existing: Entry | null;
  user: User;
  users: User[];
  today: string;
  saving: boolean;
  error: string;
  onSave: (e: EntryDraft) => void;
  onClose: () => void;
}) {
  const [d, setD] = useState<EntryDraft>(
    existing
      ? {
          ...existing,
          return_time: existing.return_time || "",
          final_end: existing.final_end || "",
        }
      : blankEntry(today, user.id),
  );
  const set = (key: keyof EntryDraft, value: string | number) =>
    setD({ ...d, [key]: value });
  const preview =
    d.start && d.end
      ? Math.max(
          0,
          Number(d.end.slice(0, 2)) * 60 +
            Number(d.end.slice(3)) -
            (Number(d.start.slice(0, 2)) * 60 + Number(d.start.slice(3))),
        ) +
        (d.return_time && d.final_end
          ? Math.max(
              0,
              Number(d.final_end.slice(0, 2)) * 60 +
                Number(d.final_end.slice(3)) -
                (Number(d.return_time.slice(0, 2)) * 60 +
                  Number(d.return_time.slice(3))),
            )
          : 0)
      : 0;
  return (
    <Modal
      title={existing ? "Editar lançamento" : "Um tempo bem registrado."}
      subtitle="Conte o que fez e informe os períodos de trabalho."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(d);
        }}
      >
        <ErrorMessage error={error} />
        <div className="form-grid">
          <label>
            Data
            <input
              type="date"
              min="2000-01-01"
              max="2100-12-31"
              required
              value={d.date}
              onChange={(e) => set("date", e.target.value)}
            />
          </label>
          {user.role === "admin" ? (
            <label>
              Pessoa
              <select
                value={d.user_id}
                onChange={(e) => set("user_id", Number(e.target.value))}
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                    {!u.active ? " (inativo)" : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="mode-preview">
              <span>Modalidade do dia</span>
              <Badge
                tone={modality(d.date || today) === "Remoto" ? "blue" : "green"}
              >
                {modality(d.date || today)}
              </Badge>
            </div>
          )}
        </div>
        {user.role === "admin" && (
          <div className="inline-info">
            <BriefcaseBusiness size={16} />
            {modality(d.date || today)} · Seg e sex remoto; ter a qui
            presencial.
          </div>
        )}
        <label>
          Descrição da atividade
          <textarea
            placeholder="Em que você trabalhou neste período?"
            maxLength={4000}
            rows={3}
            value={d.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </label>
        <div className="form-grid">
          <label>
            Issue do Jira <span className="optional">opcional</span>
            <input
              type="url"
              placeholder="https://empresa.atlassian.net/…"
              value={d.jira_url}
              onChange={(e) => set("jira_url", e.target.value)}
            />
          </label>
          <label>
            Card do Trello <span className="optional">opcional</span>
            <input
              type="url"
              placeholder="https://trello.com/c/…"
              value={d.trello_url}
              onChange={(e) => set("trello_url", e.target.value)}
            />
          </label>
        </div>
        <p className="field-help">
          Preencha pelo menos a descrição ou um dos links acima.
        </p>
        <div className="time-section">
          <div className="time-heading">
            <strong>
              <Clock3 size={16} />
              Períodos do dia
            </strong>
            <span>{duration(preview)}</span>
          </div>
          <div className="time-inputs">
            {(["start", "end", "return_time", "final_end"] as const).map(
              (key, i) => (
                <label key={key}>
                  {["Entrada", "Saída", "Retorno", "Saída final"][i]}
                  <input
                    type="time"
                    required={i < 2}
                    value={d[key]}
                    onChange={(e) => set(key, e.target.value)}
                  />
                </label>
              ),
            )}
          </div>
          <p className="field-help">
            Sem intervalo? Deixe retorno e saída final em branco. Horários do
            mesmo dia.
          </p>
        </div>
        <div className="checkbox-row">
          <label>
            <input
              type="checkbox"
              checked={!!d.extra}
              onChange={(e) => set("extra", e.target.checked ? 1 : 0)}
            />
            <span>Hora extra</span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={!!d.on_call}
              onChange={(e) => set("on_call", e.target.checked ? 1 : 0)}
            />
            <span>Plantão</span>
          </label>
        </div>
        <p className="field-help">
          Extras e plantões permitem sobreposição com outros registros.
        </p>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary" disabled={saving}>
            {saving ? (
              "Salvando…"
            ) : (
              <>
                <Check size={17} />
                Salvar lançamento
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function Calendar({
  month,
  setMonth,
  today,
  days,
  isAdmin,
  onDay,
}: {
  month: string;
  setMonth: (s: string) => void;
  today: string;
  days: Day[];
  isAdmin: boolean;
  onDay: (s: string) => void;
}) {
  const start = parseDate(month + "-01");
  const offset = (start.getDay() + 6) % 7;
  const count = new Date(
    start.getFullYear(),
    start.getMonth() + 1,
    0,
  ).getDate();
  const length = Math.ceil((offset + count) / 7) * 7;
  function move(n: number) {
    const d = parseDate(month + "-01");
    d.setMonth(d.getMonth() + n);
    if (d.getFullYear() >= 2000 && d.getFullYear() <= 2100)
      setMonth(localDate(d).slice(0, 7));
  }
  return (
    <>
      <div className="calendar-layout">
        <section className="panel calendar-panel">
          <div className="panel-heading">
            <div>
              <h2 className="capitalize">
                {dateLabel(month + "-01", { month: "long", year: "numeric" })}
              </h2>
              <p>O nosso mês, com tudo no lugar.</p>
            </div>
            <div className="calendar-controls">
              <button
                className="icon-button"
                aria-label="Mês anterior"
                onClick={() => move(-1)}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                className="button secondary compact"
                onClick={() => setMonth(today.slice(0, 7))}
              >
                Hoje
              </button>
              <button
                className="icon-button"
                aria-label="Próximo mês"
                onClick={() => move(1)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
          <div className="calendar-grid">
            {["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"].map((w) => (
              <div className="calendar-weekday" key={w}>
                {w}
              </div>
            ))}
            {Array.from({ length }, (_, i) => {
              const d = new Date(start);
              d.setDate(i - offset + 1);
              const date = localDate(d),
                item = days.find((x) => x.date === date),
                outside = d.getMonth() !== start.getMonth();
              return (
                <button
                  aria-label={date + (item ? " " + item.title : "")}
                  key={date}
                  disabled={outside}
                  onClick={() => onDay(date)}
                  className={
                    "calendar-cell " +
                    (outside ? "outside " : "") +
                    (date === today ? "is-today " : "") +
                    (item?.holiday ? "is-holiday" : "")
                  }
                >
                  <span className="day-number">{d.getDate()}</span>
                  {!outside && (
                    <>
                      <small className="calendar-mode">
                        {modality(date) === "Remoto" ? (
                          <House size={11} />
                        ) : modality(date) === "Presencial" ? (
                          <BriefcaseBusiness size={11} />
                        ) : null}
                      </small>
                      {item && (
                        <span
                          className={
                            "calendar-event " + (item.holiday ? "holiday" : "")
                          }
                        >
                          {item.holiday ? "◉ " : ""}
                          {item.title}
                        </span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>
          <div className="calendar-legend">
            <span>
              <i className="legend-dot holiday" /> Feriado
            </span>
            <span>
              <i className="legend-dot note" /> Observação
            </span>
            <span>
              <House size={13} /> Remoto
            </span>
            <span>
              <BriefcaseBusiness size={13} /> Presencial
            </span>
          </div>
        </section>
        <aside className="calendar-aside">
          <div className="panel month-notes">
            <h3>No calendário</h3>
            {days.length ? (
              days.map((d) => (
                <button key={d.date} onClick={() => onDay(d.date)}>
                  <span className={"note-date " + (d.holiday ? "holiday" : "")}>
                    {dateLabel(d.date, { day: "2-digit" })}
                    <small>{dateLabel(d.date, { month: "short" })}</small>
                  </span>
                  <span>
                    <strong>{d.title}</strong>
                    <small>
                      {d.holiday
                        ? "Feriado · Horas bloqueadas"
                        : "Observação da equipe"}
                    </small>
                  </span>
                  <ChevronRight size={16} />
                </button>
              ))
            ) : (
              <div className="empty-notes">
                <CalendarDays size={24} />
                <p>Nenhuma observação neste mês.</p>
              </div>
            )}
          </div>
          <div className="calendar-tip">
            <ShieldCheck size={20} />
            <h3>Dias de descanso importam.</h3>
            <p>
              Em feriados, os lançamentos ficam bloqueados para toda a equipe,
              inclusive extras e plantões.
            </p>
            <small>
              {isAdmin
                ? "Clique em um dia para gerenciar o calendário."
                : "O calendário é gerenciado pela administração."}
            </small>
          </div>
        </aside>
      </div>
    </>
  );
}
export function DayModal({
  date,
  day,
  isAdmin,
  saving,
  error,
  onClose,
  onSave,
  onDelete,
}: {
  date: string;
  day?: Day;
  isAdmin: boolean;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSave: (date: string, draft: Omit<Day, "date">) => void;
  onDelete: () => void;
}) {
  const [d, setD] = useState({
    title: day?.title || "",
    note: day?.note || "",
    holiday: day?.holiday || 0,
  });
  return (
    <Modal
      title={dateLabel(date, {
        day: "numeric",
        month: "long",
        year: "numeric",
      })}
      subtitle={modality(date)}
      onClose={onClose}
    >
      {isAdmin ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(date, d);
          }}
        >
          <ErrorMessage error={error} />
          <label>
            Título
            <input
              autoFocus
              required
              maxLength={150}
              placeholder="Ex.: Feriado municipal, encontro da equipe…"
              value={d.title}
              onChange={(e) => setD({ ...d, title: e.target.value })}
            />
          </label>
          <label>
            Observação
            <textarea
              rows={4}
              maxLength={4000}
              placeholder="Informações importantes para a equipe"
              value={d.note}
              onChange={(e) => setD({ ...d, note: e.target.value })}
            />
          </label>
          <div className="checkbox-row">
            <label>
              <input
                type="checkbox"
                checked={!!d.holiday}
                onChange={(e) =>
                  setD({ ...d, holiday: e.target.checked ? 1 : 0 })
                }
              />
              Marcar como feriado
            </label>
          </div>
          <p className="field-help">
            Feriados bloqueiam novos lançamentos. Para marcar um dia com horas,
            primeiro corrija os registros existentes.
          </p>
          <div className="modal-actions">
            {day && (
              <button
                type="button"
                disabled={saving}
                className="button danger-outline"
                onClick={onDelete}
              >
                <Trash2 size={15} />
                Remover
              </button>
            )}
            <button
              type="button"
              className="button secondary"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button disabled={saving} className="button primary">
              {saving ? "Salvando…" : "Salvar dia"}
            </button>
          </div>
        </form>
      ) : (
        <div className="day-details">
          {day ? (
            <>
              <Badge tone={day.holiday ? "rose" : "blue"}>
                {day.holiday ? "Feriado" : "Observação"}
              </Badge>
              <h3>{day.title}</h3>
              <p>{day.note || "Sem observações adicionais."}</p>
            </>
          ) : (
            <p>Nenhum feriado ou observação para este dia.</p>
          )}
          <div className="modal-actions">
            <button className="button secondary" onClick={onClose}>
              Fechar
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
export function UserModal({
  user,
  saving,
  error,
  onClose,
  onSave,
}: {
  user: User | null;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSave: (d: unknown) => void;
}) {
  const [d, setD] = useState({
    name: user?.name || "",
    email: user?.email || "",
    role: user?.role || "user",
    active: user?.active ?? 1,
    password: "",
  });
  return (
    <Modal
      title={user ? "Editar pessoa" : "Boas-vindas à equipe."}
      subtitle="Defina os dados e o acesso ao Sirius Wink."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(d);
        }}
      >
        <ErrorMessage error={error} />
        <label>
          Nome completo
          <input
            required
            maxLength={150}
            autoComplete="off"
            value={d.name}
            onChange={(e) => setD({ ...d, name: e.target.value })}
          />
        </label>
        <label>
          E-mail
          <input
            required
            type="email"
            autoComplete="off"
            value={d.email}
            onChange={(e) => setD({ ...d, email: e.target.value })}
          />
        </label>
        <div className="form-grid">
          <label>
            Perfil
            <select
              value={d.role}
              onChange={(e) =>
                setD({ ...d, role: e.target.value as "user" | "admin" })
              }
            >
              <option value="user">Colaborador</option>
              <option value="admin">Administrador</option>
            </select>
          </label>
          <label>
            Status
            <select
              value={d.active}
              onChange={(e) => setD({ ...d, active: Number(e.target.value) })}
            >
              <option value="1">Ativo</option>
              <option value="0">Inativo</option>
            </select>
          </label>
        </div>
        <label>
          {user ? "Nova senha" : "Senha inicial"}
          <input
            type="password"
            autoComplete="new-password"
            minLength={10}
            maxLength={256}
            required={!user}
            placeholder={
              user ? "Deixe em branco para manter" : "Pelo menos 10 caracteres"
            }
            value={d.password}
            onChange={(e) => setD({ ...d, password: e.target.value })}
          />
        </label>
        <p className="field-help">
          A pessoa poderá alterar sua senha ao clicar no próprio perfil.
        </p>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button disabled={saving} className="button primary">
            {saving ? "Salvando…" : "Salvar pessoa"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function PasswordModal({
  saving,
  error,
  onClose,
  onSave,
}: {
  saving: boolean;
  error: string;
  onClose: () => void;
  onSave: (d: unknown) => void;
}) {
  const [d, setD] = useState({ current: "", password: "", confirm: "" });
  const [localError, setLocalError] = useState("");
  return (
    <Modal
      title="Alterar minha senha"
      subtitle="Cuide do acesso ao seu espaço."
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setLocalError("");
          if (d.password !== d.confirm) {
            setLocalError("A confirmação da senha não confere.");
            return;
          }
          onSave({ current: d.current, password: d.password });
        }}
      >
        <ErrorMessage error={localError || error} />
        <label>
          Senha atual
          <input
            autoComplete="current-password"
            type="password"
            required
            value={d.current}
            onChange={(e) => setD({ ...d, current: e.target.value })}
          />
        </label>
        <label>
          Nova senha
          <input
            autoComplete="new-password"
            type="password"
            required
            minLength={10}
            value={d.password}
            onChange={(e) => setD({ ...d, password: e.target.value })}
          />
        </label>
        <label>
          Confirme a nova senha
          <input
            autoComplete="new-password"
            type="password"
            required
            minLength={10}
            value={d.confirm}
            onChange={(e) => setD({ ...d, confirm: e.target.value })}
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancelar
          </button>
          <button disabled={saving} className="button primary">
            {saving ? "Salvando…" : "Alterar senha"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
