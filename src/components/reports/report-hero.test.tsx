import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ReportHero } from "./report-hero";

it("presents a negative result and labeled projection", () => {
  render(<ReportHero month="2026-08" cutoff="2026-08-25" result={-15000} previousResult={10000} projectedResult={-18600} />);
  expect(screen.getByText("Resultado operativo")).toBeVisible();
  expect(screen.getByText(/-.*15[.]000/)).toBeVisible();
  expect(screen.getByText("Estimación de cierre")).toBeVisible();
  expect(screen.getByText(/25 de agosto/i)).toBeVisible();
});
