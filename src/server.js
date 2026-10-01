import express from "express";
import "dotenv/config";
import { handleWebhook, verifyWebhook } from "./whatsapp.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true, service: "lmconsertos-whatsapp-bot" }));

app.get("/webhook", verifyWebhook);
app.post("/webhook", handleWebhook);

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log("LMConsertos WhatsApp bot listening on port " + port));
