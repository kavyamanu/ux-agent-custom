/* eslint-disable no-undef */
import Fastify from "fastify";
import dotenv from "dotenv";
import https from "https";
import { generateSchemaInstructions } from "./util.js";

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

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
    console.log("Received request body:", request.body);
    const { systemPrompt, prompt, availableComponents } = request.body;

    if (!systemPrompt || !prompt) {
      reply
        .code(400)
        .send({ error: "Missing required fields: systemPrompt or prompt" });
      return;
    }

    const schemaInstructions = `You are a UI/UX design expert creating high-quality, professional designs using primitive components. Follow these guidelines:

1. Design Structure:
   - Create multiple screens when the design requires different views or states
   - Each screen MUST be exactly 1440px wide and at least 900px high
   - Each screen should be a frame containing other primitive elements
   - Use proper nesting and hierarchy for components
   - Maintain consistent spacing and alignment
   - Add descriptive IDs and names for each screen

2. Available Primitive Components:
   - frame: Container for other elements
   - text: Text elements
   - rectangle: Rectangular shapes
   - line: Line elements
   - image: Image elements

3. Layout Guidelines:
   - Screen width MUST be exactly 1440px
   - Screen height MUST be at least 900px
   - Set appropriate direction (horizontal/vertical)
   - Use consistent alignment (start/center/end)
   - Maintain proper spacing between elements
   - Apply appropriate padding
   - Position screens with proper spacing (64px between screens)

4. Component Properties:
   For all components:
   - id: Unique identifier
   - type: Component type (frame, text, rectangle, line, image)
   - layout: {
     width: number,
     height: number,
     x: number (optional),
     y: number (optional),
     direction: "horizontal" | "vertical" (for frames),
     alignment: "start" | "center" | "end" (for frames),
     spacing: number (for frames),
     padding: number (for frames)
   }
   - children: Array of child components (for frames)

   For text components:
   - text: The text content
   - properties: {
     fontSize: number,
     textAlign: "left" | "center" | "right" | "justified",
     color: { r: number, g: number, b: number },
     fontFamily: string (optional)
   }

   For rectangle components:
   - properties: {
     fill: { r: number, g: number, b: number },
     cornerRadius: number (optional),
     stroke: { r: number, g: number, b: number } (optional),
     strokeWidth: number (optional)
   }

   For line components:
   - properties: {
     stroke: { r: number, g: number, b: number },
     strokeWidth: number
   }

   For image components:
   - properties: {
     url: string,
     scaleMode: "fill" | "fit" | "tile" | "stretch"
   }

5. Response Format:
   IMPORTANT: You must respond with ONLY a valid JSON object, no other text or explanation.
   The JSON must follow this exact structure:
   {
     "screens": [
       {
         "id": "unique-id",
         "name": "descriptive-name",
         "type": "frame",
         "layout": {
           "width": 1440,
           "height": 900,
           "direction": "vertical",
           "alignment": "start",
           "spacing": 16,
           "padding": 24,
           "x": 0,
           "y": 0
         },
         "children": [
           {
             "id": "header-text",
             "type": "text",
             "text": "Welcome",
             "layout": {
               "width": 400,
               "height": 40
             },
             "properties": {
               "fontSize": 32,
               "textAlign": "center",
               "color": { "r": 0, "g": 0, "b": 0 }
             }
           },
           {
             "id": "content-frame",
             "type": "frame",
             "layout": {
               "width": 800,
               "height": 600,
               "direction": "vertical",
               "alignment": "center",
               "spacing": 16,
               "padding": 24
             },
             "children": [
               // Nested components
             ]
           }
         ]
       }
     ]
   }

6. Design Principles:
   - Create clear visual hierarchy
   - Use consistent spacing
   - Ensure proper alignment
   - Maintain readability
   - Follow accessibility guidelines
   - Position screens logically (e.g., left to right, top to bottom)`;

    const fullPrompt = `${schemaInstructions}\n\nUser Prompt: ${prompt}\n\nIMPORTANT: Respond with ONLY the JSON object, no other text or explanation.`;

    const payload = {
      model: "llmgateway__OpenAIGPT4Omni_08_06",
      prompt: fullPrompt
    };
    console.log("Sending fetch to AI with payload:", payload);

    const response = await fetch("https://bot-svc-llm.sfproxy.einstein.dev1-uswest2.aws.sfdc.cl/v1.0/generations", {
      method: "POST",
      headers: {
        "Authorization": `API_KEY 651192c5-37ff-440a-b930-7444c69f4422`,
        "Content-Type": "application/json",
        "X-LLM-Provider": "OpenAI",
        "x-sfdc-core-tenant-id": "core/falcontest1-core4sdb6/00DSB00000Mdzpe",
        "x-client-feature-id": "FigmaToSLDSCodeGenerator",
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Einstein API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const rawContent = data.generations[0].text;
    
    // Clean up the response to ensure it's valid JSON
    let jsonContent = rawContent
      .replace(/```json|```/g, "") // Remove markdown code blocks
      .replace(/^[^{]*/, "") // Remove any text before the first {
      .replace(/[^}]*$/, "") // Remove any text after the last }
      .trim();

    try {
      const parsedData = JSON.parse(jsonContent);

      // Validate multi-screen response structure
      if (!Array.isArray(parsedData.screens)) {
        throw new Error("AI response must contain a 'screens' array");
      }

      // Basic structure validation for each screen
      for (const screen of parsedData.screens) {
        if (!screen.id || !screen.type) {
          throw new Error("Each screen must have id and type");
        }
      }

      reply.send(parsedData);
    } catch (parseError) {
      console.error("Failed to parse AI response:", {
        rawContent,
        jsonContent,
        error: parseError
      });
      throw new Error(`Invalid JSON response from AI: ${parseError.message}`);
    }
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

// Add graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  fastify.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  fastify.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

// Function to find an available port
async function findAvailablePort(startPort) {
  const net = await import('net');
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(findAvailablePort(startPort + 1));
      } else {
        reject(err);
      }
    });
    server.listen(startPort, () => {
      server.close(() => {
        resolve(startPort);
      });
    });
  });
}

// Update the server startup code
try {
  const startPort = process.env.PORT || 3000;
  const port = await findAvailablePort(startPort);
  
  if (port !== startPort) {
    console.log(`Port ${startPort} is in use, using port ${port} instead`);
  }
  
  await fastify.listen({ port, host: "0.0.0.0" });
  console.log(`Server is running on http://0.0.0.0:${port}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
