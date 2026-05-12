import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string;

const MODEL_NAME = (import.meta.env.VITE_MODEL_NAME as string) || "openrouter/free";
const MAX_TOKENS = parseInt((import.meta.env.VITE_MAX_TOKENS as string) || "4000");


// Helper to determine if we are using OpenRouter
const isOpenRouter = API_KEY?.startsWith("sk-or-");

// Initialize Google AI
export const ai = !isOpenRouter && API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

export interface ChatMessage {
  role: "user" | "model" | "assistant";
  content: string;
  reasoning_details?: string;
  parts?: { text: string }[];
}

export async function getChatResponse(messages: ChatMessage[], systemInstruction?: string) {
  if (isOpenRouter) {
    const formattedMessages = messages.map(m => ({
      role: m.role === "model" ? "assistant" : m.role,
      content: m.content,
      reasoning_details: m.reasoning_details
    }));

    if (systemInstruction) {
      formattedMessages.unshift({ role: "system" as any, content: systemInstruction, reasoning_details: undefined });
    }

    return getOpenRouterResponse(formattedMessages);
  }

  try {
    if (!ai) throw new Error("Google AI not initialized");
    const model = ai.getGenerativeModel({ 
      model: MODEL_NAME,
      systemInstruction: systemInstruction 
    });

    const chat = model.startChat({
      history: messages.slice(0, -1).map(m => ({
        role: m.role === "assistant" ? "model" : m.role as "user" | "model",
        parts: m.parts || [{ text: m.content }]
      })),
    });

    const result = await chat.sendMessage(messages[messages.length - 1].content);

    return { content: result.response.text() };
  } catch (error) {
    console.error("Gemini API Error:", error);
    return { content: "I'm sorry, I encountered an error while processing your request." };
  }
}

async function getOpenRouterResponse(messages: ChatMessage[]) {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": window.location.origin,
        "X-Title": "AS-ChatAI",
      },
      body: JSON.stringify({
        "model": MODEL_NAME,
        "messages": messages.map(m => ({
          role: m.role === "model" ? "assistant" : m.role,
          content: m.content,
          reasoning_details: m.reasoning_details
        })),
        "max_tokens": MAX_TOKENS
      })
    });

    if (!response.ok) {
      if (response.status === 402) {
        return { content: "Payment Required: Your OpenRouter account has insufficient credits. Please check your balance at openrouter.ai." };
      }
      if (response.status === 429) {
        return { content: "Rate Limit Reached: You're sending requests too quickly. Please wait a moment or switch to a different model." };
      }
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `OpenRouter API Error: ${response.status}`);
    }

    const data = await response.json();
    const message = data.choices[0].message;
    return {
      content: message.content,
      reasoning_details: message.reasoning_details
    };
  } catch (error) {
    console.error("OpenRouter API Error:", error);
    return { content: "Error connecting to OpenRouter." };
  }
}

export async function* getChatResponseStream(messages: ChatMessage[], signal?: AbortSignal, systemInstruction?: string) {
  if (isOpenRouter) {
    try {
      const formattedMessages = messages.map(m => ({
        role: m.role === "model" ? "assistant" : m.role,
        content: m.content,
        reasoning_details: m.reasoning_details
      }));

      if (systemInstruction) {
        formattedMessages.unshift({ role: "system" as any, content: systemInstruction, reasoning_details: undefined });
      }

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.origin,
          "X-Title": "AS-ChatAI",
        },
        body: JSON.stringify({
          "model": MODEL_NAME,
          "messages": formattedMessages,
          "stream": true,
          "max_tokens": MAX_TOKENS
        }),
        signal
      });

      if (!response.ok) {
        if (response.status === 402) {
          yield { type: "content", value: "Payment Required: Your OpenRouter account has insufficient credits. Please check your balance at openrouter.ai." };
          return;
        }
        if (response.status === 429) {
          yield { type: "content", value: "Rate Limit Reached: You're sending requests too quickly. Please wait a moment or switch to a different model." };
          return;
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `OpenRouter Streaming Error: ${response.status}`);
      }


      if (!response.body) throw new Error("No response body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const cleanLine = line.replace(/^data: /, "").trim();
          if (cleanLine === "" || cleanLine === "[DONE]") continue;

          try {
            const parsed = JSON.parse(cleanLine);
            const content = parsed.choices[0]?.delta?.content;
            const reasoning = parsed.choices[0]?.delta?.reasoning;

            if (content !== undefined && content !== null) yield { type: "content", value: content };
            if (reasoning !== undefined && reasoning !== null) yield { type: "reasoning", value: reasoning };

            if (parsed.choices[0]?.message?.reasoning_details) {
              yield { type: "reasoning_details", value: parsed.choices[0].message.reasoning_details };
            }
          } catch (e) {
            // Some lines might not be valid JSON
          }
        }
      }
    } catch (error: any) {
      console.error("OpenRouter Streaming Error:", error);
      yield { type: "content", value: `Connection failed: ${error.message || 'Check your internet or API key'}` };
    }
    return;
  }

  try {
    if (!ai) throw new Error("Google AI not initialized");
    
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === "assistant" ? "model" : m.role as "user" | "model",
      parts: [{ text: m.content }]
    }));

    // If there's a system instruction, we can try to put it in the history or model config
    // For @google/genai, let's see if we can use systemInstruction
    const model = ai.getGenerativeModel({ 
      model: MODEL_NAME,
      systemInstruction: systemInstruction 
    });

    const chat = model.startChat({
      history: history,
    });

    const result = await chat.sendMessageStream(messages[messages.length - 1].content);

    for await (const chunk of result.stream) {
      if (chunk.text) {
        yield { type: "content", value: chunk.text };
      }
    }
  } catch (error) {
    console.error("Gemini API Error:", error);
    yield { type: "content", value: "I'm sorry, I encountered an error." };
  }
}
