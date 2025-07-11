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

// Function to format component list with keys and page names
function formatComponentList(components) {
  return components.map(component => {
    const pageName = component.containing_frame && component.containing_frame.pageName 
      ? component.containing_frame.pageName 
      : 'Unknown Page';
    
    return {
      key: component.key,
      name: component.name,
      pageName: pageName
    };
  });
}

// Function to generate component matching instructions
function generateComponentMatchingInstructions(components) {
  return `
Component Matching Instructions:
1. For each component you create, check if there's a similar component in the available components list.
2. Match components based on their names and types. For example:
   - If creating a "header", look for components with "header" in their name
   - If creating a "button", look for components with "button" in their name
   - If creating a "card", look for components with "card" in their name
3. When a match is found, add the componentKey property to your component using the matched component's key.
4. Example matches:
   ${components.map(comp => `- For a "${comp.pagename}" component, use componentKey: "${comp.key}"`).join('\n   ')}
5. If no match is found, create the component without a componentKey.
`;
}

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

    // Fetch available components from the library
    const componentsResponse = await fetch(
      `https://api.figma.com/v1/files/JZRmBokYBOJxnZMco4oGkx/components`,
      {
        headers: {
          "X-Figma-Token": process.env.FIGMA_TOKEN || "",
        },
      }
    );

    if (!componentsResponse.ok) {
      throw new Error(`Failed to fetch components: ${componentsResponse.status}`);
    }

    const componentsData = await componentsResponse.json();
    const components = (componentsData.meta && componentsData.meta.components) || [];
    const formattedComponents = formatComponentList(components);

    // Log formatted components
    console.log('Components for AI Prompt:', JSON.stringify(formattedComponents, null, 2));
    console.log('Number of components found:', formattedComponents.length);

    const componentMatchingInstructions = generateComponentMatchingInstructions(formattedComponents);

    const schemaInstructions = `You are a UI/UX design expert creating high-quality, professional designs using given list of components. Follow these guidelines:

1. Available Components:
   The following components are available in the library.use any of these components if they are similar to the component you are creating, include their componentKey in the properties:
   ${JSON.stringify(formattedComponents, null, 2)}

${componentMatchingInstructions}

2. Page Layout Structure (CRITICAL - Follow This Exact Hierarchy):
   
   🔹 Global Page Structure (applies to ALL pages):
   Every page must include these top-level components in this exact order:
   1. Header (y: 0, height: 64px)
   2. Navigation (y: 64, height: 48px) 
   3. Page Content (y: 112, varies by layout type)

   🔹 Page Content Layout Decision Logic:
   
   ✅ STANDARD LAYOUT (when prompt does NOT specify split view):
   - Page Content is a standalone section after Header and Navigation
   - Choose either List Layout or Record Layout based on context:
     
     A) LIST LAYOUT (One Column) - Use when displaying collections/lists:
        - Page Header: Full-width component (componentKey: "2dbfb7fb9d0323bc25a2dadbcc3d68a0e9621088")
        - Panel Container: Contains single main content frame for item lists
        - Components inside single column MUST NOT have width - they fill container
        - Include: filters, sort, charts, actions, "Display" menu
     
     B) RECORD LAYOUT (Two Column) - DEFAULT LAYOUT for single records:
        - Page Header: Full-width component (componentKey: "2dbfb7fb9d0323bc25a2dadbcc3d68a0e9621088")
        - Panel Container: Contains main content area (2/3 space) + sidebar (1/3 space, minimum 400px)
        - Components inside BOTH areas MUST NOT have width - they fill container
        - Use for: single record detail with related data in sidebar
   
   ✅ SPLIT VIEW LAYOUT (when prompt requires master-detail or queue scenarios):
   - Page Header: Full-width component (componentKey: "2dbfb7fb9d0323bc25a2dadbcc3d68a0e9621088")
   - Panel Container: Contains left panel (main content) + right panel (400px sidebar)
   - Left Panel: Main content area that fills remaining space
   - Right Panel: Fixed 400px width sidebar for navigation/details
   - Use when: users need to navigate/edit multiple items without leaving screen

       🔸 Component Sizing Rule (CRITICAL):
    - All components inside ANY layout region MUST fill the full width of their parent container
    - DO NOT specify width for components inside:
      * Single column layout (List Layout)
      * Two column layout (Record Layout - main content & sidebar)
      * Split view layout (left panel & right panel)
    - Components should use "fill container" behavior in ALL layouts
    - Let the parent frame dimensions handle the sizing automatically
    - Only specify width for the layout containers themselves (sidebars = 400px)
    - Page content has 24px padding and 12px gap between panels

3. Screen Generation Guidelines:
   - ALWAYS create multiple screens for a complete user flow
   - Each screen MUST be exactly 1440px wide and minimum 900px high
   - Screens positioned horizontally with 64px spacing between them
   - Each screen represents a distinct view or state in the user flow
   - Add descriptive IDs and names for each screen
   - EVERY screen MUST follow the Global Page Structure above
4. Component Schema Definitions:
     IMPORTANT: Follow these exact schemas for each component type. If using a component from the library, add the componentKey property:
     
     🚨 IMPORTANT SPACING RULE: Use spacing: 0 for top-level screens (no gaps between header, navigation, page content). Use spacing: 12-24px for layout containers (gaps between child components).

   a) Frame Component (for layout regions):
      {
        "id": "unique-id",
        "type": "frame",
        "name": "descriptive-name",
        "componentKey": "string (if library component found)",
        "properties": {
          "fill": { "r": 0.953, "g": 0.953, "b": 0.953 } // Use for layout containers
        },
        "layout": {
          "width": number, // Optional - omit to fill parent container
          "height": number,
          "direction": "horizontal" | "vertical",
          "alignment": "start" | "center" | "end",
          "spacing": number, // Use 0 for top-level screens, 12-24 for layout containers
          "padding": number // Use for page content frames (24px)
        },
        "children": [Node[]]
      }

   a1) Page Content Frame (use for main content areas):
      {
        "id": "page-content",
        "type": "frame", 
        "name": "Page Content",
        "properties": {
          "fill": { "r": 0.953, "g": 0.953, "b": 0.953 }
        },
        "layout": {
          "width": 1440, // Full screen width
          "height": number,
          "x": 0,
          "y": 112, // After header (64px) + navigation (48px)
          "direction": "vertical", // Always vertical to stack page header + panels
          "alignment": "start",
          "padding": 24 // 24px padding around page content
        },
        "children": [
          // First child: Page Header (full width)
          {
            "id": "page-header",
            "type": "header",
            "name": "Page Header",
            "componentKey": "2dbfb7fb9d0323bc25a2dadbcc3d68a0e9621088",
            "layout": {
              "height": number // Page header height
              // No width specified - will fill container
            },
            "children": [Node[]]
          },
          // Second child: Panel Container (left + right panels)
          {
            "id": "panel-container",
            "type": "frame",
            "name": "Panel Container",
            "properties": {
              "fill": { "r": 0.953, "g": 0.953, "b": 0.953 }
            },
            "layout": {
              "height": number,
              "direction": "horizontal", // Horizontal for left + right panels
              "alignment": "start",
              "spacing": 12 // Gap between panels
            },
            "children": [Node[]] // Left panel and right panel go here
          }
        ]
      }

   a2) Panel Container Structure:
      For Split View or Record Layout, the Panel Container contains:
      
      // Left Panel (for split view layouts) - Main content area
      {
        "id": "left-panel",
        "type": "frame",
        "name": "Left Panel",
        "properties": {
          "fill": { "r": 0.953, "g": 0.953, "b": 0.953 }
        },
        "layout": {
          "height": number,
          "direction": "vertical",
          "alignment": "start",
          "spacing": 16
        },
        "children": [Node[]] // Children width should follow fill container
      }
      
      // Right Panel (for split view layouts) - Sidebar  
      {
        "id": "right-panel",
        "type": "frame",
        "name": "Right Panel",
        "properties": {
          "fill": { "r": 0.953, "g": 0.953, "b": 0.953 }
        },
        "layout": {
          "width": 400, // Fixed width for right sidebar
          "height": number,
          "direction": "vertical", 
          "alignment": "start",
          "spacing": 16
        },
        "children": [Node[]] // Children width should follow fill container that is 400px
      }

   a3) Record Layout Components:
      For Record Layout, the Panel Container contains:
      
      // Main Content Area (takes 2/3 of available space)
      {
        "id": "main-content",
        "type": "frame",
        "name": "Main Content",
        "properties": {
          "fill": { "r": 0.953, "g": 0.953, "b": 0.953 }
        },
        "layout": {
          "height": number,
          "direction": "vertical",
          "alignment": "start", 
          "spacing": 24
        },
        "children": [Node[]] // Children should NOT have width - will fill container
      }
      
      // Sidebar (takes 1/3 of available space)
      {
        "id": "sidebar",
        "type": "frame",
        "name": "Sidebar",
        "properties": {
          "fill": { "r": 0.953, "g": 0.953, "b": 0.953 }
        },
        "layout": {
          "width": 400, // Minimum sidebar width
          "height": number,
          "direction": "vertical",
          "alignment": "start",
          "spacing": 16
        },
        "children": [Node[]] // Children should NOT have width - will fill container
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
          "width": number (optional), // Omit to fill parent container
          "height": number
        }
      }

   c) Button Component:
      {
        "id": "unique-id",
        "type": "button",
        "text": "string",
        "componentKey": "string (optional, if using library component)",
        "properties": {
          "fill": { "r": number, "g": number, "b": number },
          "cornerRadius": number,
          "stroke": { "r": number, "g": number, "b": number } (optional),
          "strokeWidth": number (optional)
        },
        "layout": {
          "width": number (optional), // Omit to fill parent container
          "height": number
        }
      }
    d) Textarea Component:
      {
        "id": "unique-id",
        "type": "textarea",
        "text": "string", // text should be Field Label text
        "componentKey": "string (optional, if using library component)",
        "layout": {
          "width": number (optional), // Omit to fill parent container
          "height": number // height should be minimum 70px
        }
      }

   e) Card Component:
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

   f) Input Component:
      {
        "id": "unique-id",
        "type": "input",
        "componentKey": "string (optional, if using library component)",
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
          "width": number (optional), // Omit to fill parent container
          "height": number
        }
      }

   g) Tab Component:
      {
        "id": "unique-id",
        "type": "tab",
        "componentKey": "string (optional, if using library component)",
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

   h) Divider Component:
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

   i) List Component:
      {
        "id": "unique-id",
        "type": "list",
        "componentKey": "string (optional, if using library component)",
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

   j) Table Component:
      {
        "id": "unique-id",
        "type": "table",
        "componentKey": "string (optional, if using library component)",
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

   k) Header Component (REQUIRED on every page):
      {
        "id": "header",
        "type": "header",
        "name": "Header",
        "componentKey": "0b137239c565232ebfeb0b0e5f78f733bce22306",
        "layout": {
          "width": 1440, // Full screen width
          "height": 64, // Fixed header height
          "x": 0,
          "y": 0 // Always at top
        },
        "children": [Node[]]
      }

   k1) Navigation Component (REQUIRED on every page):
      {
        "id": "navigation", 
        "type": "navigation",
        "name": "Navigation",
        "componentKey": "8cdbc8664f35fd6e12de94d8c7a9e90214317023",
        "layout": {
          "width": 1440, // Full screen width
          "height": 48, // Fixed navigation height
          "x": 0,
          "y": 64 // Always directly after header
        },
        "children": [Node[]]
      }

   k2) Page Header Component (REQUIRED inside page content):
      {
        "id": "page-header",
        "type": "header",
        "name": "Page Header",
        "componentKey": "2dbfb7fb9d0323bc25a2dadbcc3d68a0e9621088",
        "layout": {
          "height": number // Page header height, typically 60-80px
          // No width specified - will fill container width
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

5. Layout Decision Logic and Component Usage:
   
   🔹 STEP 1: Analyze the prompt to determine layout type
   - Does the prompt mention "split view", "master-detail", "queue", or "working through multiple items"?
     → YES: Use SPLIT VIEW LAYOUT
     → NO: Use STANDARD LAYOUT
   
   🔹 STEP 2: For STANDARD LAYOUT, choose content type:
   - Does the prompt involve displaying lists, collections, or multiple records?
     → YES: Use LIST LAYOUT (one column)
     → NO: Use RECORD LAYOUT (two column - default)
   
   🔹 STEP 3: Build the page structure:
   Every page MUST follow this exact hierarchy:
   1. Header (id: "header", y: 0, height: 64px)
   2. Navigation (id: "navigation", y: 64, height: 48px)  
   3. Page Content (id: "page-content", y: 112) containing:
      a. Page Header (id: "page-header", componentKey: "2dbfb7fb9d0323bc25a2dadbcc3d68a0e9621088", full width)
      b. Panel Container (id: "panel-container") containing left/right panels or main content/sidebar
   
   🔹 STEP 4: Apply component sizing rules:
   - Components inside ALL layout regions should fill their parent container width automatically
   - NEVER specify width for components inside:
     * Single column layout
     * Two column layout (main content & sidebar)
     * Split view layout (left panel & right panel)
   - Use "fill container" behavior for proper responsive design
   - Only specify width for layout containers themselves (sidebars = 400px)
   - Spacing rules:
     * Top-level screens: spacing: 0 (no gaps between header, navigation, page content)
     * Layout containers: spacing: 12-24px (gaps between child components)
   
   🔹 STEP 5: Component implementation guidelines:
   - If a component exists in the library (check Available Components), use its componentKey
   - Always include required properties for each component type
   - For width: OMIT width property for components inside ALL layout regions (they will fill container)
   - Only specify width for layout containers themselves (sidebars = 400px) or standalone elements
   - Always specify height for all components
   - For spacing: Use spacing: 0 for top-level screens, spacing: 12-24px for layout containers
   - Follow the exact schema structure
   - Include proper nesting for components that support children
   - Use consistent naming conventions for IDs
   - Maintain proper component hierarchy
   - When the user provides a prompt, go beyond the literal request — infer the broader intent and generate richer, more context-aware components and content
   - ALWAYS include header, navigation, and page header in every screen but DO NOT include footer
   - Page structure hierarchy: Header → Navigation → Page Content → Page Header → Panel Container → Panels

6. Screen Layout and Positioning:
   - First screen should be at x: 0
   - Each subsequent screen should be positioned at x: (previous_screen_x + previous_screen_width + 64)
   - All screens should be at y: 0
   - Example screen positions:
     * Screen 1: x: 0, y: 0
     * Screen 2: x: 1504 (1440 + 64), y: 0
     * Screen 3: x: 3008 (1504 + 1440 + 64), y: 0
   
   🔹 MANDATORY Screen Structure (every screen MUST follow this):
   1. Header (id: "header", y: 0, height: 64px, width: 1440px)
   2. Navigation (id: "navigation", y: 64, height: 48px, width: 1440px)
   3. Page Content (id: "page-content", y: 112) containing:
      a. Page Header (id: "page-header", componentKey: "2dbfb7fb9d0323bc25a2dadbcc3d68a0e9621088", full width)
      b. Panel Container (id: "panel-container") with left/right panels or main content/sidebar
   
   🔹 Component Positioning Rules:
   - Components must not overlap - each component should have its own space
   - Top-level screens should have spacing: 0 (no gaps between header, navigation, page content)
   - Layout containers should have appropriate spacing between components (16-24px)
   - All components within a layout region must fill the full width of that region
   - Use the exact positioning values specified in the layout schemas above

6. Component Quality Guidelines:
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

   b) Image Components:
      - ALWAYS use type: "image" for any image content
      - NEVER use rectangles or other components for images
      - Image properties must include:
        * url: Valid image URL
        * scaleMode: "fill" | "fit" | "tile" | "stretch"
      - Common image sizes:
        * Hero images: 1440x400px
        * Thumbnails: 200x200px
        * Icons: 24x24px or 32x32px
        * Avatars: 48x48px or 64x64px
      - Always specify proper dimensions in layout
      - Use appropriate scaleMode:
        * "fill" for hero images and backgrounds
        * "fit" for logos and icons
        * "tile" for patterns
        * "stretch" for decorative elements
      - Example image component:
        {
          "id": "hero-image",
          "type": "image",
          "properties": {
            "image": {
              "url": "https://example.com/image.jpg",
              "scaleMode": "fill"
            }
          },
          "layout": {
            "width": 1440,
            "height": 400,
            "x": 0,
            "y": 0
          }
        }

   c) Buttons:
      - Standard sizes:
        * Primary: 65-120px width, 32px height
        * Secondary: 65-120px width, 32px height
      - Proper padding: 16px horizontal, 8px vertical
      - Consistent corner radius: 24px
      - Clear visual hierarchy:
        * Primary: { r: 0.1, g: 0.5, b: 0.9 }
        * Secondary: { r: 0.95, g: 0.95, b: 0.95 }
      - Always include hover states in properties

   d) Cards:
      - Standard padding: 24px
      - Consistent corner radius: 12px
      - Proper shadow: { type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.15 }, offset: { x: 0, y: 4 }, radius: 12 }
      - Background color: { r: 1, g: 1, b: 1 }
      - Proper spacing between cards: 24-32px

   e) Input Fields:
      - Standard height: 32px fixed
      - Proper padding: 12-16px
      - Border color: { r: 0.8, g: 0.8, b: 0.8 }
      - Always include placeholder text
      - Label text size: 14px
      - Error state styling

   f) Headers:
      - Header height: 64-80px
      - Proper padding: 24-32px
      - Background color: { r: 0.3, g: 0.5, b: 0.9 }
      - Consistent component spacing: 24-32px

   g) Lists and Tables:
      - Proper row height: 40-48px
      - Consistent column widths
      - Header styling: bold, 14-16px
      - Cell padding: 12-16px
      - Alternating row colors
      - Proper borders and dividers

7. Layout and Spacing Guidelines:
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

8. Color and Style Guidelines:
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

9. Response Format:
   IMPORTANT: You must respond with ONLY a valid JSON object, no other text or explanation.
   The JSON must have a top-level property "screens" which is an array of screen objects.
   Each screen must have:
   - id: Unique identifier (e.g., "dashboard", "user-profile")
   - type: "frame" (NOT "container" or any other type)
   - name: Descriptive name for the screen
   - layout: { width: 1440, height: 900, x: number, y: 0 }
   - children: Array with EXACTLY 3 components (Header, Navigation, Page Content)

   Example of proper screen structure:
   {
     "screens": [
       {
         "id": "dashboard",
         "type": "frame",
         "name": "Dashboard",
         "layout": { 
           "width": 1440, 
           "height": 900, 
           "x": 0, 
           "y": 0,
           "spacing": 0 // No spacing between header, navigation, and page content
         },
         "children": [
           {
             "id": "header",
             "type": "header",
             "name": "Header",
             "layout": { "width": 1440, "height": 64, "x": 0, "y": 0 },
             "children": [/* header content */]
           },
           {
             "id": "navigation",
             "type": "navigation", 
             "name": "Navigation",
             "layout": { "width": 1440, "height": 48, "x": 0, "y": 64 },
             "children": [/* navigation content */]
           },
           {
             "id": "page-content",
             "type": "frame",
             "name": "Page Content",
             "properties": {
               "fill": { "r": 0.953, "g": 0.953, "b": 0.953 }
             },
             "layout": { 
               "width": 1440, 
               "height": 788, 
               "x": 0, 
               "y": 112,
               "direction": "vertical", // Always vertical to stack page header + panels
               "alignment": "start",
               "spacing": 16, // Gap between page header and panels
               "padding": 24 // 24px padding around page content
             },
             "children": [
               // First child: Page Header (full width)
               {
                 "id": "page-header",
                 "type": "header",
                 "name": "Page Header",
                 "componentKey": "2dbfb7fb9d0323bc25a2dadbcc3d68a0e9621088",
                 "layout": { "height": 60 },
                 "children": [/* page header content */]
               },
               // Second child: Panel Container
               {
                 "id": "panel-container",
                 "type": "frame",
                 "name": "Panel Container",
                 "properties": {
                   "fill": { "r": 0.953, "g": 0.953, "b": 0.953 }
                 },
                 "layout": { 
                   "height": 700,
                   "direction": "horizontal", // Horizontal for left + right panels
                   "alignment": "start",
                   "spacing": 12 // Gap between panels
                 },
                 "children": [
                   // For Record Layout (two column):
                   {
                     "id": "main-content",
                     "type": "frame",
                     "name": "Main Content",
                     "properties": {
                       "fill": { "r": 0.953, "g": 0.953, "b": 0.953 }
                     },
                     "layout": { "height": 700, "direction": "vertical", "spacing": 24 },
                     "children": [
                       // Components should NOT have width - will fill container
                       {"type": "text", "layout": {"height": 24}}
                     ]
                   },
                   {
                     "id": "sidebar", 
                     "type": "frame",
                     "name": "Sidebar",
                     "properties": {
                       "fill": { "r": 0.953, "g": 0.953, "b": 0.953 }
                     },
                     "layout": { "width": 400, "height": 700, "direction": "vertical", "spacing": 16 },
                     "children": [
                       // Components should NOT have width - will fill container
                       {"type": "card", "layout": {"height": 200}}
                     ]
                   }
                 ]
               }
             ]
           }
         ]
       }
     ]
   }

10. Design Principles:
   - Create clear visual hierarchy
   - Use consistent spacing
   - Ensure proper alignment
   - Maintain readability
   - Follow accessibility guidelines
   - Position screens logically (left to right)
   - Maintain consistent styling across screens
   - Use clear transitions between screens
   - Include appropriate transitions/indicators between screens
   - Ensure proper contrast and readability
   - Implement responsive design patterns
   - Follow platform-specific design guidelines
   - Consider user interaction patterns
   - Maintain proper information architecture
   - Use appropriate visual feedback
   - Implement proper error states
   - Structure the main content using a two-column layout for better organization and readability
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

// Component enhancement endpoint
fastify.post("/enhance-component", async (request, reply) => {
  console.log("=== ENHANCE-COMPONENT ENDPOINT HIT ===");
  console.log("Request method:", request.method);
  console.log("Request URL:", request.url);
  console.log("Request headers:", request.headers);
  console.log("Request body:", request.body);
  
  try {
    console.log("Received component enhancement request:", request.body);
    const { systemPrompt, prompt, availableComponents, componentType, currentProperties } = request.body;

    if (!prompt) {
      reply
        .code(400)
        .send({ error: "Missing required field: prompt" });
      return;
    }

    // Create a focused system prompt for component enhancement
    const enhancementSystemPrompt = `You are a UI/UX expert enhancing a specific component with actual UI elements.

