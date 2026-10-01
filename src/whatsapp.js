const sessions = new Map();

const QUESTIONS = {
  START: "👋 Olá! Seja bem-vindo à LMConsertos!\n\nVou fazer algumas perguntas rápidas para entender o que você precisa.\n\nQual é o seu nome?",
  SERVICE: (name) => `Prazer, ${name}! 😊\n\nO que você está procurando?\n\n1️⃣ Catálogo digital\n2️⃣ Página de vendas\n3️⃣ Automação para WhatsApp\n4️⃣ Outro`,
  BUSINESS: "Perfeito! 👍\n\nQual é o seu tipo de negócio?\n\n1️⃣ Comércio\n2️⃣ Alimentação\n3️⃣ Prestação de serviços\n4️⃣ Outro",
  WEBSITE: "Ótimo! 😊\n\nSó mais uma informação:\nVocê já possui um site?\n\n1️⃣ Sim\n2️⃣ Não",
  END: (name) => `✅ Pronto, ${name}!\n\nRecebi suas informações. Nossa equipe vai analisar seu pedido e entrar em contato com você.\n\nObrigado pelo contato!\n\nA partir de agora, nossa equipe continuará o atendimento pessoalmente.`
};

const SERVICES = { "1": "Catálogo digital", "2": "Página de vendas", "3": "Automação para WhatsApp", "4": "Outro" };
const BUSINESSES = { "1": "Comércio", "2": "Alimentação", "3": "Prestação de serviços", "4": "Outro" };
const WEBSITES = { "1": "Sim", "2": "Não" };

function normalize(text) {
  return String(text || "").trim().toLowerCase();
}

function getText(message) {
  return message?.text?.body || message?.interactive?.button_reply?.id || message?.interactive?.list_reply?.id || "";
}

async function sendText(to, body) {
  const version = process.env.WHATSAPP_API_VERSION || "v23.0";
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneId || !token) {
    console.log("[DEMO] Mensagem para", to, ":", body);
    return;
  }

  const response = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`WhatsApp API error: ${response.status} ${error}`);
  }
}

export function verifyWebhook(req, res) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
}

export async function handleWebhook(req, res) {
  res.sendStatus(200);

  try {
    const message = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (!message) return;

    const from = message.from;
    const input = getText(message).trim();
    if (!from || !input) return;

    let session = sessions.get(from);

    if (!session || session.finished) {
      session = { step: "NAME", finished: false };
      sessions.set(from, session);
      await sendText(from, QUESTIONS.START);
      return;
    }

    const value = normalize(input);

    if (session.step === "NAME") {
      session.name = input;
      session.step = "SERVICE";
      await sendText(from, QUESTIONS.SERVICE(session.name));
      return;
    }

    if (session.step === "SERVICE") {
      if (!SERVICES[value]) return sendText(from, "Por favor, escolha uma opção de 1 a 4.");
      session.service = SERVICES[value];
      session.step = "BUSINESS";
      await sendText(from, QUESTIONS.BUSINESS);
      return;
    }

    if (session.step === "BUSINESS") {
      if (!BUSINESSES[value]) return sendText(from, "Por favor, escolha uma opção de 1 a 4.");
      session.business = BUSINESSES[value];
      session.step = "WEBSITE";
      await sendText(from, QUESTIONS.WEBSITE);
      return;
    }

    if (session.step === "WEBSITE") {
      if (!WEBSITES[value]) return sendText(from, "Por favor, escolha 1 para Sim ou 2 para Não.");
      session.website = WEBSITES[value];
      session.finished = true;
      session.step = "FINISHED";

      console.log("[LEAD]", JSON.stringify({
        whatsapp: from,
        name: session.name,
        service: session.service,
        business: session.business,
        website: session.website,
        createdAt: new Date().toISOString()
      }));

      await sendText(from, QUESTIONS.END(session.name));
    }
  } catch (error) {
    console.error("Webhook error:", error);
  }
}
