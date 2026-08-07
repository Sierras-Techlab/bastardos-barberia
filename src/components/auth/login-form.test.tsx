import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

import { LoginForm } from "./login-form";

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("submits credentials and enters the dashboard", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ data: { user: { id: "1" } } }), { status: 200 }));
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/nombre de usuario/i), "Ada.Lovelace");
    await user.type(screen.getByLabelText(/^contrase/i), "safe-password");
    await user.click(screen.getByRole("button", { name: "Ingresar" }));

    expect(fetch).toHaveBeenCalledWith("/api/auth/login", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ username: "Ada.Lovelace", password: "safe-password" }),
    }));
    expect(replace).toHaveBeenCalledWith("/");
  });

  it("shows the safe API error and keeps the user on the form", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      error: { code: "INVALID_CREDENTIALS", message: "Usuario o contrase\u00f1a incorrectos." },
    }), { status: 401 }));
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText(/nombre de usuario/i), "ada.lovelace");
    await user.type(screen.getByLabelText(/^contrase/i), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Ingresar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/incorrectos/i);
    expect(replace).not.toHaveBeenCalled();
  });
});
