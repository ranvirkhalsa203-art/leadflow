"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  CreditCard,
  FileText,
  LayoutDashboard,
  LayoutGrid,
  Layers3,
  List,
  Loader2,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Moon,
  MoreHorizontal,
  Package,
  Pencil,
  Trash2,
  Plus,
  Search,
  Settings,
  Sparkles,
  Sun,
  Target,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";
import {
  formatMoney,
  leadStages,
  paidAmount,
  creditedAmount,
  outstandingAmount,
  type Workspace,
  type Lead,
  type Document,
} from "@/lib/domain";
import { api, Auth, Editor, Field, type ModalKind } from "./forms";
import { whatsappDraft } from "@/lib/contact";
import { localDate, preferNewerWorkspace } from "@/lib/client-utils";

export type Page =
  | "Overview"
  | "Leads"
  | "Clients"
  | "Follow-ups"
  | "Quotations"
  | "Invoices"
  | "Products"
  | "Revenue"
  | "Email"
  | "Feedback"
  | "Settings";
type Session = {
  user: { email: string; workspaceId: string };
  workspace: Workspace;
  integrations: { database: string; email: boolean; billing: boolean };
};
const nav = [
  {
    title: "WORKSPACE",
    items: [
      ["Overview", LayoutDashboard],
      ["Leads", Target],
      ["Clients", Users],
      ["Follow-ups", CalendarDays],
    ],
  },
  {
    title: "BUSINESS",
    items: [
      ["Quotations", FileText],
      ["Invoices", CreditCard],
      ["Products", Package],
      ["Revenue", TrendingUp],
      ["Email", Mail],
    ],
  },
] as const;
const pageByRoute: Record<string, Page> = {
  leads: "Leads",
  clients: "Clients",
  "follow-ups": "Follow-ups",
  quotations: "Quotations",
  invoices: "Invoices",
  products: "Products",
  revenue: "Revenue",
  email: "Email",
  feedback: "Feedback",
  settings: "Settings",
};
const description: Record<Page, string> = {
  Overview: "A little clarity. A lot of possibility.",
  Leads: "Good conversations become great opportunities.",
  Clients: "The people at the heart of your business.",
  "Follow-ups": "The right nudge, at the right time.",
  Quotations: "Turn a good conversation into a clear proposal.",
  Invoices: "Beautifully simple billing, from draft to paid.",
  Products: "Your most-used services, ready to quote.",
  Revenue: "Know what’s coming in. See what’s still to come.",
  Email: "Thoughtful messages. Stronger relationships.",
  Feedback: "A better workspace starts with your ideas.",
  Settings: "Make LeadFlow feel like your business.",
};
const initials = (name: string) =>
  name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
