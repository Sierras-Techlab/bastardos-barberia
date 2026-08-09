import { Badge } from "@/components/ui/badge";
import { formatArs } from "@/lib/incomes/income-calculations";
import { formatProductCategory } from "@/lib/products/product-catalog";
import type { CatalogProduct } from "@/types/product";

type ProductMobileListProps = {
  products: CatalogProduct[];
};

export const ProductMobileList = ({ products }: ProductMobileListProps) => (
  <ul aria-label="Catálogo móvil de productos" className="space-y-3">
    {products.map((product) => (
      <li
        key={product.id}
        className="flex min-h-24 items-center justify-between gap-4 rounded-[1.35rem] bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
      >
        <div className="min-w-0">
          <p className="truncate font-semibold">{product.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatProductCategory(product.category)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-semibold">{formatArs(product.price)}</p>
          <Badge
            className={
              product.availability === "available"
                ? "mt-2 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                : "mt-2 rounded-full bg-black/5 text-muted-foreground hover:bg-black/5"
            }
          >
            {product.availability === "available"
              ? "Disponible"
              : "No disponible"}
          </Badge>
        </div>
      </li>
    ))}
  </ul>
);
