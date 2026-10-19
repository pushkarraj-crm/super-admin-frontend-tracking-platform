import { useEffect, useState } from "react";
import {
  send,
  login,
  refresh,
  currentSession,
  onSession,
  endSession,
  type Session,
  type Row,
} from "./api";
import { useData } from "./hooks";
import { SessionContext, ToastContext } from "./context";
import {
  PageHead,
  Panel,
  Table,
  Fields,
  Modal,
  ErrorBox,
  Loading,
  Badge,
} from "./ui";
export default function App() {
  const [session, setSession] = useState<Session | null>(currentSession),
    [ready, setReady] = useState(false),
    [error, setError] = useState<Error | null>(null),
    [notice, setNotice] = useState("");
  useEffect(() => onSession(() => setSession(currentSession())), []);
  useEffect(() => {
    let active = true;
    refresh()
      .catch((e) => {
        if (active) setError(e);
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  if (!ready) return <Loading />;
  if (!session)
    return (
      <main className="owner-login">
        <div className="owner-login-card">
          <span className="eyebrow">PLATFORM OPERATIONS</span>
          <h1>Super admin login</h1>
          <p>
            Manage networks, users and dashboard access across your platform.
          </p>
          {error && <ErrorBox error={error} />}
          <Fields
            fields={[
              {
                name: "email",
                label: "Email address",
                type: "email",
                autoComplete: "username",
              },
              {
                name: "password",
                label: "Password",
                type: "password",
                autoComplete: "current-password",
              },
            ]}
            submit="Sign in"
            onSubmit={async (b) => {
              await login(b.email, b.password);
              setError(null);
            }}
          />
        </div>
      </main>
    );
  if (session.user.role !== "platform_admin")
    return (
      <main className="owner-login">
        <div className="owner-login-card">
          <h1>Super admin access required</h1>
          <p>
            This account has {session.user.role} access. Only an authorized
            platform owner can use this application.
          </p>
          <p>Signing in here does not upgrade account permissions.</p>
          <button
            className="button primary"
            onClick={async () => {
              await endSession();
            }}
          >
            Sign out
          </button>
        </div>
      </main>
    );
  return (
    <SessionContext.Provider value={session}>
      <ToastContext.Provider value={setNotice}>
        <header className="owner-header">
          <strong>Relay · Super admin</strong>
          <span>{session.user.email}</span>
          <button
            className="button secondary"
            onClick={async () => {
              try {
                await endSession();
              } catch (e) {
                setNotice((e as Error).message);
              }
            }}
          >
            Sign out
          </button>
        </header>
        <main className="owner-main">
          {notice && (
            <div role="status" className="notice">
              {notice}
              <button className="text-button" onClick={() => setNotice("")}>
                Dismiss
              </button>
            </div>
          )}
          <Console notify={setNotice} />
        </main>
      </ToastContext.Provider>
    </SessionContext.Provider>
  );
}
function Console({ notify }: { notify: (v: string) => void }) {
  const [version, setVersion] = useState(0),
    [offset, setOffset] = useState(0),
    [network, setNetwork] = useState<Row | null>(null);
  const summary = useData<Row>("/platform/summary", version),
    networks = useData<Row[]>(
      `/platform/workspaces?offset=${offset}&limit=50`,
      version,
    );
  return (
    <>
      <PageHead
        title="Super admin dashboard"
        description="Network overview, account roles, module permissions and audit history."
        actions={
          <button
            className="button secondary"
            onClick={() => setVersion((v) => v + 1)}
          >
            Refresh
          </button>
        }
      />
      {summary.error && <ErrorBox error={summary.error} />}
      <div className="owner-metrics">
        {Object.entries(summary.data || {}).map(([key, value]) => (
          <Panel key={key} title={key.replaceAll("_", " ")}>
            <strong className="owner-value">{String(value)}</strong>
          </Panel>
        ))}
      </div>
      <Panel
        title="Customer networks"
        subtitle="Select a network to manage its users and review its operations."
      >
        {networks.error ? (
          <ErrorBox error={networks.error} />
        ) : networks.loading ? (
          <Loading />
        ) : (
          <Table
            rows={networks.data || []}
            offset={offset}
            setOffset={setOffset}
            columns={[
              { key: "name", title: "Network" },
              { key: "plan", title: "Plan" },
              {
                key: "subscription_status",
                title: "Subscription",
                render: (r) => <Badge value={r.subscription_status} />,
              },
              {
                key: "active",
                title: "Access",
                render: (r) => <Badge value={r.active} />,
              },
              {
                key: "actions",
                title: "Manage",
                render: (r) => (
                  <button
                    className="button secondary"
                    onClick={() => setNetwork(r)}
                  >
                    Manage network
                  </button>
                ),
              },
            ]}
          />
        )}
      </Panel>
      {network && (
        <Network
          key={network.id}
          network={network}
          notify={notify}
          close={() => setNetwork(null)}
          changed={() => setVersion((v) => v + 1)}
        />
      )}
    </>
  );
}
function Network({
  network,
  notify,
  close,
  changed,
}: {
  network: Row;
  notify: (s: string) => void;
  close: () => void;
  changed: () => void;
}) {
  const [tab, setTab] = useState("users"),
    [version, setVersion] = useState(0),
    [offset, setOffset] = useState(0),
    [editing, setEditing] = useState<Row | null>(null),
    [error, setError] = useState<Error | null>(null),
    [busy, setBusy] = useState(false),
    [enabled, setEnabled] = useState(Boolean(network.active));
  const result = useData<Row | Row[]>(
      `/platform/networks/${network.id}/${tab}?offset=${offset}&limit=50`,
      version,
    ),
    permissions = useData<Row>("/platform/networks/permissions");
  const rows = Array.isArray(result.data)
    ? result.data
    : result.data
      ? [result.data]
      : [];
  const fields = rows.length
    ? Object.keys(rows[0]).filter(
        (k) =>
          ![
            "staff_permissions",
            "api_enabled",
            "sessions_revoked",
            "api_keys_revoked",
          ].includes(k),
      )
    : [];
  return (
    <section className="owner-network">
      <PageHead
        title={network.name}
        description={`Network ID: ${network.id}`}
        actions={
          <button className="button secondary" onClick={close}>
            Close network
          </button>
        }
      />
      <div className="owner-actions">
        <button
          className="button secondary"
          disabled={busy}
          onClick={async () => {
            if (!confirm(`${enabled ? "Suspend" : "Reactivate"} this network?`))
              return;
            setBusy(true);
            setError(null);
            try {
              await send(
                `/platform/workspaces/${network.id}`,
                { active: !enabled },
                "PATCH",
              );
              setEnabled(!enabled);
              changed();
              notify("Network access updated");
            } catch (e) {
              setError(e as Error);
            } finally {
              setBusy(false);
            }
          }}
        >
          {enabled ? "Suspend network" : "Reactivate network"}
        </button>
        {network.dashboard_url && (
          <a
            className="button secondary"
            href={network.dashboard_url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open network login
          </a>
        )}
      </div>
      {error && <ErrorBox error={error} />}
      <nav className="owner-tabs" aria-label="Network modules">
        {[
          "users",
          "overview",
          "campaigns",
          "conversions",
          "invoices",
          "domains",
          "audit",
        ].map((t) => (
          <button
            className={t === tab ? "button primary" : "button secondary"}
            key={t}
            onClick={() => {
              setTab(t);
              setOffset(0);
            }}
          >
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </nav>
      <Panel
        title={tab === "users" ? "Accounts and dashboard permissions" : tab}
      >
        {result.error ? (
          <ErrorBox error={result.error} />
        ) : result.loading ? (
          <Loading />
        ) : (
          <Table
            rows={rows}
            offset={offset}
            setOffset={tab !== "overview" ? setOffset : undefined}
            columns={[
              ...fields.map((key) => ({
                key,
                title: key.replaceAll("_", " "),
                render: (r: Row) =>
                  typeof r[key] === "object"
                    ? JSON.stringify(r[key])
                    : String(r[key] ?? "—"),
              })),
              ...(tab === "users"
                ? [
                    {
                      key: "manage",
                      title: "Permissions",
                      render: (r: Row) =>
                        r.role !== "platform_admin" && (
                          <button
                            className="button secondary"
                            onClick={() => setEditing(r)}
                          >
                            Change access
                          </button>
                        ),
                    },
                  ]
                : []),
            ]}
          />
        )}
      </Panel>
      {editing && (
        <Modal
          title={`Change access · ${editing.email}`}
          onClose={() => setEditing(null)}
        >
          <p>
            Network admin grants access to this network's administrator
            dashboard. Saving revokes current sessions and API keys; the person
            must sign in again. Financial records stay intact.
          </p>
          <Fields
            initial={{
              ...editing,
              staff_permissions: JSON.stringify(editing.staff_permissions),
              reason: "",
            }}
            fields={[
              {
                name: "role",
                label: "Account role",
                options: (
                  permissions.data?.roles || [
                    "admin",
                    "staff",
                    "advertiser",
                    "affiliate",
                    "publisher",
                  ]
                ).map((role: string) => ({
                  value: role,
                  label:
                    role === "admin"
                      ? "Network admin"
                      : role[0].toUpperCase() + role.slice(1),
                })),
              },
              {
                name: "active",
                label: "Account enabled",
                type: "checkbox",
                required: false,
              },
              {
                name: "api_enabled",
                label: "Allow partner API access",
                type: "checkbox",
                required: false,
              },
              {
                name: "staff_permissions",
                label: "Staff module permissions",
                type: "textarea",
                help: "For staff only: null preserves standard staff access; [] denies management modules; or enter an array of allowed permissions.",
                full: true,
              },
              {
                name: "parent_user_id",
                label: "Parent affiliate ID (publishers only)",
                required: false,
              },
              {
                name: "reason",
                label: "Reason for this access change",
                help: "At least 8 characters; recorded in the audit trail.",
                full: true,
              },
            ]}
            submit="Save access changes"
            onSubmit={async (b) => {
              let staffPermissions = null;
              if (b.role === "staff") {
                try {
                  staffPermissions = JSON.parse(b.staff_permissions);
                } catch {
                  throw new Error(
                    "Enter null or a JSON array for staff permissions",
                  );
                }
              }
              await send(
                `/platform/networks/${network.id}/users/${editing.id}/access`,
                {
                  role: b.role,
                  active: b.active,
                  api_enabled: b.api_enabled,
                  staff_permissions: staffPermissions,
                  parent_user_id:
                    b.role === "publisher" ? b.parent_user_id || null : null,
                  reason: b.reason,
                },
                "PATCH",
              );
              setEditing(null);
              setVersion((v) => v + 1);
              notify(
                "Access updated. Ask the user to sign out and sign in again.",
              );
            }}
          />
          {permissions.data && (
            <p className="owner-permissions">
              Available staff permissions:{" "}
              {permissions.data.staff_permissions.join(", ")}
            </p>
          )}
        </Modal>
      )}
    </section>
  );
}