const today = localDate;
function Badge({ value }: { value: string }) {
  return (
    <span className={`badge ${value.toLowerCase().replaceAll(" ", "-")}`}>
      <i />
      {value}
    </span>
  );
}
function Avatar({ name, index = 0 }: { name: string; index?: number }) {
  return <span className={`avatar color-${index % 5}`}>{initials(name)}</span>;
}
function Empty({
  title,
  body,
  action,
  onClick,
}: {
  title: string;
  body: string;
  action?: string;
  onClick?: () => void;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Layers3 size={25} />
      </span>
      <h3>{title}</h3>
      <p>{body}</p>
      {action && (
        <button className="primary" onClick={onClick}>
          <Plus size={16} />
          {action}
        </button>
      )}
    </div>
  );
}
function Stat({
  label,
  value,
  note,
  icon: Icon,
  accent = false,
}: {
  label: string;
  value: string;
  note: string;
  icon: typeof Users;
  accent?: boolean;
}) {
  return (
    <div className={`stat ${accent ? "accent" : ""}`}>
      <div className="stat-label">
        {label}
        <span>
          <Icon size={17} />
        </span>
      </div>
      <strong>{value}</strong>
      <div className="stat-note">
        {accent ? (
          <span className="stat-arrow">
            <ArrowUpRight size={14} />
          </span>
        ) : (
          <span className="tiny-dot" />
        )}
        {note}
      </div>
    </div>
  );
}
function downloadCsv(name: string, rows: (string | number)[][]) {
  const clean = (v: string | number) => {
    const text = String(v);
    return (
      '"' +
      (/^[=+\-@\t\r]/.test(text) ? "\u0027" : "") +
      text.replaceAll('"', '""') +
      '"'
    );
  };
  const url = URL.createObjectURL(
    new Blob(
      ["\ufeff" + rows.map((r) => r.map(clean).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8;" },
    ),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function LeadFlow({
  initialPage = "Overview",
}: {
  initialPage?: Page;
}) {
  const router = useRouter();
  const authGeneration = useRef(0);
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(true),
    [demoEnabled, setDemoEnabled] = useState(false),
    [page, setPage] = useState<Page>(initialPage),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [mobile, setMobile] = useState(false),
    [dark, setDark] = useState(false),
    [board, setBoard] = useState(false),
    [modal, setModal] = useState<{ kind: ModalKind; id?: string } | null>(null),
    [toast, setToast] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function refresh() {
    const generation = authGeneration.current;
    const state: Session = await api("state");
    if (generation !== authGeneration.current) return;
    setSession((old) =>
      old?.user.workspaceId === state.user.workspaceId
        ? {
            ...state,
            workspace: preferNewerWorkspace(old.workspace, state.workspace),
          }
        : state,
    );
  }
  async function loadSession() {
    setLoading(true);
    setError("");
    try { await refresh(); }
    catch (e) {
      if ((e as Error).message !== "Please sign in") setError((e as Error).message);
    } finally { setLoading(false); }
  }
  useEffect(() => {
    api("config")
      .then((x) => setDemoEnabled(x.demoEnabled))
      .catch(() => {});
    void loadSession();
    const theme = localStorage.getItem("leadflow-theme") === "dark";
    setDark(theme);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("leadflow-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  function go(next: Page) {
    setPage(next);
    const slug =
      next === "Overview"
        ? "/app"
        : `/app/${next.toLowerCase().replaceAll(" ", "-")}`;
    window.history.pushState({}, "", slug);
    setSearch("");
    setFilter("all");
    setMobile(false);
    setError("");
  }
  useEffect(() => {
    setPage(initialPage);
  }, [initialPage]);
  useEffect(() => {
    const onPopState = () => {
      const section = window.location.pathname.split("/")[2] ?? "";
      setPage(pageByRoute[section] ?? "Overview");
      setSearch("");
      setFilter("all");
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  async function save(command: unknown) {
    const generation = authGeneration.current;
    const workspaceId = session?.user.workspaceId;
    const result = await api("command", command);
    if (generation !== authGeneration.current) return;
    setSession((old) =>
      old && old.user.workspaceId === workspaceId
        ? {
            ...old,
            workspace: preferNewerWorkspace(old.workspace, result.workspace),
          }
        : old,
    );
    setToast(result.notice || "Saved. You’re all up to date.");
  }
  async function act(command: unknown) {
    const generation = authGeneration.current;
    setBusy(true);
    setError("");
    try {
      await save(command);
    } catch (e) {
      if (generation === authGeneration.current) setError((e as Error).message);
    } finally {
      if (generation === authGeneration.current) setBusy(false);
    }
  }
  async function signout() {
    authGeneration.current++;
    try {
      await api("auth/logout", {});
      setSession(null);
      setPage("Overview");
      router.push("/app");
      setModal(null);
      setToast("");
      setError("");
      setSearch("");
      setFilter("all");
      setBusy(false);
      setMobile(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (loading)
    return (
      <div className="loading">
        <Layers3 size={32} />
        <span>Loading your business…</span>
        <Loader2 className="spin" size={20} />
      </div>
    );
  if (!session)
    return (
      <>
        {error && (
          <div className="global-error" role="alert">
            {error}
            <button className="secondary" onClick={() => void loadSession()}>Retry loading</button>
          </div>
        )}
        <Auth
          onSuccess={async () => {
            authGeneration.current++;
            await refresh();
          }}
          demoEnabled={demoEnabled}
        />
      </>
    );
  const s = session.workspace;
  const money = (n: number) => formatMoney(n, s.currency);
  const open = (kind: ModalKind, id?: string) => setModal({ kind, id });
  const collected = s.payments.reduce((n, p) => n + p.amount, 0);
  const invoices = s.documents.filter((d) => d.kind === "invoice");
  const issued = invoices.filter((d) => !["draft", "void"].includes(d.status));
  const outstanding = issued.reduce(
    (n, d) => n + outstandingAmount(s, d.id),
    0,
  );
  const active = s.leads.filter((l) => !["won", "lost"].includes(l.status));
  const pipeline = active.reduce((n, l) => n + l.value, 0);
  const pending = s.followups.filter((f) => !f.done);
  const due = pending.filter((f) => f.dueDate <= today());
  const matched = (...values: string[]) =>
    values.join(" ").toLowerCase().includes(search.toLowerCase());
  const leads = s.leads.filter(
    (l) =>
      (page !== "Clients" || l.status === "won") &&
      (filter === "all" || l.status === filter) &&
      matched(l.name, l.company, l.email, l.source),
  );
  const docs = s.documents.filter(
    (d) =>
      (page === "Quotations"
        ? d.kind === "quote"
        : d.kind === "invoice" || d.kind === "credit") &&
      (filter === "all" || d.status === filter) &&
      matched(d.number, s.leads.find((l) => l.id === d.leadId)?.name || ""),
  );
  const primary: Partial<Record<Page, [string, ModalKind]>> = {
    Overview: ["Add lead", "lead"],
    Leads: ["Add lead", "lead"],
    Clients: ["Add contact", "lead"],
    "Follow-ups": ["Schedule follow-up", "followup"],
    Quotations: ["New quotation", "quote"],
    Invoices: ["New invoice", "invoice"],
    Products: ["Add product", "product"],
    Email: ["Compose email", "email"],
    Feedback: ["Share feedback", "feedback"],
  };
  function exportData() {
    if (page === "Revenue")
      downloadCsv("leadflow-payments.csv", [
        ["Date", "Invoice", `Amount (${s.currency})`, "Method", "Reference"],
        ...s.payments.map((p) => [
          p.createdAt,
          s.documents.find((d) => d.id === p.documentId)?.number || "",
          p.amount / 100,
          p.method,
          p.reference,
        ]),
      ]);
    else if (["Invoices", "Quotations"].includes(page))
      downloadCsv("leadflow-documents.csv", [
        ["Number", "Status", "Due date", `Total (${s.currency})`, "Paid"],
        ...docs.map((d) => [
          d.number,
          d.status,
          d.dueDate,
          d.total / 100,
          paidAmount(s, d.id) / 100,
        ]),
      ]);
    else
      downloadCsv("leadflow-contacts.csv", [
        ["Name", "Company", "Email", "Status", `Value (${s.currency})`],
        ...leads.map((l) => [
          l.name,
          l.company,
          l.email,
          l.status,
          l.value / 100,
        ]),
      ]);
    setToast("Your export is ready.");
  }
  const leadTable = (rows: Lead[], compact = false) => (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Contact</th>
            <th>Status</th>
            <th>Deal value</th>
            {!compact && <th>Source</th>}
            <th className="right">Next step</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l, i) => (
            <tr key={l.id}>
              <td>
                <div className="contact">
                  <Avatar name={l.name} index={i} />
                  <span>
                    <strong>{l.name}</strong>
                    <small>{l.company || l.email}</small>
                  </span>
                </div>
              </td>
              <td>
                <select
                  className={`stage-select ${l.status}`}
                  aria-label={`Status for ${l.name}`}
                  value={l.status}
                  disabled={busy}
                  onChange={(e) =>
                    act({
                      type: "lead.update",
                      id: l.id,
                      status: e.target.value,
                    })
                  }
                >
                  {leadStages.map((stage) => (
                    <option key={stage}>{stage}</option>
                  ))}
                </select>
              </td>
              <td className="amount">{money(l.value)}</td>
              {!compact && (
                <td>
                  <span className="source-pill">{l.source}</span>
                </td>
              )}
              <td className="right">
                {whatsappDraft(l.phone, l.name, s.business.legalName || s.name) && (
                  <a className="icon-button" href={whatsappDraft(l.phone, l.name, s.business.legalName || s.name)!} target="_blank" rel="noopener noreferrer" aria-label={`Open WhatsApp draft for ${l.name}`} title="Open WhatsApp draft: review and send yourself">
                    <MessageSquare size={17} />
                  </a>
                )}
                <button
                  className="icon-button"
                  title="Edit contact"
                  aria-label={`Edit ${l.name}`}
                  onClick={() => open("lead", l.id)}
                >
                  <Pencil size={16} />
                </button>
                <button
                  className="icon-button"
                  title="Delete contact"
                  aria-label={`Delete ${l.name}`}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Delete ${l.name}? This is only possible when the contact has no linked business history.`,
                      )
                    )
                      void act({ type: "lead.delete", id: l.id });
                  }}
                >
                  <Trash2 size={16} />
                </button>
                <button
                  className="icon-button"
                  title="Schedule follow-up"
                  aria-label={`Follow up with ${l.name}`}
                  onClick={() => open("followup", l.id)}
                >
                  <CalendarDays size={17} />
                </button>
                <button
                  className="icon-button"
                  title="Compose email"
                  aria-label={`Email ${l.name}`}
                  onClick={() => open("email", l.id)}
                >
                  <Mail size={17} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  const taskRows = (limit?: number) =>
    pending
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, limit)
      .map((f) => (
        <div className="task-row" key={f.id}>
          <button
            className="task-check"
            aria-label={`Complete ${f.title}`}
            disabled={busy}
            onClick={() => act({ type: "followup.toggle", id: f.id })}
          >
            <Check size={13} />
          </button>
          <div>
            <strong>{f.title}</strong>
            <span>
              {s.leads.find((l) => l.id === f.leadId)?.company ||
                s.leads.find((l) => l.id === f.leadId)?.name}
            </span>
          </div>
          <small
            className={
              f.dueDate < today()
                ? "overdue"
                : f.dueDate === today()
                  ? "today"
                  : ""
            }
          >
            {f.dueDate === today()
              ? "Today"
              : f.dueDate < today()
                ? "Overdue"
                : new Date(f.dueDate + "T12:00:00").toLocaleDateString(
                    "en-GB",
                    { day: "numeric", month: "short" },
                  )}
          </small>
        </div>
      ));
  return (
    <div className="app-shell">
      {mobile && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            go("Overview");
          }}
        >
          <span className="brand-mark">
            <Layers3 size={22} />
          </span>
          leadflow<span className="brand-dot">®</span>
        </a>
        <button className="workspace-switch" onClick={() => go("Settings")}>
          <span className="workspace-icon">{initials(s.name)}</span>
          <span>
            <strong>{s.name}</strong>
            <small>{s.isDemo ? "Sample workspace" : "Your workspace"}</small>
          </span>
          <ChevronDown size={15} />
        </button>
        <nav aria-label="Main navigation">
          {nav.map((group) => (
            <div className="nav-group" key={group.title}>
              <span className="nav-label">{group.title}</span>
              {group.items.map(([name, Icon]) => (
                <button
                  key={name}
                  aria-label={name}
                  className={`nav-item ${page === name ? "active" : ""}`}
                  onClick={() => go(name)}
                >
                  <Icon size={18} />
                  <span>{name}</span>
                  {name === "Leads" && active.length > 0 && (
                    <small>{active.length}</small>
                  )}
                  {name === "Follow-ups" && due.length > 0 && (
                    <small className="nav-alert">{due.length}</small>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="growth-card">
            <span>
              <Sparkles size={17} />
              Room to grow
            </span>
            <p>
              Small beginnings.
              <br />
              Big possibilities.
            </p>
            <button onClick={() => go("Settings")}>
              Your workspace plan
              <ArrowUpRight size={16} />
            </button>
          </div>
          <button
            className={`nav-item ${page === "Feedback" ? "active" : ""}`}
            onClick={() => go("Feedback")}
          >
            <MessageSquare size={18} />
            <span>Feedback</span>
          </button>
          <button
            className={`nav-item ${page === "Settings" ? "active" : ""}`}
            onClick={() => go("Settings")}
          >
            <Settings size={18} />
            <span>Settings</span>
          </button>
          <div className="profile">
            <Avatar name={s.name} />
            <span>
              <strong>Workspace owner</strong>
              <small>{session.user.email}</small>
            </span>
            <button
              className="icon-button"
              aria-label="Sign out"
              onClick={signout}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{page}</strong>
          </div>
          <div className="topbar-tools">
            <span className="saved-indicator">
              <span />
              All changes saved
            </span>
            <button
              className="icon-button"
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <button
              className="icon-button notification"
              aria-label={`View ${due.length} due follow-ups`}
              onClick={() => go("Follow-ups")}
            >
              <Bell size={19} />
              {due.length > 0 && <i />}
            </button>
            <Avatar name={s.name} />
          </div>
        </header>
        <main className="main-content">
          {s.isDemo && (
            <div className="demo-banner">
              <span>
                <Sparkles size={14} />
                Sample workspace · explore freely, this data is yours to try.
              </span>
              <button onClick={signout}>
                Create your own
                <ArrowRight size={13} />
              </button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {page === "Overview"
                  ? `LET’S MAKE TODAY COUNT`
                  : "YOUR BUSINESS, IN FLOW"}
              </div>
              <h1>
                {page === "Overview" ? (
                  <>
                    Overview
                    <span aria-hidden="true" className="heading-spark">
                      ✳
                    </span>
                  </>
                ) : (
                  page
                )}
              </h1>
              <p>{description[page]}</p>
            </div>
            <div className="heading-actions">
              {[
                "Overview",
                "Leads",
                "Clients",
                "Invoices",
                "Quotations",
                "Revenue",
              ].includes(page) && (
                <button className="secondary" onClick={exportData}>
                  <ArrowDownToLine size={16} />
                  Export
                </button>
              )}
              {primary[page] && (
                <button
                  className="primary"
                  onClick={() => open(primary[page]![1])}
                >
                  <Plus size={17} />
                  {primary[page]![0]}
                </button>
              )}
            </div>
          </div>
          {error && (
            <div className="error banner" role="alert">
              {error}
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => setError("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {page === "Overview" && (
            <>
              <div className="stats-grid">
                <Stat
                  label="Total revenue"
                  value={money(collected)}
                  note="Payments received · all time"
                  icon={Wallet}
                  accent
                />
                <Stat
                  label="Active leads"
                  value={String(active.length).padStart(2, "0")}
                  note={`${money(pipeline)} in your pipeline`}
                  icon={Target}
                />
                <Stat
                  label="Outstanding"
                  value={money(outstanding)}
                  note={`${issued.filter((d) => d.status !== "paid").length} invoices awaiting payment`}
                  icon={FileText}
                />
                <Stat
                  label="Follow-ups due"
                  value={String(due.length).padStart(2, "0")}
                  note={
                    due.length
                      ? "A little nudge goes a long way"
                      : "You’re all caught up"
                  }
                  icon={CalendarDays}
                />
              </div>
              <div className="overview-middle">
                <RevenueChart s={s} />
                <section className="card pipeline-card">
                  <div className="card-heading">
                    <div>
                      <h2>Pipeline snapshot</h2>
                      <p>Every conversation is a possibility.</p>
                    </div>
                    <button
                      className="icon-button"
                      aria-label="View leads"
                      onClick={() => go("Leads")}
                    >
                      <ArrowUpRight size={19} />
                    </button>
                  </div>
                  <div className="pipeline-total">
                    <strong>{money(pipeline)}</strong>
                    <span>active opportunity value</span>
                  </div>
                  <div className="pipeline-stack">
                    {leadStages.slice(0, 4).map((stage, i) => (
                      <div
                        key={stage}
                        style={{
                          flex: Math.max(
                            s.leads.filter((l) => l.status === stage).length,
                            0.1,
                          ),
                          background: [
                            "#204f42",
                            "#5d8a70",
                            "#a6c298",
                            "#dcE9bc",
                          ][i],
                        }}
                      />
                    ))}
                  </div>
                  <div className="pipeline-legend">
                    {leadStages.slice(0, 4).map((stage, i) => (
                      <div key={stage}>
                        <span>
                          <i
                            style={{
                              background: [
                                "#204f42",
                                "#5d8a70",
                                "#a6c298",
                                "#dce9bc",
                              ][i],
                            }}
                          />
                          {stage}
                        </span>
                        <strong>
                          {s.leads.filter((l) => l.status === stage).length}
                          <small>leads</small>
                        </strong>
                      </div>
                    ))}
                  </div>
                  <button className="card-link" onClick={() => go("Leads")}>
                    Explore your pipeline
                    <ArrowRight size={15} />
                  </button>
                </section>
              </div>
              <div className="overview-bottom">
                <section className="card">
                  <div className="card-heading">
                    <div className="inline-title">
                      <h2>Recent leads</h2>
                      <span className="count">{s.leads.length}</span>
                    </div>
                    <button className="text-button" onClick={() => go("Leads")}>
                      View all
                      <ArrowRight size={15} />
                    </button>
                  </div>
                  {s.leads.length ? (
                    leadTable(s.leads.slice(0, 4), true)
                  ) : (
                    <Empty
                      title="Your next chapter starts with a hello."
                      body="Add your first lead and give your next opportunity a home."
                      action="Add lead"
                      onClick={() => open("lead")}
                    />
                  )}
                </section>
                <section className="card">
                  <div className="card-heading">
                    <div className="inline-title">
                      <h2>Up next</h2>
                      <span className="count">{pending.length}</span>
                    </div>
                    <button
                      className="icon-button"
                      aria-label="Add follow-up"
                      onClick={() => open("followup")}
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  <div className="tasks">
                    {pending.length ? (
                      taskRows(4)
                    ) : (
                      <Empty
                        title="A little breathing room."
                        body="Your follow-ups will appear here."
                      />
                    )}
                  </div>
                  <button
                    className="card-link"
                    onClick={() => go("Follow-ups")}
                  >
                    All follow-ups
                    <ArrowRight size={15} />
                  </button>
                </section>
              </div>
              <div className="dashboard-footer">
                <span>
                  <span className="live-dot" /> A clear picture of your
                  business. Always.
                </span>
                <span>Let’s build something good.</span>
              </div>
            </>
          )}
          {(page === "Leads" || page === "Clients") && (
            <>
              <div className="section-summary">
                <span>
                  <strong>
                    {page === "Clients"
                      ? s.leads.filter((l) => l.status === "won").length
                      : s.leads.length}
                  </strong>
                  {page === "Clients" ? "won clients" : "total contacts"}
                </span>
                <span>
                  <strong>
                    {money(
                      page === "Clients"
                        ? s.leads
                            .filter((l) => l.status === "won")
                            .reduce((n, l) => n + l.value, 0)
                        : pipeline,
                    )}
                  </strong>
                  {page === "Clients" ? "won deal value" : "active pipeline"}
                </span>
                <p>
                  {page === "Clients"
                    ? "Move a lead to “won” to see them here."
                    : "A little attention today. A new client tomorrow."}
                </p>
              </div>
              <section className="card">
                <div className="toolbar">
                  <div className="search-input">
                    <Search size={17} />
                    <input
                      aria-label="Search contacts"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search name, company or email…"
                    />
                  </div>
                  {page === "Leads" && (
                    <select
                      aria-label="Filter by status"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option value="all">All stages</option>
                      {leadStages.map((stage) => (
                        <option key={stage}>{stage}</option>
                      ))}
                    </select>
                  )}
                  <div className="view-toggle">
                    <button
                      className={!board ? "selected" : ""}
                      aria-label="List view"
                      onClick={() => setBoard(false)}
                    >
                      <List size={17} />
                    </button>
                    <button
                      className={board ? "selected" : ""}
                      aria-label="Board view"
                      onClick={() => setBoard(true)}
                    >
                      <LayoutGrid size={17} />
                    </button>
                  </div>
                </div>
                {leads.length ? (
                  board ? (
                    <div className="kanban">
                      {(page === "Clients" ? ["won"] : leadStages)
                        .filter((stage) => filter === "all" || filter === stage)
                        .map((stage) => (
                          <div className="kanban-column" key={stage}>
                            <h3>
                              <span className={`stage-dot ${stage}`} />
                              {stage}
                              <span>
                                {leads.filter((l) => l.status === stage).length}
                              </span>
                            </h3>
                            {leads
                              .filter((l) => l.status === stage)
                              .map((l, i) => (
                                <article className="lead-card" key={l.id}>
                                  <Avatar name={l.name} index={i} />
                                  <h3>{l.company || l.name}</h3>
                                  <p>{l.name}</p>
                                  <strong>{money(l.value)}</strong>
                                  <select
                                    aria-label={`Status for ${l.name}`}
                                    value={l.status}
                                    onChange={(e) =>
                                      act({
                                        type: "lead.update",
                                        id: l.id,
                                        status: e.target.value,
                                      })
                                    }
                                  >
                                    {leadStages.map((x) => (
                                      <option key={x}>{x}</option>
                                    ))}
                                  </select>
                                  <button
                                    className="text-button"
                                    onClick={() => open("followup", l.id)}
                                  >
                                    Follow up
                                    <ArrowRight size={14} />
                                  </button>
                                </article>
                              ))}
                          </div>
                        ))}
                    </div>
                  ) : (
                    leadTable(leads)
                  )
                ) : (
                  <Empty
                    title={
                      search
                        ? "No matching contacts."
                        : page === "Clients"
                          ? "Good things take a conversation."
                          : "Your next opportunity starts here."
                    }
                    body={
                      page === "Clients"
                        ? "Mark a lead as won to add them to your client list."
                        : "Add a lead to start building your pipeline."
                    }
                    action="Add lead"
                    onClick={() => open("lead")}
                  />
                )}
              </section>
            </>
          )}
          {page === "Follow-ups" && (
            <>
              <div className="tabs">
                <button
                  className={filter === "all" ? "selected" : ""}
                  onClick={() => setFilter("all")}
                >
                  Upcoming <span>{pending.length}</span>
                </button>
                <button
                  className={filter === "done" ? "selected" : ""}
                  onClick={() => setFilter("done")}
                >
                  Completed{" "}
                  <span>{s.followups.filter((f) => f.done).length}</span>
                </button>
              </div>
              <section className="card followup-page">
                {filter === "all" ? (
                  pending.length ? (
                    taskRows()
                  ) : (
                    <Empty
                      title="You’re all caught up."
                      body="Schedule a follow-up to keep a good conversation moving."
                      action="Schedule follow-up"
                      onClick={() => open("followup")}
                    />
                  )
                ) : s.followups.some((f) => f.done) ? (
                  s.followups
                    .filter((f) => f.done)
                    .map((f) => (
                      <div className="task-row completed" key={f.id}>
                        <button
                          className="task-check"
                          aria-label={`Reopen ${f.title}`}
                          onClick={() =>
                            act({ type: "followup.toggle", id: f.id })
                          }
                        >
                          <Check size={14} />
                        </button>
                        <div>
                          <strong>{f.title}</strong>
                          <span>
                            {s.leads.find((l) => l.id === f.leadId)?.name}
                          </span>
                        </div>
                        <Badge value="complete" />
                      </div>
                    ))
                ) : (
                  <Empty
                    title="Your wins will live here."
                    body="Complete a follow-up to see it in this list."
                  />
                )}
              </section>
            </>
          )}
          {(page === "Invoices" || page === "Quotations") && (
            <section className="card">
              <div className="toolbar">
                <div className="search-input">
                  <Search size={17} />
                  <input
                    aria-label="Search documents"
                    placeholder="Search document or client…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select
                  aria-label="Document status"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">All statuses</option>
                  {["draft", "issued", "accepted", "partial", "paid"].map(
                    (x) => (
                      <option key={x}>{x}</option>
                    ),
                  )}
                </select>
              </div>
              {docs.length ? (
                <div className="table-scroll">
                  <table className="documents-table">
                    <thead>
                      <tr>
                        <th>Document</th>
                        <th>Client</th>
                        <th>Status</th>
                        <th>Due date</th>
                        <th>Total</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {docs.map((d) => (
                        <tr key={d.id}>
                          <td>
                            <a
                              className="document-link"
                              href={`/documents/${d.id}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <FileText size={17} />
                              {d.number}
                              <ArrowUpRight size={13} />
                            </a>
                          </td>
                          <td>
                            {s.leads.find((l) => l.id === d.leadId)?.name}
                          </td>
                          <td>
                            <Badge value={d.status} />
                          </td>
                          <td
                            className={
                              d.dueDate < today() &&
                              !["paid", "accepted", "draft"].includes(d.status)
                                ? "overdue"
                                : ""
                            }
                          >
                            {d.dueDate}
                          </td>
                          <td>
                            <strong>{money(d.total)}</strong>
                            {d.status === "partial" && (
                              <small className="subline">
                                {money(d.total - paidAmount(s, d.id))} due
                              </small>
                            )}
                          </td>
                          <td>
                            <div className="row-actions">
                              {d.status === "draft" && (
                                <button
                                  disabled={busy}
                                  className="small-button"
                                  aria-label={`Issue ${d.number}`}
                                  onClick={() =>
                                    act({ type: "document.issue", id: d.id })
                                  }
                                >
                                  Issue
                                  <ArrowUpRight size={13} />
                                </button>
                              )}
                              {d.kind === "quote" && d.status === "issued" && (
                                <button
                                  className="small-button"
                                  disabled={busy}
                                  aria-label={`Accept ${d.number}`}
                                  onClick={() =>
                                    act({
                                      type: "document.accept",
                                      id: d.id,
                                    })
                                  }
                                >
                                  Mark accepted
                                </button>
                              )}
                              {d.kind === "quote" &&
                                d.status === "accepted" && (
                                  <button
                                    className="small-button"
                                    disabled={busy}
                                    onClick={() =>
                                      act({
                                        type: "document.convert",
                                        id: d.id,
                                      })
                                    }
                                  >
                                    Convert to invoice
                                  </button>
                                )}
                              {d.kind === "invoice" &&
                                !["draft", "paid", "void"].includes(d.status) &&
                                outstandingAmount(s, d.id) > 0 && (
                                  <button
                                    className="small-button"
                                    aria-label={`Record payment for ${d.number}`}
                                    onClick={() => open("payment", d.id)}
                                  >
                                    Record payment
                                  </button>
                                )}
                              {d.kind === "invoice" &&
                                !["draft", "void"].includes(d.status) && (
                                  <button
                                    className="small-button"
                                    disabled={busy}
                                    onClick={() => open("credit", d.id)}
                                  >
                                    Credit note
                                  </button>
                                )}
                              {!["void", "paid", "partial"].includes(
                                d.status,
                              ) && (
                                <button
                                  className="small-button"
                                  disabled={busy}
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        `Void ${d.number}? This cannot be undone.`,
                                      )
                                    )
                                      void act({
                                        type: "document.void",
                                        id: d.id,
                                      });
                                  }}
                                >
                                  Void
                                </button>
                              )}
                              <a
                                className="icon-button"
                                href={`/documents/${d.id}`}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`View ${d.number}`}
                              >
                                <ArrowUpRight size={17} />
                              </a>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty
                  title={`Your first ${page === "Invoices" ? "invoice" : "quotation"} is a fresh start.`}
                  body="Create a professional document linked to one of your contacts."
                  action={page === "Invoices" ? "New invoice" : "New quotation"}
                  onClick={() =>
                    open(page === "Invoices" ? "invoice" : "quote")
                  }
                />
              )}
            </section>
          )}
          {page === "Products" && (
            <>
              <section className="card">
                <div className="card-heading">
                  <div>
                    <h2>Products & services</h2>
                    <p>
                      Reuse pricing and tax settings when preparing a quote or
                      invoice.
                    </p>
                  </div>
                  <button className="primary" onClick={() => open("product")}>
                    Add product
                  </button>
                </div>
                {s.products.length ? (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Product / service</th>
                          <th>HSN / SAC</th>
                          <th>Unit price</th>
                          <th>GST / tax</th>
                          <th>Stock</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.products.map((p) => (
                          <tr key={p.id}>
                            <td>
                              <strong>{p.name}</strong>
                              {p.description && (
                                <small className="subline">
                                  {p.description}
                                </small>
                              )}
                            </td>
                            <td>{p.hsnSac || "—"}</td>
                            <td>{money(p.unitPrice)}</td>
                            <td>{p.taxBps / 100}%</td>
                            <td>
                              {p.trackInventory
                                ? `${p.stockOnHandMilli / 1000}${p.stockOnHandMilli <= p.lowStockAtMilli ? " · Low" : ""}`
                                : "Not tracked"}
                            </td>
                            <td>
                              <Badge value={p.active ? "active" : "archived"} />
                            </td>
                            <td>
                              <button
                                className="small-button"
                                onClick={() =>
                                  act({
                                    type: "product.update",
                                    id: p.id,
                                    name: p.name,
                                    description: p.description,
                                    hsnSac: p.hsnSac,
                                    unitPrice: p.unitPrice,
                                    taxBps: p.taxBps,
                                    active: !p.active,
                                    trackInventory: p.trackInventory,
                                    stockOnHandMilli: p.stockOnHandMilli,
                                    lowStockAtMilli: p.lowStockAtMilli,
                                  })
                                }
                              >
                                {p.active ? "Archive" : "Restore"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty
                    title="Build your catalog."
                    body="Add your regular services once, then reuse them on documents."
                    action="Add product"
                    onClick={() => open("product")}
                  />
                )}
              </section>
              <section className="card spaced">
                <div className="card-heading">
                  <div>
                    <h2>Stock movement history</h2>
                    <p>
                      Opening quantities, sales, reversals and manual
                      adjustments.
                    </p>
                  </div>
                  <span className="count">{s.inventoryMovements.length}</span>
                </div>
                {s.inventoryMovements.length ? (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Product</th>
                          <th>Movement</th>
                          <th>Quantity</th>
                          <th>Balance</th>
                          <th>Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.inventoryMovements.map((m) => (
                          <tr key={m.id}>
                            <td>
                              {new Date(m.createdAt).toLocaleDateString(
                                "en-GB",
                              )}
                            </td>
                            <td>
                              {s.products.find((p) => p.id === m.productId)
                                ?.name ?? "Archived product"}
                            </td>
                            <td>
                              <Badge value={m.type.replace("_", " ")} />
                            </td>
                            <td>
                              {m.quantityMilli > 0 ? "+" : ""}
                              {m.quantityMilli / 1000}
                            </td>
                            <td>{m.stockAfterMilli / 1000}</td>
                            <td>{m.note}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="hint">
                    Stock activity will appear here when tracked products are
                    added.
                  </p>
                )}
              </section>
            </>
          )}
          {page === "Revenue" && (
            <>
              <div className="stats-grid three">
                <Stat
                  label="Payments received"
                  value={money(collected)}
                  note={`${s.payments.length} recorded payments · all time`}
                  icon={Wallet}
                  accent
                />
                <Stat
                  label="Outstanding balance"
                  value={money(outstanding)}
                  note="Issued invoices minus payments"
                  icon={FileText}
                />
                <Stat
                  label="Issued invoice value"
                  value={money(
                    issued.reduce(
                      (n, d) => n + d.total - creditedAmount(s, d.id),
                      0,
                    ),
                  )}
                  note="After issued credit notes; drafts excluded"
                  icon={CreditCard}
                />
              </div>
              <RevenueChart s={s} />
              <section className="card spaced">
                <div className="card-heading">
                  <div>
                    <h2>Payment history</h2>
                    <p>Actual payments you’ve recorded, all in one place.</p>
                  </div>
                  <ArrowDownLeft size={20} />
                </div>
                {s.payments.length ? (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Invoice</th>
                          <th>Received</th>
                          <th>Method</th>
                          <th>Reference</th>
                          <th className="right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.payments.map((p) => (
                          <tr key={p.id}>
                            <td>
                              {
                                s.documents.find((d) => d.id === p.documentId)
                                  ?.number
                              }
                            </td>
                            <td>
                              {new Date(p.createdAt).toLocaleDateString(
                                "en-GB",
                              )}
                            </td>
                            <td>
                              <span className="source-pill">{p.method}</span>
                            </td>
                            <td>{p.reference || "—"}</td>
                            <td className="right amount">{money(p.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty
                    title="Here’s to your first payment."
                    body="Issue an invoice, then record a payment when it arrives."
                  />
                )}
              </section>
            </>
          )}
          {page === "Email" && (
            <>
              <div
                className={`connection-banner ${session.integrations.email ? "connected" : ""}`}
              >
                <Mail size={22} />
                <div>
                  <strong>
                    {session.integrations.email
                      ? "Email provider configured"
                      : "Your outbox is ready. Connect email to send."}
                  </strong>
                  <p>
                    {session.integrations.email
                      ? "Send saved messages when you’re ready. Sent means accepted by the provider."
                      : "Messages are saved safely. Add a Resend API key and verified sender to enable delivery."}
                  </p>
                </div>
                <Badge
                  value={
                    session.integrations.email ? "connected" : "setup needed"
                  }
                />
              </div>
              <section className="card">
                <div className="card-heading">
                  <h2>Outbox</h2>
                  <span className="count">{s.outbox.length}</span>
                </div>
                {s.outbox.length ? (
                  s.outbox.map((m) => (
                    <div className="mail-row" key={m.id}>
                      <span className="mail-icon">
                        <Mail size={20} />
                      </span>
                      <div>
                        <strong>{m.subject}</strong>
                        <span>To {m.to}</span>
                        <p>{m.body}</p>
                        {m.error && (
                          <small className="overdue">{m.error}</small>
                        )}
                      </div>
                      <Badge value={m.status} />
                      {m.status !== "sent" && (
                        <button
                          className="secondary"
                          disabled={busy || !session.integrations.email}
                          onClick={async () => {
                            setBusy(true);
                            try {
                              await api("email/send", { id: m.id });
                              await refresh();
                              setToast("Email accepted by provider.");
                            } catch (e) {
                              setError((e as Error).message);
                              await refresh();
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          {m.status === "failed" ? "Retry" : "Send now"}
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <Empty
                    title="A thoughtful follow-up goes a long way."
                    body="Compose your first email and save it to the outbox."
                    action="Compose email"
                    onClick={() => open("email")}
                  />
                )}
              </section>
            </>
          )}
          {page === "Feedback" && (
            <>
              <div className="feedback-hero">
                <span className="feedback-art">✳</span>
                <div>
                  <span className="eyebrow">BETTER, TOGETHER</span>
                  <h2>
                    Your everyday ideas.
                    <br />
                    Our next chapter.
                  </h2>
                  <p>
                    Keep a log of suggestions, bugs and things you’d love to
                    see.
                  </p>
                </div>
                <button className="primary" onClick={() => open("feedback")}>
                  Share an idea
                  <ArrowRight size={16} />
                </button>
              </div>
              <section className="card">
                <div className="card-heading">
                  <h2>Workspace feedback</h2>
                  <span className="count">{s.feedback.length}</span>
                </div>
                {s.feedback.length ? (
                  s.feedback.map((f) => (
                    <div className="feedback-row" key={f.id}>
                      <MessageSquare size={20} />
                      <div>
                        <Badge value={f.category} />
                        <p>{f.message}</p>
                        <small>
                          {new Date(f.createdAt).toLocaleDateString("en-GB")} ·
                          Saved in this workspace
                        </small>
                      </div>
                    </div>
                  ))
                ) : (
                  <Empty
                    title="An open page for your ideas."
                    body="Feedback stays in your workspace. A shared support inbox can be connected later."
                  />
                )}
              </section>
            </>
          )}
          {page === "Settings" && (
            <SettingsPage
              session={session}
              onSave={save}
              dark={dark}
              onTheme={() => setDark(!dark)}
              onDelete={async () => {
                const password = window.prompt(
                  "Enter your password to permanently delete this account and its workspace data.",
                );
                if (!password) return;
                if (
                  !window.confirm(
                    "This permanently deletes your account and workspace records. Continue?",
                  )
                )
                  return;
                await api("account/delete", { password });
                authGeneration.current++;
                setSession(null);
                router.push("/");
              }}
            />
          )}
        </main>
      </div>
      {modal && (
        <Editor
          kind={modal.kind}
          recordId={modal.id}
          s={s}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}{" "}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          {toast}
        </div>
      )}
    </div>
  );
}

function RevenueChart({ s }: { s: Workspace }) {
  const [range, setRange] = useState(6);
  const now = new Date();
  const months = Array.from({ length: range }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - range + 1 + i, 1);
    const sum = s.payments
      .filter((p) => {
        const d = new Date(p.createdAt);
        return (
          d.getMonth() === date.getMonth() &&
          d.getFullYear() === date.getFullYear()
        );
      })
      .reduce((n, p) => n + p.amount, 0);
    return { label: date.toLocaleDateString("en-GB", { month: "short" }), sum };
  });
  const max = Math.max(...months.map((m) => m.sum), 10000);
  const sum = months.reduce((n, m) => n + m.sum, 0);
  const compact = (n: number) =>
    new Intl.NumberFormat("en-IN", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n / 100);
  return (
    <section className="card revenue-chart">
      <div className="card-heading">
        <div>
          <h2>Revenue overview</h2>
          <p>A steady view of your business growth.</p>
        </div>
        <select
          aria-label="Revenue chart period"
          value={range}
          onChange={(e) => setRange(Number(e.target.value))}
        >
          <option value={6}>Last 6 months</option>
          <option value={3}>Last 3 months</option>
        </select>
      </div>
      <div className="chart-summary">
        <strong>{formatMoney(sum, s.currency)}</strong>
        <span>
          <i />
          Payments received
        </span>
      </div>
      <div
        className="chart"
        role="img"
        aria-label={months
          .map((m) => `${m.label}: ${formatMoney(m.sum, s.currency)}`)
          .join(", ")}
      >
        <div className="chart-axis">
          {[1, 0.75, 0.5, 0.25, 0].map((v) => (
            <span key={v}>{compact(max * v)}</span>
          ))}
        </div>
        <div className="chart-plot">
          <div className="chart-grid">
            {[0, 1, 2, 3, 4].map((v) => (
              <i key={v} />
            ))}
          </div>
          <div className="chart-columns">
            {months.map((m, i) => (
              <div className="chart-column" key={i}>
                <div
                  className={`chart-bar ${i === range - 1 ? "current" : ""}`}
                  style={{ height: `${Math.max(1, (m.sum / max) * 100)}%` }}
                >
                  <span>{formatMoney(m.sum, s.currency)}</span>
                </div>
                <small>{m.label}</small>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="chart-caption">
        {s.payments.length
          ? "Every bar represents payments recorded in that month."
          : "Your revenue story begins with your first recorded payment."}
      </div>
    </section>
  );
}
function SettingsPage({
  session,
  onSave,
  dark,
  onTheme,
  onDelete,
}: {
  session: Session;
  onSave: (c: unknown) => Promise<void>;
  dark: boolean;
  onTheme: () => void;
  onDelete: () => Promise<void>;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const s = session.workspace;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const business = Object.fromEntries(
        [
          "legalName",
          "address",
          "email",
          "phone",
          "gstin",
          "state",
          "paymentTerms",
          "bankDetails",
        ].map((key) => [key, f[key] || ""]),
      );
      await onSave({
        type: "settings.update",
        name: f.name,
        currency: f.currency,
        business,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="settings-grid">
      <section className="card">
        <div className="card-heading">
          <div>
            <h2>Workspace details</h2>
            <p>The basics that make this place yours.</p>
          </div>
          <Settings size={20} />
        </div>
        <form className="settings-form" onSubmit={submit}>
          <Field label="Workspace name">
            <input
              name="name"
              required
              minLength={2}
              maxLength={100}
              defaultValue={s.name}
            />
          </Field>
          <Field label="Currency">
            <select name="currency" defaultValue={s.currency}>
              {["INR", "USD", "EUR", "GBP", "CAD", "AUD"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <p className="hint">
            Currency is locked once financial records exist, so your totals stay
            consistent.
          </p>
          <Field label="Owner email">
            <input value={session.user.email} readOnly />
          </Field>
          <h3 className="settings-subhead">Business details for documents</h3>
          <p className="hint">
            Add your legal details once; they’ll appear on printable quotations
            and invoices. Tax registration and rates are your responsibility to
            confirm.
          </p>
          <Field label="Legal business name">
            <input
              name="legalName"
              maxLength={200}
              defaultValue={s.business.legalName}
            />
          </Field>
          <Field label="Business address">
            <textarea
              name="address"
              rows={3}
              maxLength={1000}
              defaultValue={s.business.address}
            />
          </Field>
          <div className="form-grid">
            <Field label="Business email">
              <input
                name="email"
                type="email"
                maxLength={254}
                defaultValue={s.business.email}
              />
            </Field>
            <Field label="Phone">
              <input
                name="phone"
                maxLength={40}
                defaultValue={s.business.phone}
              />
            </Field>
          </div>
          <div className="form-grid">
            <Field label="GSTIN (if registered)">
              <input
                name="gstin"
                maxLength={15}
                defaultValue={s.business.gstin}
              />
            </Field>
            <Field label="State / region">
              <input
                name="state"
                maxLength={100}
                defaultValue={s.business.state}
              />
            </Field>
          </div>
          <Field label="Payment terms">
            <input
              name="paymentTerms"
              maxLength={500}
              placeholder="e.g. Due within 14 days"
              defaultValue={s.business.paymentTerms}
            />
          </Field>
          <Field label="Bank / payment details">
            <textarea
              name="bankDetails"
              rows={3}
              maxLength={1000}
              defaultValue={s.business.bankDetails}
            />
          </Field>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
            <Check size={16} />
          </button>
        </form>
      </section>
      <div>
        <section className="card spaced">
          <div className="card-heading">
            <div>
              <h2>Your data</h2>
              <p>Keep a copy of your workspace or permanently close it.</p>
            </div>
          </div>
          <div className="setting-row">
            <span>
              Workspace export<small>Download your records as JSON</small>
            </span>
            <a className="secondary" href="/api/account/export">
              Download export
            </a>
          </div>
          <div className="setting-row">
            <span>
              Close account
              <small>Permanently remove this workspace and its data</small>
            </span>
            <button
              className="secondary danger-button"
              onClick={() => void onDelete()}
            >
              Delete account
            </button>
          </div>
        </section>
        <section className="card plan-card">
          <div className="card-heading">
            <h2>Your plan</h2>
            <Badge value="free" />
          </div>
          <span className="eyebrow">STARTER WORKSPACE</span>
          <h3>
            A strong foundation.
            <br />
            Room for what’s next.
          </h3>
          <p>
            Your MVP workspace includes all current workflows. No subscription
            is being charged.
          </p>
          <div className="plan-feature">
            <CheckCircle2 size={17} />
            Client & lead management
          </div>
          <div className="plan-feature">
            <CheckCircle2 size={17} />
            Quotations, invoices & revenue
          </div>
          <div className="plan-feature">
            <CheckCircle2 size={17} />
            Follow-ups & feedback
          </div>
          <div className="plan-note">
            <CreditCard size={17} />
            Paid plans await payment-provider integration.
          </div>
        </section>
        <section className="card spaced">
          <div className="card-heading">
            <h2>Connections & appearance</h2>
          </div>
          <div className="setting-row">
            <span>
              Database<small>Persistent workspace storage</small>
            </span>
            <Badge value={session.integrations.database} />
          </div>
          <div className="setting-row">
            <span>
              Email delivery<small>Resend with verified sender</small>
            </span>
            <Badge
              value={session.integrations.email ? "connected" : "not connected"}
            />
          </div>
          <div className="setting-row">
            <span>
              Appearance<small>{dark ? "Dark mode" : "Light mode"}</small>
            </span>
            <button className="secondary" onClick={onTheme}>
              {dark ? <Sun size={16} /> : <Moon size={16} />}Switch theme
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
