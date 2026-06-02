// @ts-ignore

import { GoogleGenAI } from "@google/genai";
import { Client, LocalAuth } from "whatsapp-web.js";
// @ts-ignore
import qrcode from "qrcode-terminal";
import { createCalendarEvent, calendarToolDefinition } from "./calendar.ts";
import * as dotenv from "dotenv";

dotenv.config();

// Inisialisasi Gemini Client menggunakan SDK terbaru
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const whatsapp = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

whatsapp.on("qr", (qr) => {
  // Mengenerate QR code di terminal log
  qrcode.generate(qr, { small: true });
  console.log("=== SCAN QR CODE DI BAWAH INI ===\n", qr);
});

whatsapp.on("ready", () => console.log("WhatsApp Bot Ready!"));

whatsapp.on("message", async (msg) => {
  // Abaikan pesan jika berasal dari Group Chat
  if (msg.from.includes("@g.us")) return;

  const currentWaktu = new Date().toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
  });
  const timeContext = `\n\n[Konteks Waktu Sekarang: ${currentWaktu}]`;

  try {
    // Panggil model Gemini 1.5 Flash beserta tools kalendernya
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: msg.body + timeContext,
      config: {
        systemInstruction:
          "Anda adalah asisten kalender personal yang efisien. Deteksi kemauan user untuk membuat jadwal, lalu eksekusi menggunakan tool createCalendarEvent yang tersedia.",
        tools: [calendarToolDefinition],
      },
    });

    // Cek apakah Gemini memutuskan untuk memanggil Function Calling
    const functionCalls = response.functionCalls;
    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];

      if (call.name === "createCalendarEvent") {
        const args = call.args as any;

        await msg.reply(`Mengonfirmasi pembuatan jadwal: "${args.summary}"...`);

        // Eksekusi pembuatan event ke Google Calendar API
        const executionResult = await createCalendarEvent(
          process.env.GOOGLE_CREDENTIALS_JSON!,
          args.summary,
          args.startTime,
        );

        // Kirim link/status sukses kembali ke WhatsApp user
        await msg.reply(executionResult);
        return;
      }
    }

    // Jika pesan berupa obrolan biasa (tidak memicu tool), balas dengan text biasa
    if (response.text) {
      await msg.reply(response.text);
    }
  } catch (err: any) {
    console.error("Error saat memproses pesan:", err);
    await msg.reply(
      "Maaf, sistem gagal memproses permintaan jadwal Anda saat ini.",
    );
  }
});

whatsapp.initialize();
