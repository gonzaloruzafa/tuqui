/**
 * MeliSkillsRenderer Component
 *
 * Detects and renders MercadoLibre Skills output with rich UI components
 * Parses skill results from assistant messages and displays:
 * - ProductGrid for search_meli_products
 * - PriceAnalysis for compare_meli_prices or get_meli_price_statistics
 */

'use client';

import { ProductGrid, type Product } from './ProductGrid';
import { PriceAnalysis } from './PriceAnalysis';

interface MeliSkillsRendererProps {
  content: string;
}

/**
 * Attempts to extract JSON from a string that may contain text + JSON
 */
function extractJSON(text: string): any | null {
  try {
    // Try to parse the whole string first
    return JSON.parse(text);
  } catch {
    // Look for JSON blocks in the text
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch {
        return null;
      }
    }

    // Look for raw JSON objects
    const objectMatch = text.match(/\{[\s\S]*"products"[\s\S]*\}/);
    if (objectMatch) {
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        return null;
      }
    }

    return null;
  }
}

/**
 * Detects if content contains MercadoLibre skill results
 */
function detectSkillType(content: string): 'products' | 'price_analysis' | 'price_stats' | null {
  const lower = content.toLowerCase();

  // Check for products array
  if (content.includes('"products"') && content.includes('"url"')) {
    return 'products';
  }

  // Check for price comparison
  if (
    (content.includes('"minPrice"') || content.includes('"avgPrice"')) &&
    content.includes('"insights"')
  ) {
    return 'price_analysis';
  }

  // Check for price statistics
  if (content.includes('"statistics"') && content.includes('"priceDistribution"')) {
    return 'price_stats';
  }

  return null;
}

export function MeliSkillsRenderer({ content }: MeliSkillsRendererProps) {
  const skillType = detectSkillType(content);

  if (!skillType) {
    // Not a MeLi skill result, return null so normal rendering happens
    return null;
  }

  const data = extractJSON(content);
  if (!data) {
    // Failed to parse JSON, return null
    return null;
  }

  // Render ProductGrid for search results
  if (skillType === 'products' && data.products && Array.isArray(data.products)) {
    return (
      <ProductGrid
        products={data.products as Product[]}
        title={`Productos de "${data.query || 'búsqueda'}"`}
        showIndexes={true}
      />
    );
  }

  // Render PriceAnalysis for price comparison
  if (skillType === 'price_analysis') {
    return (
      <PriceAnalysis
        productName={data.productName || 'producto'}
        stats={{
          min: data.minPrice,
          max: data.maxPrice,
          avg: data.avgPrice,
          median: data.medianPrice,
        }}
        sampleSize={data.sampleSize || 0}
        insights={data.insights}
        priceRanges={null}
      />
    );
  }

  // Render PriceAnalysis for price statistics
  if (skillType === 'price_stats' && data.statistics) {
    return (
      <PriceAnalysis
        productName={data.productType || 'producto'}
        stats={data.statistics}
        sampleSize={data.sampleSize || 0}
        insights={data.analysis}
        priceRanges={data.priceRanges || null}
      />
    );
  }

  return null;
}
