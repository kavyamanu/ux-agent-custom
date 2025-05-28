/* eslint-disable @typescript-eslint/no-explicit-any */

figma.showUI(__html__, { width: 450, height: 700 });

let isGenerating = false;
let shouldStop = false;

// Define library types
type LibraryId =  'slds';

type LibraryConfig = {
  name: string;
  fileKey: string;
};

type LibraryConfigs = {
  [key in LibraryId]: LibraryConfig;
};

// Add library configuration
const LIBRARY_CONFIG: LibraryConfigs = {
  slds: {
    name: "Core Components",
    fileKey: "RiY2reCmbX0Jyq7QAFL8SE", // Using same key for now as requested
  }
};

figma.ui.onmessage = async (msg) => {
  if (msg.type === "generate") {
    if (isGenerating) {
      figma.notify("Already generating a design. Please wait or stop the current generation.", { error: true });
      return;
    }

    // Always use all libraries
    const libraryIds: LibraryId[] = [ 'slds'];
    const selectedLibraryConfigs = libraryIds.map(id => LIBRARY_CONFIG[id]).filter(Boolean);
    if (!selectedLibraryConfigs.length) {
      figma.notify("Error: No valid libraries found", { error: true });
      figma.ui.postMessage({ type: "complete", success: false });
      return;
    }

    isGenerating = true;
    shouldStop = false;
    try {
      await renderComponents(msg.prompt, libraryIds);
    } catch (error) {
      console.error('Generation failed:', error);
    } finally {
      isGenerating = false;
      shouldStop = false;
    }
  } else if (msg.type === "stop") {
    if (isGenerating) {
      shouldStop = true;
      isGenerating = false;
      figma.notify("Generation stopped");
      figma.ui.postMessage({ type: "complete", success: false });
    }
  }
};

