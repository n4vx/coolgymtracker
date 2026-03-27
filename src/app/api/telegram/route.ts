import { NextRequest, NextResponse } from "next/server";
import { handleStart, handleTextMessage, handleCallbackQuery } from "@/lib/bot";

export async function POST(request: NextRequest) {
  try {
    const update = await request.json();

    if (update.message) {
      const chatId = update.message.chat.id;
      const userId = String(update.message.from.id);
      const text = update.message.text || "";

      await handleTextMessage(chatId, userId, text);
    }

    if (update.callback_query) {
      const chatId = update.callback_query.message.chat.id;
      const messageId = update.callback_query.message.message_id;
      const userId = String(update.callback_query.from.id);
      const data = update.callback_query.data || "";

      await handleCallbackQuery(chatId, messageId, userId, data, update.callback_query.id);
    }
  } catch (error) {
    console.error("Telegram webhook error:", error);
  }

  return NextResponse.json({ ok: true });
}
