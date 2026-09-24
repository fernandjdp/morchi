Sí. Para una tienda de ropa con remeras personalizadas, tu esquema inicial es un buen punto de partida, pero todavía mezcla conceptos que conviene separar para que el sistema pueda crecer sin rehacer la base de datos.

La estructura que usaría es esta:

```text
                         ┌─────────────┐
                         │  profiles   │
                         │ auth.users  │
                         └──────┬──────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
                 addresses                carts
                                            │
                                         cart_items
                                            │
products ───── product_variants ─────── inventory
   │                 │
   │                 └──── product_images
   │
   ├──── categories
   │
   └──── designs
             │
       design_assets


profiles ───── orders ───── order_items ───── products/variants
                  │
                  ├──── order_addresses
                  ├──── payments ─── Mercado Pago
                  └──── shipments

coupons ───── coupon_redemptions ───── orders
```

## 1. La modificación más importante a tu modelo

Tu ejemplo tiene:

```sql
products.price
products_variants.stock
orders.total
```

Yo cambiaría esas responsabilidades.

### `products`

Representa **el modelo de producto**:

> "Remera Oversize", "Remera Classic", "Buzo Hoodie", etc.

No necesariamente representa una unidad comprable concreta.

### `product_variants`

Representa **la combinación realmente vendible**:

> Remera Oversize / Negra / L
> Remera Oversize / Negra / XL
> Remera Oversize / Blanca / L

Por eso el **SKU, precio y disponibilidad** deberían estar asociados a la variante.

### `orders`

Representa únicamente el pedido. Las líneas del pedido viven en `order_items`.

Esto es fundamental porque un pedido tiene que conservar su historia. Si mañana una remera pasa de $25.000 a $30.000, el pedido anterior debe continuar mostrando $25.000.

---

# 2. Catálogo

## `products`

```sql
create table products (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  slug text unique not null,
  description text,

  status text not null default 'draft'
    check (status in ('draft', 'active', 'archived')),

  brand text,
  product_type text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
```

Campos importantes:

| Campo          | Para qué sirve                        |
| -------------- | ------------------------------------- |
| `name`         | Nombre comercial                      |
| `slug`         | URL amigable                          |
| `description`  | Descripción                           |
| `status`       | Draft / publicado / archivado         |
| `brand`        | Marca, si en el futuro manejás varias |
| `product_type` | Remera, buzo, gorra, etc.             |
| `created_at`   | Alta                                  |
| `updated_at`   | Última modificación                   |
| `deleted_at`   | Soft delete                           |

No pondría `price` acá si existe la posibilidad de que distintas variantes tengan distintos precios.

---

# 3. Talles y colores

Para una tienda de ropa empezaría con tablas específicas:

```sql
create table sizes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0
);

create table colors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  hex_code text,
  sort_order int not null default 0
);
```

Ejemplo:

```text
sizes
XS
S
M
L
XL
XXL

colors
Blanco
Negro
Rojo
Azul
```

Esto es mejor que tener:

```sql
size TEXT
color TEXT
```

directamente en cada variante, porque evita inconsistencias como:

```text
"Negro"
"negro"
"Black"
"NEGRO"
```

---

# 4. Variantes

```sql
create table product_variants (
  id uuid primary key default gen_random_uuid(),

  product_id uuid not null
    references products(id) on delete cascade,

  size_id uuid
    references sizes(id),

  color_id uuid
    references colors(id),

  sku text not null unique,

  price numeric(12,2) not null
    check (price >= 0),

  compare_at_price numeric(12,2)
    check (compare_at_price >= 0),

  cost_price numeric(12,2),

  barcode text,

  weight_grams int,

  is_active boolean not null default true,

  created_at timestamptz not null default now(),

  unique(product_id, size_id, color_id)
);
```

Esto permite:

```text
REMERA-OVERSIZE
 ├── Negra / M
 │     SKU: OV-BLK-M
 │     Precio: 25000
 │
 ├── Negra / L
 │     SKU: OV-BLK-L
 │     Precio: 25000
 │
 └── Blanca / M
       SKU: OV-WHT-M
       Precio: 25000
```