async function getLLMResponse(
  availableComponents: any[],
  userPrompt: string,
  libraryConfig: typeof LIBRARY_CONFIG[keyof typeof LIBRARY_CONFIG]
): Promise<any> {
  const availablePageNames = [
    ...new Set(
      availableComponents.map((comp) => ({
        type: comp.containing_frame.name,
        variant: comp.name,
        key: comp.key
      }))
    ),
  ];

  // Group components by type for better variant selection
  const componentGroups = availablePageNames.reduce((acc, comp) => {
    if (!acc[comp.type]) {
      acc[comp.type] = [];
    }
    acc[comp.type].push(comp.variant);
    return acc;
  }, {} as Record<string, string[]>);

  try {
    console.log("Sending request to local server...");
    const response = await fetch("http://localhost:3000/command", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        prompt: userPrompt,
        libraryId: libraryConfig.name,
        systemPrompt: `You are a UI/UX design expert creating high-quality, professional desktop-first designs with exceptional customer experience using the ${libraryConfig.name} library. Follow these guidelines strictly:

---

1. Design Focus (PRIMARY REQUIREMENT):
- All screens must be optimized for desktop view (max-width = 1440px, min-height = 1024px).
- add 64px space between two generated frames

---

2. Global Header and Global Navigation (MUST BE INCLUDED ON EVERY SCREEN):

Structure & Positioning:
- Every screen MUST begin with a **Global Header**, followed **immediately** by a **Global Navigation**.
- These two elements must:
  - Be the first components in the layer/frame structure.
  - Start at the top-left corner (x=0, y=0).
  - Span the full width of the screen.
  - Use sticky positioning (always visible on scroll).
  - Have **no margin or spacing between them**.
  - Be implemented using standard SLDS components only.

Global Navigation:
- Must be placed directly below the Global Header.
- Use App Navigation (horizontal or vertical) as per SLDS patterns.
- Show active page clearly using the "default" navigation variant.

---

3. Layout Structure:
- Main content must begin **immediately below** the combined height of the Global Header + Global Navigation.
- Do NOT hardcode 64px top margin—**calculate based on actual header height** (48–72px).
- Use Figma constraints or Auto Layout for correct content positioning.
- Group related elements with proper white space.
- Avoid unnecessary vertical stacking unless on mobile.

---

4. Component Variant Selection Guidelines:

Use only the allowed variants based on context and component purpose:

**Buttons:**
- Primary: main actions (submit, save)
- Secondary: alternate actions (cancel, back)
- Error: destructive actions (delete)
- Success: confirmation actions
- Disabled: inactive states

**Input Fields:**
- Default: standard input
- Error: validation failed
- Success: validation passed
- Disabled: read-only

**Navigation:**
- Active: current page
- Hover: mouse-over state
- Default: normal state

**Alerts:**
- Error: critical failure
- Warning: attention required
- Success: task completed
- Info: general update

Available Components and Variants:
${Object.entries(componentGroups)
  .map(([type, variants]) => 
    `- ${type}:\n${variants.map(v => `  * ${v}`).join('\n')}`)
  .join('\n')}

---

5. User-Centric Design Principles:
- Prioritize clarity, ease of use, and intuitive navigation.
- Maintain strong visual hierarchy.
- Apply consistent interaction patterns.
- Provide feedback for user actions.
- Reduce cognitive load.
- Use Fitts's Law for touch and click targets (minimum 44x44px).

---

6. Component Usage Rules:
- Use **only the available components** from the ${libraryConfig.name} library.
- Match component choice to user mental models and task flow.
- Avoid creating custom or hybrid components.
- For text content, use the "Textarea" component with appropriate sizing.

---

7. Layout and Spacing:
- Use consistent spacing increments: 8px, 16px, 24px, 32px.
- Align content to grid columns.
- Ensure proper content density.
- Use responsive layout constraints, but optimize for desktop.
- Always factor in the header and navigation height when positioning content.

---

8. Visual Design:
- Use clear and consistent typography.
- Minimum body font size: 16px.
- Maintain sufficient contrast (WCAG AA or better).
- Use color intentionally and consistently.
- Show visual feedback for hover, active, and disabled states.
- Use icons/images that support content and reduce clutter.

---

9. Accessibility and Inclusivity:
- Ensure color contrast ratios meet accessibility standards.
- All non-text elements must have descriptive alt text.
- Support full keyboard navigation.
- Use semantic component structures.
- Highlight focus states clearly.
- Ensure compatibility with screen readers.

---

10. Interaction Design:
- Make interactive elements obvious.
- Use standard affordances and patterns.
- Provide immediate feedback for interactions.
- Use consistent hover, focus, and active styles.
- Prevent common user errors and offer clear recovery.
- Align flows to common real-world tasks.

---

11. Content Strategy:
- Keep language clear, concise, and actionable.
- Use consistent terminology across the interface.
- Provide meaningful button labels and field instructions.
- Display helpful error messages with context.
- Use progressive disclosure to manage complexity.
- Consider localization and translations.

---

12. Modal Exception Handling:
- If the design requested is a **modal** or popup:
  - **Do NOT include the Global Header or Navigation**.
  - Use SLDS modal components.
  - Follow modal-specific spacing, header/footer, and interaction rules.

---

13. Output Format:
- Use SLDS components and Figma Auto Layout best practices.
- Use explicit layer names:
  - "GlobalHeader", "GlobalNavigation", "MainContent"
- Ensure logical structure for developers and handoff.

Return a well-structured, desktop-first design that **includes Global Header and Navigation**, applies spacing based on header height, and uses only the defined component library and variants. Prioritize clarity, structure, and best-in-class user experience.
`
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Server response error:", {
        status: response.status,
        statusText: response.statusText,
        errorText
      });
      throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}\n${errorText}`);
    }

    const data = await response.json();
    console.log("Successfully received design from AI:", data);
    return data;
  } catch (error) {
    console.error("Error fetching design from AI:", error);
    figma.notify("Error connecting to the design server. Please ensure the server is running at http://localhost:3000", { error: true });
    return null;
  }
}

// Fetch components from all selected libraries (no cache)
async function getFigmaComponentsByIds(libraryIds: string[]): Promise<any[]> {
  const fileKeys = libraryIds
    .map(id => {
      const config = LIBRARY_CONFIG[id as LibraryId];
      return config && config.fileKey;
    })
    .filter(Boolean)
    .join(',');

  if (!fileKeys) {
    console.error('No valid fileKeys found for selected libraries:', libraryIds);
    return [];
  }

  try {
    reportProgress('fetching', 'Fetching components from Figma...');
    const response = await fetch(`http://localhost:3000/components?fileKeys=${fileKeys}`, {
      method: "GET",
      headers: { "Accept": "application/json" }
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}\n${errorText}`);
    }
    const components = await response.json() as any[];
    return components;
  } catch (error) {
    console.error("Error fetching Figma components:", error);
    return [];
  }
}

function findMatchingComponent(components: any[], type: string, variant?: string): any {
  const normalizedType = type.toLowerCase().trim();
  const normalizedVariant = variant ? variant.toLowerCase().trim() : undefined;


  // Try exact match
  let match = components.find(comp => {
    const compType = (comp.containing_frame && (comp.containing_frame.name || comp.containing_frame.pageName) || '').toLowerCase().trim();
    const compVariant = (comp.name || '').toLowerCase().trim();
    return compType === normalizedType && (!normalizedVariant || compVariant === normalizedVariant);
  });

  // Try fuzzy match if no exact match
  if (!match) {
    match = components.find(comp => {
      const compType = (comp.containing_frame && (comp.containing_frame.name || comp.containing_frame.pageName) || '').toLowerCase().trim();
      const compVariant = (comp.name || '').toLowerCase().trim();
      return compType.includes(normalizedType) && (!normalizedVariant || compVariant.includes(normalizedVariant));
    });
  }

  return match;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function safelyResizeNode(
  node: SceneNode,
  width: number | undefined,
  height: number | undefined
): void {
  const currentWidth = "width" in node ? node.width : 100;
  const currentHeight = "height" in node ? node.height : 40;

  // Ensure minimum dimensions for usability
  const minWidth = 40;
  const minHeight = 40;

  const newWidth = width && width > minWidth ? width : Math.max(currentWidth, minWidth);
  const newHeight = height && height > minHeight ? height : Math.max(currentHeight, minHeight);

  if (newWidth > 0 && newHeight > 0 && "resize" in node) {
    node.resize(newWidth, newHeight);
  }
}

// Add new function for text overflow handling
function handleTextOverflow(node: TextNode, maxWidth: number): void {
  if (node.width > maxWidth) {
    // Enable text auto-resize
    node.textAutoResize = "HEIGHT";
    // Set maximum width
    node.resize(maxWidth, node.height);
  }
}

// Add function to handle text length restrictions
function restrictTextLength(text: string, maxLength: number = 15): string {
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// Modify the applyConsistentSpacing function
function applyConsistentSpacing(container: FrameNode, children: SceneNode[]): void {
  const spacing = 16; // Base spacing unit
  const padding = 24; // Container padding
  const minHeight = 600; // Minimum container height
  let currentY = padding;
  let currentX = padding;
  let maxRowHeight = 0;
  let rowStartIndex = 0;

  // First pass: handle text overflow and calculate actual dimensions
  for (const child of children) {
    if (child.type === "TEXT") {
      const maxTextWidth = container.width - (padding * 2);
      handleTextOverflow(child as TextNode, maxTextWidth);
    }
  }

  // Second pass: position components
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    
    // Check if child would overflow container width
    if (currentX + child.width > container.width - padding) {
      // Start new row
      currentX = padding;
      currentY += maxRowHeight + spacing;
      maxRowHeight = 0;
      rowStartIndex = i;
    }

    // Position child
    child.x = currentX;
    child.y = currentY;

    // Update tracking variables
    currentX += child.width + spacing;
    maxRowHeight = Math.max(maxRowHeight, child.height);

    // If this is the last child in the row, ensure proper spacing
    if (i === children.length - 1 || 
        (i < children.length - 1 && 
         currentX + children[i + 1].width > container.width - padding)) {
      // Add extra spacing after the last element in the row
      currentX = padding;
      currentY += maxRowHeight + spacing;
      maxRowHeight = 0;
    }
  }

  // Update container height to fit all content with padding, but not less than minHeight
  const totalHeight = Math.max(currentY + maxRowHeight + padding, minHeight);
  container.resize(container.width, totalHeight);
}

async function renderComponents(userPrompt: string, libraryIds: string[]) {
  try {
    reportProgress('analyzing', 'Analyzing your prompt...');
    const components = await getFigmaComponentsByIds(libraryIds);
    if (!components || components.length === 0) {
      figma.notify(`No components found in the selected libraries`, { error: true });
      figma.ui.postMessage({ type: "complete", success: false });
      return;
    }

    // Check if stopped
    if (shouldStop) {
      throw new Error('Generation stopped');
    }

    console.log(`Available components in selected libraries:`, components);

    // Use the first selected library for system prompt context, or default to 'core'
    const firstLibraryId = libraryIds[0] as LibraryId || 'core';
    reportProgress('generating', 'Generating design...');
    const designData = await getLLMResponse(components, userPrompt, LIBRARY_CONFIG[firstLibraryId]);
    
    // Check if stopped
    if (shouldStop) {
      throw new Error('Generation stopped');
    }

    if (!designData || !Array.isArray(designData.screens)) {
      figma.notify("Failed to get valid design data from LLM", { error: true });
      figma.ui.postMessage({ type: "complete", success: false });
      return;
    }

    // Send preview message to UI
    const previewText = `I'll create ${designData.screens.length} screen${designData.screens.length > 1 ? 's' : ''}:\n\n` +
      designData.screens.map((screen: { name?: string; id: string; layout?: any; children?: any[] }) => {
        const screenName = screen.name || screen.id;
        const width = (screen.layout && screen.layout.width) || 1200;
        const componentCount = (screen.children && screen.children.length) || 0;
        const components = screen.children ? screen.children.map(child => `  - ${child.type}${child.variant ? ` (${child.variant})` : ''}`).join('\n') : '';
        
        return `📱 ${screenName}\n` +
               `   Components: ${componentCount}\n` +
               (components ? `   Components List:\n${components}` : '');
      }).join('\n\n');
    
    figma.ui.postMessage({ 
      type: "preview", 
      preview: previewText 
    });

    const successfulComponents: string[] = [];
    const failedComponents: string[] = [];

    for (const screen of designData.screens) {
      // Check if stopped
      if (shouldStop) {
        throw new Error('Generation stopped');
      }

      const container = figma.createFrame();
      container.name = screen.name || screen.id || "Generated Screen";

      // Set default container width if not specified
      let width = 1440;
      let height = 1024;
      let x = 0;
      let y = 0;

      if (screen.layout) {
        if (typeof screen.layout.width === 'number') width = screen.layout.width;
        if (typeof screen.layout.height === 'number') height = screen.layout.height;
        if (typeof screen.layout.x === 'number') x = screen.layout.x;
        if (typeof screen.layout.y === 'number') y = screen.layout.y;

        // Apply margin to container position
        if (screen.layout.margin) {
          const margin = screen.layout.margin;
          x += margin.left || 0;
          y += margin.top || 0;
        }
      }

      container.resize(width, height);
      container.x = x;
      container.y = y;

      // Set padding if supported by FrameNode
      if (screen.layout && screen.layout.padding && 'paddingLeft' in container) {
        const padding = screen.layout.padding;
        container.paddingLeft = padding.left || 0;
        container.paddingRight = padding.right || 0;
        container.paddingTop = padding.top || 0;
        container.paddingBottom = padding.bottom || 0;
      }

      // Set background color
      container.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];

      // Load fonts at the start
      await figma.loadFontAsync({ family: "Inter", style: "Regular" });
      await figma.loadFontAsync({ family: "Segoe UI", style: "Regular" });

      const renderedChildren: SceneNode[] = [];

      const children = screen.children || [];
      for (const child of children) {
        if (!child.type) {
          console.warn(`Skipping component missing type:`, child);
          continue;
        }

        try {
          const matchingComponent = findMatchingComponent(
            components,
            child.type,
            child.variant
          );

          if (!matchingComponent) {
            failedComponents.push(`${child.type}${child.variant ? ` (${child.variant})` : ''}`);
            continue;
          }

          if (matchingComponent.isText) {
            // Handle text component
            if (!child.properties || typeof child.properties.text !== 'string') {
              console.warn(`Text component missing text property:`, child);
              failedComponents.push(`${child.type}`);
              continue;
            }

            const textNode = figma.createText();
            textNode.fontName = { family: "Inter", style: "Regular" };
            
            // Apply text length restrictions based on component type
            let textContent = child.properties.text;
            if (child.type.toLowerCase().includes('button') || 
                child.type.toLowerCase().includes('header')) {
              textContent = restrictTextLength(textContent);
            }
            
            textNode.characters = textContent;
            
            // Set text properties
            if (child.properties.fontSize) {
              textNode.fontSize = child.properties.fontSize;
            }
            if (child.properties.textAlign) {
              textNode.textAlignHorizontal = child.properties.textAlign;
            }
            
            // Enable text auto-resize
            textNode.textAutoResize = "HEIGHT";
            
            // Set initial width based on layout or container
            const maxTextWidth = container.width - 48;
            const initialWidth = child.layout && typeof child.layout.width === 'number'
              ? Math.min(child.layout.width, maxTextWidth)
              : maxTextWidth;
            
            textNode.resize(initialWidth, textNode.height);

            container.appendChild(textNode);
            renderedChildren.push(textNode);
            successfulComponents.push(`${child.type}`);
            continue;
          }

          if (!matchingComponent.key) {
            console.error(`Component missing key: ${child.type}${child.variant ? ` (${child.variant})` : ''}`);
            failedComponents.push(`${child.type}${child.variant ? ` (${child.variant})` : ''}`);
            continue;
          }

          try {
            const component = await figma.importComponentByKeyAsync(matchingComponent.key);
            const instance = component.createInstance();
            instance.name = child.id || `${child.type}${child.variant ? ` (${child.variant})` : ''}`;

            // Handle variant properties more carefully
            if (child.variant) {
              try {
                const mainComponent = await instance.getMainComponentAsync();
                if (mainComponent && mainComponent.children) {
                  const figmaVariant = child.variant.replace('State=', '');
                  const matchingVariant = mainComponent.children.find(
                    (child: SceneNode) => child.name === figmaVariant
                  );
                  if (matchingVariant) {
                    instance.mainComponent = matchingVariant as ComponentNode;
                  }
                }
              } catch (variantError) {
                console.warn(`Could not set variant ${child.variant} for ${child.type}:`, variantError);
              }
            }

            // Set layout
            if (child.layout) {
              if (typeof child.layout.x === 'number') instance.x = child.layout.x;
              if (typeof child.layout.y === 'number') instance.y = child.layout.y;
              
              if (typeof child.layout.width === 'number' && typeof child.layout.height === 'number') {
                safelyResizeNode(instance, child.layout.width, child.layout.height);
              }

              // Margin: adjust the position of the component
              const margin = child.layout.margin || { top: 0, right: 0, bottom: 0, left: 0 };
              instance.x += margin.left;
              instance.y += margin.top;

              // Padding: if the component supports it (e.g., FrameNode), set padding
              if ("paddingLeft" in instance) {
                const padding = child.layout.padding || { top: 0, right: 0, bottom: 0, left: 0 };
                instance.paddingLeft = padding.left;
                instance.paddingRight = padding.right;
                instance.paddingTop = padding.top;
                instance.paddingBottom = padding.bottom;
              }
            }

            // Handle component properties
            if (child.properties) {
              if (typeof child.properties.text === "string") {
                const textNodes = instance.findAll((node) => node.type === "TEXT");
                for (const node of textNodes) {
                  const textNode = node as TextNode;
                  await figma.loadFontAsync(textNode.fontName as FontName);
                  textNode.characters = child.properties.text;
                }
              }
              
              // Handle other properties like colors, states, etc.
              if (child.properties.fill) {
                const fills = instance.findAll((node) => "fills" in node);
                for (const node of fills) {
                  (node as GeometryMixin).fills = [{ type: 'SOLID', color: child.properties.fill }];
                }
              }
            }

            container.appendChild(instance);
            renderedChildren.push(instance);
            successfulComponents.push(`${child.type}${child.variant ? ` (${child.variant})` : ''}`);
          } catch (error) {
            console.error(`Error rendering ${child.type}${child.variant ? ` (${child.variant})` : ''}:`, error);
            failedComponents.push(`${child.type}${child.variant ? ` (${child.variant})` : ''}`);
          }
        } catch (error) {
          console.error(`Error rendering ${child.type}${child.variant ? ` (${child.variant})` : ''}:`, error);
          failedComponents.push(`${child.type}${child.variant ? ` (${child.variant})` : ''}`);
        }
      }

      // Apply consistent spacing to all rendered children
      applyConsistentSpacing(container, renderedChildren);

      figma.currentPage.appendChild(container);
    }

    if (failedComponents.length === 0) {
      figma.notify("Successfully generated all components!");
    } else {
      figma.notify(
        `Generated ${successfulComponents.length} components. Failed: ${[
          ...new Set(failedComponents),
        ].join(", ")}`
      );
    }

    figma.ui.postMessage({
      type: "complete",
      success: true,
      stats: {
        successful: successfulComponents.length,
        failed: failedComponents.length,
      },
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Generation stopped') {
      console.log('Generation was stopped by user');
    } else {
      console.error("Error in renderComponents:", error);
      figma.notify("Error generating design: " + getErrorMessage(error), {
        error: true,
      });
    }
    figma.ui.postMessage({ type: "complete", success: false });
  }
}

// Add a function to report progress
function reportProgress(stage: string, message: string) {
  figma.ui.postMessage({
    type: "progress",
    stage,
    message
  });
}
