import { Badge } from "@/components/ui/badge";
import { formatArs } from "@/lib/incomes/income-calculations";
import { formatProductCategory } from "@/lib/products/product-catalog";
import type { CatalogProduct } from "@/types/product";

type ProductTableProps = {
  products: CatalogProduct[];
};

export const ProductTable = ({ products }: ProductTableProps) => (
  <div className="overflow-hidden rounded-[1.6rem] bg-white shadow-sm">
    <div className="overflow-x-auto">
      <table aria-label="Catálogo de productos" className="w-full text-sm">
        <thead className="border-b border-black/5 bg-[#f8f7f4] text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-5 py-3.5 font-medium">Producto</th>
            <th className="px-5 py-3.5 font-medium">Categoría</th>
            <th className="px-5 py-3.5 font-medium">Disponibilidad</th>
            <th className="px-5 py-3.5 text-right font-medium">Precio</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr
              key={product.id}
              className="border-b border-black/5 transition-colors last:border-0 hover:bg-[#f6f5f2]"
            >
              <td className="px-5 py-4 font-medium">{product.name}</td>
              <td className="px-5 py-4 text-muted-foreground">
                {formatProductCategory(product.category)}
              </td>
              <td className="px-5 py-4">
                <Badge
                  className={
                    product.availability === "available"
                      ? "rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
                      : "rounded-full bg-black/5 text-muted-foreground hover:bg-black/5"
                  }
                >
                  {product.availability === "available"
                    ? "Disponible"
                    : "No disponible"}
                </Badge>
              </td>
              <td className="px-5 py-4 text-right text-base font-semibold">
                {formatArs(product.price)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);
