/**
 * E2E Conversation Scenarios
 *
 * Tests conversational context and skill chaining with realistic user flows.
 * These scenarios validate that the LLM can:
 * 1. Choose the correct skill based on user intent
 * 2. Maintain context across multiple turns
 * 3. Handle follow-up questions without repeating information
 * 4. Reference previous results ("those products", "that customer", etc.)
 */

export interface ConversationTurn {
  user: string;
  expectedSkill: string;
  expectedContext?: string[];  // References to previous turns
  notes?: string;
}

export interface ConversationScenario {
  name: string;
  description: string;
  context: string;
  turns: ConversationTurn[];
}

/**
 * Sales Analysis Conversation Flow
 */
export const salesAnalysisScenario: ConversationScenario = {
  name: 'Sales Analysis',
  description: 'User investigates sales performance, drilling down from general to specific',
  context: 'User is a sales manager reviewing Q4 2024 performance',
  turns: [
    {
      user: '¿Cuánto vendimos en diciembre 2024?',
      expectedSkill: 'get_sales_total',
      notes: 'Initial broad question - should use sales total'
    },
    {
      user: '¿Quiénes fueron los mejores clientes?',
      expectedSkill: 'get_sales_by_customer',
      expectedContext: ['diciembre 2024'],
      notes: 'Should maintain December period from previous turn'
    },
    {
      user: '¿Qué productos vendió el primero?',
      expectedSkill: 'get_sales_by_product',
      expectedContext: ['diciembre 2024', 'primer cliente del ranking anterior'],
      notes: 'Should filter by top customer from previous result'
    },
    {
      user: 'Mostrame el historial de ese producto',
      expectedSkill: 'get_product_sales_history',
      expectedContext: ['producto mencionado en turno anterior'],
      notes: 'Should use product from previous turn'
    },
    {
      user: '¿Está en stock?',
      expectedSkill: 'get_product_stock',
      expectedContext: ['mismo producto'],
      notes: 'Should continue with same product'
    },
  ],
};

/**
 * Debt Collection Workflow
 */
export const debtCollectionScenario: ConversationScenario = {
  name: 'Debt Collection',
  description: 'User reviews overdue invoices and customer debt',
  context: 'User is in finance/collections department',
  turns: [
    {
      user: '¿Qué facturas están vencidas?',
      expectedSkill: 'get_overdue_invoices',
      notes: 'Initial debt query'
    },
    {
      user: 'Agrupalo por cliente',
      expectedSkill: 'get_overdue_invoices',
      expectedContext: ['groupByCustomer: true'],
      notes: 'Should modify previous query to group by customer'
    },
    {
      user: 'Mostrame todas las facturas del primer cliente',
      expectedSkill: 'get_invoices_by_customer',
      expectedContext: ['cliente con mayor deuda vencida'],
      notes: 'Should identify top customer from previous result'
    },
    {
      user: '¿Cuál es su balance total?',
      expectedSkill: 'get_customer_balance',
      expectedContext: ['mismo cliente'],
      notes: 'Should use same customer ID'
    },
  ],
};

/**
 * Inventory Management Flow
 */
export const inventoryManagementScenario: ConversationScenario = {
  name: 'Inventory Management',
  description: 'User reviews stock levels and reordering needs',
  context: 'User is a warehouse manager doing weekly inventory check',
  turns: [
    {
      user: '¿Qué productos tienen stock bajo?',
      expectedSkill: 'get_low_stock_products',
      notes: 'Initial stock query'
    },
    {
      user: '¿Cuándo fue la última venta de esos productos?',
      expectedSkill: 'get_sales_by_product',
      expectedContext: ['productos con stock bajo del resultado anterior'],
      notes: 'Should query sales for low-stock products'
    },
    {
      user: '¿Cuál es la valuación total del inventario?',
      expectedSkill: 'get_stock_valuation',
      notes: 'General inventory value query'
    },
    {
      user: 'Buscame el producto "Tornillo M8"',
      expectedSkill: 'search_products',
      notes: 'Specific product search'
    },
    {
      user: '¿Cuánto stock hay?',
      expectedSkill: 'get_product_stock',
      expectedContext: ['producto encontrado en búsqueda anterior'],
      notes: 'Should use product from search result'
    },
  ],
};

/**
 * Vendor/Supplier Management
 */
