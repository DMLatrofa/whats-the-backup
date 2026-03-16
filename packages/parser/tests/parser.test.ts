import { describe, expect, it } from "vitest";

import { filterMessages, loadChat } from "../src/parser";

const sampleChatText = `[22/11/19, 08:31:08] Alice Example: Hello
[22/11/19, 08:31:09] Bob Example: Line one
line two
[22/11/19, 08:31:30] Alice Example: <attached: 00000004-AUDIO-2019-11-22-08-31-30.opus>
[22/11/19, 08:31:31] Messages and calls are end-to-end encrypted.
[14/01/26, 16:35:07] Alice Example: Photo? <attached: 00001139-PHOTO-2026-01-14-16-35-07.jpg>`;

describe("loadChat", () => {
  it("parses text, multiline messages, attachments, and system rows", () => {
    const chat = loadChat({
      archivePath: "C:/backup/WhatsApp Chat - Alice Example.zip",
      chatText: sampleChatText,
      attachments: [
        { entryName: "00000004-AUDIO-2019-11-22-08-31-30.opus", size: 9772 },
        { entryName: "00001139-PHOTO-2026-01-14-16-35-07.jpg", size: 144291 },
      ],
    });

    expect(chat.title).toBe("Alice Example");
    expect(chat.messageCount).toBe(5);
    expect(chat.participants).toEqual(["Alice Example", "Bob Example"]);
    expect(chat.messages[1].text).toBe("Line one\nline two");
    expect(chat.messages[2].type).toBe("audio");
    expect(chat.messages[2].attachment?.mimeType).toContain("audio");
    expect(chat.messages[3].isSystem).toBe(true);
    expect(chat.messages[4].type).toBe("image");
  });

  it("filters messages by sender and content", () => {
    const chat = loadChat({
      archivePath: "C:/backup/WhatsApp Chat - Alice Example.zip",
      chatText: sampleChatText,
      attachments: [],
    });

    expect(filterMessages(chat.messages, "bob")).toHaveLength(1);
    expect(filterMessages(chat.messages, "photo")).toHaveLength(1);
    expect(filterMessages(chat.messages, "")).toHaveLength(chat.messages.length);
  });
});
