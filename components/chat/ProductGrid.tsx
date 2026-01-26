/**
 * ProductGrid Component
 *
 * Displays a grid of products from MercadoLibre
 * Responsive: 1 column on mobile, 2 on tablet, 3-4 on desktop
 */

'use client';

import { ProductCard, type Product } from './ProductCard';

// Re-export Product type for convenience
export type { Product } from './ProductCard';

interface ProductGridProps {
  products: Product[];
  title?: string;
  showIndexes?: boolean;
}

export function ProductGrid({ products, title, showIndexes = true }: ProductGridProps) {
  if (products.length === 0) {
    return null;
  }

  return (
    <div className="my-6 w-full">
      {/* Title */}
      {title && (
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <span className="text-2xl">🛒</span>
          {title}
        </h2>
      )}

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {products.map((product, index) => (
          <ProductCard
            key={product.url}
            product={product}
            index={showIndexes ? index : undefined}
          />
        ))}
      </div>

      {/* Summary */}
      <div className="mt-4 text-sm text-gray-500 dark:text-gray-400 text-center">
        Mostrando {products.length} producto{products.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
