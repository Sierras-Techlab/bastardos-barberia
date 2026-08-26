import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { ReportRankings } from "./report-rankings";

it("shows five ranked items and expands the complete list", async () => {
  const items = Array.from({ length: 6 }, (_, index) => ({ id: String(index), name: `Servicio ${index + 1}`, amount: 600 - index, quantity: 1 }));
  render(<ReportRankings services={items} products={[]} highlights={{ bestDay: { date: "2026-08-10", amount: 500 }, worstDay: { date: "2026-08-11", amount: -200 } }} />);
  expect(screen.queryByText("Servicio 6")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Ver detalle de servicios" }));
  expect(screen.getByText("Servicio 6")).toBeVisible();
  expect(screen.getByText("Peor día")).toBeVisible();
});
