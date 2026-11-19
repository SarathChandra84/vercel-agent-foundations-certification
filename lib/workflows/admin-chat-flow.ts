import { WorkflowAgent, type ModelCallStreamPart } from "@ai-sdk/workflow";
import { getWritable } from "workflow";
import {
  convertToModelMessages,
  type UIMessage,
} from "ai";
import {
  getReturnsHistory,
  getInventoryStock,
  getSalesAnalytics,
  getSupportTickets,
  searchProducts,
  getAllCategories,
} from "@/lib/tools";

export const backOfficeInstructions = `You are the back-office assistant for the Vercel swag store. You have read-only access to back-office data and the product catalog through these tools:
- Returns: getReturnsHistory
- Inventory: getInventoryStock
- Sales: getSalesAnalytics
- Support tickets: getSupportTickets
- Catalog search: searchProducts, getAllCategories
Be concrete: name specific products, give specific numbers, and state the date range you used. Keep answers short and scannable; lead with the headline number or finding, then a brief breakdown. Never promise to change anything in the store; you only have read tools.`;

export async function adminChatFlow(messages: UIMessage[], today: string) {
  "use workflow";

  const modelMessages = await convertToModelMessages(messages);

  const agent = new WorkflowAgent({
    model: "anthropic/claude-sonnet-5",
    instructions: `${backOfficeInstructions}\nToday's date is ${today}. Compute date ranges from this date, not from your training data. When the user gives no window, end the range today.`,
    tools: {
      getReturnsHistory,
      getInventoryStock,
      getSalesAnalytics,
      getSupportTickets,
      searchProducts,
      getAllCategories,
    },
  });

  await agent.stream({
    messages: modelMessages,
    writable: getWritable<ModelCallStreamPart>(),
  });
}
