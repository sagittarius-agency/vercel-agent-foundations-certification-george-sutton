/**
 * This is where your agent will live.
 *
 * During the workshop you'll define a `ToolLoopAgent` here, give it a model
 * and instructions, and later add tools (web search, sandbox, etc.). The
 * route handler in `app/api/chat/route.ts` and the `useChat` call in
 * `components/agent-chat.tsx` will both import from this file.
 *
 * Workshop docs: https://agent-foundations-certification.vercel.app/docs/chat-agent
 */

import {
  tool,
  ToolLoopAgent,
  type InferAgentUIMessage,
  type UIToolInvocation,
} from "ai";
import { z } from "zod";
import {
  ApiRequestError,
  cartAdd,
  cartCreate,
  getCategories,
  getProductById,
  getProductStock,
  getProducts,
} from "@/lib/api";
import { getCartToken } from "@/lib/cart-token";

import { start } from "workflow/api";
import { returnFlow } from "./workflows/return-flow";

export type ShoppingAgentUIMessage = InferAgentUIMessage<typeof shoppingAgent>;
export type ProductDetailsToolInvocation = UIToolInvocation<
  typeof getProductDetails
>;
export type CategoriesToolInvocation = UIToolInvocation<
  typeof getAllCategories
>;
export type SearchProductsToolInvocation = UIToolInvocation<
  typeof searchProducts
>;
export type AddToCartToolInvocation = UIToolInvocation<typeof addToCart>;

const searchProducts = tool({
  description: `Search the Vercel swag store product catalog. Use this whenever the user asks about products, what the store sells, or wants recommendations. Optionally narrow results to a single category.`,
  inputSchema: z.object({
    query: z
      .string()
      .optional()
      .describe(
        `Optional, free-text search terms describing what the user is looking for, e.g. 'hoodie' or 'water bottle'.`
      ),
    category: z
      .string()
      .optional()
      .describe(
        `Optional category slug to filter results. Only set this when the user clearly wants a specific category. Use the getAllCategories tool to get all valid categories.`
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
        products: products.map(p => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          price: p.price,
          currency: p.currency,
          category: p.category,
          description: p.description,
        })),
      };
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { count: 0, products: [], error: message };
    }
  },
});

const getAllCategories = tool({
  description: `List every product category available in the Vercel swag store, along with the number of products in each. Use this when the user asks what categories exist, what kinds of products are sold, or wants to browse the store at a high level.`,
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const categories = await getCategories();
      return {
        count: categories.length,
        categories: categories.map(c => ({
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

const getProductDetails = tool({
  description: `Get the product details of a single product.`,
  inputSchema: z.object({
    id: z.string().describe(`Product ID`),
  }),
  execute: async ({ id }) => {
    try {
      const product = await getProductById(id);
      return product;
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { error: message };
    }
  },
});

const getProductStockLevel = tool({
  description: `Get the stock/availability information for a single product.`,
  inputSchema: z.object({
    slugOrId: z.string().describe(`Product slug or ID`),
  }),
  execute: async ({ slugOrId }) => {
    try {
      const stock = await getProductStock(slugOrId);
      return stock;
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { error: message };
    }
  },
});

const addToCart = tool({
  description: `Add a product to the user's shopping cart. Use this when the user asks to add a product to their cart or wants to buy something.`,
  inputSchema: z.object({
    productId: z.string().describe(`The ID of the product to add to the cart`),
    quantity: z
      .number()
      .int()
      .positive()
      .optional()
      .describe(`Number of units to add. Defaults to 1.`),
  }),
  execute: async ({ productId, quantity = 1 }) => {
    try {
      // Read-only cookie access works in a streaming route handler;
      // writing cookies mid-stream does not, so we bypass addToCartAction.
      let token = await getCartToken();
      if (!token) {
        const { token: newToken } = await cartCreate();
        token = newToken;
      }
      const cart = await cartAdd(token, productId, quantity);
      return {
        success: true,
        totalItems: cart.totalItems,
        subtotal: cart.subtotal,
        currency: cart.currency,
      };
    } catch (err) {
      const message =
        err instanceof ApiRequestError ? err.message : "Unknown error";
      return { success: false, error: message };
    }
  },
});

const processReturn = tool({
  description: `File a return for one of the user's orders. The user must provide an order ID. Valid order IDs in this demo are 11111, 22222, 33333, 44444, 55555. Returns immediately.`,
  inputSchema: z.object({
    orderId: z.string().describe("The order ID the user wants to return."),
    reason: z
      .string()
      .min(10)
      .max(500)
      .describe("Why the user is returning the order."),
  }),
  execute: async ({ orderId, reason }) => {
    try {
      const run = await start(returnFlow, [orderId, reason]);
      return {
        runId: run.runId,
        message: `Return filed for order ${orderId}.`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { error: message };
    }
  },
});

export const shoppingAgent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-4.6",
  instructions: `You are a helpful assistant for the Vercel swag store. When the user asks about products, availability, or recommendations, use the searchProducts tool to look up real catalog data before answering.
  When asked about a type or category of product use the getAllCategories tool for getting valid categories before using searchProducts.
  When asked about a single product use getProductDetails. After calling getProductDetails, a product card is automatically rendered in the UI showing the name, price, description, tags, and a link — do not repeat any of that information in your text reply.
  When asked about stock, availability, or inventory for a specific product use getProductStockLevel.
  When the user asks to add a product to their cart or wants to purchase something, use the addToCart tool with the product's ID. Confirm the item was added and mention the updated cart total.
  When the user wants to return an order use the processReturn tool. Ask for the order ID and reason if they haven't given them. Valid demo order IDs are 11111-55555.`,
  tools: {
    searchProducts,
    getAllCategories,
    getProductDetails,
    getProductStockLevel,
    addToCart,
    processReturn,
  },
});

export {};
