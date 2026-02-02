/**
 * Tests for MercadoLibre URL Validator
 */

import { describe, test, expect } from 'vitest';
import { MLLinkValidator } from '@/lib/skills/web-search/mercadolibre/_validator';

describe('MLLinkValidator', () => {
  describe('isProductURL', () => {
    test('should accept valid product URLs with MLA pattern', () => {
      const validUrls = [
        'https://articulo.mercadolibre.com.ar/MLA-123456789-turbina-led-dental-alta-velocidad',
        'https://www.mercadolibre.com.ar/MLA-987654321-sillon-odontologico',
        'https://articulo.mercadolibre.com.ar/MLA123456-producto-sin-guion',
        'https://mercadolibre.com.ar/p/MLA123456',
      ];

      for (const url of validUrls) {
        expect(MLLinkValidator.isProductURL(url), `Expected ${url} to be valid`).toBe(true);
      }
    });

    test('should accept product URLs from other countries', () => {
      const validUrls = [
        'https://articulo.mercadolibre.com.mx/MLM-12345-producto',
        'https://articulo.mercadolivre.com.br/MLB-12345-producto',
        'https://articulo.mercadolibre.cl/MLC-12345-producto',
        'https://articulo.mercadolibre.com.co/MCO-12345-producto',
        'https://articulo.mercadolibre.com.uy/MLU-12345-producto',
      ];

      for (const url of validUrls) {
        expect(MLLinkValidator.isProductURL(url), `Expected ${url} to be valid`).toBe(true);
      }
    });

    test('should reject listing/search URLs', () => {
      const invalidUrls = [
        'https://listado.mercadolibre.com.ar/turbina-dental',
        'https://www.mercadolibre.com.ar/listado/odontologia',
        'https://www.mercadolibre.com.ar/busca/turbina',
        'https://www.mercadolibre.com.ar/ofertas',
        'https://www.mercadolibre.com.ar/s/MLA-CATEGORY',
        'https://www.mercadolibre.com.ar/categoria/odontologia',
      ];

      for (const url of invalidUrls) {
        expect(MLLinkValidator.isProductURL(url), `Expected ${url} to be invalid`).toBe(false);
      }
    });

    test('should reject URLs without product ID', () => {
      const invalidUrls = [
        'https://www.mercadolibre.com.ar/',
        'https://articulo.mercadolibre.com.ar/turbina-dental',
        'https://google.com/search?q=turbina',
      ];

      for (const url of invalidUrls) {
        expect(MLLinkValidator.isProductURL(url), `Expected ${url} to be invalid`).toBe(false);
      }
    });

    test('should reject non-MercadoLibre domains', () => {
      const invalidUrls = [
        'https://amazon.com/dp/B123456',
        'https://ebay.com/itm/MLA-123456',
        'https://fake-mercadolibre.com/MLA-123456',
      ];

      for (const url of invalidUrls) {
        expect(MLLinkValidator.isProductURL(url), `Expected ${url} to be invalid`).toBe(false);
      }
    });
  });

  describe('extractProductId', () => {
    test('should extract product ID with dash', () => {
      expect(MLLinkValidator.extractProductId(
        'https://articulo.mercadolibre.com.ar/MLA-123456789-turbina-led'
      )).toBe('MLA-123456789');
    });

    test('should extract product ID without dash', () => {
      expect(MLLinkValidator.extractProductId(
        'https://mercadolibre.com.ar/p/MLA123456'
      )).toBe('MLA123456');
    });

    test('should extract product ID from different countries', () => {
      expect(MLLinkValidator.extractProductId(
        'https://articulo.mercadolibre.com.mx/MLM-123456-producto'
      )).toBe('MLM-123456');

      expect(MLLinkValidator.extractProductId(
        'https://articulo.mercadolivre.com.br/MLB-123456-produto'
      )).toBe('MLB-123456');
    });

    test('should return null for invalid URLs', () => {
      expect(MLLinkValidator.extractProductId('https://google.com')).toBeNull();
      expect(MLLinkValidator.extractProductId('https://mercadolibre.com.ar/')).toBeNull();
      expect(MLLinkValidator.extractProductId('')).toBeNull();
    });
  });

  describe('isMercadoLibreDomain', () => {
    test('should accept valid MercadoLibre domains', () => {
      const validDomains = [
        'https://mercadolibre.com.ar/algo',
        'https://www.mercadolibre.com.ar/algo',
        'https://articulo.mercadolibre.com.ar/algo',
        'https://mercadolibre.com.mx/algo',
        'https://mercadolivre.com.br/algo', // Brasil uses mercadolivre
      ];

      for (const url of validDomains) {
        expect(MLLinkValidator.isMercadoLibreDomain(url), `Expected ${url} to be ML domain`).toBe(true);
      }
    });

    test('should reject non-MercadoLibre domains', () => {
      const invalidDomains = [
        'https://amazon.com/algo',
        'https://ebay.com/algo',
        'https://not-mercadolibre.com/algo',
        'https://mercadolibrefake.com/algo',
      ];

      for (const url of invalidDomains) {
        expect(MLLinkValidator.isMercadoLibreDomain(url), `Expected ${url} to not be ML domain`).toBe(false);
      }
    });
  });
});
