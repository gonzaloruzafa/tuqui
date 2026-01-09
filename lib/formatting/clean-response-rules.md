# Reglas de Formateo Limpio para Respuestas

## Objetivo
Respuestas que se vean bien tanto en WhatsApp como en la app web, sin markdown roto ni emojis excesivos.

---

## ✅ USAR (Funciona en todos lados)

### Negritas
```
*texto en negrita*
```
**NO usar**: `**doble asterisco**` (se rompe en WhatsApp)

### Listas
```
• Item 1
• Item 2
• Item 3
```
**O numeradas**:
```
1. Primero
2. Segundo
3. Tercero
```

### Precios
```
$ 123.456
```
**NO usar**: `$ 123.456,78` (demasiado detalle para WhatsApp)

### Secciones
```
*Título de Sección*

Contenido de la sección...
```
**NO usar**: `### Headers` (no se ven en WhatsApp)

### Emojis
**Máximo 1 por sección**, al inicio:
```
📊 *Ventas de Enero*

Total: $ 1.234.567
```

### Links
```
[Link producto](https://url-corta.com)
```
**NO poner** texto muy largo en el link.

---

## ❌ NO USAR (Se rompe en WhatsApp)

### ❌ Tablas markdown
```
| Col1 | Col2 |
|------|------|
| A    | B    |
```
**Usar en su lugar**: Listas

### ❌ Itálicas con guión bajo
```
_texto en itálica_
```

### ❌ Código con backticks
```
`código`
```

### ❌ Múltiples emojis juntos
```
📊💰📈🎯 ❌
```
**Usar**: Un emoji por sección máximo

### ❌ Headers con ###
```
### Mi Header
```
**Usar**: `*Mi Header*`

---

## Ejemplos de Respuestas Limpias

### ✅ BUENO - Ranking de Productos

```
*Top 5 Productos Enero 2026*

1. *Adhesivo Adper* - $ 82.150
2. *Filtek Z350XT A2D* - $ 46.800
3. *Tetric Bulk Fill* - $ 38.450
4. *Kit Gacela* - $ 32.100
5. *Filtek Z350XT A3D* - $ 28.950

Total: $ 228.450
```

### ❌ MALO - Sobrecargado

```
📊 **Top 5 Productos Enero 2026** 💰📈

1. 🏆 **[C001063] Adhesivo Adper Single Bond 2** ⭐ - `$ 82.150.400`
2. 🥈 **[M000215] Filtek Z350XT Jeringa A2D** ✨ - `$ 46.800.210`
3. 🥉 **[M000798] Tetric EvoCeram Bulk Fill IVA** 💎 - `$ 38.450.000`
...
```

---

### ✅ BUENO - Comparación de Precios

```
*Turbina Gacela LED*

Tu precio: $ 455.000
Mercado: $ 441.000
▲ 3.1% arriba del promedio

Recomendación: Considerar bajar a $ 440.000 para ser más competitivo.
```

### ❌ MALO - Con markdown complejo

```
## Turbina Gacela Evo Lux LED 🔧

| Métrica | Valor |
|---------|-------|
| **Tu Precio** | $ 455.000 💰 |
| **Mercado** | $ 441.000 📊 |

### Análisis 📈
Estás un **3.1%** arriba del promedio...
```

---

### ✅ BUENO - Lista de Observaciones

```
*Observaciones Enero 2026*

• Kit Rotatorio entró en el Top 5 este mes
• Adhesivo Adper sigue liderando ventas
• Precios ajustados 5% por inflación

Próximos pasos: Revisar stock de Gacela LED
```

### ❌ MALO - Con headers y emojis excesivos

```
### 🔍 Observaciones de Enero 2026 📋✨

* ⭐ **Tendencia:** El `Kit Rotatorio Gacela` entró en el Top 5 🎯🚀
* 💎 **Alerta Adper:** 📢 El _Adhesivo Single Bond_ es nuestro...
* 💰📊 **Precios de Lista:** Actualizamos...
```

---

## Reglas de Oro

1. **Un emoji por sección** (máximo)
2. **Negritas con `*`** (no `**`)
3. **Sin tablas** (usar listas)
4. **Sin headers `###`** (usar `*texto*`)
5. **Precios sin céntimos** en WhatsApp
6. **Links cortos** `[Link](url)` no `[Texto muy muy largo](url)`
7. **Listas simples** con `•` o números
8. **Máximo 80 caracteres por línea**

---

## Implementación en Prompts

Agregar al final del system prompt:

```
**FORMATO DE RESPUESTA (CRÍTICO):**
- Texto limpio que funcione en WhatsApp y web
- Negritas solo con * (no **)
- Un emoji por sección máximo
- Sin tablas markdown (usar listas)
- Sin headers ### (usar *texto*)
- Precios sin céntimos: $ 123.456
- Máximo 80 caracteres por línea

EJEMPLO BUENO:
*Ventas Enero*

• Adhesivo Adper: $ 82.150
• Filtek Z350: $ 46.800

Total: $ 128.950

EJEMPLO MALO (NO HACER):
### 📊💰 Ventas de Enero 2026 🎯

| Producto | Valor |
|----------|-------|
| **Adhesivo** | $ 82.150,40 |
```
