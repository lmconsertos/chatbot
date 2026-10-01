const sessions = new Map();

const SERVICE_OPTIONS = {
  "1": "Conserto de inversor solar",
  "2": "Conserto de inversor de frequência",
  "3": "Conserto/manutenção de esteira",
  "4": "Outro"
};

function normalize(text) {
  return String(text || "").trim().toLowerCase();
}

function getText(message) {
  return (
    message?.text?.body ||
    message?.interactive?.button_reply?.title ||
    message?.interactive?.button_reply?.id ||
    message?.interactive?.list_reply?.title ||
    message?.interactive?.list_reply?.id ||
    ""
  );
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
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
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

function startMessage() {
  return [
    "Olá! Seja bem-vindo à LMConsertos.",
    "",
    "Somos especializados em conserto e manutenção de equipamentos eletrônicos.",
    "",
    "Para direcionar seu atendimento, selecione o serviço que você precisa:",
    "",
    "1️⃣ Conserto de inversor solar",
    "2️⃣ Conserto de inversor de frequência",
    "3️⃣ Conserto/manutenção de esteira",
    "4️⃣ Outro serviço"
  ].join("\\n");
}

function nameQuestion() {
  return "Para começarmos, qual é o seu nome?";
}

function serviceQuestion(service) {
  const questions = {
    "Conserto de inversor solar": [
      "Perfeito. Vamos avaliar o inversor solar.",
      "",
      "Qual é a marca e o modelo do equipamento?"
    ],
    "Conserto de inversor de frequência": [
      "Perfeito. Vamos avaliar o inversor de frequência.",
      "",
      "Qual é a marca e o modelo do equipamento?"
    ],
    "Conserto/manutenção de esteira": [
      "Perfeito. Vamos avaliar a esteira.",
      "",
      "Qual é a marca e o modelo da esteira?"
    ],
    "Outro": [
      "Certo. Vamos entender o que você precisa.",
      "",
      "Descreva brevemente o serviço ou equipamento."
    ]
  };

  return questions[service].join("\\n");
}

function faultQuestion(service) {
  if (service === "Conserto/manutenção de esteira") {
    return "O que está acontecendo com a esteira? Se possível, descreva o defeito apresentado.";
  }

  if (service === "Outro") {
    return "Se possível, informe também o defeito ou o que precisa ser realizado.";
  }

  return "O que está acontecendo com o equipamento? Se houver código ou mensagem de erro, informe também.";
}

function mediaQuestion() {
  return [
    "Se você tiver fotos ou um vídeo do equipamento, pode enviar aqui.",
    "",
    "Isso pode ajudar na avaliação inicial."
  ].join("\\n");
}

function locationQuestion() {
  return "Para verificarmos o atendimento na sua região, informe sua cidade e bairro.";
}

function endMessage(name) {
  return [
    `Obrigado, ${name}.`,
    "",
    "Recebi as informações do seu atendimento.",
    "Nossa equipe vai analisar os dados e continuar o contato com você pelo WhatsApp.",
    "",
    "Se tiver fotos, vídeos ou outras informações sobre o equipamento, pode enviá-los por aqui."
  ].join("\\n");
}

function saveLead(from, session) {
  console.log("[LEAD]", JSON.stringify({
    whatsapp: from,
    name: session.name,
    service: session.service,
    equipment: session.equipment,
    problem: session.problem,
    location: session.location,
    createdAt: new Date().toISOString()
  }));
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
    if (!from) return;

    // Mensagens sem texto (por exemplo, foto/vídeo) são aceitas durante a etapa de mídia.
    let session = sessions.get(from);

    if (!session) {
      session = { step: "SERVICE", mediaReceived: false };
      sessions.set(from, session);
      await sendText(from, startMessage());
      return;
    }

    if (session.step === "FINISHED") {
      console.log("[HUMAN HANDOFF] Nova mensagem recebida de", from);
      return;
    }

    if (session.step === "SERVICE") {
      const service = SERVICE_OPTIONS[normalize(input)];
      if (!service) {
        await sendText(from, "Por favor, escolha uma das opções de 1 a 4.");
        return;
      }

      session.service = service;
      session.step = "NAME";
      await sendText(from, nameQuestion());
      return;
    }

    if (session.step === "NAME") {
      session.name = input;
      session.step = "EQUIPMENT";
      await sendText(from, serviceQuestion(session.service));
      return;
    }

    if (session.step === "EQUIPMENT") {
      session.equipment = input;
      session.step = "PROBLEM";
      await sendText(from, faultQuestion(session.service));
      return;
    }

    if (session.step === "PROBLEM") {
      session.problem = input;
      session.step = "MEDIA";
      await sendText(from, mediaQuestion());
      return;
    }

    if (session.step === "MEDIA") {
      // O webhook pode entregar texto ou mídia. Registramos que o cliente chegou a esta etapa.
      session.mediaReceived = Boolean(message.image || message.video || input);
      session.step = "LOCATION";
      await sendText(from, locationQuestion());
      return;
    }

    if (session.step === "LOCATION") {
      session.location = input;
      session.step = "FINISHED";
      saveLead(from, session);
      await sendText(from, endMessage(session.name));
    }
  } catch (error) {
    console.error("Webhook error:", error);
  }
}
