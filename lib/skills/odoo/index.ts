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

// Invoice/Debt Skills
export { getDebtByCustomer, type GetDebtByCustomerInput, type GetDebtByCustomerOutput } from './get-debt-by-customer';

// Stock Skills
export { getProductStock, type GetProductStockInput, type GetProductStockOutput } from './get-product-stock';

// Payment Skills
export { getPaymentsReceived, type GetPaymentsReceivedInput, type GetPaymentsReceivedOutput } from './get-payments-received';

// Skill array for registration
import { getSalesTotal } from './get-sales-total';
import { getSalesByCustomer } from './get-sales-by-customer';
import { getDebtByCustomer } from './get-debt-by-customer';
import { getProductStock } from './get-product-stock';
import { getPaymentsReceived } from './get-payments-received';

export const odooSkills = [
  getSalesTotal,
  getSalesByCustomer,
  getDebtByCustomer,
  getProductStock,
  getPaymentsReceived,
];
