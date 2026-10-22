export type User = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user";
  active: number;
};
export type Entry = {
  id: number;
  user_id: number;
  user_name: string;
  date: string;
  description: string;
  jira_url: string;
  trello_url: string;
  start: string;
  end: string;
  return_time: string | null;
  final_end: string | null;
  extra: number;
  on_call: number;
  minutes: number;
  mode: string;
};
export type Day = {
  date: string;
  title: string;
  note: string;
  holiday: number;
};
export type View = "dashboard" | "entries" | "calendar" | "reports" | "users";
let csrf = "";
export async function api<T>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const res = await fetch("/api" + path, {
    method,
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const result = await res.json();
  if (!res.ok) {
    if (res.status === 401 && path !== "/login")
      window.dispatchEvent(new Event("session-expired"));
    throw new Error(result.error || "Não foi possível concluir a operação.");
  }
  return result;
}
export const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const parseDate = (s: string) => new Date(s + "T12:00:00");
export const dateLabel = (
  s: string,
  opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" },
) => parseDate(s).toLocaleDateString("pt-BR", opts);
export const duration = (n: number) =>
  `${Math.floor(n / 60)
    .toString()
    .padStart(2, "0")}h ${Math.round(n % 60)
    .toString()
    .padStart(2, "0")}m`;
export const modality = (date: string) =>
  [1, 5].includes(parseDate(date).getDay())
    ? "Remoto"
    : [2, 3, 4].includes(parseDate(date).getDay())
      ? "Presencial"
      : "Fim de semana";
export const initials = (s: string) =>
  s
    .split(" ")
    .filter(Boolean)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
export const monthRange = (month: string) => ({
  from: month + "-01",
  to: localDate(new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0)),
});
export const blankEntry = (today: string, userId: number) => ({
  user_id: userId,
  date: today,
  description: "",
  jira_url: "",
  trello_url: "",
  start: "09:00",
  end: "12:00",
  return_time: "13:00",
  final_end: "18:00",
  extra: 0,
  on_call: 0,
});
export type EntryDraft = ReturnType<typeof blankEntry>;

export function setCsrf(value: string) {
  csrf = value;
}
