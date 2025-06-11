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

    const schemaInstructions = `You are a UI/UX design expert creating high-quality, professional designs using given list of components. Follow these guidelines:

1. Design Structure and Quality Guidelines:
   - ALWAYS create multiple screens for a complete user flow
   - Each screen MUST be exactly 1440px wide and at least 900px high
   - Screens should be positioned horizontally with 64px spacing between them
   - Each screen should represent a distinct view or state in the user flow
   - Common screen types include:
     * Landing/Home page
     * Product/Service details
     * User profile/Account
     * Settings/Configuration
     * Checkout/Payment
     * Success/Confirmation
     * Error/404 pages
   - Use proper nesting and hierarchy for components
   - Maintain consistent spacing and alignment
   - Add descriptive IDs and names for each screen (e.g., "landing-page", "product-details", "checkout-flow")

2. Component Schema Definitions:
   IMPORTANT: Follow these exact schemas for each component type:

   a) Frame Component:
      {
        "id": "unique-id",
        "type": "frame",
        "layout": {
          "width": number,
          "height": number,
          "x": number,
          "y": number,
          "direction": "horizontal" | "vertical",
          "alignment": "start" | "center" | "end",
          "spacing": number,
          "padding": number
        },
        "children": [Node[]]
      }

   b) Text Component:
      {
        "id": "unique-id",
        "type": "text",
        "text": "string",
        "properties": {
          "text": {
            "fontSize": number,
            "color": { "r": number, "g": number, "b": number },
            "textAlign": "left" | "center" | "right" | "justified",
            "fontFamily": "string" (optional)
          }
        },
        "layout": {
          "width": number,
          "height": number,
          "x": number (optional),
          "y": number (optional)
        }
      }

   c) Button Component:
      {
        "id": "unique-id",
        "type": "button",
        "text": "string",
        "properties": {
          "fill": { "r": number, "g": number, "b": number },
          "cornerRadius": number,
          "stroke": { "r": number, "g": number, "b": number } (optional),
          "strokeWidth": number (optional)
        },
        "layout": {
          "width": number,
          "height": number,
          "x": number (optional),
          "y": number (optional)
        }
      }

   d) Card Component:
      {
        "id": "unique-id",
        "type": "card",
        "properties": {
          "fill": { "r": number, "g": number, "b": number },
          "cornerRadius": number,
          "shadow": boolean
        },
        "layout": {
          "width": number,
          "height": number,
          "x": number (optional),
          "y": number (optional)
        },
        "children": [Node[]]
      }

   e) Input Component:
      {
        "id": "unique-id",
        "type": "input",
        "properties": {
          "input": {
            "label": "string",
            "placeholder": "string",
            "value": "string" (optional),
            "type": "text" | "email" | "password" | "number",
            "required": boolean (optional),
            "disabled": boolean (optional)
          }
        },
        "layout": {
          "width": number,
          "height": number,
          "x": number (optional),
          "y": number (optional)
        }
      }

   f) Tab Component:
      {
        "id": "unique-id",
        "type": "tab",
        "properties": {
          "tab": {
            "label": "string",
            "selected": boolean (optional)
          }
        },
        "layout": {
          "width": number,
          "height": number,
          "x": number (optional),
          "y": number (optional)
        }
      }

   g) Divider Component:
      {
        "id": "unique-id",
        "type": "divider",
        "properties": {
          "divider": {
            "orientation": "horizontal" | "vertical",
            "color": { "r": number, "g": number, "b": number },
            "thickness": number
          }
        },
        "layout": {
          "width": number,
          "height": number,
          "x": number (optional),
          "y": number (optional)
        }
      }

   h) List Component:
      {
        "id": "unique-id",
        "type": "list",
        "properties": {
          "list": {
            "items": string[],
            "ordered": boolean (optional)
          }
        },
        "layout": {
          "width": number,
          "height": number,
          "x": number (optional),
          "y": number (optional)
        }
      }

   i) Table Component:
      {
        "id": "unique-id",
        "type": "table",
        "properties": {
          "table": {
            "columns": string[],
            "rows": string[][]
          }
        },
        "layout": {
          "width": number,
          "height": number,
          "x": number (optional),
          "y": number (optional)
        }
      }

   j) Header Component:
      {
        "id": "unique-id",
        "type": "header",
        "properties": {
          "header": {
            "backgroundColor": { "r": number, "g": number, "b": number } (optional)
          }
        },
        "layout": {
          "width": number,
          "height": number,
          "x": number (optional),
          "y": number (optional)
        },
        "children": [Node[]]
      }

   k) Footer Component:
      {
        "id": "unique-id",
        "type": "footer",
        "properties": {
          "footer": {
            "backgroundColor": { "r": number, "g": number, "b": number } (optional)
          }
        },
        "layout": {
          "width": number,
          "height": number,
          "x": number (optional),
          "y": number (optional)
        },
        "children": [Node[]]
      }

   l) Rectangle Component:
      {
        "id": "unique-id",
        "type": "rectangle",
        "properties": {
          "rectangle": {
            "fill": { "r": number, "g": number, "b": number },
            "cornerRadius": number (optional),
            "stroke": { "r": number, "g": number, "b": number } (optional),
            "strokeWidth": number (optional)
          }
        },
        "layout": {
          "width": number,
          "height": number,
          "x": number (optional),
          "y": number (optional)
        }
      }

   m) Line Component:
      {
        "id": "unique-id",
        "type": "line",
        "properties": {
          "line": {
            "stroke": { "r": number, "g": number, "b": number },
            "strokeWidth": number
          }
        },
        "layout": {
          "width": number,
          "height": number,
          "x": number (optional),
          "y": number (optional)
        }
      }

   n) Image Component:
      {
        "id": "unique-id",
        "type": "image",
        "properties": {
          "image": {
            "url": "string",
            "scaleMode": "fill" | "fit" | "tile" | "stretch"
          }
        },
        "layout": {
          "width": number,
          "height": number,
          "x": number (optional),
          "y": number (optional)
        }
      }

3. Component Usage Guidelines:
   - Always include required properties for each component type
   - Use appropriate layout values for each component
   - Follow the exact schema structure
   - Include proper nesting for components that support children
   - Use consistent naming conventions for IDs
   - Maintain proper component hierarchy

4. Screen Layout and Positioning:
   - First screen should be at x: 0
   - Each subsequent screen should be positioned at x: (previous_screen_x + previous_screen_width + 64)
   - All screens should be at y: 0
   - Example screen positions:
     * Screen 1: x: 0, y: 0
     * Screen 2: x: 1504 (1440 + 64), y: 0
     * Screen 3: x: 3008 (1504 + 1440 + 64), y: 0

5. Component Quality Guidelines:
   a) Text Components:
      - Use appropriate font sizes:
        * Headings: 24-32px
        * Subheadings: 18-20px
        * Body text: 14-16px
        * Small text: 12px
      - Use proper text colors:
        * Primary text: { r: 0.1, g: 0.1, b: 0.1 }
        * Secondary text: { r: 0.4, g: 0.4, b: 0.4 }
        * White text: { r: 1, g: 1, b: 1 }
      - Always include text alignment
      - Use proper line heights (1.2-1.5)

   b) Buttons:
      - Standard sizes:
        * Primary: 120-160px width, 40-48px height
        * Secondary: 100-140px width, 36-44px height
      - Proper padding: 16-24px horizontal, 8-12px vertical
      - Consistent corner radius: 6-8px
      - Clear visual hierarchy:
        * Primary: { r: 0.1, g: 0.5, b: 0.9 }
        * Secondary: { r: 0.95, g: 0.95, b: 0.95 }
      - Always include hover states in properties

   c) Cards:
      - Standard padding: 24px
      - Consistent corner radius: 12px
      - Proper shadow: { type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.15 }, offset: { x: 0, y: 4 }, radius: 12 }
      - Background color: { r: 1, g: 1, b: 1 }
      - Proper spacing between cards: 24-32px

   d) Input Fields:
      - Standard height: 40-48px
      - Proper padding: 12-16px
      - Border color: { r: 0.8, g: 0.8, b: 0.8 }
      - Focus state color: { r: 0.1, g: 0.5, b: 0.9 }
      - Always include placeholder text
      - Label text size: 14px
      - Error state styling

   e) Headers and Footers:
      - Header height: 64-80px
      - Footer height: 80-120px
      - Proper padding: 24-32px
      - Background color: { r: 0.97, g: 0.97, b: 0.97 }
      - Consistent navigation spacing: 24-32px

   f) Lists and Tables:
      - Proper row height: 40-48px
      - Consistent column widths
      - Header styling: bold, 14-16px
      - Cell padding: 12-16px
      - Alternating row colors
      - Proper borders and dividers

6. Layout and Spacing Guidelines:
   - Use consistent spacing system:
     * Extra small: 4px
     * Small: 8px
     * Medium: 16px
     * Large: 24px
     * Extra large: 32px
   - Maintain proper component hierarchy:
     * Section spacing: 48-64px
     * Component spacing: 24-32px
     * Element spacing: 16-24px
   - Use proper alignment:
     * Text: left for LTR languages
     * Headers: center or left
     * Buttons: center
     * Lists: left
   - Implement responsive layouts:
     * Use percentage-based widths where appropriate
     * Maintain minimum widths for components
     * Consider mobile breakpoints

7. Color and Style Guidelines:
   - Use a consistent color palette:
     * Primary: { r: 0.1, g: 0.5, b: 0.9 }
     * Secondary: { r: 0.4, g: 0.4, b: 0.4 }
     * Background: { r: 1, g: 1, b: 1 }
     * Surface: { r: 0.97, g: 0.97, b: 0.97 }
     * Error: { r: 0.9, g: 0.2, b: 0.2 }
     * Success: { r: 0.2, g: 0.8, b: 0.2 }
   - Maintain consistent styling:
     * Border radiuses
     * Shadow effects
     * Typography
     * Spacing
   - Use proper contrast ratios
   - Implement proper hover and active states

8. Response Format:
   IMPORTANT: You must respond with ONLY a valid JSON object, no other text or explanation.
   The JSON must have a top-level property "screens" which is an array of screen objects.
   Each screen must have:
   - id: Unique identifier (e.g., "landing-page", "product-details")
   - type: "frame" (NOT "container" or any other type)
   - layout: { width: 1440, height: 900, x: number, y: 0 }
   - children: Array of components

   Example of high-quality JSON:
   {
     "screens": [
       {
         "id": "landing-page",
         "type": "frame",
         "layout": { "width": 1440, "height": 900, "x": 0, "y": 0 },
         "children": [
           {
             "id": "header",
             "type": "header",
             "layout": { "width": 1440, "height": 64 },
             "properties": {
               "header": {
                 "backgroundColor": { "r": 0.97, "g": 0.97, "b": 0.97 }
               }
             },
             "children": [
               {
                 "id": "nav-logo",
                 "type": "text",
                 "text": "Logo",
                 "properties": {
                   "text": {
                     "fontSize": 24,
                     "color": { "r": 0.1, "g": 0.1, "b": 0.1 },
                     "textAlign": "left"
                   }
                 },
                 "layout": { "width": 120, "height": 32 }
               }
             ]
           }
         ]
       }
     ]
   }

9. Design Principles:
   - Create clear visual hierarchy
   - Use consistent spacing
   - Ensure proper alignment
   - Maintain readability
   - Follow accessibility guidelines
   - Position screens logically (left to right)
   - Maintain consistent styling across screens
   - Use clear navigation between screens
   - Include appropriate transitions/indicators between screens
   - Ensure proper contrast and readability
   - Implement responsive design patterns
   - Follow platform-specific design guidelines
   - Consider user interaction patterns
   - Maintain proper information architecture
   - Use appropriate visual feedback
   - Implement proper error states
   - Consider loading states
   - Use appropriate animations and transitions`;

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