export const vendorManagementScenario: ConversationScenario = {
  name: 'Vendor Management',
  description: 'User analyzes supplier spending and bills',
  context: 'User is reviewing vendor relationships and expenses',
  turns: [
    {
      user: '¿Cuánto gastamos en compras este trimestre?',
      expectedSkill: 'get_purchase_orders',
      notes: 'Initial purchase query for Q1 2025'
    },
    {
      user: '¿Quiénes son los proveedores principales?',
      expectedSkill: 'get_purchases_by_supplier',
      expectedContext: ['mismo trimestre'],
      notes: 'Should maintain period context'
    },
    {
      user: 'Mostrame las facturas del primero',
      expectedSkill: 'get_vendor_bills',
      expectedContext: ['proveedor con mayor gasto'],
      notes: 'Should filter by top supplier'
    },
    {
      user: 'Buscame el contacto de ese proveedor',
      expectedSkill: 'search_customers',
      expectedContext: ['mismo proveedor (partner)'],
      notes: 'Should search for supplier contact info'
    },
  ],
};

/**
 * Sales Team Performance Review
 */
export const salesTeamScenario: ConversationScenario = {
  name: 'Sales Team Performance',
  description: 'Manager reviews sales team performance and commissions',
  context: 'Monthly sales team review meeting',
  turns: [
    {
      user: 'Ventas por vendedor del último mes',
      expectedSkill: 'get_sales_by_seller',
      notes: 'Sales performance by salesperson'
    },
    {
      user: '¿Qué vendió el mejor vendedor?',
      expectedSkill: 'get_sales_by_product',
      expectedContext: ['vendedor top del ranking', 'último mes'],
      notes: 'Should filter products by top seller'
    },
    {
      user: '¿A qué clientes les vendió?',
      expectedSkill: 'get_sales_by_customer',
      expectedContext: ['mismo vendedor', 'último mes'],
      notes: 'Should filter customers by same seller'
    },
    {
      user: '¿Alguno tiene facturas vencidas?',
      expectedSkill: 'get_overdue_invoices',
      expectedContext: ['clientes del vendedor mencionado'],
      notes: 'Should check overdue invoices for seller\'s customers'
    },
  ],
};

/**
 * Mixed Query Scenario (Cross-Module)
 */
export const mixedQueryScenario: ConversationScenario = {
  name: 'Mixed Business Query',
  description: 'User asks questions across different business areas',
  context: 'CEO weekly dashboard review',
  turns: [
    {
      user: '¿Cuánto vendimos esta semana?',
      expectedSkill: 'get_sales_total',
      notes: 'Sales overview'
    },
    {
      user: '¿Cuánto cobramos?',
      expectedSkill: 'get_payments_received',
      expectedContext: ['misma semana'],
      notes: 'Payments for same period'
    },
    {
      user: '¿Quién nos debe?',
      expectedSkill: 'get_debt_by_customer',
      notes: 'Outstanding debt'
    },
    {
      user: 'Productos más vendidos',
      expectedSkill: 'get_top_products',
      expectedContext: ['esta semana'],
      notes: 'Top products for the week'
    },
    {
      user: '¿Tenemos stock de esos?',
      expectedSkill: 'get_product_stock',
      expectedContext: ['productos top del resultado anterior'],
      notes: 'Stock check for top products'
    },
  ],
};

/**
 * Error Recovery Scenario
 */
export const errorRecoveryScenario: ConversationScenario = {
  name: 'Error Recovery',
  description: 'Tests how system handles ambiguous or missing data',
  context: 'User makes vague queries that need clarification',
  turns: [
    {
      user: 'Ventas',
      expectedSkill: 'get_sales_total',
      notes: 'Vague query - should ask for period or use default (current month)'
    },
    {
      user: 'Del cliente X',
      expectedSkill: 'search_customers',
      expectedContext: ['buscar cliente llamado X'],
      notes: 'Should search for customer if name not exact'
    },
    {
      user: '¿Qué le vendimos?',
      expectedSkill: 'get_sales_by_customer',
      expectedContext: ['cliente encontrado en búsqueda'],
      notes: 'Should use customer from search result'
    },
  ],
};

/**
 * All scenarios for testing
 */
export const allScenarios: ConversationScenario[] = [
  salesAnalysisScenario,
  debtCollectionScenario,
  inventoryManagementScenario,
  vendorManagementScenario,
  salesTeamScenario,
  mixedQueryScenario,
  errorRecoveryScenario,
];

/**
 * Export for use in test runner
 */
export default allScenarios;
