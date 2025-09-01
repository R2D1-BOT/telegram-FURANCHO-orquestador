// Código del Orquestador (el Cerebro)
export class StateManager {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    // Lista de agentes obreros. El estado 'free'/'busy' se gestiona en memoria.
    this.agents = [
      { id: "agent_2034d1ed26b7511957e3168643", status: "free", url: this.env.AGENT1_URL },
      { id: "agent_68559fb3b0132580cea9adfb25", status: "free", url: this.env.AGENT2_URL },
    ];
  }

  async fetch(request) {
    // 1. Encontrar un agente libre
    const freeAgent = this.agents.find(agent => agent.status === "free");

    // 2. Si no hay ninguno, rechazar la petición
    if (!freeAgent) {
      return new Response("All agents are busy. Try again later.", { status: 503 });
    }

    // 3. Marcar el agente como ocupado
    freeAgent.status = "busy";

    // 4. Preparar y enviar la tarea al worker del agente
    const taskPayload = await request.json();
    fetch(freeAgent.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telegramPayload: taskPayload, agentId: freeAgent.id }),
    });

    // 5. Poner un temporizador de seguridad para liberar al agente
    // Si el agente falla y no avisa, no se queda bloqueado para siempre.
    setTimeout(() => {
      freeAgent.status = "free";
    }, 180000); // 3 minutos

    // 6. Responder a Telegram inmediatamente que la tarea ha sido despachada
    return new Response("Task dispatched to " + freeAgent.id);
  }
}

// Worker de Entrada: el único punto de contacto con el mundo exterior
export default {
  async fetch(request, env, ctx) {
    // Obtiene el Durable Object "StateManager"
    let id = env.STATE_MANAGER.idFromName("SociobotManager");
    let stub = env.STATE_MANAGER.get(id);
    // Le pasa la petición para que la gestione
    return stub.fetch(request);
  },
};
