import debug from 'debug';
import { Context } from "grammy";
import { aiService } from './services/ai-service';
import { databaseService } from './services/database';
import { translationService } from './services/translator';

const debugLog = debug("bot:poll");

export async function handlePollCommand(ctx: Context) {
  debugLog("Triggered poll command");

  let loadingMsg;
  try {
    // Send loading message
    loadingMsg = await ctx.reply("🤖 Генерую опитування...\n⬜️⬜️⬜️⬜️⬜️");

    // Step 1: Fetch existing polls from database
    await ctx.api.editMessageText(ctx.chat!.id, loadingMsg.message_id, "📊 Завантажую історію опитувань... (20%)\n🟩⬜️⬜️⬜️⬜️");
    const existingPolls = await databaseService.getAllPolls();
    debugLog(`Found ${existingPolls.length} existing polls`);

    // Step 2: Generate new poll with AI
    await ctx.api.editMessageText(ctx.chat!.id, loadingMsg.message_id, "🧠 Генерую нове опитування... (40%)\n🟩🟩⬜️⬜️⬜️");
    const generatedPoll = await aiService.generatePoll(existingPolls);
    debugLog("Generated poll:", generatedPoll);

    // Step 3: Translate to Ukrainian
    await ctx.api.editMessageText(ctx.chat!.id, loadingMsg.message_id, "🌍 Перекладаю українською... (60%)\n🟩🟩🟩⬜️⬜️");
    const translatedPoll = await translationService.translatePoll(
      generatedPoll.question,
      generatedPoll.option1,
      generatedPoll.option2
    );
    debugLog("Translated poll:", translatedPoll);

    // Step 4: Store in database
    await ctx.api.editMessageText(ctx.chat!.id, loadingMsg.message_id, "💾 Зберігаю в базу даних... (80%)\n🟩🟩🟩🟩⬜️");
    await databaseService.addPoll({
      question: translatedPoll.question,
      option1: translatedPoll.option1,
      option2: translatedPoll.option2
    });

    // Step 5: Send the poll
    await ctx.api.editMessageText(ctx.chat!.id, loadingMsg.message_id, "✅ Готово! (100%)\n🟩🟩🟩🟩🟩");

    // Format and send the poll message
    const pollMessage = `${translatedPoll.question}\n\n🅰️ ${translatedPoll.option1}\n\n🅱️ ${translatedPoll.option2}`;

    await ctx.reply(pollMessage, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🅰️", callback_data: "poll_option_a" },
            { text: "🅱️", callback_data: "poll_option_b" }
          ]
        ]
      }
    });

    // Cleanup loading message
    if (loadingMsg) {
      await ctx.api.deleteMessage(ctx.chat!.id, loadingMsg.message_id);
    }

  } catch (error) {
    console.error("Error generating poll:", error);
    debugLog("Poll generation failed:", error);

    if (loadingMsg) {
      await ctx.api.deleteMessage(ctx.chat!.id, loadingMsg.message_id);
    }

    const errorMsg = await ctx.reply("❌ Помилка при генерації опитування. Спробуйте пізніше.");

    // Auto-delete error message after 5 seconds
    setTimeout(async () => {
      try {
        await ctx.api.deleteMessage(ctx.chat!.id, errorMsg.message_id);
      } catch (deleteError) {
        // Ignore delete errors
      }
    }, 5000);
  }
}
