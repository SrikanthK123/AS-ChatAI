export interface ChatMessage {
  role: "user" | "model" | "assistant";
  content: string;
  reasoning_details?: string;
  parts?: { text: string }[];
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const DEFAULT_MODEL = import.meta.env.VITE_MODEL_NAME || "google/gemma-2-9b-it:free";

export async function getChatResponse(messages: ChatMessage[], systemInstruction?: string, model: string = DEFAULT_MODEL) {
  try {
    const formattedMessages = messages.map(m => ({
      role: m.role === "model" ? "assistant" : m.role,
      content: m.content
    }));

    const response = await fetch(`${API_URL}/api/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: formattedMessages, systemInstruction, model }),
    });

    if (!response.ok) throw new Error(`Server error: ${response.status}`);
    const data = await response.json();
    return { content: data.choices[0].message.content };
  } catch (error) {
    console.error("AI Proxy Chat Error:", error);
    return { content: "I'm having trouble connecting to my brain." };
  }
}

export async function* getChatResponseStream(messages: ChatMessage[], model: string = DEFAULT_MODEL) {
  try {
    const formattedMessages = messages.map(m => ({
      role: m.role === "model" ? "assistant" : m.role,
      content: m.content
    }));

    const response = await fetch(`${API_URL}/api/ai/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: formattedMessages,
      }),
    });

    if (!response.ok) {
      let errorMsg = `Server error: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMsg = errorData.error?.message || errorData.error || errorMsg;
      } catch (e) {}
      throw new Error(errorMsg);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) throw new Error("No response body");

    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.trim() === "") continue;
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") return;
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || "";
            if (content) {
              yield { type: "content", value: content };
            }
          } catch (e) {
            console.error("Error parsing stream:", e);
          }
        }
      }
    }
  } catch (error: any) {
    console.error("AI Proxy Error:", error);
    yield { type: "content", value: `Connection failed: ${error.message || 'Check backend connection'}` };
  }
}
