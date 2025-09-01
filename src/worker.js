// CÓDIGO DEL ORQUESTADOR - VERSIÓN FINAL QUE ENTIENDE CONVERSACIONES
export class StateManager {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request) {
    // El estado se guarda en el almacenamiento persistente del Durable Object.
    // 'conversations' es un mapa: { "chat_id_1": "agent_id_1", "chat_id_2": "agent_id_2" }
    let conversations = (await this.state.storage.get("conversations")) || {};
    
    // Lista de todos los agentes disponibles.
    const ALL_AGENTS = [
      { id: "agent_2034d1ed26b7511957e3168643", url: this.env.AGENT1_URL },
      { id: "agent_68559fb3b0132580cea9adfb25", url: this.env.AGENT2_URL },
    ];

    const payload = await request.json();
    const chatId = payload.message.chat.id.toString(); // El ID de la conversación actual

    let targetAgent;

    // 1. ¿Ya hay una conversación activa para este chat_id?
    const assignedAgentId = conversations[chatId];
    if (assignedAgentId) {
      targetAgent = ALL_AGENTS.find(a => a.id === assignedAgentId);
    }

    // 2. Si no, ¿hay un agente libre para una nueva conversación?
    if (!targetAgent) {
      const busyAgentIds = Object.values(conversations);
      const freeAgent = ALL_AGENTS.find(a => !busyAgentIds.includes(a.id));

      if (freeAgent) {
        // Asignamos este agente libre a la nueva conversación.
        conversations[chatId] = freeAgent.id;
        targetAgent = freeAgent;
        // Guardamos el nuevo estado de las conversaciones.
        await this.state.storage.put("conversations", conversations);
      }
    }

    // 3. Si encontramos un agente (ya sea asignado o uno nuevo libre)
    if (targetAgent) {
      const taskPayload = { telegramPayload: payload, agentId: targetAgent.id };
      // Enviamos la tarea al worker del agente correspondiente.
      fetch(targetAgent.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskPayload),
      });
      return new Response(`Task dispatched to agent ${targetAgent.id} for chat ${chatId}`);
    } else {
      // 4. Si no hay agente asignado y tampoco hay agentes libres.
      // Aquí se podría encolar el mensaje o responder que están ocupados.
      // Por ahora, respondemos directamente.
      const busyResponse = "Lo siento, todos nuestros agentes están ocupados en este momento. Por favor, inténtalo de nuevo más tarde.";
      const telegramApiUrl = `https://api.telegram.org/bot${this.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
      await fetch(telegramApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: busyResponse } ),
      });
      return new Response("All agents are busy.", { status: 503 });
    }
  }
}

// El Worker de Entrada no cambia.
export default {
  async fetch(request, env, ctx) {
    let id = env.STATE_MANAGER.idFromName("SociobotManager");
    let stub = env.STATE_MANAGER.get(id);
    return stub.fetch(request);
  },
};

