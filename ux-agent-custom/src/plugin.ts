/* eslint-disable @typescript-eslint/no-explicit-any */

figma.showUI(__html__, { width: 450, height: 700 });

let isGenerating = false;
let shouldStop = false;

// Define types for our design system
interface Color {
  r: number;
  g: number;
  b: number;
}

interface Layout {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  direction?: 'horizontal' | 'vertical';
  alignment?: 'start' | 'center' | 'end';
  spacing?: number;
  padding?: number;
}

interface TextProperties {
  text?: string;
  fontSize?: number;
  textAlign?: 'left' | 'center' | 'right' | 'justified';
  color?: Color;
  fontFamily?: string;
}

interface RectangleProperties {
  fill?: Color;
  cornerRadius?: number;
  stroke?: Color;
  strokeWidth?: number;
}

interface LineProperties {
  stroke: Color;
  strokeWidth: number;
}

interface ImageProperties {
  url: string;
  scaleMode?: 'fill' | 'fit' | 'tile' | 'stretch';
}

interface NodeProperties {
  text?: TextProperties;
  rectangle?: RectangleProperties;
  line?: LineProperties;
  image?: ImageProperties;
}

interface Node {
  id: string;
  type: 'frame' | 'text' | 'rectangle' | 'line' | 'image' | 'button';
  name?: string;
  layout?: Layout;
  properties?: NodeProperties;
  children?: Node[];
  text?: string; // for text nodes and button label
}

interface Design {
  screens: Node[];
}

// Handle messages from the UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === "generate") {
    if (isGenerating) {
      figma.notify("Already generating a design. Please wait or stop the current generation.", { error: true });
      return;
    }

    isGenerating = true;
    shouldStop = false;
    try {
      await generateDesign(msg.prompt);
    } catch (error: unknown) {
      console.error('Generation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      figma.notify("Failed to generate design: " + errorMessage, { error: true });
    } finally {
      isGenerating = false;
      shouldStop = false;
    }
  } else if (msg.type === "stop") {
    if (isGenerating) {
      shouldStop = true;
      isGenerating = false;
      figma.notify("Generation stopped");
    }
  }
};

