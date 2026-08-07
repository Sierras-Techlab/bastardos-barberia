import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ServiceSelector } from "./service-selector";

const services = [
  { id: "service-haircut", name: "Corte de pelo", price: 16000 },
  { id: "service-beard", name: "Barba", price: 13000 },
];

describe("ServiceSelector", () => {
  it("selects an unselected service", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ServiceSelector services={services} value={null} onChange={onChange} />,
    );

    await user.click(screen.getByRole("button", { name: /corte de pelo/i }));

    expect(onChange).toHaveBeenCalledWith("service-haircut");
  });

  it("clears the currently selected service", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ServiceSelector
        services={services}
        value="service-beard"
        onChange={onChange}
        error="Elegí otra opción."
      />,
    );

    const beard = screen.getByRole("button", { name: /barba/i });
    expect(beard).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Elegí otra opción.")).toBeInTheDocument();

    await user.click(beard);

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