Component Type: ${componentType || 'unknown'}
Current Properties: ${JSON.stringify(currentProperties || {}, null, 2)}

CRITICAL INSTRUCTIONS:
1. Analyze the current component and the enhancement request
2. Keep the same component type and core structure
3. Create ACTUAL UI elements as children - never just metadata
4. For frames, always include a "children" array with visible UI components
5. Use text, button, input, card, and other UI component types
6. Apply proper layout, spacing, and styling
7. Return a complete, renderable component structure

COMPONENT SIZING RULES:
- Components inside ALL layout regions MUST fill the full width of their parent container
- NEVER specify width for components inside any layout region - they will fill container
- Only specify width for layout containers themselves (sidebars = 400px) or standalone elements
- Use appropriate height based on content
- Apply consistent spacing between components (16-24px)

COMPONENT SCHEMA REQUIREMENTS:
- Frame components MUST have children array with UI elements
- Use these component types: text, button, input, card, rectangle, divider
- Each child must have proper type, layout, and properties
- Include real content, not placeholders
- Apply modern design principles (spacing, typography, colors)
- Components inside frames must fill the frame's width

Available Components (use componentKey if matching):
${JSON.stringify(availableComponents || [], null, 2)}

EXAMPLE Enhanced Frame Structure:
{
  "id": "enhanced-component",
  "type": "frame",
  "name": "Enhanced Component",
  "layout": {"width": 400, "height": 200},
  "children": [
    {
      "id": "title",
      "type": "text", 
      "text": "Component Title",
      "properties": {"text": {"fontSize": 18, "color": {"r": 0.1, "g": 0.1, "b": 0.1}}},
      "layout": {"width": 400, "height": 24}
    },
    {
      "id": "content",
      "type": "card",
      "layout": {"width": 400, "height": 120},
      "children": [/* child components that fill the card width */]
    }
  ]
}

