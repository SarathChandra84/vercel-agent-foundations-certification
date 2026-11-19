import { tool } from "ai";
import { z } from "zod";
import type { Product } from "@/lib/types";
import { ApiRequestError, createReturn, getCategories, getOrder, getProductById, getProductStock, getProducts, preauthorizeRefund, notifyReturnInProcess } from "@/lib/api";

// The fields the chat UI needs to render a ProductCard, plus description for the model.
const toListing = (p: Product) => ({
  id: p.id,
  name: p.name,
  slug: p.slug,
  price: p.price,
  currency: p.currency,
  category: p.category,
  images: p.images,
  description: p.description,
});

export const searchProducts = tool({
  description: `Search the store catalog for a BROAD lookup: several products matching a keyword, a category, or a general request ("what hoodies do you have", "show me drinkware", "recommend something for travel"). Returns up to 10 products. Do NOT use this to answer questions about one specific product. Use getProductDetails for that.`,
  inputSchema: z.object({
    query: z
      .string()
      .optional()
      .describe(
        `Optional free-text search terms describing what the user is looking for, e.g. 'hoodie' or 'water bottle'.`,
      ),
    category: z
      .string()
      .optional()
      .describe(
        `Optional category slug to filter results. Only set this when the user clearly wants a specific category. Use the getAllCategories tool to get all valid categories.`,
      ),
  }),
  execute: async ({ query, category }) => {
    try {
      const products = await getProducts({
        search: query,
        category,
        limit: 10,
      });
      return {
        count: products.length,
        products: products.map(toListing),
      };
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { count: 0, products: [], error: message };
    }
  },
});

export const getProductDetails = tool({
  description: `Get the full details for ONE specific product: its description, every image, price, tags, live stock level, and a few related products. Use this whenever the user asks about a single item, e.g. "tell me more about the black hoodie", "is the tumbler in stock?", or "what's the water bottle made of?". Pass the product's slug (preferred) or id. If you don't have it yet, call searchProducts first and use the slug from the matching result. Use searchProducts instead when the user is browsing or comparing several products.`,
  inputSchema: z.object({
    idOrSlug: z
      .string()
      .describe(
        `The product's slug or id, copied from a previous searchProducts or getProductDetails result. For example 'matte-black-insulated-tumbler' or 'tumbler_001'.`,
      ),
  }),
  execute: async ({ idOrSlug }) => {
    try {
      const [product, stock] = await Promise.all([
        getProductById(idOrSlug),
        // Stock is best-effort: if the stock endpoint fails, report it as unknown (null)
        // instead of failing the whole lookup.
        getProductStock(idOrSlug).catch(() => null),
      ]);

      // Related products: other items in the same category. The API has no dedicated endpoint.
      const sameCategory = await getProducts({
        category: product.category,
        limit: 5,
      }).catch(() => [] as Product[]);

      return {
        product: {
          ...toListing(product),
          tags: product.tags,
          featured: product.featured,
        },
        stock: stock
          ? {
              units: stock.stock,
              inStock: stock.inStock,
              lowStock: stock.lowStock,
            }
          : null,
        related: sameCategory
          .filter((p) => p.id !== product.id)
          .slice(0, 4)
          .map(toListing),
      };
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { error: message };
    }
  },
});

export const getAllCategories = tool({
  description: `List every product category available in the Vercel swag store, along with the number of products in each. Use this when the user asks what categories exist, what kinds of products are sold, or wants to browse the store at a high level.`,
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const categories = await getCategories();
      return {
        count: categories.length,
        categories: categories.map((c) => ({
          slug: c.slug,
          name: c.name,
          productCount: c.productCount,
        })),
      };
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { count: 0, categories: [], error: message };
    }
  },
});

export const returnOrder = tool({
  description: `File a return for one of the user's past orders. The user must provide an order ID and a reason. Example order IDs: 11111, 22222, 33333.`,
  inputSchema: z.object({
    orderId: z
      .string()
      .describe("The order ID the user wants to return."),
    reason: z
      .string()
      .min(10)
      .max(500)
      .describe("Why the user is returning the order."),
  }),
  execute: async ({ orderId, reason }) => {
    try {
      const order = await getOrder(orderId);
      await notifyReturnInProcess(orderId);
      await preauthorizeRefund(orderId);
      const filed = await createReturn({
        orderId: order.id,
        items: order.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
        })),
        reason,
      });
      return { returnId: filed.id, status: filed.status };
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { error: message };
    }
  },
});
