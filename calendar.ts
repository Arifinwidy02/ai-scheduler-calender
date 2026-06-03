import { google } from "googleapis";
import { Type } from "@google/genai";

export async function createCalendarEvent(
  authJson: string,
  summary: string,
  startTime: string,
): Promise<string> {
  try {
    const credentials = JSON.parse(authJson);

    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });

    const calendar = google.calendar({ version: "v3", auth });
    const response = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: summary,
        start: { dateTime: startTime, timeZone: "Asia/Jakarta" },
        end: {
          dateTime: new Date(
            new Date(startTime).getTime() + 60 * 60 * 1000,
          ).toISOString(),
          timeZone: "Asia/Jakarta",
        },
      },
    });
    return `Sukses membuat jadwal! Link: ${response.data.htmlLink}`;
  } catch (error: any) {
    return `Gagal membuat jadwal: ${error.message}`;
  }
}

export const calendarToolDefinition = {
  functionDeclarations: [
    {
      name: "createCalendarEvent",
      description:
        "Membuat jadwal atau event baru di Google Calendar milik user.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          summary: {
            type: Type.STRING,
            description: "Judul atau deskripsi acara (misal: Meeting Kerja)",
          },
          startTime: {
            type: Type.STRING,
            description:
              "Waktu mulai dengan format ISO 8601 (misal: 2026-06-02T10:00:00)",
          },
        },
        required: ["summary", "startTime"],
      },
    },
  ],
};