// Main function to generate design
async function generateDesign(prompt: string) {
  try {
    reportProgress('analyzing', 'Analyzing your prompt...');
    
    // Get design data from the server
    const designData = await getDesignData(prompt);
    
    if (!designData || !Array.isArray(designData.screens)) {
      throw new Error("Invalid design data received");
    }

    // Process each screen
    for (const screen of designData.screens) {
      if (shouldStop) {
        throw new Error('Generation stopped');
      }

      reportProgress('rendering', `Rendering screen: ${screen.name || screen.id}`);
      const screenNode = await renderNode(screen);
      figma.currentPage.appendChild(screenNode);
    }

    figma.notify("Design generated successfully!");
    figma.ui.postMessage({ type: "complete", success: true });
  } catch (error: unknown) {
    console.error("Error in generateDesign:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    figma.notify("Error generating design: " + errorMessage, { error: true });
    figma.ui.postMessage({ type: "complete", success: false });
  }
}

// Function to get design data from server
async function getDesignData(prompt: string): Promise<Design> {
  try {
    const response = await fetch("http://localhost:3000/command", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        prompt,
        systemPrompt: "You are a UI/UX design expert creating high-quality, professional designs using primitive components.",
        availableComponents: [] // Empty array since we're using primitive components
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("AI response:", data);
    if (!isDesign(data)) {
      throw new Error('Invalid design data received from server');
    }
    return data;
  } catch (error: unknown) {
    console.error("Error fetching design data:", error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get design data from server';
    throw new Error(errorMessage);
  }
}

// Type guard for Design
function isDesign(data: unknown): data is Design {
  return (
    typeof data === 'object' &&
    data !== null &&
    'screens' in data &&
    Array.isArray((data as Design).screens)
  );
}

// Function to render a node and its children
async function renderNode(data: Node): Promise<SceneNode> {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid node data');
  }

  console.log(`[renderNode] Rendering node:`, {
    id: data.id,
    type: data.type,
    hasChildren: data.children && data.children.length > 0
  });

  let node: SceneNode;

  // Create the appropriate node type
  switch (data.type) {
    case 'frame':
      node = await renderFrame(data);
      break;
    case 'text':
      node = await renderText(data);
      break;
    case 'rectangle':
      node = await renderRectangle(data);
      break;
    case 'line':
      node = await renderLine(data);
      break;
    case 'image':
      node = await renderImage(data);
      break;
    case 'button':
      node = await renderButton(data);
      break;
    default:
      throw new Error(`Unsupported node type: ${data.type}`);
  }

  // Set node name
  if (data.name) {
    node.name = data.name;
  }

  // Apply layout
  if (data.layout) {
    await applyLayout(node, data.layout);
  }

  // Render children if this is a frame
  if ((data.type === 'frame' || data.type === 'button') && data.children && node.type === 'FRAME') {
    const frameNode = node as FrameNode;
    for (const child of data.children) {
      const childNode = await renderNode(child);
      frameNode.appendChild(childNode);
    }
  }

  return node;
}

// Function to apply layout to a node
async function applyLayout(node: SceneNode, layout: Layout) {
  if ('resize' in node && layout.width !== undefined && layout.height !== undefined) {
    node.resize(layout.width, layout.height);
  }

  if (layout.x !== undefined) {
    node.x = layout.x;
  }

  if (layout.y !== undefined) {
    node.y = layout.y;
  }

  if (node.type === 'FRAME') {
    const frame = node as FrameNode;
    if (layout.direction) {
      frame.layoutMode = layout.direction.toUpperCase() as 'HORIZONTAL' | 'VERTICAL';
    }
    if (layout.alignment) {
      // Map alignment values to Figma's expected values
      const alignmentMap: Record<string, 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN'> = {
        'start': 'MIN',
        'center': 'CENTER',
        'end': 'MAX',
        'space-between': 'SPACE_BETWEEN'
      };
      const alignment = alignmentMap[layout.alignment.toLowerCase()] || 'MIN';
      frame.primaryAxisAlignItems = alignment;
    }
    if (layout.spacing !== undefined) {
      frame.itemSpacing = layout.spacing;
    }
    if (layout.padding !== undefined) {
      frame.paddingLeft = layout.padding;
      frame.paddingRight = layout.padding;
      frame.paddingTop = layout.padding;
      frame.paddingBottom = layout.padding;
    }
  }
}

// Function to render a frame
async function renderFrame(data: Node): Promise<FrameNode> {
  const frame = figma.createFrame();
  return frame;
}

// Function to render text
async function renderText(data: Node): Promise<TextNode> {
  const text = figma.createText();

  // Load default font
  await figma.loadFontAsync({ family: "Inter", style: "Regular" });
  text.fontName = { family: "Inter", style: "Regular" };

  // Set text content: prefer data.text if type is 'text', else fallback
  let textContent = '';
  if (data.type === 'text' && typeof (data as any).text === 'string' && (data as any).text.trim() !== '') {
    textContent = (data as any).text;
  } else if (data.properties && data.properties.text && typeof data.properties.text.text === 'string' && data.properties.text.text.trim() !== '') {
    textContent = data.properties.text.text;
  } else {
    textContent = 'Text'; // fallback
  }
  text.characters = textContent;

  // Apply text properties with defaults
  let color = { r: 0, g: 0, b: 0 };
  let fontSize = 16;
  let textAlign: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED' = 'LEFT';

  if (data.properties && data.properties.text) {
    const props = data.properties.text;
    if (props.fontSize) fontSize = props.fontSize;
    if (props.textAlign) {
      const align = props.textAlign.toLowerCase();
      if (align === 'center') textAlign = 'CENTER';
      else if (align === 'right') textAlign = 'RIGHT';
      else if (align === 'justified') textAlign = 'JUSTIFIED';
      else textAlign = 'LEFT';
    }
    if (props.color) color = props.color;
  }
  text.fontSize = fontSize;
  text.textAlignHorizontal = textAlign;
  text.fills = [{ type: 'SOLID', color }];

  // Ensure text node is sized to fit content
  text.resizeWithoutConstraints( Math.max(100, text.width), Math.max(24, text.height) );

  return text;
}

// Function to render a rectangle
async function renderRectangle(data: Node): Promise<RectangleNode> {
  const rect = figma.createRectangle();

  // Apply rectangle properties
  if (data.properties && data.properties.rectangle) {
    const props = data.properties.rectangle;
    if (props.fill) {
      rect.fills = [{ type: 'SOLID', color: props.fill }];
    }
    if (props.cornerRadius !== undefined) {
      rect.cornerRadius = props.cornerRadius;
    }
    if (props.stroke) {
      rect.strokes = [{ type: 'SOLID', color: props.stroke }];
    }
    if (props.strokeWidth !== undefined) {
      rect.strokeWeight = props.strokeWidth;
    }
  }

  return rect;
}

// Function to render a line
async function renderLine(data: Node): Promise<LineNode> {
  const line = figma.createLine();

  // Apply line properties
  if (data.properties && data.properties.line) {
    const props = data.properties.line;
    if (props.stroke) {
      line.strokes = [{ type: 'SOLID', color: props.stroke }];
    }
    if (props.strokeWidth !== undefined) {
      line.strokeWeight = props.strokeWidth;
    }
  }

  return line;
}

// Function to render an image
async function renderImage(data: Node): Promise<RectangleNode> {
  const image = figma.createRectangle();

  // Apply image properties
  if (data.properties && data.properties.image) {
    const props = data.properties.image;
    if (props.url) {
      try {
        const response = await fetch(props.url);
        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        const imageHash = await figma.createImage(uint8Array);
        
        const scaleModeMap: Record<string, 'FILL' | 'FIT' | 'CROP' | 'TILE'> = {
          'fill': 'FILL',
          'fit': 'FIT',
          'tile': 'TILE',
          'stretch': 'FILL'
        };
        
        const scaleMode = scaleModeMap[props.scaleMode || 'fill'] || 'FILL';
        
        image.fills = [{
          type: 'IMAGE',
          scaleMode,
          imageHash: imageHash.hash
        }];
      } catch (error) {
        console.error('Failed to load image:', error);
        image.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }];
      }
    }
  }

  return image;
}

