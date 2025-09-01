// ORQUESTADOR SIN DURABLE OBJECTS - USA KV
export default {
  async fetch(request, env, ctx ) {
    const AGENTS = [
      { id: "agent_2034d1ed26b7511957e3168643", url: env.AGENT1_URL, status_key: "AGENT1_STATUS" },
      { id: "agent_68559fb3b0132580cea9adfb25", url: env.AGENT2_URL, status_key: "AGENT2_STATUS" },
    ];

    const payload = await request.json();
    const chatId = payload.message.chat.id.toString();

    // Buscamos un agente libre en el KV
    let freeAgent = null;
    for (const agent of AGENTS) {
      const status = await env.AGENTS_KV.get(agent.status_key);
      if (status !== "busy") {
        freeAgent = agent;
        break;
      }
    }

    if (freeAgent) {
      // Lo marcamos como ocupado en el KV
      await env.AGENTS_KV.put(freeAgent.status_key, "busy");

      const taskPayload = { telegramPayload: payload, agentId: freeAgent.id };

      // DESPERTAMOS AL AGENTE con una llamada directa
      fetch(freeAgent.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskPayload),
      });

      // Ponemos un seguro de vida para liberar el agente en el KV después de 3 minutos
      ctx.waitUntil(new Promise(resolve => setTimeout(async () => {
        await env.AGENTS_KV.put(freeAgent.status_key, "free");
        resolve();
      }, 180000)));

      return new Response(`Task dispatched to ${freeAgent.id}`);
    } else {
      // Todos ocupados
      const busyResponse = "Lo siento, todos nuestros agentes están ocupados. Inténtalo más tarde.";
      const telegramApiUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
      await fetch(telegramApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: busyResponse } ),
      });
      return new Response("All agents busy", { status: 503 });
    }
  },
};


