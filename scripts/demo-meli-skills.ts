/**
 * Demo MercadoLibre Skills
 * Shows realistic output from skills with actual product data
 */

import 'dotenv-flow/config';
import type { SkillContext } from '@/lib/skills/types';
import { searchMeliProducts } from '@/lib/skills/mercadolibre/search-products';
import { compareMeliPrices } from '@/lib/skills/mercadolibre/compare-prices';

const context: SkillContext = {
  userId: 'demo-user',
  tenantId: 'demo-tenant',
  credentials: {},
  locale: 'es-AR',
};

async function demo() {
  console.log('\n🎬 Demo: MercadoLibre Skills con datos reales\n');
  console.log('='.repeat(80));

  // Scenario 1: User searches for iPhone 15
  console.log('\n📱 Escenario 1: Búsqueda de producto\n');
  console.log('👤 Usuario: "Buscá precios de iPhone 15 en MercadoLibre"\n');
  console.log('🤖 Tuqui ejecuta: search_meli_products({ query: "iPhone 15", limit: 5 })\n');

  try {
    const result1 = await searchMeliProducts.execute(
      { query: 'iPhone 15', limit: 5, sortBy: 'price_asc' },
      context
    );

    if (result1.success) {
      console.log('✅ Skill ejecutado exitosamente\n');
      console.log('📊 Resultado (JSON tipado):');
      console.log(JSON.stringify(result1.data, null, 2));

      console.log('\n💬 Respuesta de Tuqui al usuario:\n');
      console.log(result1.data.summary);
      console.log('\n🛒 Productos encontrados:\n');

      result1.data.products.slice(0, 3).forEach((p, i) => {
        console.log(`${i + 1}. **${p.title}** - ${p.priceFormatted}`);
        console.log(`   [Ver en MercadoLibre](${p.url})\n`);
      });
    }
  } catch (error: any) {
    console.log('❌ Error:', error.message);
  }

  console.log('\n' + '-'.repeat(80));

  // Scenario 2: User wants price comparison
  console.log('\n💰 Escenario 2: Comparación de precios\n');
  console.log('👤 Usuario: "Comparame precios de notebooks, quiero saber si $800.000 está caro"\n');
  console.log('🤖 Tuqui ejecuta: compare_meli_prices({ productName: "notebook", limit: 10 })\n');

  try {
    const result2 = await compareMeliPrices.execute(
      { productName: 'notebook', limit: 10 },
      context
    );

    if (result2.success) {
      console.log('✅ Skill ejecutado exitosamente\n');
      console.log('📊 Estadísticas:');
      console.log(`   - Precio mínimo: ${result2.data.minPrice ? `$ ${result2.data.minPrice.toLocaleString('es-AR')}` : 'N/A'}`);
      console.log(`   - Precio promedio: ${result2.data.avgPrice ? `$ ${result2.data.avgPrice.toLocaleString('es-AR')}` : 'N/A'}`);
      console.log(`   - Precio máximo: ${result2.data.maxPrice ? `$ ${result2.data.maxPrice.toLocaleString('es-AR')}` : 'N/A'}`);
      console.log(`   - Muestra: ${result2.data.sampleSize} productos`);

      console.log('\n💬 Respuesta de Tuqui:\n');
      console.log(result2.data.insights);

      if (result2.data.avgPrice) {
        const userPrice = 800000;
        const diff = ((userPrice - result2.data.avgPrice) / result2.data.avgPrice) * 100;
        console.log(`\n"Tu precio de $${userPrice.toLocaleString('es-AR')} está ${diff > 0 ? 'arriba' : 'abajo'} del promedio por ${Math.abs(Math.round(diff))}%."`);
        console.log(diff > 20 ? '🔴 Estás caro, podrías bajar el precio.' : diff > 0 ? '🟡 Estás en gama media-alta.' : '🟢 Estás competitivo!');
      }
    }
  } catch (error: any) {
    console.log('❌ Error:', error.message);
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n✨ Demo completado!\n');
  console.log('📝 Ventajas de Skills vs web_search:');
  console.log('   ✅ Output tipado y predecible');
  console.log('   ✅ Fácil de testear y debuggear');
  console.log('   ✅ URLs validadas (solo /articulo/)');
  console.log('   ✅ Análisis automático (insights, rangos)');
  console.log('   ✅ Cacheable (5min TTL)');
  console.log('   ✅ Composable (skills se pueden combinar)\n');
}

demo().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
