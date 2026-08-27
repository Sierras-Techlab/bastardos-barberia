"use client";

import { Minus, Plus, Search, ShoppingBag, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatArs } from "@/lib/incomes/income-calculations";
import type { Product } from "@/types/income";

export type ProductSelection = Array<{
  productId: string;
  quantity: number;
  grantFullCommission: boolean;
}>;

type ProductOption = Product | {
  id: string;
  name: string;
  earning: number;
  stock: number;
  price?: never;
};

type ProductSelectorProps = {
  products: ReadonlyArray<ProductOption>;
  value: ProductSelection;
  onChange: (products: ProductSelection) => void;
  canGrantFullCommission?: boolean;
};

const getProductPrice = (product: ProductOption): number =>
  "price" in product && typeof product.price === "number"
    ? product.price
    : product.earning;

export const ProductSelector = ({
  products,
  value,
  onChange,
  canGrantFullCommission = false,
}: ProductSelectorProps) => {
  const [query, setQuery] = useState("");
  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es");

    if (!normalizedQuery) {
      return products;
    }

    return products.filter((product) =>
      product.name.toLocaleLowerCase("es").includes(normalizedQuery),
    );
  }, [products, query]);

  const addProduct = (productId: string) => {
    const selected = value.find((item) => item.productId === productId);

    if (selected) {
      onChange(
        value.map((item) =>
          item.productId === productId
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        ),
      );
      return;
    }

    onChange([...value, { productId, quantity: 1, grantFullCommission: false }]);
  };

  const changeQuantity = (productId: string, delta: number) => {
    const selected = value.find((item) => item.productId === productId);

    if (!selected || selected.quantity + delta < 1) {
      return;
    }

    onChange(
      value.map((item) =>
        item.productId === productId
          ? { ...item, quantity: item.quantity + delta }
          : item,
      ),
    );
  };

  const removeProduct = (productId: string) => {
    onChange(value.filter((item) => item.productId !== productId));
  };

  const setFullCommission = (productId: string, grantFullCommission: boolean) => {
    onChange(value.map((item) => item.productId === productId ? { ...item, grantFullCommission } : item));
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar productos"
          aria-label="Buscar productos"
          className="h-11 rounded-xl border-black/10 bg-[#f6f5f2] pl-10 shadow-none"
        />
      </div>

      <div className="grid max-h-56 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
        {filteredProducts.map((product) => {
          const unitPrice = getProductPrice(product);
          return (
            <button
              key={product.id}
              type="button"
              onClick={() => addProduct(product.id)}
              aria-label={`Agregar ${product.name}`}
              className="flex min-h-20 items-center gap-3 rounded-xl bg-[#f6f5f2] p-3 text-left ring-1 ring-black/5 transition-all hover:bg-white hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary">
                <ShoppingBag className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {product.name}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {formatArs(unitPrice)} · Stock {product.stock}
                </span>
              </span>
              <Plus className="size-4 shrink-0 text-primary" />
            </button>
          );
        })}
      </div>

      {value.length > 0 && (
        <div className="space-y-2 border-t border-black/5 pt-4">
          {value.map((item) => {
            const product = products.find(
              (candidate) => candidate.id === item.productId,
            );

            if (!product) {
              return null;
            }

            const unitPrice = getProductPrice(product);
            const fullCommissionLabel = item.quantity === 1
              ? `Regalar el 100% del valor de 1 unidad de ${product.name}`
              : `Regalar el 100% del valor de las ${item.quantity} unidades de ${product.name}`;

            return (
              <div
                key={item.productId}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-black/5 bg-white p-3"
              >
                <div className="min-w-32 flex-1">
                  <p className="text-sm font-medium">{product.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatArs(unitPrice)} c/u
                  </p>
                </div>
                <div className="flex items-center gap-1 rounded-xl bg-[#f6f5f2] p-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Restar ${product.name}`}
                    onClick={() => changeQuantity(item.productId, -1)}
                  >
                    <Minus />
                  </Button>
                  <span className="w-7 text-center text-sm font-semibold">
                    {item.quantity}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Sumar ${product.name}`}
                    onClick={() => changeQuantity(item.productId, 1)}
                  >
                    <Plus />
                  </Button>
                </div>
                <p className="w-24 text-right text-sm font-semibold">
                  {formatArs(unitPrice * item.quantity)}
                </p>
                {canGrantFullCommission && (
                  <label className="flex basis-full items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={item.grantFullCommission}
                      onChange={(event) => setFullCommission(item.productId, event.target.checked)}
                      aria-label={fullCommissionLabel}
                      className="size-4 accent-red-600"
                    />
                    {fullCommissionLabel}
                  </label>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Eliminar ${product.name}`}
                  onClick={() => removeProduct(item.productId)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
