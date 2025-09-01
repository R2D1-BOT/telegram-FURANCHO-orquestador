// ORQUESTADOR SIN BOZAL
export default {
  async fetch(request, env, ctx) {
    // Si no es un POST, fuera. Esta es la única comprobación que necesitamos.
    if (request.method !== "POST") {
      return new Response("OK");
    }

    try {
      const AGENTS = [
        { id: "agent_2034d1ed26b7511957e3168643", url: env.AGENT1_URL, status_key: "AGENT1_STATUS" },
        { id: "agent_68559fb3b0132580cea9adfb25", url: env.AGENT2_URL, status_key: "AGENT2_STATUS" },
      ];

      const payload = await request.json();
      const chatId = payload.message?.chat?.id?.toString();

      if (!chatId) {
        return new Response("OK. Not a message.");
      }

      let freeAgent = null;
      for (const agent of AGENTS) {
        const status = await env.AGENTS_KV.get(agent.status_key);
        if (status !== "busy") {
          freeAgent = agent;
          break;
        }
      }

      if (freeAgent) {
        await env.AGENTS_KV.put(freeAgent.status_key, "busy", { expirationTtl: 180 });
        const taskPayload = { telegramPayload: payload, agentId: freeAgent.id };
        const response = await fetch(freeAgent.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(taskPayload),
        }));
        return new Response("Task dispatched");
      } else {
        const busyResponse = "Lo siento, todos nuestros agentes están ocupados.";
        const telegramApiUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
        ctx.waitUntil(fetch(telegramApiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: busyResponse } ),
        }));
        return new Response("All agents busy");
      }
    } catch (e) {
      return new Response("OK. Error handled.");
    }
  },
};



