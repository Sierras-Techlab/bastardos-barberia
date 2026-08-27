"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { formatArs } from "@/lib/incomes/income-calculations";

export type LinePriceOverride = {
  chargedUnitPrice: number;
  reason: string;
};

type LinePriceEditorProps = {
  catalogUnitPrice: number;
  label: string;
  value: LinePriceOverride | null;
  onChange: (value: LinePriceOverride | null) => void;
};

export const LinePriceEditor = ({
  catalogUnitPrice,
  label,
  value,
  onChange,
}: LinePriceEditorProps) => {
  const [draft, setDraft] = useState<LinePriceOverride | null>(value);
  const enabled = draft !== null;
  const charged = draft?.chargedUnitPrice ?? catalogUnitPrice;
  const adjustment = charged - catalogUnitPrice;

  return (
    <div className="rounded-2xl border border-black/5 bg-white/80 p-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-medium text-zinc-700">{label}</span>
        <label className="flex items-center gap-2 text-xs text-zinc-500">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => {
              if (event.target.checked) {
                const next: LinePriceOverride = draft ?? {
                  chargedUnitPrice: catalogUnitPrice,
                  reason: "",
                };
                setDraft(next);
                onChange(next);
              } else {
                setDraft(null);
                onChange(null);
              }
            }}
            aria-label={`Modificar precio de ${label}`}
          />
          Modificar precio
        </label>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
        <span>Catálogo: {formatArs(catalogUnitPrice)}</span>
        <span aria-hidden="true">·</span>
        <span className={adjustment < 0 ? "text-emerald-700" : adjustment > 0 ? "text-amber-700" : "text-zinc-500"}>
          Cobrado: {formatArs(charged)}
        </span>
      </div>
      {enabled && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="space-y-1 text-xs">
            <span className="font-medium text-zinc-600">Precio cobrado</span>
            <Input
              type="number"
              min="0"
              step="1"
              value={draft?.chargedUnitPrice ?? catalogUnitPrice}
              onChange={(event) => {
                const next: LinePriceOverride = {
                  chargedUnitPrice: Number(event.target.value),
                  reason: draft?.reason ?? "",
                };
                setDraft(next);
                onChange(next);
              }}
              aria-label={`Precio cobrado de ${label}`}
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="font-medium text-zinc-600">Motivo</span>
            <Input
              type="text"
              maxLength={240}
              value={draft?.reason ?? ""}
              onChange={(event) => {
                const next: LinePriceOverride = {
                  chargedUnitPrice: draft?.chargedUnitPrice ?? catalogUnitPrice,
                  reason: event.target.value,
                };
                setDraft(next);
                onChange(next);
              }}
              aria-label={`Motivo del cambio de precio de ${label}`}
            />
          </label>
        </div>
      )}
    </div>
  );
};
