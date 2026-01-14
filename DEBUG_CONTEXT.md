# 🐛 Debug Context: autoFilterStates not applying in production

## Problem Summary
The **automatic state filters** (`autoFilterStates`) are not being applied correctly in production for Odoo models like `sale.order`, `account.move`, `purchase.order`, etc.

## System Context
- **Project**: `tuqui-agents-alpha` - AI Agent that queries Odoo data via API
- **Feature**: `autoFilterStates` - declarative configuration that auto-filters by "confirmed" states
- **Main file**: `lib/tools/odoo/query-builder.ts`

## Expected Behavior
When querying models like `sale.order`, the system should automatically filter by confirmed states unless the user explicitly asks for drafts/quotations.

```typescript
// MODEL_CONFIG in query-builder.ts (lines ~200-350)
MODEL_CONFIG = {
  'sale.order': { autoFilterStates: ['sale', 'sent', 'done'] },      // Confirmed sales only
  'account.move': { autoFilterStates: ['posted'] },                   // Posted invoices only
  'purchase.order': { autoFilterStates: ['purchase', 'done'] },       // Confirmed purchases
  'sale.order.line': { autoFilterStates: ['sale', 'sent', 'done'] },  // Lines from confirmed sales
  'account.payment': { autoFilterStates: ['posted'] },                // Posted payments
  'purchase.order.line': { autoFilterStates: ['purchase', 'done'] },  // Lines from confirmed purchases
  'sale.report': { autoFilterStates: ['sale', 'done'] },              // Sales report
  'purchase.report': { autoFilterStates: ['purchase', 'done'] },      // Purchase report
  'account.invoice.report': { autoFilterStates: ['posted'] },         // Invoice report
}
```

## Current Logic (lines 798-819)

```typescript
// ============================================
// AUTO-APPLY DEFAULT STATE FILTERS (DECLARATIVO)
// ============================================
const stateField = config.stateField || 'state'
const hasExplicitStateFilter = hasStateFilter(domain, stateField) || filtersHasState

// DEBUG: Log to verify in production
console.error(`[QueryBuilder:DEBUG] Model=${query.model}, hasExplicitState=${hasExplicitStateFilter}, autoFilterStates=${JSON.stringify(config.autoFilterStates)}`)

if (!hasExplicitStateFilter && config.autoFilterStates && config.autoFilterStates.length > 0) {
    // Use declarative model configuration
    if (config.autoFilterStates.length === 1) {
        domain.push([stateField, '=', config.autoFilterStates[0]])
    } else {
        domain.push([stateField, 'in', config.autoFilterStates])
    }
    console.error(`[QueryBuilder:DEBUG] APPLIED Auto-filter ${query.model}: ${stateField} IN [${config.autoFilterStates.join(', ')}]`)
} else {
    console.error(`[QueryBuilder:DEBUG] SKIPPED Auto-filter for ${query.model}. Reason: hasExplicit=${hasExplicitStateFilter}, autoFilterStates=${!!config.autoFilterStates}`)
}
```

## Suspected Issue
The auto-filter is NOT being applied when it should. Possible causes:

1. **`config` is not being retrieved correctly** - The model lookup in `MODEL_CONFIG` might fail
2. **`config.autoFilterStates` is undefined** - Config exists but property is missing
3. **`hasExplicitStateFilter` is incorrectly true** - Detection of explicit filter is too aggressive
4. **Model name mismatch** - Query uses different model name than configured

## Debug Output to Check
Look for these logs in Vercel production logs:
```
[QueryBuilder:DEBUG] Model=sale.order, hasExplicitState=???, autoFilterStates=???
[QueryBuilder:DEBUG] APPLIED Auto-filter... OR SKIPPED Auto-filter...
```

## Key Questions to Investigate

1. Is `MODEL_CONFIG['sale.order']` returning the expected config object?
2. What is the value of `hasExplicitStateFilter` when querying sales?
3. Is `config.autoFilterStates` an array or undefined?
4. Is there something in `filtersHasState` that's incorrectly detecting a state filter?

## Relevant Commits
- `6cd620c` - Refactor to declarative `autoFilterStates` system
- `5a218b5` - Fix to prevent duplicate state filters  
- `767802b` - Current debug (console.error for tracking)

## Files to Review
- `lib/tools/odoo/query-builder.ts` - Main logic (lines 113-120, 198-350, 795-820)
- Check `getModelConfig()` function if it exists
- Check `hasStateFilter()` function implementation

## Test Command
```bash
# Run E2E tests locally
pnpm test:e2e
```
