// ORQUESTADOR REFORZADO - ANTI-404
export default {
  async fetch(request, env, ctx) {
    // 1. BLINDAJE ANTI-ERRORES
    // Si la petición no es un POST, o no tiene el encabezado correcto,
    // respondemos a Telegram con un "200 OK" para que se calle y no nos meta en la lista negra.
    if (request.method !== "POST" || !request.headers.get("content-type")?.includes("application/json")) {
      return new Response("OK. Webhook is alive.", { status: 200 });
    }

    try {
      // 2. LÓGICA DE ORQUESTACIÓN (la que ya teníamos)
      const AGENTS = [
        { id: "agent_2034d1ed26b7511957e3168643", url: env.AGENT1_URL, status_key: "AGENT1_STATUS" },
        { id: "agent_68559fb3b0132580cea9adfb25", url: env.AGENT2_URL, status_key: "AGENT2_STATUS" },
      ];

      const payload = await request.json();
      const chatId = payload.message?.chat?.id?.toString();

      // Si el payload no tiene la estructura de un mensaje, lo ignoramos.
      if (!chatId) {
        return new Response("OK. Not a message.", { status: 200 });
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
        await env.AGENTS_KV.put(freeAgent.status_key, "busy", { expirationTtl: 180 }); // Se libera solo en 3 mins
        const taskPayload = { telegramPayload: payload, agentId: freeAgent.id };
        ctx.waitUntil(fetch(freeAgent.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(taskPayload),
        }));
        return new Response("Task dispatched");
      } else {
        const busyResponse = "Lo siento, todos nuestros agentes están ocupados. Inténtalo más tarde.";
        const telegramApiUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
        ctx.waitUntil(fetch(telegramApiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: busyResponse } ),
        }));
        return new Response("All agents busy");
      }
    } catch (e) {
      // Si algo peta, devolvemos un OK para que Telegram no nos bloquee.
      return new Response("OK. Error handled.", { status: 200 });
    }
  },
};



