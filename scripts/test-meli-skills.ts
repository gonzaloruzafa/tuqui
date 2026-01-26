/**
 * Test MercadoLibre Skills
 *
 * Validates the 3 new MercadoLibre skills work correctly:
 * - search_meli_products
 * - compare_meli_prices
 * - get_meli_price_statistics
 */

import 'dotenv-flow/config';
import type { SkillContext } from '@/lib/skills/types';

// Import skills
import { searchMeliProducts } from '@/lib/skills/mercadolibre/search-products';
import { compareMeliPrices } from '@/lib/skills/mercadolibre/compare-prices';
import { getMeliPriceStatistics } from '@/lib/skills/mercadolibre/get-price-statistics';

const context: SkillContext = {
  userId: 'test-user',
  tenantId: 'test-tenant',
  credentials: {}, // MercadoLibre skills don't need credentials (use public search)
  locale: 'es-AR',
};

async function testMeliSkills() {
  console.log('\n🧪 Testing MercadoLibre Skills\n');
  console.log('='.repeat(80));

  // Test 1: search_meli_products
  console.log('\n--- Test 1: search_meli_products ---\n');
  console.log('👤 User: "Buscá precios de iPhone 15"');
  console.log('🤖 Executing: search_meli_products...\n');

  try {
    const result1 = await searchMeliProducts.execute(
      {
        query: 'iPhone 15',
        limit: 5,
        sortBy: 'price_asc',
      },
      context
    );

    if (result1.success) {
      console.log('✅ Skill executed successfully');
      console.log(`📊 Found ${result1.data.products.length} products`);
      console.log(`💬 Summary: ${result1.data.summary}\n`);

      console.log('Top 3 products:');
      result1.data.products.slice(0, 3).forEach((p, i) => {
        console.log(`${i + 1}. ${p.title}`);
        console.log(`   Precio: ${p.priceFormatted}`);
        console.log(`   URL: ${p.url}\n`);
      });
    } else {
      console.log('❌ Skill failed:', result1.error.message);
    }
  } catch (error: any) {
    console.log('❌ Exception:', error.message);
  }

  console.log('\n' + '-'.repeat(80));

  // Test 2: compare_meli_prices
  console.log('\n--- Test 2: compare_meli_prices ---\n');
  console.log('👤 User: "Comparar precios de notebooks"');
  console.log('🤖 Executing: compare_meli_prices...\n');

  try {
    const result2 = await compareMeliPrices.execute(
      {
        productName: 'notebook',
        limit: 10,
      },
      context
    );

    if (result2.success) {
      console.log('✅ Skill executed successfully');
      console.log(`📊 Analyzed ${result2.data.sampleSize} products`);
      console.log(`💰 Price range: ${result2.data.priceRange}`);
      console.log(`📈 Average: ${result2.data.avgPrice ? `$ ${result2.data.avgPrice.toLocaleString('es-AR')}` : 'N/A'}`);
      console.log(`📉 Min: ${result2.data.minPrice ? `$ ${result2.data.minPrice.toLocaleString('es-AR')}` : 'N/A'}`);
      console.log(`📊 Max: ${result2.data.maxPrice ? `$ ${result2.data.maxPrice.toLocaleString('es-AR')}` : 'N/A'}`);
      console.log(`\n💡 Insights:\n${result2.data.insights}\n`);
    } else {
      console.log('❌ Skill failed:', result2.error.message);
    }
  } catch (error: any) {
    console.log('❌ Exception:', error.message);
  }

  console.log('\n' + '-'.repeat(80));

  // Test 3: get_meli_price_statistics
  console.log('\n--- Test 3: get_meli_price_statistics ---\n');
  console.log('👤 User: "Análisis de mercado de aires acondicionados"');
  console.log('🤖 Executing: get_meli_price_statistics...\n');

  try {
    const result3 = await getMeliPriceStatistics.execute(
      {
        productType: 'aire acondicionado',
        sampleSize: 15,
      },
      context
    );

    if (result3.success) {
      console.log('✅ Skill executed successfully');
      console.log(`📊 Sample size: ${result3.data.sampleSize} products`);
      console.log(`📈 Statistics:`);
      console.log(`   Min: ${result3.data.statistics.min ? `$ ${result3.data.statistics.min.toLocaleString('es-AR')}` : 'N/A'}`);
      console.log(`   Avg: ${result3.data.statistics.avg ? `$ ${result3.data.statistics.avg.toLocaleString('es-AR')}` : 'N/A'}`);
      console.log(`   Median: ${result3.data.statistics.median ? `$ ${result3.data.statistics.median.toLocaleString('es-AR')}` : 'N/A'}`);
      console.log(`   Max: ${result3.data.statistics.max ? `$ ${result3.data.statistics.max.toLocaleString('es-AR')}` : 'N/A'}`);
      console.log(`\n📊 Distribution: ${result3.data.priceDistribution}`);

      if (result3.data.priceRanges) {
        console.log(`\n💰 Price Ranges:`);
        console.log(`   ${result3.data.priceRanges.low.label}`);
        console.log(`   ${result3.data.priceRanges.medium.label}`);
        console.log(`   ${result3.data.priceRanges.high.label}`);
      }

      console.log(`\n💡 Analysis:\n${result3.data.analysis}\n`);
    } else {
      console.log('❌ Skill failed:', result3.error.message);
    }
  } catch (error: any) {
    console.log('❌ Exception:', error.message);
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n✅ Test completed!\n');
}

testMeliSkills().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
