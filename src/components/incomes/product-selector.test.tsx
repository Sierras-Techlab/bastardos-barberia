import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProductSelector } from "./product-selector";

const products = [
  { id: "product-pomade", name: "Pomada", price: 10000, stock: 5 },
  { id: "product-shampoo", name: "Shampoo", price: 12000, stock: 8 },
];

describe("ProductSelector", () => {
  it("filters the catalog by product name", async () => {
    const user = userEvent.setup();
    render(
      <ProductSelector products={products} value={[]} onChange={vi.fn()} />,
    );

    await user.type(screen.getByRole("searchbox"), "sham");

    expect(screen.getByRole("button", { name: /agregar shampoo/i })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /agregar pomada/i }),
    ).not.toBeInTheDocument();
  });

  it("adds a new product with quantity one", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ProductSelector products={products} value={[]} onChange={onChange} />,
    );

    await user.click(screen.getByRole("button", { name: /agregar pomada/i }));

    expect(onChange).toHaveBeenCalledWith([
      { productId: "product-pomade", quantity: 1, grantFullCommission: false },
    ]);
  });

  it("increments an existing product instead of duplicating its row", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ProductSelector
        products={products}
        value={[{ productId: "product-pomade", quantity: 1, grantFullCommission: false }]}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: /agregar pomada/i }));

    expect(onChange).toHaveBeenCalledWith([
      { productId: "product-pomade", quantity: 2, grantFullCommission: false },
    ]);
    expect(screen.getAllByText("Pomada")).toHaveLength(2);
  });

  it("changes quantity and removes only through the explicit action", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const value = [{ productId: "product-pomade", quantity: 1, grantFullCommission: false }];
    render(
      <ProductSelector products={products} value={value} onChange={onChange} />,
    );

    await user.click(screen.getByRole("button", { name: /restar pomada/i }));
    expect(onChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /sumar pomada/i }));
    expect(onChange).toHaveBeenLastCalledWith([
      { productId: "product-pomade", quantity: 2, grantFullCommission: false },
    ]);

    await user.click(screen.getByRole("button", { name: /eliminar pomada/i }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("grants full commission to the complete selected quantity only when eligible", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ProductSelector products={products} value={[{ productId: "product-pomade", quantity: 2, grantFullCommission: false }]} canGrantFullCommission onChange={onChange} />);

    const checkbox = screen.getByRole("checkbox", { name: /otorgar comisión completa.*2 unidades.*pomada/i });
    await user.click(checkbox);
    expect(onChange).toHaveBeenCalledWith([{ productId: "product-pomade", quantity: 2, grantFullCommission: true }]);
  });

  it("keeps multiple product-line exceptions independent", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ProductSelector
      products={products}
      value={[
        { productId: "product-pomade", quantity: 2, grantFullCommission: true },
        { productId: "product-shampoo", quantity: 1, grantFullCommission: false },
      ]}
      canGrantFullCommission
      onChange={onChange}
    />);

    await user.click(screen.getByRole("checkbox", { name: /otorgar comisión completa.*1 unidad.*shampoo/i }));
    expect(onChange).toHaveBeenCalledWith([
      { productId: "product-pomade", quantity: 2, grantFullCommission: true },
      { productId: "product-shampoo", quantity: 1, grantFullCommission: true },
    ]);
  });

  it("hides full-commission controls when attribution is ineligible", () => {
    render(<ProductSelector products={products} value={[{ productId: "product-pomade", quantity: 2, grantFullCommission: false }]} canGrantFullCommission={false} onChange={vi.fn()} />);
    expect(screen.queryByRole("checkbox", { name: /otorgar comisión completa/i })).not.toBeInTheDocument();
  });
});
