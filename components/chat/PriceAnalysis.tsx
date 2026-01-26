/**
 * PriceAnalysis Component
 *
 * Displays price comparison statistics with visual chart
 */

'use client';

import { TrendingDown, TrendingUp, Minus } from 'lucide-react';

interface PriceStats {
  min: number | null;
  max: number | null;
  avg: number | null;
  median?: number | null;
}

interface PriceAnalysisProps {
  productName: string;
  stats: PriceStats;
  sampleSize: number;
  insights?: string;
  priceRanges?: {
    low: { min: number; max: number; label: string };
    medium: { min: number; max: number; label: string };
    high: { min: number; max: number; label: string };
  } | null;
}

export function PriceAnalysis({ productName, stats, sampleSize, insights, priceRanges }: PriceAnalysisProps) {
  if (!stats.min || !stats.max || !stats.avg) {
    return (
      <div className="my-6 p-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          ⚠️ No se encontraron suficientes precios para analizar &quot;{productName}&quot;
        </p>
      </div>
    );
  }

  const formatPrice = (price: number) => `$ ${price.toLocaleString('es-AR')}`;

  // Calculate range percentage
  const range = stats.max - stats.min;
  const volatility = Math.round((range / stats.avg) * 100);

  return (
    <div className="my-6 w-full">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <span className="text-2xl">📊</span>
          Análisis de Precios: {productName}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Basado en {sampleSize} producto{sampleSize !== 1 ? 's' : ''} encontrados
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {/* Min Price */}
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400 text-sm font-medium mb-1">
            <TrendingDown className="w-4 h-4" />
            Mínimo
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {formatPrice(stats.min)}
          </div>
        </div>

        {/* Avg Price */}
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 text-sm font-medium mb-1">
            <Minus className="w-4 h-4" />
            Promedio
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {formatPrice(stats.avg)}
          </div>
        </div>

        {/* Median Price */}
        {stats.median && (
          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
            <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400 text-sm font-medium mb-1">
              <Minus className="w-4 h-4" />
              Mediana
            </div>
            <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {formatPrice(stats.median)}
            </div>
          </div>
        )}

        {/* Max Price */}
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400 text-sm font-medium mb-1">
            <TrendingUp className="w-4 h-4" />
            Máximo
          </div>
          <div className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {formatPrice(stats.max)}
          </div>
        </div>
      </div>

      {/* Visual Range Bar */}
      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Rango de Precios</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Volatilidad: {volatility}%
          </span>
        </div>

        <div className="relative h-8 bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-full overflow-hidden">
          {/* Average marker */}
          {stats.avg && (
            <div
              className="absolute top-0 bottom-0 w-1 bg-blue-700 shadow-lg"
              style={{
                left: `${((stats.avg - stats.min) / range) * 100}%`,
              }}
              title={`Promedio: ${formatPrice(stats.avg)}`}
            >
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-blue-700 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                Promedio
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between mt-2 text-xs text-gray-600 dark:text-gray-400">
          <span>{formatPrice(stats.min)}</span>
          <span>{formatPrice(stats.max)}</span>
        </div>
      </div>

      {/* Price Ranges (if available) */}
      {priceRanges && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">
              Gama Baja
            </div>
            <div className="text-sm text-gray-900 dark:text-gray-100">
              {formatPrice(priceRanges.low.min)} - {formatPrice(priceRanges.low.max)}
            </div>
          </div>

          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="text-xs font-medium text-yellow-700 dark:text-yellow-400 mb-1">
              Gama Media
            </div>
            <div className="text-sm text-gray-900 dark:text-gray-100">
              {formatPrice(priceRanges.medium.min)} - {formatPrice(priceRanges.medium.max)}
            </div>
          </div>

          <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="text-xs font-medium text-red-700 dark:text-red-400 mb-1">
              Gama Alta
            </div>
            <div className="text-sm text-gray-900 dark:text-gray-100">
              {formatPrice(priceRanges.high.min)} - {formatPrice(priceRanges.high.max)}
            </div>
          </div>
        </div>
      )}

      {/* Insights */}
      {insights && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start gap-2">
            <span className="text-xl">💡</span>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {insights}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
