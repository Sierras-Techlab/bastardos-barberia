import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import DashboardLoading from "./loading";

it("shows navigation progress inside the persistent dashboard shell", () => {
  render(<DashboardLoading />);

  expect(screen.getByRole("status")).toHaveAccessibleName(
    /cargando contenido/i,
  );
  expect(screen.queryByAltText("Bastardos Barbería")).not.toBeInTheDocument();
});