`compare_at_price` te permite manejar algo como:

```text
Precio anterior: $30.000
Precio actual:   $25.000
```

y `cost_price` sirve para calcular margen, aunque debería quedar restringido a administradores.

---

# 5. Categorías

```sql
create table categories (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  slug text not null unique,
  description text,

  parent_id uuid
    references categories(id)
);

create table product_categories (
  product_id uuid not null
    references products(id) on delete cascade,

  category_id uuid not null
    references categories(id) on delete cascade,

  primary key (product_id, category_id)
);
```

Esto permite:

```text
Remeras
├── Oversize
├── Classic
└── Deportivas
```

y un producto puede pertenecer a varias categorías.

---

# 6. Imágenes de productos

No guardaría las imágenes dentro de Postgres.

En Supabase conviene almacenar los archivos en **Supabase Storage** y guardar en la DB únicamente la referencia al archivo. Supabase recomienda almacenar los archivos fuera de la base de datos y permite aplicar control de acceso mediante RLS. ([Supabase][1])

```sql
create table product_images (
  id uuid primary key default gen_random_uuid(),

  product_id uuid not null
    references products(id) on delete cascade,

  variant_id uuid
    references product_variants(id) on delete set null,

  storage_path text not null,

  alt_text text,

  sort_order int not null default 0,

  created_at timestamptz not null default now()
);
```

Por ejemplo:

```text
product-images/
  abc123/
    front.webp
    back.webp
    detail.webp
```

En la DB:

```text
storage_path = "product-images/abc123/front.webp"
```

---

# 7. Inventario

Para un proyecto pequeño podés mantener:

```sql
stock int
```

dentro de `product_variants`.

Pero si querés una arquitectura más cercana a un ecommerce profesional, separaría el inventario.

## `inventory_levels`

```sql
create table inventory_levels (
  id uuid primary key default gen_random_uuid(),

  variant_id uuid not null unique
    references product_variants(id) on delete cascade,

  quantity int not null default 0
    check (quantity >= 0),

  reserved_quantity int not null default 0
    check (reserved_quantity >= 0),

  updated_at timestamptz not null default now()
);
```

El stock realmente disponible sería conceptualmente:

```text
available = quantity - reserved_quantity
```

Esto permite reservar stock mientras una persona está pagando.

## `inventory_movements`

Además conservaría un historial:

```sql
create table inventory_movements (
  id uuid primary key default gen_random_uuid(),

  variant_id uuid not null
    references product_variants(id),

  quantity int not null
    check (quantity <> 0),

  movement_type text not null
    check (
      movement_type in (
        'purchase',
        'sale',
        'reservation',
        'release',
        'adjustment',
        'return'
      )
    ),

  reference_id uuid,

  note text,

  created_at timestamptz not null default now()
);
```

Esto te permite responder:

> ¿Por qué ahora tengo 7 unidades si originalmente tenía 20?

Por ejemplo:

```text
+20 adjustment
-3 sale
-5 sale
-2 sale
-3 reservation
```

Mucho más robusto que modificar directamente un `stock`.

---

# 8. Usuarios

Supabase ya tiene:

```text
auth.users
```

No conviene duplicar el sistema de autenticación.

Crearía:

```sql
create table profiles (
  id uuid primary key
    references auth.users(id) on delete cascade,

  first_name text,
  last_name text,
  phone text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Supabase recomienda precisamente crear una tabla pública como `profiles` vinculada a `auth.users`, ya que el esquema `auth` no se expone directamente mediante la API generada. ([Supabase][2])

Además, Supabase permite usar usuarios anónimos, que puede ser útil para carritos de ecommerce antes de que el visitante cree una cuenta. ([Supabase][3])

---

# 9. Direcciones

Una persona puede tener varias:

```sql
create table addresses (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references profiles(id) on delete cascade,

  recipient_name text not null,
  address_line1 text not null,
  address_line2 text,

  city text not null,
  state text,
  postal_code text not null,
  country text not null default 'AR',

  phone text,

  is_default boolean not null default false,

  created_at timestamptz not null default now()
);
```

Pero hay un detalle MUY importante.

No usaría directamente esta dirección en el pedido.

Un usuario puede comprar hoy:

```text
Av. Siempre Viva 123
```

y mañana cambiarla a:

```text
Av. Siempre Viva 456
```

El pedido anterior debe seguir mostrando `123`.

Por eso necesitamos `order_addresses`.

---

# 10. Carrito

```sql
create table carts (
  id uuid primary key default gen_random_uuid(),

  user_id uuid
    references profiles(id) on delete cascade,

  status text not null default 'active'
    check (status in ('active', 'converted', 'abandoned')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table cart_items (
  id uuid primary key default gen_random_uuid(),

  cart_id uuid not null
    references carts(id) on delete cascade,

  variant_id uuid not null
    references product_variants(id),

  quantity int not null
    check (quantity > 0),

  created_at timestamptz not null default now(),

  unique(cart_id, variant_id)
);
```

---

# 11. Pedidos

Acá haría un cambio grande respecto de tu modelo original.

```sql
create table orders (
  id uuid primary key default gen_random_uuid(),

  order_number bigint generated always as identity unique,

  user_id uuid
    references profiles(id) on delete set null,

  email text not null,

  status text not null default 'pending'
    check (
      status in (
        'pending',
        'confirmed',
        'processing',
        'shipped',
        'completed',
        'cancelled',
        'refunded'
      )
    ),

  payment_status text not null default 'pending'
    check (
      payment_status in (
        'pending',
        'approved',
        'rejected',
        'refunded',
        'cancelled'
      )
    ),

  fulfillment_status text not null default 'unfulfilled'
    check (
      fulfillment_status in (
        'unfulfilled',
        'processing',
        'packed',
        'shipped',
        'delivered',
        'returned'
      )
    ),

  currency text not null default 'ARS',

  subtotal numeric(12,2) not null
    check (subtotal >= 0),

  discount_total numeric(12,2) not null default 0
    check (discount_total >= 0),

  shipping_total numeric(12,2) not null default 0
    check (shipping_total >= 0),

  tax_total numeric(12,2) not null default 0
    check (tax_total >= 0),

  total numeric(12,2) not null
    check (total >= 0),

  customer_note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### Por qué separar tres estados

No pondría solamente:

```text
pending
paid
cancelled
```

porque son cosas diferentes.

Un pedido puede estar:

```text
status = processing
payment_status = approved
fulfillment_status = packed
```

Eso significa:

> el pedido existe → está pago → está preparado para despacho.

Esta separación te evita muchos problemas posteriormente.

---

# 12. Líneas del pedido

Esta es otra tabla imprescindible.

```sql
create table order_items (
  id uuid primary key default gen_random_uuid(),

  order_id uuid not null
    references orders(id) on delete cascade,

  product_id uuid
    references products(id) on delete set null,

  variant_id uuid
    references product_variants(id) on delete set null,

  sku text,
  product_name text not null,
  variant_description text,

  unit_price numeric(12,2) not null
    check (unit_price >= 0),

  quantity int not null
    check (quantity > 0),

  line_total numeric(12,2) not null
    check (line_total >= 0),

  created_at timestamptz not null default now()
);
```

Fijate que repito:

```text
sku
product_name
variant_description
unit_price
```

aunque ya existan en `products`.

Eso es **intencional**.

Ejemplo:

Hoy:

```text
Remera Oversize
$25.000
```

El cliente compra.

Mañana cambiás el nombre a:

```text
Remera Oversize Premium
$32.000
```

El pedido histórico tiene que seguir diciendo:

```text
Remera Oversize
$25.000
```

Por eso `order_items` funciona como una fotografía histórica del momento de compra.

---

# 13. Dirección del pedido

```sql
create table order_addresses (
  id uuid primary key default gen_random_uuid(),

  order_id uuid not null
    references orders(id) on delete cascade,

  address_type text not null
    check (address_type in ('shipping', 'billing')),

  recipient_name text not null,

  address_line1 text not null,
  address_line2 text,

  city text not null,
  state text,
  postal_code text not null,
  country text not null,

  phone text,

  unique(order_id, address_type)
);
```

Así un pedido puede tener:

```text
shipping address
billing address
```

independientes.

---

# 14. Pagos / Mercado Pago

No pondría:

```sql
mercadopago_preference_id
```

directamente en `orders`.

Lo separaría:

```sql
create table payments (
  id uuid primary key default gen_random_uuid(),

  order_id uuid not null
    references orders(id) on delete cascade,

  provider text not null
    check (provider in ('mercadopago', 'cash', 'bank_transfer', 'other')),

  provider_payment_id text,

  provider_preference_id text,

  status text not null
    check (
      status in (
        'pending',
        'approved',
        'rejected',
        'cancelled',
        'refunded'
      )
    ),

  amount numeric(12,2) not null
    check (amount >= 0),

  currency text not null default 'ARS',

  raw_response jsonb,

  paid_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Mercado Pago devuelve un identificador de preferencia que conviene conservar para la integración. ([Mercado Pago][4])

Y para actualizar el estado del pedido no deberías confiar únicamente en el redirect del navegador: Mercado Pago dispone de Webhooks para informar cambios de pago y recomienda ese mecanismo para las notificaciones. ([Mercado Pago][5])

La arquitectura sería:

```text
Cliente
   │
   ▼
Crear order
   │
   ▼
Crear Mercado Pago preference
   │
   ▼
Cliente paga
   │
   ▼
Mercado Pago
   │
   ▼
Webhook
   │
   ▼
Supabase Edge Function
   │
   ├── actualizar payments
   ├── actualizar orders
   └── descontar/reservar inventario
```

Y el access token de Mercado Pago **no debería vivir en la tabla**.

---

# 15. Envíos

```sql
create table shipments (
  id uuid primary key default gen_random_uuid(),

  order_id uuid not null
    references orders(id) on delete cascade,

  carrier text,

  service text,

  tracking_number text,

  status text not null default 'pending'
    check (
      status in (
        'pending',
        'label_created',
        'shipped',
        'in_transit',
        'delivered',
        'returned'
      )
    ),

  shipping_cost numeric(12,2) not null default 0,

  shipped_at timestamptz,
  delivered_at timestamptz,

  created_at timestamptz not null default now()
);
```

Esto después te permite integrar correo argentino, Andreani, OCA, Mercado Envíos, etc., sin cambiar `orders`.

---

# 16. Diseños personalizados

Esta parte es especialmente importante para tu negocio.

Yo **no mezclaría el diseño con `products`**.

Un producto es:

```text
Remera Oversize
```

Un diseño es:

```text
Logo retro "Buenos Aires"
```

Y una combinación puede ser:

```text
Remera negra + diseño X + impresión frontal
```

## `designs`

```sql
create table designs (
  id uuid primary key default gen_random_uuid(),

  user_id uuid
    references profiles(id) on delete cascade,

  name text not null,

  design_type text not null default 'custom'
    check (
      design_type in (
        'custom',
        'template',
        'uploaded'
      )
    ),

  status text not null default 'draft'
    check (
      status in (
        'draft',
        'ready',
        'archived'
      )
    ),

  preview_storage_path text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Así podés tener diseños:

```text
Diseño de la tienda
Diseño creado por cliente
Diseño subido por cliente
```

## `design_assets`

```sql
create table design_assets (
  id uuid primary key default gen_random_uuid(),

  design_id uuid not null
    references designs(id) on delete cascade,

  storage_path text not null,

  file_type text,
  mime_type text,

  width int,
  height int,

  created_at timestamptz not null default now()
);
```

Los archivos vuelven a ir a Supabase Storage, no a Postgres. ([Supabase][1])

---

# 17. Diseños disponibles para un producto

Si tenés diseños predeterminados:

```sql
create table product_designs (
  product_id uuid not null
    references products(id) on delete cascade,

  design_id uuid not null
    references designs(id) on delete cascade,

  placement text not null
    check (
      placement in (
        'front',
        'back',
        'left_chest',
        'sleeve'
      )
    ),

  is_default boolean not null default false,

  primary key (product_id, design_id, placement)
);
```

Entonces podés expresar:

```text
Remera Oversize
 ├── Diseño A → frente
 ├── Diseño B → frente
 └── Diseño B → espalda
```

---

# 18. Configuración personalizada del pedido

Para algo del estilo:

> "Quiero mi propia imagen, texto y ubicación"

agregaría:

```sql
create table order_item_customizations (
  id uuid primary key default gen_random_uuid(),

  order_item_id uuid not null
    references order_items(id) on delete cascade,

  design_id uuid
    references designs(id) on delete set null,

  configuration jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);
```

El `jsonb` podría guardar algo como:

```json
{
  "front": {
    "image": "designs/abc/logo.png",
    "x": 0.5,
    "y": 0.35,
    "scale": 0.8,
    "rotation": 0
  },
  "text": {
    "content": "Buenos Aires",
    "font": "Montserrat",
    "size": 32
  }
}
```

Aquí sí usaría JSONB: la estructura de una personalización puede cambiar bastante y no merece la pena crear una columna para cada parámetro visual.

---

# 19. Cupones

No es obligatorio para el MVP, pero suele aparecer rápidamente en ecommerce.

```sql
create table coupons (
  id uuid primary key default gen_random_uuid(),

  code text not null unique,

  discount_type text not null
    check (discount_type in ('percentage', 'fixed')),

  discount_value numeric(12,2) not null
    check (discount_value >= 0),

  minimum_order_amount numeric(12,2),

  max_uses int,

  used_count int not null default 0,

  starts_at timestamptz,
  expires_at timestamptz,

  is_active boolean not null default true,

  created_at timestamptz not null default now()
);

create table coupon_redemptions (
  id uuid primary key default gen_random_uuid(),

  coupon_id uuid not null
    references coupons(id),

  order_id uuid not null
    references orders(id),

  user_id uuid
    references profiles(id),

  discount_amount numeric(12,2) not null,

  created_at timestamptz not null default now(),

  unique(coupon_id, order_id)
);
```

---

# 20. El modelo completo que recomiendo

Para tu caso lo dividiría en tres niveles.

### Esencial

```text
products
product_variants
sizes
colors
product_images
categories
product_categories

profiles
addresses

carts
cart_items

orders
order_items
order_addresses
payments
shipments
```

### Inventario profesional

```text
inventory_levels
inventory_movements
```

### Sistema de diseños

```text
designs
design_assets
product_designs
order_item_customizations
```

### Marketing

```text
coupons
coupon_redemptions
```

---

# 21. Una decisión arquitectónica que te recomiendo especialmente

No pensaría tu tienda como:

```text
Product
 └── Variant
       └── Stock
```

sino como:

```text
PRODUCT
│
├── Información comercial
│
├── CATEGORIES
│
├── IMAGES
│
└── VARIANTS
      │
      ├── SIZE
      ├── COLOR
      ├── SKU
      ├── PRICE
      └── INVENTORY
```

y por separado:

```text
DESIGN
│
├── Assets
├── Preview
└── Configuration
```

y cuando se vende:

```text
ORDER
│
├── ORDER ITEMS
│     ├── product snapshot
│     ├── variant snapshot
│     ├── price snapshot
│     └── customization snapshot
│
├── PAYMENT
├── SHIPPING
└── ADDRESS SNAPSHOT
```

Ese diseño te da mucha más estabilidad.

---

# 22. Supabase: algo que no dejaría para el final

Como vas a exponer la base mediante la API de Supabase, **RLS debería formar parte del diseño inicial**, no agregarse después. Supabase recomienda habilitar RLS en las tablas del esquema expuesto y definir políticas específicas para cada operación. ([Supabase][6])

Por ejemplo:

```text
PRODUCTS
anon          → SELECT productos activos
authenticated → SELECT productos activos

ORDERS
anon          → normalmente ninguno
authenticated → SELECT/UPDATE solamente sus propios pedidos

ADDRESSES
authenticated → solamente las propias

DESIGNS
authenticated → solamente los propios

PAYMENTS
cliente       → solamente lectura muy limitada
backend       → gestión

INVENTORY
cliente       → ninguno
admin/backend → gestión
```

Y especialmente:

```text
Mercado Pago Webhook
        ↓
Supabase Edge Function
        ↓
service role
        ↓
payments / orders / inventory
```

no:

```text
Mercado Pago → cliente → update orders
```

---

# 23. Sobre los precios

Para dinero usaría:

```sql
numeric(12,2)
```

y no el tipo PostgreSQL `money`, porque este último tiene comportamiento dependiente de configuración regional; `numeric`/`decimal` es más apropiado para importes de negocio. ([PostgreSQL][7])

Además, guardaría siempre:

```text
currency = ARS
```

en pedidos y pagos.

Eso te deja preparada la base para eventualmente manejar:

```text
ARS
USD
EUR
```

sin rediseñar todo.

---

# 24. Qué agregaría más adelante

Para una versión más avanzada podrías añadir:

```text
reviews
wishlists
product_tags
brands
collections
shipping_methods
shipping_rates
returns
refunds
gift_cards
inventory_locations
discount_rules
invoices
audit_logs
```

Pero **no pondría todas desde el primer día**.

Para una tienda de remeras que está comenzando, el punto razonable sería aproximadamente:

**15–20 tablas bien diseñadas**, en lugar de intentar crear 40 tablas desde el principio.

### Mi recomendación para tu caso

La estructura base quedaría:

```text
                        ┌─────────────┐
                        │ auth.users  │
                        └──────┬──────┘
                               │
                          ┌────▼────┐
                          │ profiles│
                          └────┬────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
          addresses         carts            designs
                              │                │
                         cart_items       design_assets
                                               │
products ───── categories               product_designs
   │
   ├──── product_images
   │
   └──── product_variants
                │
                └──── inventory_levels
                         │
                         └──── inventory_movements


profiles ───── orders
                 │
        ┌────────┼───────────┐
        │        │           │
   order_items payments   shipments
        │
   customizations
        │
     designs
```

Y hay una última decisión que puede cambiar bastante el diseño: **si tus remeras van a ser productos prediseñados o si el cliente va a tener un editor para subir su propia imagen, agregar texto, elegir ubicación, color de impresión, etc.** Para una tienda de diseño de remeras, esa diferencia afecta especialmente `designs`, `product_variants`, `order_item_customizations` e inventario.

[1]: https://supabase.com/docs/guides/storage?utm_source=chatgpt.com "Storage | Supabase Docs"
[2]: https://supabase.com/docs/guides/auth/managing-user-data?utm_source=chatgpt.com "User Management | Supabase Docs"
[3]: https://supabase.com/docs/guides/auth/users?utm_source=chatgpt.com "Users | Supabase Docs"
[4]: https://www.mercadopago.com.ar/developers/en/docs/checkout-pro-preferences/create-payment-preference?utm_source=chatgpt.com "Create and configure a payment preference - Mercado Pago Developers"
[5]: https://www.mercadopago.com.ar/developers/es/docs/links-and-debts/additional-content/your-integrations/notifications?utm_source=chatgpt.com "Notificaciones - Mercado Pago Developers"
[6]: https://supabase.com/docs/guides/database/postgres/row-level-security?utm_source=chatgpt.com "Row Level Security | Supabase Docs"
[7]: https://www.postgresql.org/docs/13/datatype-money.html?utm_source=chatgpt.com "PostgreSQL: Documentation: 13: 8.2. Monetary Types"