// Function to render a button
async function renderButton(data: Node): Promise<FrameNode> {
  // Create a frame to represent the button
  const buttonFrame = figma.createFrame();
  buttonFrame.name = data.name || data.id || 'Button';

  // Set default button size if not provided
  const width = (data.layout && data.layout.width) || 120;
  const height = (data.layout && data.layout.height) || 40;
  buttonFrame.resize(width, height);

  // Set background color and border radius
  let fill = { r: 0.1, g: 0.5, b: 0.9 }; // default blue
  let cornerRadius = 8;
  if (data.properties && data.properties.rectangle) {
    if (data.properties.rectangle.fill) fill = data.properties.rectangle.fill;
    if (typeof data.properties.rectangle.cornerRadius === 'number') cornerRadius = data.properties.rectangle.cornerRadius;
  }
  buttonFrame.fills = [{ type: 'SOLID', color: fill }];
  buttonFrame.cornerRadius = cornerRadius;

  // Center children
  buttonFrame.layoutMode = 'HORIZONTAL';
  buttonFrame.primaryAxisAlignItems = 'CENTER';
  buttonFrame.counterAxisAlignItems = 'CENTER';
  buttonFrame.paddingLeft = 0;
  buttonFrame.paddingRight = 0;
  buttonFrame.paddingTop = 0;
  buttonFrame.paddingBottom = 0;
  buttonFrame.itemSpacing = 0;

  // Create the text label
  const labelNode: Node = {
    id: data.id + '-label',
    type: 'text',
    text: data.text || (data.properties && data.properties.text && data.properties.text.text) || 'Button',
    properties: {
      text: {
        fontSize: 16,
        color: { r: 1, g: 1, b: 1 }, // white text
        textAlign: 'center',
      },
    },
    layout: {
      width: width,
      height: height,
    },
  };
  const textNode = await renderText(labelNode);
  buttonFrame.appendChild(textNode);

  return buttonFrame;
}

// Function to report progress to UI
function reportProgress(stage: string, message: string) {
  figma.ui.postMessage({
    type: "progress",
    stage,
    message
  });
}
