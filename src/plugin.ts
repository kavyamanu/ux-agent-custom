/* eslint-disable @typescript-eslint/no-explicit-any */

figma.showUI(__html__, { width: 400, height: 300 });

// Listen for messages from the UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === "generate") {
    await renderComponents(msg.prompt);
  }
};

async function getLLMResponse(
  availableComponents: any[],
  userPrompt: string
): Promise<any> {
  // Extract unique page names from components
  const availablePageNames = [
    ...new Set(
      availableComponents.map((comp) => comp.containing_frame.pageName)
    ),
  ];

  try {
    const response = await fetch("http://localhost:3000/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: userPrompt,
        systemPrompt: `You must create a UI design using ONLY the following component types: ${availablePageNames.join(
          ", "
        )}. 
        Each component in your response must have a 'type' that exactly matches one of these names. 
        Do not invent new component types. Use these exact types for your components.
        IMPORTANT: For any text components, use the type "Textarea" instead of "Text".`,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Received design from AI:", data);
    return data;
  } catch (error) {
    console.error("Error fetching design from AI:", error);
    return null;
  }
}

async function getFigmaComponents(): Promise<any[]> {
  try {
    const response = await fetch("http://localhost:3000/components");
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = (await response.json()) as any;
    console.log("Figma components:", data);

    return data;
  } catch (error) {
    console.error("Error fetching Figma components:", error);
    return [];
  }
}

async function renderComponents(userPrompt: string) {
  try {
    // First fetch components from Figma library
    const components = await getFigmaComponents();
    console.log("Available components:", components);
    // Then fetch design from AI with available component names
    const designData = await getLLMResponse(components, userPrompt);
    if (!designData) {
      figma.notify("Failed to get design data from LLM", { error: true });
      figma.ui.postMessage({ type: "complete", success: false });
      return;
    }

    // Create a container frame
    const container = figma.createFrame();
    container.name = designData.id || "Generated Form";

    // Safely get layout dimensions
    const width =
      designData.layout && designData.layout.width
        ? designData.layout.width
        : 400;
    const height =
      designData.layout && designData.layout.height
        ? designData.layout.height
        : 300;
    const x =
      designData.layout && designData.layout.x ? designData.layout.x : 0;
    const y =
      designData.layout && designData.layout.y ? designData.layout.y : 0;

    container.resize(width, height);
    container.x = x;
    container.y = y;

    // Load required fonts
    await figma.loadFontAsync({ family: "Segoe UI", style: "Regular" });

    // Process each child from the AI design
    for (const child of designData.children) {
      try {
        // Find matching component in the library
        const matchingComponent = components.find(
          (comp) =>
            comp.containing_frame.pageName.toLowerCase() ===
            child.type.toLowerCase()
        );

        if (matchingComponent) {
          console.log(
            `Found matching component for ${child.type}:`,
            matchingComponent
          );
          const component = await figma.importComponentByKeyAsync(
            matchingComponent.key
          );
          const instance = component.createInstance();

          // Set properties from the design data
          instance.name = child.id;
          instance.x = child.layout ? child.layout.x : 0;
          instance.y = child.layout ? child.layout.y : 0;
          instance.resize(
            child.layout ? child.layout.width : 100,
            child.layout ? child.layout.height : 40
          );

          // If it's a text component, update the text content
          if (child.type === "TEXT") {
            const textNode = instance.findOne(
              (node) => node.type === "TEXT"
            ) as TextNode;
            if (textNode) {
              textNode.characters = child.properties
                ? child.properties.text
                : "";
            }
          }

          container.appendChild(instance);
          console.log(`Created instance for ${child.componentName}`);
        } else {
          console.log(`No matching component found for ${child.componentName}`);
          figma.notify(
            `No matching component found for ${child.componentName}`,
            { error: true }
          );
        }
      } catch (error) {
        console.error(
          `Error rendering component ${child.componentName}:`,
          error
        );
        figma.notify(`Error rendering component ${child.componentName}`, {
          error: true,
        });
      }
    }

    // Add the container to the current page
    figma.currentPage.appendChild(container);
    console.log("Rendered all components from AI design.");
    figma.notify("Successfully generated form!");

    // Send completion message to UI
    figma.ui.postMessage({ type: "complete", success: true });
  } catch (error) {
    console.error("Error in renderComponents:", error);
    figma.notify("Error generating design", { error: true });
    figma.ui.postMessage({ type: "complete", success: false });
  }
}