Response Format: Return ONLY the enhanced component JSON with children array, no additional text.`;

    const payload = {
      model: "llmgateway__OpenAIGPT4Omni_08_06",
      prompt: `${enhancementSystemPrompt}\n\nEnhancement Request: ${prompt}\n\nIMPORTANT: Respond with ONLY the JSON object for the enhanced component, no other text.`
    };
    
    console.log("Sending component enhancement request to AI with payload:", payload);

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

      // Validate component structure
      if (!parsedData.type) {
        throw new Error("Enhanced component must have a type");
      }

      console.log("✅ Successfully enhanced component:", {
        componentType: parsedData.type,
        hasChildren: !!(parsedData.children && parsedData.children.length > 0),
        childrenCount: parsedData.children ? parsedData.children.length : 0
      });
      
      reply.send(parsedData);
    } catch (parseError) {
      console.error("❌ Failed to parse component enhancement response:", {
        rawContent,
        jsonContent,
        error: parseError
      });
      throw new Error(`Invalid JSON response from AI: ${parseError.message}`);
    }
  } catch (error) {
    console.error("❌ Component enhancement failed:", error);
    request.log.error(error);
    reply
      .code(500)
      .send({ error: "Failed to enhance component", details: error.message });
  }
});

// Test endpoint to verify server is working
fastify.get("/test", async (request, reply) => {
  console.log("Test endpoint hit!");
  reply.send({ message: "Server is working!", timestamp: new Date().toISOString() });
});

fastify.post("/test-post", async (request, reply) => {
  console.log("Test POST endpoint hit!");
  console.log("Request body:", request.body);
  reply.send({ message: "POST test successful!", body: request.body, timestamp: new Date().toISOString() });
});

fastify.get("/components", async (request, reply) => {
  try {
    const libraryKey = "JZRmBokYBOJxnZMco4oGkx";
    
    // Fetch components from the library
      const response = await fetch(
      `https://api.figma.com/v1/files/${libraryKey}/components`,
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
    const components = (data.meta && data.meta.components) || [];

    // Format the response to include only key and page name
    const formattedComponents = formatComponentList(components);
    
    // Log formatted components
    console.log('Available Components:', JSON.stringify(formattedComponents, null, 2));

    reply.send({
      success: true,
      components: formattedComponents
    });
  } catch (error) {
    console.error("Error fetching components:", error);
    reply.code(500).send({
      error: "Failed to fetch Figma components",
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
