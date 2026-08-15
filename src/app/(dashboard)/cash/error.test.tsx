import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import CashError from "./error";

it("offers a retry when cash loading fails", async () => {
  const retry = vi.fn();
  render(<CashError error={new Error("offline")} retry={retry} />);

  await userEvent.click(
    screen.getByRole("button", { name: "Intentar de nuevo" }),
  );
  expect(retry).toHaveBeenCalledOnce();
});

