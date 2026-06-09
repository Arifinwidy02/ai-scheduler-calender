// @ts-ignore
import { GoogleGenAI } from "@google/genai";
import { Client, LocalAuth } from "whatsapp-web.js";
// @ts-ignore
import qrcode from "qrcode-terminal";
import { createCalendarEvent, calendarToolDefinition } from "./calendar";
import * as dotenv from "dotenv";

dotenv.config();

// Inisialisasi Gemini Client menggunakan SDK terbaru
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const whatsapp = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  },
});

let codeHaveShown = false;

whatsapp.on("qr", async (qr) => {
  if (codeHaveShown) return;

  try {
    const nomorBot = "6281392816836";
    codeHaveShown = true;

    console.log(`[System] Meminta Pairing Code untuk: ${nomorBot}`);

    // Berikan sedikit delay 3 detik agar halaman whatsapp web benar-benar siap
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const code = await whatsapp.requestPairingCode(nomorBot);

    console.log("\n=================================================");
    console.log(` KODE VERIFIKASI WHATSAPP ANDA: ${code} `);
    console.log("=================================================\n");
  } catch (error) {
    console.log("Gagal meminta pairing code, mecoba ulang nanti...", error);
    codeHaveShown = false;
  }
});

whatsapp.on("ready", () => console.log("WhatsApp Bot Ready !"));

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
      model: "gemini-2.5-flash",
      contents: msg.body + timeContext,
      config: {
        systemInstruction:
          "Anda adalah asisten kalender personal yang efisien. Deteksi kemauan user untuk membuat jadwal, lalu eksekusi menggunakan tool createCalendarEvent yang tersedia.",
        tools: [calendarToolDefinition],
      },
    });

    // Cek apakah Gemini memutuskan untuk memanggil Function Calling
    const functionCalls = response.functionCalls;

    // Pastikan array functionCalls ada, isinya lebih dari 0, dan indeks ke-0 tidak undefined
    if (functionCalls && functionCalls.length > 0 && functionCalls[0]) {
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
