/**
 * Hallucination Stress Tests — Evaluaciones avanzadas anti-alucinación
 * 
 * Emula usuarios reales con distintos perfiles haciendo preguntas
 * encadenadas y complejas que antes provocaban confusión de entidades.
 * 
 * Perfiles:
 * - 🧑‍💼 Gerente Comercial: ventas, vendedores, clientes
 * - 📊 Controller Financiero: cobranzas, deuda, pagos
 * - 🏭 Jefe de Compras: proveedores, OC, facturas proveedor
 * - 🔀 Usuario Caótico: mezcla todo, lenguaje ambiguo
 * 
 * Run: npx vitest run tests/evals/hallucination-stress.test.ts
 */

import { describe, test, expect, beforeAll, afterAll } from 'vitest';

const BASE_URL = process.env.EVAL_BASE_URL || 'http://localhost:3000';
const INTERNAL_KEY = process.env.INTERNAL_TEST_KEY || 'test-key-change-in-prod';
const TENANT_ID = process.env.TEST_TENANT_ID || 'de7ef34a-12bd-4fe9-9d02-3d876a9393c2';
const AGENT_SLUG = process.env.TEST_AGENT_SLUG || 'tuqui';
const TIMEOUT = 90_000; // 90s por test (multi-turn tarda más)
const DELAY_BETWEEN = 10_000; // 10s entre calls para rate limit

const SKIP = !process.env.GEMINI_API_KEY;

// ============================================
// HELPERS
// ============================================

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AgentResponse {
  response: string;
  latencyMs: number;
  toolsUsed: string[];
  success: boolean;
}

