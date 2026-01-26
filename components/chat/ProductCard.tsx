/**
 * ProductCard Component
 *
 * Displays a product from MercadoLibre with image, price, and link
 * Similar to ChatGPT's product cards
 */

'use client';

import { ExternalLink, ShoppingCart } from 'lucide-react';
import { useState } from 'react';

export interface Product {
  id: string | null;
  title: string;
  price: number | null;
  priceFormatted: string;
  url: string;
  snippet?: string;
  image?: string;
}

interface ProductCardProps {
  product: Product;
  index?: number;
}

export function ProductCard({ product, index }: ProductCardProps) {
  const [imageError, setImageError] = useState(false);

  // Generate placeholder image from MercadoLibre if not provided
  const imageUrl = product.image || (product.id
    ? `https://http2.mlstatic.com/D_NQ_NP_${product.id.replace('MLA-', '')}-O.jpg`
    : null);

  return (
    <div className="group relative flex flex-col bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all duration-200 hover:border-adhoc-violet">
      {/* Product Image */}
      <div className="relative aspect-square bg-gray-100 dark:bg-gray-900">
        {imageUrl && !imageError ? (
          <img
            src={imageUrl}
            alt={product.title}
            className="w-full h-full object-contain p-4"
            onError={() => setImageError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingCart className="w-16 h-16 text-gray-300 dark:text-gray-600" />
          </div>
        )}

        {/* Index badge (optional) */}
        {index !== undefined && (
          <div className="absolute top-2 left-2 bg-adhoc-violet text-white text-xs font-bold px-2 py-1 rounded">
            #{index + 1}
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="flex-1 flex flex-col p-4 gap-2">
        {/* Title */}
        <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100 line-clamp-2 group-hover:text-adhoc-violet transition-colors">
          {product.title}
        </h3>

        {/* Price */}
        <div className="mt-auto">
          {product.price !== null ? (
            <div className="text-2xl font-bold text-green-600 dark:text-green-500">
              $ {product.price.toLocaleString('es-AR')}
            </div>
          ) : (
            <div className="text-sm text-gray-500 dark:text-gray-400 italic">
              Consultar precio
            </div>
          )}
        </div>

        {/* Snippet (optional) */}
        {product.snippet && (
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">
            {product.snippet}
          </p>
        )}
      </div>

      {/* View on MercadoLibre link */}
      <a
        href={product.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 p-3 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-medium text-sm transition-colors"
      >
        <span>Ver en MercadoLibre</span>
        <ExternalLink className="w-4 h-4" />
      </a>
    </div>
  );
}
