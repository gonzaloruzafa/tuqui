/**
 * Odoo Skills Index
 *
 * Exports all Odoo-related skills for registration in the global registry.
 */

// Client and helpers
export * from './_client';

// Sales Skills
export { getSalesTotal, type GetSalesTotalInput, type GetSalesTotalOutput } from './get-sales-total';
export { getSalesByCustomer, type GetSalesByCustomerInput, type GetSalesByCustomerOutput } from './get-sales-by-customer';
export { getSalesByProduct } from './get-sales-by-product';
export { getSalesBySeller } from './get-sales-by-seller';
export { getTopProducts } from './get-top-products';
export { getTopCustomers } from './get-top-customers';
export { getProductSalesHistory } from './get-product-sales-history';
export { getPendingSaleOrders } from './get-pending-sale-orders';

// Invoice/Debt Skills
export { getDebtByCustomer, type GetDebtByCustomerInput, type GetDebtByCustomerOutput } from './get-debt-by-customer';
export { getInvoicesByCustomer } from './get-invoices-by-customer';
export { getInvoiceLines } from './get-invoice-lines';
export { getOverdueInvoices } from './get-overdue-invoices';

// Stock Skills
export { getProductStock, type GetProductStockInput, type GetProductStockOutput } from './get-product-stock';
export { getLowStockProducts } from './get-low-stock-products';
export { getStockValuation } from './get-stock-valuation';
export { getExpiringStock, type GetExpiringStockInput, type GetExpiringStockOutput } from './get-expiring-stock';
export { getStockRotation } from './get-stock-rotation';
export { getBelowReorderPoint } from './get-below-reorder-point';

// Payment Skills
export { getPaymentsReceived, type GetPaymentsReceivedInput, type GetPaymentsReceivedOutput } from './get-payments-received';

// Purchase Skills
export { getPurchaseOrders } from './get-purchase-orders';
export { getPurchasesBySupplier } from './get-purchases-by-supplier';
export { getVendorBills } from './get-vendor-bills';

// Search Skills
export { searchCustomers } from './search-customers';
export { searchProducts } from './search-products';

// Accounting Skills
export { getAccountBalance, type GetAccountBalanceInput, type GetAccountBalanceOutput } from './get-account-balance';
export { getJournalEntries, type GetJournalEntriesInput, type GetJournalEntriesOutput } from './get-journal-entries';
export { getAccountsPayable, type GetAccountsPayableInput, type GetAccountsPayableOutput } from './get-accounts-payable';
export { getPaymentsMade, type GetPaymentsMadeInput, type GetPaymentsMadeOutput } from './get-payments-made';

// Treasury Skills
export { getCashBalance, type GetCashBalanceInput, type GetCashBalanceOutput } from './get-cash-balance';
export { getAccountsReceivable, type GetAccountsReceivableInput, type GetAccountsReceivableOutput } from './get-accounts-receivable';

// Comparison Skills
export { compareSalesPeriods, type CompareSalesPeriodsInput, type CompareSalesPeriodsOutput } from './compare-sales-periods';

// New Skills
export { getTopStockProducts } from './get-top-stock-products';

// Intelligence Revamp Phase 1
export { getCrmPipeline } from './get-crm-pipeline';
export { getProductMargin } from './get-product-margin';
export { getInactiveCustomers } from './get-inactive-customers';
export { getSalesMarginSummary } from './get-sales-margin-summary';
export { getPurchasePriceHistory } from './get-purchase-price-history';
export { getNewCustomers } from './get-new-customers';
export { getArAging } from './get-ar-aging';
export { getSalesTeams } from './get-sales-teams';
export { getCompanies } from './get-companies';
export { searchSuppliers } from './search-suppliers';

// CRM Business Analysis
export { getStaleOpportunities } from './get-stale-opportunities';
export { getLostOpportunities } from './get-lost-opportunities';
export { searchCrmOpportunities } from './search-crm-opportunities';
export { getCrmTags } from './get-crm-tags';

// Subscription Business Analysis
export { getSubscriptionHealth } from './get-subscription-health';
export { getSubscriptionChurn } from './get-subscription-churn';
export { getSubscriptionDetail } from './get-subscription-detail';

// HR Skills
export { getEmployees } from './get-employees';
export { getEmployeeLeaves } from './get-employee-leaves';
export { getLeaveSummary } from './get-leave-summary';
export { getDepartments } from './get-departments';

// Mail/Chatter Skills
export { getChatterMessages } from './get-chatter-messages';
export { getMailActivities } from './get-mail-activities';
export { getRecentEmails } from './get-recent-emails';

// Users Skills
export { getUsers } from './get-users';
export { getUserActivity } from './get-user-activity';

