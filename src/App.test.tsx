import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { it, expect, vi, afterEach } from "vitest";
import App from "./App";
import { setSession } from "./api";
vi.mock("./api", async (original) => {
  const actual = await original<typeof import("./api")>();
  return { ...actual, refresh: vi.fn(async () => actual.currentSession()) };
});
afterEach(() => {
  setSession(null);
  vi.restoreAllMocks();
});
it("blocks advertisers from the super admin dashboard", async () => {
  setSession({
    access_token: "test",
    csrf_token: "test",
    user: { id: "ad", email: "ad@example.com", role: "advertiser" },
  });
  render(<App />);
  expect(
    await screen.findByRole("heading", { name: "Super admin access required" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Manage network" }),
  ).not.toBeInTheDocument();
});
it("super admins select a network and manage its account roles", async () => {
  setSession({
    access_token: "test",
    csrf_token: "test",
    user: { id: "owner", email: "owner@example.com", role: "platform_admin" },
  });
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const path = String(input);
    let data: unknown = {};
    if (path.includes("/platform/workspaces"))
      data = [
        {
          id: "network",
          name: "Example network",
          active: true,
          plan: "starter",
        },
      ];
    if (path.includes("/networks/network/users"))
      data = [
        {
          id: "account",
          email: "ad@example.com",
          role: "advertiser",
          active: true,
          api_enabled: false,
          staff_permissions: null,
        },
      ];
    if (path.includes("/networks/permissions"))
      data = {
        roles: ["admin", "staff", "advertiser", "publisher", "affiliate"],
        staff_permissions: ["reports:read"],
      };
    return new Response(JSON.stringify(data), { status: 200 });
  });
  render(<App />);
  await userEvent.click(
    await screen.findByRole("button", { name: "Manage network" }),
  );
  await userEvent.click(
    await screen.findByRole("button", { name: "Change access" }),
  );
  expect(
    await screen.findByRole("option", { name: "Network admin" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("option", { name: "platform_admin" }),
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText(/Reason for this access change/)).toBeRequired();
});
