/* eslint-disable no-undef */
import Fastify from "fastify";
import dotenv from "dotenv";
import https from "https";
import { generateSchemaInstructions } from "./util.js";

dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'EINSTEIN_API_KEY',
  'EINSTEIN_BASE_URL',
  'EINSTEIN_MODEL',
  'EINSTEIN_CLIENT_FEATURE_ID',
  'EINSTEIN_TENANT_ID'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing ${envVar} environment variable`);
    process.exit(1);
  }
}

// Configure HTTPS agent with custom options
const httpsAgent = new https.Agent({
  rejectUnauthorized: false, // Allow self-signed certificates
  keepAlive: true,
  timeout: 30000 // 30 second timeout
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
    const fullPrompt = `${schemaInstructions}\n\nUser Prompt: ${prompt}`;

    const response = await fetch(`${process.env.EINSTEIN_BASE_URL}/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `API_KEY ${process.env.EINSTEIN_API_KEY}`,
        "x-client-feature-id": process.env.EINSTEIN_CLIENT_FEATURE_ID,
        "x-sfdc-app-context": "EinsteinGPT",
        "x-sfdc-core-tenant-id": process.env.EINSTEIN_TENANT_ID
      },
      body: JSON.stringify({
        model: process.env.EINSTEIN_MODEL,
        prompt: fullPrompt
      }),
      timeout: 30000, // 30 second timeout
      agent: httpsAgent // Use the custom HTTPS agent
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Einstein API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const rawContent = data.generations[0].text;
    const jsonContent = rawContent.replace(/```json|```/g, "").trim();
    const parsedData = JSON.parse(jsonContent);

    // Validate multi-screen response structure
    if (!Array.isArray(parsedData.screens)) {
      throw new Error("AI response must contain a 'screens' array");
    }

    // Basic structure validation for each screen
    for (const screen of parsedData.screens) {
      if (
        !screen.id ||
        !screen.name ||
        !screen.layout ||
        !Array.isArray(screen.children)
      ) {
        throw new Error("Each screen must have id, name, layout, and children");
      }
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
    // Accept fileKeys as a comma-separated query param
    const fileKeys = (request.query.fileKeys || "").split(",").map(k => k.trim()).filter(Boolean);

    if (fileKeys.length === 0) {
      reply.code(400).send({ error: "No fileKeys provided" });
      return;
    }

    let allComponents = [];
    for (const fileKey of fileKeys) {
      const response = await fetch(
        `https://api.figma.com/v1/files/${fileKey}/components`,
        {
          headers: {
            "X-Figma-Token": process.env.FIGMA_TOKEN || "",
          },
        }
      );
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status} for fileKey: ${fileKey}`);
      }
      const data = await response.json();
      const parsedData = (data.meta && data.meta.components) || [];
      allComponents = allComponents.concat(parsedData);
    }

    reply.send(allComponents);
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
  console.log(`Server is running on http://0.0.0.0:${port}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
