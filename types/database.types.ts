/**
 * Tipos de la base de datos.
 *
 * Escritos a mano a partir del esquema canónico de `specs/base.md`.
 * Si se instala Supabase CLI, pueden regenerarse con:
 *   supabase gen types typescript --project-id <ref> > types/database.types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type TableDefinition<Row> = {
  Row: Row
  Insert: Partial<Row>
  Update: Partial<Row>
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      products: TableDefinition<{
        id: string
        name: string
        slug: string
        description: string | null
        status: 'draft' | 'active' | 'archived'
        brand: string | null
        product_type: string | null
        created_at: string
        updated_at: string
        deleted_at: string | null
      }>
      sizes: TableDefinition<{
        id: string
        name: string
        sort_order: number
      }>
      colors: TableDefinition<{
        id: string
        name: string
        hex_code: string | null
        sort_order: number
      }>
      product_variants: TableDefinition<{
        id: string
        product_id: string
        size_id: string | null
        color_id: string | null
        sku: string
        price: number
        compare_at_price: number | null
        cost_price: number | null
        barcode: string | null
        weight_grams: number | null
        is_active: boolean
        created_at: string
      }>
      categories: TableDefinition<{
        id: string
        name: string
        slug: string
        description: string | null
        parent_id: string | null
      }>
      product_categories: TableDefinition<{
        product_id: string
        category_id: string
      }>
      product_images: TableDefinition<{
        id: string
        product_id: string
        variant_id: string | null
        storage_path: string
        alt_text: string | null
        sort_order: number
        created_at: string
      }>
      profiles: TableDefinition<{
        id: string
        first_name: string | null
        last_name: string | null
        phone: string | null
        created_at: string
        updated_at: string
      }>
      carts: TableDefinition<{
        id: string
        user_id: string | null
        session_token: string | null
        status: 'active' | 'converted' | 'abandoned'
        created_at: string
        updated_at: string
      }>
      cart_items: TableDefinition<{
        id: string
        cart_id: string
        variant_id: string
        quantity: number
        created_at: string
      }>
      addresses: TableDefinition<{
        id: string
        user_id: string
        recipient_name: string
        address_line1: string
        address_line2: string | null
        city: string
        state: string | null
        postal_code: string
        country: string
        phone: string | null
        is_default: boolean
        created_at: string
      }>
      inventory_levels: TableDefinition<{
        id: string
        variant_id: string
        quantity: number
        reserved_quantity: number
        updated_at: string
      }>
      inventory_movements: TableDefinition<{
        id: string
        variant_id: string
        quantity: number
        movement_type:
          | 'purchase'
          | 'sale'
          | 'reservation'
          | 'release'
          | 'adjustment'
          | 'return'
        reference_id: string | null
        note: string | null
        created_at: string
      }>
      orders: TableDefinition<{
        id: string
        order_number: number
        user_id: string | null
        email: string
        status:
          | 'pending'
          | 'confirmed'
          | 'processing'
          | 'shipped'
          | 'completed'
          | 'cancelled'
          | 'refunded'
        payment_status:
          | 'pending'
          | 'approved'
          | 'rejected'
          | 'refunded'
          | 'cancelled'
        fulfillment_status:
          | 'unfulfilled'
          | 'processing'
          | 'packed'
          | 'shipped'
          | 'delivered'
          | 'returned'
        currency: string
        subtotal: number
        discount_total: number
        shipping_total: number
        tax_total: number
        total: number
        customer_note: string | null
        idempotency_key: string | null
        created_at: string
        updated_at: string
      }>
      order_items: TableDefinition<{
        id: string
        order_id: string
        product_id: string | null
        variant_id: string | null
        sku: string | null
        product_name: string
        variant_description: string | null
        unit_price: number
        quantity: number
        line_total: number
        created_at: string
      }>
      order_addresses: TableDefinition<{
        id: string
        order_id: string
        address_type: 'shipping' | 'billing'
        recipient_name: string
        address_line1: string
        address_line2: string | null
        city: string
        state: string | null
        postal_code: string
        country: string
        phone: string | null
      }>
      payments: TableDefinition<{
        id: string
        order_id: string
        provider: 'mercadopago' | 'cash' | 'bank_transfer' | 'other'
        provider_payment_id: string | null
        provider_preference_id: string | null
        status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'refunded'
        amount: number
        currency: string
        raw_response: Json | null
        paid_at: string | null
        created_at: string
        updated_at: string
      }>
    }
    Views: {
      product_variant_availability: {
        Row: {
          variant_id: string | null
          available: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      create_checkout_order: {
        Args: {
          p_user_id: string | null
          p_email: string
          p_items: Json
          p_idempotency_key?: string | null
          p_cart_id?: string | null
        }
        Returns: Database['public']['Tables']['orders']['Row']
      }
      confirm_order_inventory: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      release_order_inventory: {
        Args: { p_order_id: string }
        Returns: undefined
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
