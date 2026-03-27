import { NextRequest, NextResponse } from "next/server";
import { handleStart, handleTextMessage, handleCallbackQuery, saveUserProfile } from "@/lib/bot";

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  // Verify Telegram secret token
  if (WEBHOOK_SECRET) {
    const token = request.headers.get("x-telegram-bot-api-secret-token");
    if (token !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
  }

  try {
    const update = await request.json();

    if (update.message) {
      const chatId = update.message.chat.id;
      const from = update.message.from;
      const userId = String(from.id);
      const text = update.message.text || "";

      await saveUserProfile(userId, from);
      await handleTextMessage(chatId, userId, text);
    }

    if (update.callback_query) {
      const chatId = update.callback_query.message.chat.id;
      const messageId = update.callback_query.message.message_id;
      const from = update.callback_query.from;
      const userId = String(from.id);
      const data = update.callback_query.data || "";

      await saveUserProfile(userId, from);
      await handleCallbackQuery(chatId, messageId, userId, data, update.callback_query.id);
    }
  } catch (error) {
    console.error("Telegram webhook error:", error);
  }

  return NextResponse.json({ ok: true });
}
