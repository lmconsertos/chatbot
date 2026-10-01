# LMConsertos WhatsApp Bot

Backend inicial para atendimento automático da LMConsertos pelo WhatsApp Business Platform (Cloud API).

## Fluxo atual

1. Cliente entra pelo botão de contato do site.
2. WhatsApp recebe a mensagem inicial.
3. Bot apresenta os serviços:
   - Conserto de inversor solar
   - Conserto de inversor de frequência
   - Conserto/manutenção de esteira
   - Outro serviço
4. O bot coleta nome, marca/modelo ou descrição do equipamento, defeito, fotos/vídeo e cidade/bairro.
5. As informações são registradas no log como lead.
6. O bot envia a confirmação e encerra o fluxo automático.
7. A partir daí, novas mensagens não recebem respostas automáticas, permitindo a continuidade do atendimento humano.

## Rodar localmente

Requisitos: Node.js 20 ou superior.

```bash
npm install
npm start
```

Copie `.env.example` para `.env` e configure as credenciais da Meta.

## Webhook

- GET `/webhook`: verificação do webhook da Meta.
- POST `/webhook`: recebimento das mensagens.
- GET `/health`: teste de disponibilidade.

O servidor precisa estar publicado em HTTPS para ser usado pela Meta em produção.

## Próximas etapas

- Conectar e validar o número do WhatsApp Business.
- Configurar o webhook público HTTPS.
- Trocar o armazenamento em memória por banco de dados para não perder sessões quando o servidor reiniciar.
- Salvar leads de forma estruturada.
- Integrar o botão do site com a mensagem inicial.
- Criar um mecanismo para assumir/reabrir atendimentos manualmente.