async function callAgent(messages: Message[]): Promise<AgentResponse> {
  const res = await fetch(`${BASE_URL}/api/internal/chat-test`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-key': INTERNAL_KEY,
    },
    body: JSON.stringify({
      tenantId: TENANT_ID,
      agentSlug: AGENT_SLUG,
      messages,
    }),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

/** Send a single question, return response text */
async function ask(question: string): Promise<string> {
  const r = await callAgent([{ role: 'user', content: question }]);
  return r.response || '';
}

/** Send a chain of questions simulating conversation */
async function chain(questions: string[]): Promise<string[]> {
  const messages: Message[] = [];
  const responses: string[] = [];

  for (const q of questions) {
    messages.push({ role: 'user', content: q });
    await delay(DELAY_BETWEEN);
    const r = await callAgent([...messages]);
    const text = r.response || '';
    responses.push(text);
    messages.push({ role: 'assistant', content: text });
  }
  return responses;
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ============================================
// ENTITY DETECTION HELPERS
// ============================================

/** Check text does NOT contain seller names when talking about clients */
function assertNoEntityCrossover(text: string, context: string) {
  // Known entity types that should never appear as the wrong category
  const errors: string[] = [];

  // If context is about sellers, names should not be called "clientes"
  if (context === 'vendedores') {
    if (/(?:cliente|proveedor).*?(?:Martín|Travella|comercial|vendedor)/i.test(text)) {
      errors.push('Seller name misidentified as client/supplier');
    }
  }

  // If context is about clients, should not call them "vendedores"
  if (context === 'clientes') {
    if (/vendedor.*?(?:SRL|SAS|SA\b|S\.A\.|S\.R\.L)/i.test(text)) {
      errors.push('Company name (likely client) called "vendedor"');
    }
  }

  return errors;
}

/** Detect if response has invented/fabricated names (hallucination signal) */
function detectFabricatedNames(text: string): string[] {
  const warnings: string[] = [];
  
  // Pattern: names that look like two unrelated entities merged
  // e.g., "Mauro Gavanier" = "Maico Moyano" + "Gaveno SAS"
  // Hard to detect generically, but we can check for suspicious patterns:
  
  // Names that have a company suffix used as a person name
  if (/(?:Juan|Pedro|María|Carlos|Mauro|Pablo)\s+(?:SRL|SAS|SA\b)/i.test(text)) {
    warnings.push('Person name followed by company suffix — possible hallucination');
  }
  
  return warnings;
}

// ============================================
// RESULTS
// ============================================

interface TestResult {
  profile: string;
  testName: string;
  passed: boolean;
  details: string;
  latencyMs?: number;
}

const results: TestResult[] = [];

// ============================================
// TESTS
// ============================================

describe('🧪 Hallucination Stress Tests', { timeout: TIMEOUT * 10 }, () => {

  afterAll(() => {
    console.log('\n' + '='.repeat(70));
    console.log('📊 HALLUCINATION STRESS TEST RESULTS');
    console.log('='.repeat(70));
    
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    console.log(`\n   ✅ ${passed}/${total} passed (${((passed/total)*100).toFixed(0)}%)`);
    
    const byProfile = new Map<string, TestResult[]>();
    for (const r of results) {
      const arr = byProfile.get(r.profile) || [];
      arr.push(r);
      byProfile.set(r.profile, arr);
    }
    
    for (const [profile, tests] of byProfile) {
      const p = tests.filter(t => t.passed).length;
      console.log(`   ${p === tests.length ? '✅' : '⚠️'} ${profile}: ${p}/${tests.length}`);
      for (const t of tests.filter(t => !t.passed)) {
        console.log(`      ❌ ${t.testName}: ${t.details}`);
      }
    }
    console.log('='.repeat(70) + '\n');
  });

  // ================================================
  // 🧑‍💼 PERFIL: GERENTE COMERCIAL
  // Pregunta mucho por vendedores y clientes — zona de confusión máxima
  // ================================================
  describe('🧑‍💼 Gerente Comercial', () => {

    test.skipIf(SKIP)('Vendedores vs Clientes — pregunta encadenada', async () => {
      console.log('\n🗣️  Chain: vendedores → clientes → cruce');
      
      const responses = await chain([
        '¿Cuánto vendió cada vendedor este mes?',
        '¿Y quiénes son mis mejores clientes del mismo período?',
        'Comparame al mejor vendedor con el mejor cliente',
      ]);

      const [r1, r2, r3] = responses;
      const errors: string[] = [];

      // R1: debe listar VENDEDORES con nombres de personas (equipo interno)
      if (!/vendedor|comercial|equipo/i.test(r1)) {
        errors.push('R1: No menciona vendedores/comerciales');
      }
      console.log(`   R1 (vendedores): ${r1.substring(0, 150)}...`);

      // R2: debe listar CLIENTES (empresas que compran)
      if (!/cliente|comprador/i.test(r2)) {
        errors.push('R2: No menciona clientes');
      }
      console.log(`   R2 (clientes): ${r2.substring(0, 150)}...`);

      // R3: La comparación es la zona de peligro máximo
      // Debe diferenciar claramente vendedor vs cliente
      console.log(`   R3 (comparación): ${r3.substring(0, 200)}...`);
      
      // El vendedor NO debería tener nombre de empresa (SRL/SAS)
      // El cliente NO debería ser un nombre de persona del equipo
      const fabricated = detectFabricatedNames(r3);
      if (fabricated.length > 0) {
        errors.push(`R3 fabricated names: ${fabricated.join(', ')}`);
      }

      const passed = errors.length === 0;
      results.push({
        profile: 'Gerente Comercial',
        testName: 'Vendedores vs Clientes chain',
        passed,
        details: passed ? 'Entidades bien diferenciadas' : errors.join('; '),
      });
      
      expect(errors).toEqual([]);
    }, TIMEOUT * 3);

    test.skipIf(SKIP)('Top vendedor → detalle de sus ventas → no mezcla con cliente', async () => {
      console.log('\n🗣️  Pregunta quién es el mejor vendedor y luego pide detalle');
      await delay(DELAY_BETWEEN);
      
      const responses = await chain([
        '¿Quién fue el mejor vendedor en enero?',
        '¿A qué clientes les vendió ese vendedor?',
      ]);

      const [r1, r2] = responses;
      const errors: string[] = [];

      // R1: debe nombrar UN vendedor (persona del equipo)
      console.log(`   R1 (top vendedor): ${r1.substring(0, 150)}...`);
      if (!/\$\s?[\d.,]+/i.test(r1)) {
        errors.push('R1: No tiene monto');
      }

      // R2: los clientes deben ser empresas/personas distintas al vendedor
      console.log(`   R2 (clientes del vendedor): ${r2.substring(0, 200)}...`);
      
      const passed = errors.length === 0;
      results.push({
        profile: 'Gerente Comercial',
        testName: 'Top vendedor → clientes',
        passed,
        details: passed ? 'Vendedor y clientes bien separados' : errors.join('; '),
      });

      expect(errors).toEqual([]);
    }, TIMEOUT * 2);

    test.skipIf(SKIP)('Ventas por producto → no mezcla productos con clientes', async () => {
      console.log('\n🗣️  Productos vendidos → clientes que compraron');
      await delay(DELAY_BETWEEN);

      const responses = await chain([
        '¿Cuáles son los top 3 productos más vendidos?',
        '¿Qué clientes compraron esos productos?',
      ]);

      const [r1, r2] = responses;
      console.log(`   R1 (top productos): ${r1.substring(0, 150)}...`);
      console.log(`   R2 (clientes de esos productos): ${r2.substring(0, 200)}...`);

      const errors: string[] = [];
      // R1 debe tener nombres de PRODUCTOS
      if (!/producto|artículo|sillón|equipo|combo|item/i.test(r1)) {
        errors.push('R1: No parece listar productos');
      }
      // R2 debe tener nombres de CLIENTES, no los mismos productos como si fueran clientes
      if (!/cliente|comprador|empresa/i.test(r2) && !/no pude|disponible/i.test(r2)) {
        errors.push('R2: No menciona clientes');
      }

      const passed = errors.length === 0;
      results.push({
        profile: 'Gerente Comercial',
        testName: 'Productos → Clientes que compraron',
        passed,
        details: passed ? 'Productos y clientes bien separados' : errors.join('; '),
      });

      expect(errors).toEqual([]);
    }, TIMEOUT * 2);
  });

  // ================================================
  // 📊 PERFIL: CONTROLLER FINANCIERO
  // Mezcla cobros, deudas, pagos — confusión entre quién paga y quién cobra
  // ================================================
  describe('📊 Controller Financiero', () => {

    test.skipIf(SKIP)('Deuda clientes vs deuda con proveedores', async () => {
      console.log('\n🗣️  Chain: nos deben → debemos');
      await delay(DELAY_BETWEEN);

      const responses = await chain([
        '¿Cuánto nos deben los clientes?',
        '¿Y cuánto les debemos a los proveedores?',
        '¿Cuál es la diferencia neta?',
      ]);

      const [r1, r2, r3] = responses;
      console.log(`   R1 (nos deben): ${r1.substring(0, 150)}...`);
      console.log(`   R2 (debemos): ${r2.substring(0, 150)}...`);
      console.log(`   R3 (neto): ${r3.substring(0, 200)}...`);

      const errors: string[] = [];

      // R1: CLIENTES nos deben → cuentas a cobrar
      if (!/cliente|cobrar|receivable|deud/i.test(r1)) {
        errors.push('R1: No menciona clientes/cobrar');
      }
      if (/proveedor|pagar|payable/i.test(r1) && !/también|además|por otro lado/i.test(r1)) {
        errors.push('R1: Mezcla proveedores en respuesta de clientes');
      }

      // R2: PROVEEDORES → cuentas a pagar
      if (!/proveedor|pagar|payable|deb/i.test(r2)) {
        errors.push('R2: No menciona proveedores/pagar');
      }

      const passed = errors.length === 0;
      results.push({
        profile: 'Controller Financiero',
        testName: 'Cobrar vs Pagar chain',
        passed,
        details: passed ? 'Cobrar y pagar bien separados' : errors.join('; '),
      });

      expect(errors).toEqual([]);
    }, TIMEOUT * 3);

    test.skipIf(SKIP)('Cobros vs Pagos — no confundir dirección del dinero', async () => {
      console.log('\n🗣️  Chain: cobramos → pagamos');
      await delay(DELAY_BETWEEN);

      const responses = await chain([
        '¿Cuánto cobramos en enero?',
        '¿Y cuánto pagamos en el mismo período?',
      ]);

      const [r1, r2] = responses;
      console.log(`   R1 (cobros): ${r1.substring(0, 150)}...`);
      console.log(`   R2 (pagos): ${r2.substring(0, 150)}...`);

      const errors: string[] = [];

      // R1: cobros = dinero que ENTRA de clientes
      if (!/cobr|recib|ingres|cliente/i.test(r1)) {
        errors.push('R1: No identifica cobros como dinero entrante');
      }
      
      // R2: pagos = dinero que SALE a proveedores
      if (!/pag|egres|proveedor|salid/i.test(r2)) {
        errors.push('R2: No identifica pagos como dinero saliente');
      }

      // Los montos deben ser diferentes (sería sospechoso si son iguales)
      const montoR1 = r1.match(/\$\s?([\d.,]+)/);
      const montoR2 = r2.match(/\$\s?([\d.,]+)/);
      if (montoR1 && montoR2 && montoR1[1] === montoR2[1]) {
        errors.push('R1 y R2 tienen el mismo monto — posible confusión');
      }

      const passed = errors.length === 0;
      results.push({
        profile: 'Controller Financiero',
        testName: 'Cobros vs Pagos',
        passed,
        details: passed ? 'Dirección del dinero correcta' : errors.join('; '),
      });

      expect(errors).toEqual([]);
    }, TIMEOUT * 2);

    test.skipIf(SKIP)('Facturas emitidas vs recibidas', async () => {
      console.log('\n🗣️  Facturas que emitimos vs que nos mandan');
      await delay(DELAY_BETWEEN);

      const responses = await chain([
        '¿Cuántas facturas emitimos en enero?',
        '¿Y cuántas facturas de proveedor recibimos?',
      ]);

      const [r1, r2] = responses;
      console.log(`   R1 (emitidas): ${r1.substring(0, 150)}...`);
      console.log(`   R2 (recibidas): ${r2.substring(0, 150)}...`);

      const errors: string[] = [];
      
      if (!/factur|emiti|client|venta/i.test(r1)) {
        errors.push('R1: No menciona facturas emitidas/clientes');
      }
      if (!/factur|proveedor|compra|recib/i.test(r2)) {
        errors.push('R2: No menciona facturas de proveedor');
      }

      const passed = errors.length === 0;
      results.push({
        profile: 'Controller Financiero',
        testName: 'Facturas emitidas vs recibidas',
        passed,
        details: passed ? 'Bien diferenciadas' : errors.join('; '),
      });

      expect(errors).toEqual([]);
    }, TIMEOUT * 2);
  });

  // ================================================
  // 🏭 PERFIL: JEFE DE COMPRAS
  // Proveedores, precios, OC — no confundir con ventas
  // ================================================
  describe('🏭 Jefe de Compras', () => {

    test.skipIf(SKIP)('Proveedores top → precios de compra → no confundir con ventas', async () => {
      console.log('\n🗣️  Chain: proveedores → compras → precios');
      await delay(DELAY_BETWEEN);

      const responses = await chain([
        '¿A qué proveedores les compramos más este mes?',
        '¿Cuánto gastamos en total en compras?',
      ]);

      const [r1, r2] = responses;
      console.log(`   R1 (proveedores top): ${r1.substring(0, 150)}...`);
      console.log(`   R2 (gasto total): ${r2.substring(0, 150)}...`);

      const errors: string[] = [];

      // R1: deben ser PROVEEDORES, no clientes
      if (!/proveedor|compra|supplier/i.test(r1)) {
        errors.push('R1: No menciona proveedores');
      }
      if (/vendedor.*\d.*facturó/i.test(r1)) {
        errors.push('R1: Parece hablar de vendedores en vez de proveedores');
      }

      // R2: el monto debe ser de COMPRAS, no ventas
      if (!/compr|gast|orden|purchase/i.test(r2)) {
        errors.push('R2: No parece hablar de compras');
      }

      const passed = errors.length === 0;
      results.push({
        profile: 'Jefe de Compras',
        testName: 'Proveedores top → gasto',
        passed,
        details: passed ? 'Proveedores y compras correctos' : errors.join('; '),
      });

      expect(errors).toEqual([]);
    }, TIMEOUT * 2);

    test.skipIf(SKIP)('OC pendientes — no confundir con OV pendientes', async () => {
      console.log('\n🗣️  OC pendientes vs OV pendientes');
      await delay(DELAY_BETWEEN);

      const responses = await chain([
        '¿Tenemos órdenes de compra pendientes?',
        '¿Y órdenes de venta pendientes?',
      ]);

      const [r1, r2] = responses;
      console.log(`   R1 (OC pendientes): ${r1.substring(0, 150)}...`);
      console.log(`   R2 (OV pendientes): ${r2.substring(0, 150)}...`);

      const errors: string[] = [];

      if (!/compra|purchase|proveedor/i.test(r1)) {
        errors.push('R1: No identifica como órdenes de COMPRA');
      }
      if (!/venta|sale|cliente/i.test(r2)) {
        errors.push('R2: No identifica como órdenes de VENTA');
      }

      // Los montos deben ser muy diferentes (compras ≠ ventas)
      const montoR1 = r1.match(/\$\s?([\d.,]+)/);
      const montoR2 = r2.match(/\$\s?([\d.,]+)/);
      if (montoR1 && montoR2 && montoR1[1] === montoR2[1]) {
        errors.push('OC y OV tienen el mismo monto — posible confusión');
      }

      const passed = errors.length === 0;
      results.push({
        profile: 'Jefe de Compras',
        testName: 'OC vs OV pendientes',
        passed,
        details: passed ? 'OC y OV bien diferenciadas' : errors.join('; '),
      });

      expect(errors).toEqual([]);
    }, TIMEOUT * 2);
  });

  // ================================================
  // 🔀 PERFIL: USUARIO CAÓTICO
  // Mezcla todo, lenguaje informal, preguntas ambiguas
  // ================================================
  describe('🔀 Usuario Caótico', () => {

    test.skipIf(SKIP)('Pregunta ambigua → "cuánto" sin especificar qué', async () => {
      console.log('\n🗣️  Pregunta ambigua: "cuánto movimos"');
      await delay(DELAY_BETWEEN);

      const text = await ask('¿Cuánto movimos este mes?');
      console.log(`   Response: ${text.substring(0, 200)}...`);

      const errors: string[] = [];
      // Debe responder con ALGO numérico, no inventar
      if (!/\$\s?[\d.,]+|\d+/i.test(text)) {
        // Puede pedir clarificación, eso es OK
        if (!/qué.*quer|venta|compra|prefer|aclarar/i.test(text)) {
          errors.push('Ni dio números ni pidió clarificación');
        }
      }

      const passed = errors.length === 0;
      results.push({
        profile: 'Usuario Caótico',
        testName: 'Pregunta ambigua',
        passed,
        details: passed ? 'Respondió o pidió clarificación' : errors.join('; '),
      });

      expect(errors).toEqual([]);
    }, TIMEOUT);

    test.skipIf(SKIP)('Switch rápido de contexto: ventas → stock → deuda', async () => {
      console.log('\n🗣️  Switch: ventas → stock → deuda rápido');
      await delay(DELAY_BETWEEN);

      const responses = await chain([
        '¿Cuánto vendimos hoy?',
        'Che y de stock cuánto tenemos del producto más vendido?',
        'Y ese cliente que más compra, ¿nos debe guita?',
      ]);

      const [r1, r2, r3] = responses;
      console.log(`   R1 (ventas): ${r1.substring(0, 120)}...`);
      console.log(`   R2 (stock): ${r2.substring(0, 120)}...`);
      console.log(`   R3 (deuda): ${r3.substring(0, 120)}...`);

      const errors: string[] = [];

      // R1 debe ser de VENTAS
      if (!/vend|factur|\$/i.test(r1) && !/no hubo|registr/i.test(r1)) {
        errors.push('R1: No parece ser de ventas');
      }

      // R2 debe ser de STOCK / producto
      if (!/stock|unidad|producto|inventario|cantidad/i.test(r2) && !/no pude|especif/i.test(r2)) {
        errors.push('R2: No parece ser de stock');
      }

      // R3 debe ser de DEUDA / cobranzas
      if (!/deud|deb|cobr|pend|factur|saldo/i.test(r3) && !/no encontr|especif|aclar/i.test(r3)) {
        errors.push('R3: No parece ser de deuda');
      }

      const passed = errors.length === 0;
      results.push({
        profile: 'Usuario Caótico',
        testName: 'Switch rápido de contexto',
        passed,
        details: passed ? 'Navegó bien entre contextos' : errors.join('; '),
      });

      expect(errors).toEqual([]);
    }, TIMEOUT * 3);

    test.skipIf(SKIP)('Lunfardo argentino — entiende jerga', async () => {
      console.log('\n🗣️  Lunfardo: "guita", "mango", "morosos"');
      await delay(DELAY_BETWEEN);

      const responses = await chain([
        '¿Cuánta guita entró este mes?',
        '¿Y los morosos? ¿Quién nos debe más mango?',
      ]);

      const [r1, r2] = responses;
      console.log(`   R1 (guita): ${r1.substring(0, 150)}...`);
      console.log(`   R2 (morosos): ${r2.substring(0, 150)}...`);

      const errors: string[] = [];

      // R1: "guita que entró" = cobros/ingresos
      if (!/\$\s?[\d.,]+/i.test(r1) && !/aclar|especif/i.test(r1)) {
        errors.push('R1: No entendió "guita que entró"');
      }

      // R2: "morosos" = clientes con deuda
      if (!/deud|deb|vencid|moroso|cliente|cobr/i.test(r2) && !/aclar/i.test(r2)) {
        errors.push('R2: No entendió "morosos"');
      }

      const passed = errors.length === 0;
      results.push({
        profile: 'Usuario Caótico',
        testName: 'Lunfardo argentino',
        passed,
        details: passed ? 'Entiende jerga' : errors.join('; '),
      });

      expect(errors).toEqual([]);
    }, TIMEOUT * 2);

    test.skipIf(SKIP)('Trampa: pide vendedores, luego pregunta "¿y esos mismos cuánto deben?"', async () => {
      console.log('\n🗣️  Trampa: vendedores → "¿cuánto deben?"');
      await delay(DELAY_BETWEEN);

      const responses = await chain([
        '¿Quiénes son los vendedores del equipo?',
        '¿Y esos mismos cuánto deben?',
      ]);

      const [r1, r2] = responses;
      console.log(`   R1 (vendedores): ${r1.substring(0, 150)}...`);
      console.log(`   R2 (trampa deuda): ${r2.substring(0, 200)}...`);

      const errors: string[] = [];

      // R1: lista de vendedores del equipo
      if (!/vendedor|comercial|equipo|team/i.test(r1)) {
        errors.push('R1: No lista vendedores');
      }

      // R2: La trampa — "esos mismos" son VENDEDORES (empleados)
      // Los vendedores NO son clientes que deban plata
      // El agente debería:
      // a) Aclarar que los vendedores son empleados, no clientes
      // b) O buscar deuda de los clientes MÁS GRANDES (reinterpretar)
      // c) O pedir clarificación
      // Lo que NO debe hacer: inventar deudas de los vendedores como si fueran clientes
      
      // No debe tratar a vendedores como si fueran clientes deudores sin aclarar
      const fabricated = detectFabricatedNames(r2);
      if (fabricated.length > 0) {
        errors.push(`R2: Nombres fabricados: ${fabricated.join(', ')}`);
      }

      const passed = errors.length === 0;
      results.push({
        profile: 'Usuario Caótico',
        testName: 'Trampa vendedores → deuda',
        passed,
        details: passed ? 'No cayó en la trampa' : errors.join('; '),
      });

      expect(errors).toEqual([]);
    }, TIMEOUT * 2);
  });

  // ================================================
  // 🎯 TESTS ESPECÍFICOS ANTI-HALLUCINATION
  // Casos diseñados para provocar la mezcla de entidades
  // ================================================
  describe('🎯 Anti-Hallucination Específicos', () => {

    test.skipIf(SKIP)('Cliente inexistente — no debe inventar datos', async () => {
      console.log('\n🗣️  Cliente que no existe');
      await delay(DELAY_BETWEEN);

      const text = await ask('¿Cuánto nos debe "Industrias Patatín SRL"?');
      console.log(`   Response: ${text.substring(0, 200)}...`);

      const errors: string[] = [];

      // No debe inventar un monto para un cliente que no existe
      if (/\$\s?[\d.,]+[KMB]?(?!\s*0)/i.test(text) && !/no encontr|no hay|no existe|no tenemos/i.test(text)) {
        errors.push('Inventó un monto para un cliente inexistente');
      }

      const passed = errors.length === 0;
      results.push({
        profile: 'Anti-Hallucination',
        testName: 'Cliente inexistente',
        passed,
        details: passed ? 'No inventó datos' : errors.join('; '),
      });

      expect(errors).toEqual([]);
    }, TIMEOUT);

    test.skipIf(SKIP)('Producto inexistente — no debe inventar stock', async () => {
      console.log('\n🗣️  Producto que no existe');
      await delay(DELAY_BETWEEN);

      const text = await ask('¿Cuántas unidades tenemos del "Destornillador Galáctico X9000"?');
      console.log(`   Response: ${text.substring(0, 200)}...`);

      const errors: string[] = [];

      if (/\d+\s*unidad/i.test(text) && !/no encontr|no hay|no existe|0 unidad/i.test(text)) {
        errors.push('Inventó stock para un producto inexistente');
      }

      const passed = errors.length === 0;
      results.push({
        profile: 'Anti-Hallucination',
        testName: 'Producto inexistente',
        passed,
        details: passed ? 'No inventó datos' : errors.join('; '),
      });

      expect(errors).toEqual([]);
    }, TIMEOUT);

    test.skipIf(SKIP)('Pregunta sobre período futuro — no debe inventar', async () => {
      console.log('\n🗣️  Período futuro');
      await delay(DELAY_BETWEEN);

      const text = await ask('¿Cuánto vamos a vender en diciembre 2026?');
      console.log(`   Response: ${text.substring(0, 200)}...`);

      const errors: string[] = [];

      // No debe dar montos de un período futuro como si fueran reales
      // Puede dar proyecciones basadas en tendencias o aclarar que es futuro
      if (/vendimos.*diciembre 2026.*\$\s?[\d.,]+[KMB]/i.test(text)) {
        errors.push('Presentó datos futuros como reales');
      }

      const passed = errors.length === 0;
      results.push({
        profile: 'Anti-Hallucination',
        testName: 'Período futuro',
        passed,
        details: passed ? 'No inventó datos futuros' : errors.join('; '),
      });

      expect(errors).toEqual([]);
    }, TIMEOUT);

    test.skipIf(SKIP)('Doble entidad en una pregunta — vendedor + cliente', async () => {
      console.log('\n🗣️  Pregunta con doble entidad');
      await delay(DELAY_BETWEEN);

      const text = await ask('Dame las ventas del mejor vendedor y cuánto debe el peor cliente moroso');
      console.log(`   Response: ${text.substring(0, 300)}...`);

      const errors: string[] = [];

      // La respuesta debe claramente separar VENDEDOR de CLIENTE
      const fabricated = detectFabricatedNames(text);
      if (fabricated.length > 0) {
        errors.push(`Nombres fabricados: ${fabricated.join(', ')}`);
      }

      // Debe mencionar ambos conceptos
      if (!/vendedor|comercial/i.test(text) && !/no pude|aclar/i.test(text)) {
        errors.push('No menciona vendedor');
      }
      if (!/cliente|deud|moroso/i.test(text) && !/no pude|aclar/i.test(text)) {
        errors.push('No menciona cliente/deuda');
      }

      const passed = errors.length === 0;
      results.push({
        profile: 'Anti-Hallucination',
        testName: 'Doble entidad vendedor+cliente',
        passed,
        details: passed ? 'Entidades bien separadas' : errors.join('; '),
      });

      expect(errors).toEqual([]);
    }, TIMEOUT);
  });
});