// Skill array for registration
import { getSalesTotal } from './get-sales-total';
import { getSalesByCustomer } from './get-sales-by-customer';
import { getSalesByProduct } from './get-sales-by-product';
import { getSalesBySeller } from './get-sales-by-seller';
import { getSalesByCategory } from './get-sales-by-category';
import { getTopProducts } from './get-top-products';
import { getTopCustomers } from './get-top-customers';
import { getProductSalesHistory } from './get-product-sales-history';
import { getDebtByCustomer } from './get-debt-by-customer';
import { getInvoicesByCustomer } from './get-invoices-by-customer';
import { getInvoiceLines } from './get-invoice-lines';
import { getOverdueInvoices } from './get-overdue-invoices';
import { getProductStock } from './get-product-stock';
import { getLowStockProducts } from './get-low-stock-products';
import { getStockValuation } from './get-stock-valuation';
import { getPaymentsReceived } from './get-payments-received';
import { getPurchaseOrders } from './get-purchase-orders';
import { getPurchasesBySupplier } from './get-purchases-by-supplier';
import { getVendorBills } from './get-vendor-bills';
import { searchCustomers } from './search-customers';
import { searchProducts } from './search-products';
import { searchSuppliers } from './search-suppliers';
import { getCashBalance } from './get-cash-balance';
import { getAccountsReceivable } from './get-accounts-receivable';
import { compareSalesPeriods } from './compare-sales-periods';
import { getPendingSaleOrders } from './get-pending-sale-orders';
import { getTopStockProducts } from './get-top-stock-products';
import { getNewCustomers } from './get-new-customers';
import { getArAging } from './get-ar-aging';
import { getSalesTeams } from './get-sales-teams';
import { getCompanies } from './get-companies';
import { getAccountBalance } from './get-account-balance';
import { getJournalEntries } from './get-journal-entries';
import { getAccountsPayable } from './get-accounts-payable';
import { getPaymentsMade } from './get-payments-made';
import { getExpiringStock } from './get-expiring-stock';
import { getStockRotation } from './get-stock-rotation';
import { getBelowReorderPoint } from './get-below-reorder-point';

// Intelligence Revamp Phase 1
import { getCrmPipeline } from './get-crm-pipeline';
import { getProductMargin } from './get-product-margin';
import { getInactiveCustomers } from './get-inactive-customers';
import { getSalesMarginSummary } from './get-sales-margin-summary';
import { getPurchasePriceHistory } from './get-purchase-price-history';

// CRM Business Analysis
import { getStaleOpportunities } from './get-stale-opportunities';
import { getLostOpportunities } from './get-lost-opportunities';
import { searchCrmOpportunities } from './search-crm-opportunities';
import { getCrmTags } from './get-crm-tags';

// Subscription Business Analysis
import { getSubscriptionHealth } from './get-subscription-health';
import { getSubscriptionChurn } from './get-subscription-churn';
import { getSubscriptionDetail } from './get-subscription-detail';

// HR Skills
import { getEmployees } from './get-employees';
import { getEmployeeLeaves } from './get-employee-leaves';
import { getLeaveSummary } from './get-leave-summary';
import { getDepartments } from './get-departments';

// Mail/Chatter Skills
import { getChatterMessages } from './get-chatter-messages';
import { getMailActivities } from './get-mail-activities';
import { getRecentEmails } from './get-recent-emails';

// Users Skills
import { getUsers } from './get-users';
import { getUserActivity } from './get-user-activity';

export const odooSkills = [
  // Sales (10)
  getSalesTotal,
  getSalesByCustomer,
  getSalesByProduct,
  getSalesBySeller,
  getTopProducts,
  getTopCustomers,
  getProductSalesHistory,
  compareSalesPeriods,
  getPendingSaleOrders,
  getSalesByCategory,
  getSalesTeams, // NEW - list sales teams for filtering
  getCompanies, // NEW - list companies for multi-company filtering
  // Invoices/Debt (4)
  getDebtByCustomer,
  getInvoicesByCustomer,
  getInvoiceLines, // NEW - line-level detail
  getOverdueInvoices,
  // Stock (5)
  getProductStock,
  getLowStockProducts,
  getStockValuation,
  getTopStockProducts,
  getExpiringStock, // NEW - expiration date tracking
  getStockRotation, // NEW - stock rotation analysis
  getBelowReorderPoint, // NEW - products below reorder point
  // Payments (1)
  getPaymentsReceived,
  // Purchases (3)
  getPurchaseOrders,
  getPurchasesBySupplier,
  getVendorBills,
  // Search (3)
  searchCustomers,
  searchProducts,
  searchSuppliers, // NEW - search suppliers separately from customers
  // Accounting/Treasury (6)
  getCashBalance, // NEW
  getAccountsReceivable, // NEW
  getAccountBalance, // NEW - chart of accounts balances
  getJournalEntries, // NEW - journal entries
  getAccountsPayable, // NEW - supplier debt
  getPaymentsMade, // NEW - outbound payments
  // CRM/Growth (1)
  getNewCustomers, // NEW
  // Aging/Analysis (1)
  getArAging, // NEW
  // Intelligence Revamp Phase 1 (5)
  getCrmPipeline,
  getProductMargin,
  getInactiveCustomers,
  getSalesMarginSummary,
  getPurchasePriceHistory,
  // CRM Business Analysis (4)
  getStaleOpportunities,
  getLostOpportunities,
  searchCrmOpportunities,
  getCrmTags,
  // Subscription Business Analysis (3)
  getSubscriptionHealth,
  getSubscriptionChurn,
  getSubscriptionDetail,
  // HR (4)
  getEmployees,
  getEmployeeLeaves,
  getLeaveSummary,
  getDepartments,
  // Mail/Chatter (3)
  getChatterMessages,
  getMailActivities,
  getRecentEmails,
  // Users (2)
  getUsers,
  getUserActivity,
];
