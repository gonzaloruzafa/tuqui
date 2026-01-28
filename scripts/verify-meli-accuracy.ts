/**
 * MercadoLibre Price & Link Accuracy Verification
 * 
 * Este script:
 * 1. Ejecuta queries de MeLi contra el agente (via API)
 * 2. Extrae links y precios mencionados en la respuesta
 * 3. Navega a cada link con Puppeteer (para evadir anti-bot)
 * 4. Scrapea el precio real de la página
 * 5. Compara y reporta discrepancias
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load env
config({ path: resolve(process.cwd(), '.env.local') });

// API Configuration
const BASE_URL = process.env.EVAL_BASE_URL || 'http://localhost:3000';
const INTERNAL_KEY = process.env.INTERNAL_TEST_KEY || 'test-key-change-in-prod';
const TENANT_ID = 'de7ef34a-12bd-4fe9-9d02-3d876a9393c2';
const AGENT_SLUG = 'tuqui';

/**
 * Call the agent API
 */
async function callAgent(question: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/api/internal/chat-test`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-key': INTERNAL_KEY,
    },
    body: JSON.stringify({
      tenantId: TENANT_ID,
      agentSlug: AGENT_SLUG,
      messages: [{ role: 'user', content: question }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.response || '';
}

interface ExtractedProduct {
  url: string;
  mentionedPrice: number | null;
  priceContext: string;
}

interface VerificationResult {
  url: string;
  mentionedPrice: number | null;
  actualPrice: number | null;
  actualTitle: string | null;
  isAccessible: boolean;
  priceMatch: 'exact' | 'close' | 'different' | 'no-comparison' | 'error';
  priceDifference: number | null;
  percentDiff: number | null;
  error?: string;
}

interface QueryResult {
  query: string;
  agentResponse: string;
  extractedProducts: ExtractedProduct[];
  verificationResults: VerificationResult[];
  summary: {
    totalLinks: number;
    accessibleLinks: number;
    priceMatches: number;
    priceMismatches: number;
    noComparison: number;
  };
}

const TEST_QUERIES = [
  '¿Cuánto cuesta una turbina LED dental en MercadoLibre?',
  '¿Cuánto sale un termo Stanley 1 litro?',
  'Busca el precio de iPhone 15 Pro Max 256GB nuevo en MercadoLibre',
  '¿Cuál es el rango de precios de la PS5 en MercadoLibre?',
];

const DEFAULT_TENANT_ID = 'de7ef34a-12bd-4fe9-9d02-3d876a9393c2';

/**
 * Extract MercadoLibre URLs and mentioned prices from agent response
 * 
 * The agent typically responds in this format:
 * **1. Product Name**
 * - 💰 **$XX.XXX**
 * - 📦 Vendedor: XXX
 * ...
 * **🔗 Links:**
 * 1. https://articulo.mercadolibre.com.ar/MLA-XXXXX
 * 
 * OR inline format:
 * - 🔗 [Ver en MercadoLibre](https://articulo.mercadolibre.com.ar/MLA-XXXXX)
 */
function extractProductsFromResponse(response: string): ExtractedProduct[] {
  const products: ExtractedProduct[] = [];
  
  // Pattern to find MeLi URLs (both articulo. and www. formats)
  const urlPattern = /https?:\/\/(?:articulo\.|www\.)?mercadolibre\.com\.ar\/(?:MLA-\d+[^\s\)\]"]*|[^\s\)\]"]*\/p\/MLA\d+[^\s\)\]"]*)/gi;
  const urls = response.match(urlPattern) || [];
  
  // Deduplicate URLs
  const uniqueUrls = [...new Set(urls.map(u => u.replace(/[,\.\)\]]+$/, '')))];
  
  // Also extract all prices from the response to build a price map
  const allPrices: number[] = [];
  const priceRegex = /\*?\*?\$\s*([\d.,]+)\*?\*?/g;
  let priceMatch;
  while ((priceMatch = priceRegex.exec(response)) !== null) {
    const priceStr = priceMatch[1].replace(/\./g, '').replace(',', '.');
    const price = parseFloat(priceStr);
    if (!isNaN(price) && price > 1000) { // Reasonable price threshold
      allPrices.push(price);
    }
  }
  
  for (let i = 0; i < uniqueUrls.length; i++) {
    const url = uniqueUrls[i];
    
    // Try to find price mentioned near this URL (look backwards more)
    const urlIndex = response.indexOf(url);
    const contextStart = Math.max(0, urlIndex - 500); // Look further back
    const contextEnd = Math.min(response.length, urlIndex + url.length + 50);
    const context = response.substring(contextStart, contextEnd);
    
    // Extract price from context - look for markdown bold prices like **$69.999**
    let mentionedPrice: number | null = null;
    
    // Try to match price in the immediate context (within the same "block")
    const blockPricePatterns = [
      /\*?\*?\$\s*([\d.,]+)\*?\*?/g,  // **$69.999** or $69.999
      /💰[^$]*\$\s*([\d.,]+)/g,       // 💰 **$69.999**
      /Precio:[^$]*\$\s*([\d.,]+)/gi, // Precio: $69.999
    ];
    
    for (const pattern of blockPricePatterns) {
      pattern.lastIndex = 0; // Reset regex
      const matches = [...context.matchAll(pattern)];
      if (matches.length > 0) {
        // Get the last price before the URL (most likely to be associated)
        const lastMatch = matches[matches.length - 1];
        const priceStr = lastMatch[1].replace(/\./g, '').replace(',', '.');
        const price = parseFloat(priceStr);
        if (!isNaN(price) && price > 1000) {
          mentionedPrice = price;
          break;
        }
      }
    }
    
    // If no price found near URL, try to match by position (nth URL = nth price)
    if (mentionedPrice === null && i < allPrices.length) {
      mentionedPrice = allPrices[i];
    }
    
    products.push({
      url,
      mentionedPrice,
      priceContext: context.trim().substring(0, 300),
    });
  }
  
  return products;
}

/**
 * Scrape actual price from MercadoLibre product page
 */
async function scrapeProductPage(page: Page, url: string): Promise<{
  price: number | null;
  title: string | null;
  error?: string;
}> {
  try {
    // Navigate with timeout
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });
    
    // Wait a bit for dynamic content (use setTimeout as waitForTimeout is deprecated)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Try multiple selectors for price (MeLi changes their DOM frequently)
    const priceSelectors = [
      '.andes-money-amount__fraction',
      '[class*="price"] .andes-money-amount__fraction',
      '.ui-pdp-price__second-line .andes-money-amount__fraction',
      '.ui-pdp-price .andes-money-amount__fraction',
      'meta[itemprop="price"]',
      '[data-testid="price-part"]',
    ];
    
    let price: number | null = null;
    
    for (const selector of priceSelectors) {
      try {
        if (selector.startsWith('meta')) {
          const metaPrice = await page.$eval(selector, el => el.getAttribute('content'));
          if (metaPrice) {
            price = parseFloat(metaPrice);
            break;
          }
        } else {
          const priceText = await page.$eval(selector, el => el.textContent);
          if (priceText) {
            const cleanPrice = priceText.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
            price = parseFloat(cleanPrice);
            if (!isNaN(price)) break;
          }
        }
      } catch {
        // Selector not found, try next
      }
    }
    
    // Get title
    let title: string | null = null;
    const titleSelectors = [
      'h1.ui-pdp-title',
      '.ui-pdp-title',
      'h1[class*="title"]',
      'meta[property="og:title"]',
    ];
    
    for (const selector of titleSelectors) {
      try {
        if (selector.startsWith('meta')) {
          title = await page.$eval(selector, el => el.getAttribute('content'));
        } else {
          title = await page.$eval(selector, el => el.textContent?.trim() || null);
        }
        if (title) break;
      } catch {
        // Selector not found, try next
      }
    }
    
    return { price, title };
  } catch (error) {
    return { 
      price: null, 
      title: null, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Compare prices and determine match level
 */
function comparePrices(mentioned: number | null, actual: number | null): {
  match: 'exact' | 'close' | 'different' | 'no-comparison';
  difference: number | null;
  percentDiff: number | null;
} {
  if (mentioned === null || actual === null) {
    return { match: 'no-comparison', difference: null, percentDiff: null };
  }
  
  const difference = actual - mentioned;
  const percentDiff = (difference / mentioned) * 100;
  
  if (Math.abs(percentDiff) <= 1) {
    return { match: 'exact', difference, percentDiff };
  } else if (Math.abs(percentDiff) <= 10) {
    return { match: 'close', difference, percentDiff };
  } else {
    return { match: 'different', difference, percentDiff };
  }
}

/**
 * Format price for display
 */
function formatPrice(price: number | null): string {
  if (price === null) return 'N/A';
  return `$${price.toLocaleString('es-AR')}`;
}

/**
 * Run verification for a single query
 */
async function verifyQuery(browser: Browser, query: string): Promise<QueryResult> {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`🔍 Query: "${query}"`);
  console.log('─'.repeat(60));
  
  // Get agent response
  console.log('   📤 Calling agent...');
  const agentResponse = await callAgent(query);
  console.log(`   📥 Response length: ${agentResponse.length} chars`);
  
  // Extract products from response
  const extractedProducts = extractProductsFromResponse(agentResponse);
  console.log(`   🔗 Found ${extractedProducts.length} MeLi links`);
  
  if (extractedProducts.length === 0) {
    console.log('   ⚠️  No MercadoLibre links found in response');
    return {
      query,
      agentResponse,
      extractedProducts: [],
      verificationResults: [],
      summary: {
        totalLinks: 0,
        accessibleLinks: 0,
        priceMatches: 0,
        priceMismatches: 0,
        noComparison: 0,
      },
    };
  }
  
  // Verify each product
  const verificationResults: VerificationResult[] = [];
  const page = await browser.newPage();
  
  // Set user agent to avoid detection
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  
  for (const product of extractedProducts) {
    console.log(`\n   🌐 Verifying: ${product.url.substring(0, 60)}...`);
    
    const scrapeResult = await scrapeProductPage(page, product.url);
    
    if (scrapeResult.error) {
      console.log(`      ❌ Error: ${scrapeResult.error}`);
      verificationResults.push({
        url: product.url,
        mentionedPrice: product.mentionedPrice,
        actualPrice: null,
        actualTitle: null,
        isAccessible: false,
        priceMatch: 'error',
        priceDifference: null,
        percentDiff: null,
        error: scrapeResult.error,
      });
      continue;
    }
    
    const comparison = comparePrices(product.mentionedPrice, scrapeResult.price);
    
    console.log(`      📦 Title: ${scrapeResult.title?.substring(0, 50) || 'N/A'}...`);
    console.log(`      💰 Mentioned: ${formatPrice(product.mentionedPrice)}`);
    console.log(`      💵 Actual: ${formatPrice(scrapeResult.price)}`);
    
    if (comparison.match === 'exact') {
      console.log(`      ✅ Price match: EXACT`);
    } else if (comparison.match === 'close') {
      console.log(`      🟡 Price match: CLOSE (${comparison.percentDiff?.toFixed(1)}% diff)`);
    } else if (comparison.match === 'different') {
      console.log(`      ❌ Price match: DIFFERENT (${comparison.percentDiff?.toFixed(1)}% diff)`);
    } else {
      console.log(`      ⚪ Price comparison: N/A`);
    }
    
    verificationResults.push({
      url: product.url,
      mentionedPrice: product.mentionedPrice,
      actualPrice: scrapeResult.price,
      actualTitle: scrapeResult.title,
      isAccessible: true,
      priceMatch: comparison.match,
      priceDifference: comparison.difference,
      percentDiff: comparison.percentDiff,
    });
  }
  
  await page.close();
  
  // Calculate summary
  const summary = {
    totalLinks: verificationResults.length,
    accessibleLinks: verificationResults.filter(r => r.isAccessible).length,
    priceMatches: verificationResults.filter(r => r.priceMatch === 'exact' || r.priceMatch === 'close').length,
    priceMismatches: verificationResults.filter(r => r.priceMatch === 'different').length,
    noComparison: verificationResults.filter(r => r.priceMatch === 'no-comparison' || r.priceMatch === 'error').length,
  };
  
  return {
    query,
    agentResponse,
    extractedProducts,
    verificationResults,
    summary,
  };
}

/**
 * Main verification loop
 */
async function main() {
  console.log('═'.repeat(60));
  console.log('🔬 MERCADOLIBRE ACCURACY VERIFICATION');
  console.log('═'.repeat(60));
  console.log(`\nVerifying ${TEST_QUERIES.length} queries with real browser scraping...\n`);
  
  // Launch browser
  console.log('🚀 Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
    ],
  });
  
  const results: QueryResult[] = [];
  
  try {
    for (const query of TEST_QUERIES) {
      const result = await verifyQuery(browser, query);
      results.push(result);
    }
  } finally {
    await browser.close();
  }
  
  // Print final summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 FINAL VERIFICATION SUMMARY');
  console.log('═'.repeat(60));
  
  let totalLinks = 0;
  let totalAccessible = 0;
  let totalMatches = 0;
  let totalMismatches = 0;
  let totalNoComparison = 0;
  
  for (const result of results) {
    console.log(`\n📝 "${result.query.substring(0, 40)}..."`);
    console.log(`   Links: ${result.summary.totalLinks}`);
    console.log(`   Accessible: ${result.summary.accessibleLinks}/${result.summary.totalLinks}`);
    console.log(`   Price matches: ${result.summary.priceMatches}`);
    console.log(`   Price mismatches: ${result.summary.priceMismatches}`);
    
    totalLinks += result.summary.totalLinks;
    totalAccessible += result.summary.accessibleLinks;
    totalMatches += result.summary.priceMatches;
    totalMismatches += result.summary.priceMismatches;
    totalNoComparison += result.summary.noComparison;
  }
  
  console.log('\n' + '─'.repeat(60));
  console.log('📈 TOTALS:');
  console.log(`   Total links verified: ${totalLinks}`);
  console.log(`   Accessible: ${totalAccessible}/${totalLinks} (${((totalAccessible/totalLinks)*100).toFixed(1)}%)`);
  console.log(`   Price matches (exact/close): ${totalMatches}`);
  console.log(`   Price mismatches: ${totalMismatches}`);
  console.log(`   No comparison possible: ${totalNoComparison}`);
  
  const accuracyRate = totalLinks > 0 ? ((totalAccessible / totalLinks) * 100).toFixed(1) : '0';
  const priceAccuracy = (totalMatches + totalMismatches) > 0 
    ? ((totalMatches / (totalMatches + totalMismatches)) * 100).toFixed(1) 
    : 'N/A';
  
  console.log('\n' + '═'.repeat(60));
  console.log(`🎯 LINK ACCESSIBILITY: ${accuracyRate}%`);
  console.log(`💰 PRICE ACCURACY: ${priceAccuracy}%`);
  console.log('═'.repeat(60));
  
  // Save detailed report
  const reportPath = `./meli-accuracy-report-${Date.now()}.json`;
  const fs = await import('fs');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      totalLinks,
      totalAccessible,
      totalMatches,
      totalMismatches,
      totalNoComparison,
      linkAccessibilityRate: parseFloat(accuracyRate),
      priceAccuracyRate: priceAccuracy === 'N/A' ? null : parseFloat(priceAccuracy),
    },
    results,
  }, null, 2));
  
  console.log(`\n📄 Detailed report: ${reportPath}`);
  
  // Return exit code based on results
  if (totalMismatches > 0) {
    console.log('\n⚠️  Found price discrepancies - review report for details');
    process.exit(1);
  }
}

main().catch(console.error);
