const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

class ChatService {
  async chat(messages) {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: "openai/gpt-oss-20b:free",
          messages,
        }),
      }
    );

    const data = await response.json();
    return data;
  }
}

module.exports = new ChatService();