/* eslint-disable no-undef */
import Fastify from "fastify";
import dotenv from "dotenv";
import OpenAI from "openai";
import { generateSchemaInstructions } from "./util.js";

dotenv.config();

if (!process.env.OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY environment variable");
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});

const fastify = Fastify({
  logger: {
    development: {
      transport: {
        target: "pino-pretty",
        options: {
          translateTime: "HH:MM:ss Z",
          ignore: "pid,hostname",
        },
      },
    },
    production: true,
    test: false,
  },
});

await fastify.register(import("@fastify/cors"), {
  origin: true,
});

fastify.post("/command", async (request, reply) => {
  try {
    const { systemPrompt, prompt } = request.body;

    if (!systemPrompt || !prompt) {
      reply
        .code(400)
        .send({ error: "Missing required fields: systemPrompt or prompt" });
      return;
    }

    const schemaInstructions = generateSchemaInstructions(systemPrompt);

    const response = await openai.chat.completions.create({
      model: "gemini-2.0-flash",
      messages: [
        { role: "system", content: schemaInstructions },
        { role: "user", content: prompt },
      ],
    });

    const rawContent = response.choices[0].message.content;
    const jsonContent = rawContent.replace(/```json|```/g, "").trim();
    const parsedData = JSON.parse(jsonContent);

    // Validate the response matches the schema
    if (
      !parsedData.type ||
      !parsedData.layout ||
      !Array.isArray(parsedData.children)
    ) {
      throw new Error("AI response does not match required schema");
    }

    reply.send(parsedData);
  } catch (error) {
    request.log.error(error);
    reply
      .code(500)
      .send({ error: "Failed to fetch AI response", details: error.message });
  }
});

fastify.get("/components", async (request, reply) => {
  try {
    const response = await fetch(
      "https://api.figma.com/v1/files/5dgFdCHB6FGjfOPAZEDNVK/components",
      {
        headers: {
          "X-Figma-Token": process.env.FIGMA_TOKEN || "",
        },
      }
    );
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    const parsedData = data.meta?.components || [];

    reply.send(parsedData);
  } catch (error) {
    reply.code(500).send({
      error: "Failed to fetch Figma response",
      details: error.message,
    });
  }
});

try {
  const port = process.env.PORT || 3000;
  await fastify.listen({ port, host: "0.0.0.0" });
  // eslint-disable-next-line no-undef
  console.log(`Server is running on http://0.0.0.0:${port}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
