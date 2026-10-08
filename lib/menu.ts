import "server-only";
import { db, must } from "@/lib/supabase/service";
import type { CategoryRow, ProductRow } from "@/lib/types";

export interface MenuCategory {
  id: string;
  name: string;
  subtitle: string | null;
  featured: boolean;
  products: Pick<ProductRow, "id" | "name" | "description" | "price_cents" | "compare_at_cents" | "image_url">[];
}

/** Cardápio ativo do evento, na ordem definida no admin. */
export async function activeMenu(eventId: string): Promise<MenuCategory[]> {
  const [categories, products] = await Promise.all([
    db()
      .from("categories")
      .select("id, name, subtitle, featured, position")
      .eq("event_id", eventId)
      .eq("active", true)
      .order("position")
      .order("created_at"),
    db()
      .from("products")
      .select("id, category_id, name, description, price_cents, compare_at_cents, image_url, position")
      .eq("event_id", eventId)
      .eq("active", true)
      .order("position")
      .order("created_at"),
  ]);
  const cats = must(categories, "categorias") as Pick<CategoryRow, "id" | "name" | "subtitle" | "featured">[];
  const prods = must(products, "produtos") as ProductRow[];

  return cats
    .map((c) => ({
      id: c.id,
      name: c.name,
      subtitle: c.subtitle,
      featured: c.featured,
      products: prods
        .filter((p) => p.category_id === c.id)
        .map(({ id, name, description, price_cents, compare_at_cents, image_url }) => ({
          id,
          name,
          description,
          price_cents,
          compare_at_cents,
          image_url,
        })),
    }))
    .filter((c) => c.products.length > 0);
}
