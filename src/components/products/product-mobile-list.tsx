import { ProductActions } from "@/components/products/product-actions";
import { Badge } from "@/components/ui/badge";
import { formatArs } from "@/lib/incomes/income-calculations";
import {
  getProductAvailabilityStatus,
} from "@/lib/products/product-catalog";
import type { CatalogProduct } from "@/types/product";

type ProductMobileListProps = {
  products: CatalogProduct[];
  canManage?: boolean;
  onEdit?: (product: CatalogProduct) => void;
  onAdjustStock?: (product: CatalogProduct) => void;
  onToggleStatus?: (product: CatalogProduct) => void;
};

export const ProductMobileList = ({
  products,
  canManage = false,
  onEdit,
  onAdjustStock,
  onToggleStatus,
}: ProductMobileListProps) => (
  <ul aria-label="Catálogo móvil de productos" className="space-y-3">
    {products.map((product) => {
      const availabilityStatus = getProductAvailabilityStatus(product);

      return (
      <li
        key={product.id}
        className="flex min-h-24 items-center justify-between gap-4 rounded-[1.35rem] bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold">{product.name}</p>
            {!product.isActive && (
              <Badge className="rounded-full bg-black/5 text-muted-foreground hover:bg-black/5">
                Inactivo
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {product.category.name}
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-1 text-right">
          <div>
            <p className="font-semibold">{formatArs(product.price)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {product.stock} {product.stock === 1 ? "unidad" : "unidades"}
            </p>
            <Badge
              className={
                availabilityStatus === "unavailable"
                  ? "mt-2 rounded-full bg-black/5 text-muted-foreground hover:bg-black/5"
                  : availabilityStatus === "available"
                  ? "mt-2 rounded-full bg-success/10 text-success-foreground hover:bg-success/10"
                  : availabilityStatus === "low-stock"
                    ? "mt-2 rounded-full bg-warning/10 text-warning-foreground hover:bg-warning/10"
                    : "mt-2 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/10"
              }
            >
              {availabilityStatus === "unavailable"
                ? "No disponible"
                : availabilityStatus === "available"
                ? "Disponible"
                : availabilityStatus === "low-stock"
                  ? "Stock bajo"
                  : "Sin stock"}
            </Badge>
          </div>
          {canManage && (
            <ProductActions
              product={product}
              onEdit={() => onEdit?.(product)}
              onAdjustStock={() => onAdjustStock?.(product)}
              onToggleStatus={() => onToggleStatus?.(product)}
            />
          )}
        </div>
        </li>
      );
    })}
  </ul>
);
