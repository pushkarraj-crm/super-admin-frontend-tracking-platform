import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  LoaderCircle,
  Search,
  X,
} from "lucide-react";
import { ApiError, type Row } from "./api";
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={22} /> Loading your network…
    </div>
  );
}
export function ErrorBox({
  error,
  retry,
}: {
  error: Error;
  retry?: () => void;
}) {
  return (
    <div className="error-box" role="alert">
      <AlertCircle size={20} />
      <div>
        <strong>
          {error instanceof ApiError && error.status === 402
            ? "Your plan needs attention"
            : "We couldn’t complete that request"}
        </strong>
        <p>{error.message}</p>
        {error instanceof ApiError && error.requestId && (
          <small>Reference: {error.requestId}</small>
        )}
        {retry && (
          <button className="text-button" onClick={retry}>
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
export function Empty({
  title = "Nothing here yet",
  description = "Your network activity will appear here as you get started.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-mark">↗</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Badge({ value }: { value: unknown }) {
  const label =
    typeof value === "boolean"
      ? value
        ? "active"
        : "inactive"
      : String(value ?? "pending");
  return (
    <span
      className={`badge ${["active", "approved", "paid", "processed", "delivered", "verified", "true"].includes(label) ? "positive" : ["rejected", "failed", "suspended", "inactive", "halted"].includes(label) ? "negative" : ""}`}
    >
      <i />
      {label.replaceAll("_", " ")}
    </span>
  );
}
export function CopyButton({
  value,
  label = "Copy",
}: {
  value: string;
  label?: string;
}) {
  const [done, setDone] = useState(false),
    [error, setError] = useState(false);
  return (
    <button
      className="icon-button"
      title={error ? "Copy unavailable. Select the text to copy." : label}
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          setError(true);
        }
      }}
    >
      {done ? <Check size={15} /> : <Copy size={15} />}
    </button>
  );
}
export function Secret({ title, value }: { title: string; value: string }) {
  return (
    <div className="secret" role="status">
      <strong>{title}</strong>
      <p>Save this now. It is only shown once.</p>
      <code>{value}</code>
      <CopyButton value={value} />
    </div>
  );
}
export function PageHead({
  eyebrow = "YOUR NETWORK",
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>
          {title}
          <span className="title-dot">.</span>
        </h1>
        <p>{description}</p>
      </div>
      <div className="head-actions">{actions}</div>
    </div>
  );
}
export function Panel({
  title,
  subtitle,
  actions,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}
export function Table({
  rows,
  columns,
  offset,
  setOffset,
  hasNext,
  pageSize = 50,
}: {
  rows: Row[];
  columns: { key: string; title: string; render?: (row: Row) => ReactNode }[];
  offset?: number;
  setOffset?: (n: number) => void;
  pageSize?: number;
  hasNext?: boolean;
}) {
  return (
    <>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key}>{c.title}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id || `${r.group}-${r.currency}-${i}`}>
                {columns.map((c) => (
                  <td key={c.key}>
                    {c.render
                      ? c.render(r)
                      : typeof r[c.key] === "object"
                        ? JSON.stringify(r[c.key])
                        : String(r[c.key] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <Empty />}
      {setOffset && (
        <footer className="table-foot">
          <span>
            {rows.length
              ? `${(offset || 0) + 1}–${(offset || 0) + rows.length}`
              : "0"}{" "}
            records · page {Math.floor((offset || 0) / pageSize) + 1}
          </span>
          <div>
            <button
              className="icon-button"
              aria-label="Previous page"
              disabled={!offset}
              onClick={() => setOffset(Math.max(0, (offset || 0) - pageSize))}
            >
              <ArrowLeft size={16} />
            </button>
            <button
              className="icon-button"
              aria-label="Next page"
              disabled={
                hasNext === undefined ? rows.length < pageSize : !hasNext
              }
              onClick={() => setOffset((offset || 0) + pageSize)}
            >
              <ArrowRight size={16} />
            </button>
          </div>
        </footer>
      )}
    </>
  );
}
export interface Field {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  help?: string;
  min?: number;
  max?: number;
  step?: string;
  full?: boolean;
  defaultValue?: string | number | boolean;
  autoComplete?: string;
  source?: {
    hasMore: boolean;
    loadMore: () => void;
    loading: boolean;
    error: Error | null;
  };
}
export function Fields({
  fields,
  initial = {},
  onSubmit,
  submit = "Save changes",
  children,
}: {
  fields: Field[];
  initial?: Row;
  onSubmit: (body: Row) => Promise<void>;
  submit?: string;
  children?: ReactNode;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<Error | null>(null);
  async function handle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = event.currentTarget;
    const values = new FormData(form);
    const body: Row = {};
    for (const field of fields) {
      const value = values.get(field.name);
      if (field.type === "checkbox") body[field.name] = value === "on";
      else if (value !== "" && value !== null)
        body[field.name] =
          field.type === "number" &&
          ![
            "amount",
            "revenue",
            "payout",
            "daily_revenue",
            "total_revenue",
            "minimum_amount",
            "sale_percentage",
            "threshold",
          ].includes(field.name)
            ? Number(value)
            : value;
    }
    try {
      await onSubmit(body);
      form
        .querySelectorAll<HTMLInputElement>('input[type="password"]')
        .forEach((input) => {
          input.value = "";
        });
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={handle}>
      <div className="form-grid">
        {fields.map((field) => (
          <label className={field.full ? "full" : ""} key={field.name}>
            {field.type === "checkbox" ? (
              <span className="check-label">
                <input
                  type="checkbox"
                  name={field.name}
                  defaultChecked={Boolean(
                    initial[field.name] ?? field.defaultValue,
                  )}
                />
                {field.label}
              </span>
            ) : (
              <>
                {field.label}
                {field.required !== false && (
                  <span className="required"> *</span>
                )}
                {field.options ? (
                  <div className="select-wrap">
                    <select
                      name={field.name}
                      required={field.required !== false}
                      defaultValue={
                        initial[field.name] ?? field.defaultValue ?? ""
                      }
                    >
                      <option value="">
                        Select {field.label.toLowerCase()}
                      </option>
                      {field.options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={15} />
                  </div>
                ) : field.type === "textarea" ? (
                  <textarea
                    name={field.name}
                    required={field.required !== false}
                    defaultValue={initial[field.name] ?? field.defaultValue}
                    placeholder={field.placeholder}
                    rows={7}
                  />
                ) : (
                  <input
                    name={field.name}
                    type={field.type || "text"}
                    required={field.required !== false}
                    defaultValue={initial[field.name] ?? field.defaultValue}
                    placeholder={field.placeholder}
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    minLength={
                      field.type === "password" && field.name === "password"
                        ? 12
                        : undefined
                    }
                    maxLength={
                      field.type === "password" && field.name === "password"
                        ? 128
                        : undefined
                    }
                    autoComplete={
                      field.autoComplete ||
                      (field.type === "password" ? "new-password" : "off")
                    }
                  />
                )}
              </>
            )}
            {field.source && (
              <>
                <button
                  type="button"
                  className="text-button"
                  disabled={
                    (!field.source.hasMore && !field.source.error) ||
                    field.source.loading
                  }
                  onClick={field.source.loadMore}
                >
                  {field.source.loading
                    ? "Loading choices�"
                    : field.source.error
                      ? "Retry choices"
                      : field.source.hasMore
                        ? "Load more choices"
                        : "All choices loaded"}
                </button>
                {field.source.error && (
                  <small role="alert" className="danger">
                    {field.source.error.message}
                  </small>
                )}
              </>
            )}
            {field.help && <small>{field.help}</small>}
          </label>
        ))}
      </div>
      {children}
      {error && <ErrorBox error={error} />}
      <div className="form-footer">
        <button className="button primary" disabled={busy}>
          {busy && <LoaderCircle className="spin" size={16} />}{" "}
          {busy ? "Saving…" : submit}
          <ArrowRight size={16} />
        </button>
      </div>
    </form>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-label={title}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <header>
        <div>
          <div className="eyebrow">NETWORK OPERATIONS</div>
          <h2>{title}</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function SearchBox({
  value,
  onChange,
  placeholder = "Search this page…",
}: {
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="search">
      <Search size={16} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
