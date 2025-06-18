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

interface InputProperties {
  label?: string;
  placeholder?: string;
  value?: string;
  type?: 'text' | 'email' | 'password' | 'number';
  required?: boolean;
  disabled?: boolean;
}

interface TabProperties {
  label: string;
  selected?: boolean;
}

interface DividerProperties {
  orientation?: 'horizontal' | 'vertical';
  color?: Color;
  thickness?: number;
}

interface ListProperties {
  items: Node[];
  ordered?: boolean;
}

interface TableProperties {
  columns: string[];
  rows: string[][];
}

interface HeaderFooterProperties {
  text?: string;
  backgroundColor?: Color;
}

interface NodeProperties {
  text?: TextProperties;
  rectangle?: RectangleProperties;
  line?: LineProperties;
  image?: ImageProperties;
  fill?: Color;
  cornerRadius?: number;
  shadow?: boolean;
  input?: InputProperties;
  tab?: TabProperties;
  divider?: DividerProperties;
  list?: ListProperties;
  table?: TableProperties;
  header?: HeaderFooterProperties;
  footer?: HeaderFooterProperties;
}

interface Node {
  id: string;
  type: 'frame' | 'text' | 'rectangle' | 'line' | 'image' | 'button' | 'card' | 'input' | 'tab' | 'divider' | 'list' | 'table' | 'header' | 'navigation' | 'container'| 'footer' | 'file-selector'|'textarea';
  name?: string;
  layout?: Layout;
  properties?: NodeProperties;
  children?: Node[];
  text?: string;
  componentKey?: string;
}

interface Design {
  screens: Node[];
}

// Add these interfaces near the top with other interfaces
interface ComponentInfo {
  key: string;
  pageName: string;
  name: string;
}

interface ComponentsResponse {
  success: boolean;
  components: ComponentInfo[];
}

// Add this after the interfaces
let availableComponents: ComponentInfo[] = [];

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

    // Clear existing content on the current page
    const currentPage = figma.currentPage;
    currentPage.children.forEach(child => child.remove());

    // Process each screen
    for (const screen of designData.screens) {
      if (shouldStop) {
        throw new Error('Generation stopped');
      }

      reportProgress('rendering', `Rendering screen: ${screen.name || screen.id}`);
      
      // Ensure screen has proper layout
      if (!screen.layout) {
        screen.layout = {
          width: 1440,
          height: 900,
          x: 0,
          y: 0
        };
      }

      // Ensure screen has proper dimensions
      screen.layout.width = 1440;
      screen.layout.height = Math.max(900, screen.layout.height || 900);

      // Pass isTopLevel=true for screens
      const screenNode = await renderNode(screen, true);
      
      // Position the screen
      if (screen.layout.x !== undefined) {
        screenNode.x = screen.layout.x;
      }
      if (screen.layout.y !== undefined) {
        screenNode.y = screen.layout.y;
      }

      currentPage.appendChild(screenNode);
    }

    // Zoom to fit all screens
    const bounds = currentPage.children.reduce((acc, node) => {
      return {
        x: Math.min(acc.x, node.x),
        y: Math.min(acc.y, node.y),
        width: Math.max(acc.width, node.x + node.width),
        height: Math.max(acc.height, node.y + node.height)
      };
    }, { x: Infinity, y: Infinity, width: -Infinity, height: -Infinity });

    // Create a rectangle node to represent the bounds
    const boundsRect = figma.createRectangle();
    boundsRect.x = bounds.x;
    boundsRect.y = bounds.y;
    boundsRect.resize(bounds.width, bounds.height);
    figma.viewport.scrollAndZoomIntoView([boundsRect]);
    boundsRect.remove();

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
    
    // First, fetch available components
    const componentsResponse = await fetch("http://localhost:3000/components");
    
    if (!componentsResponse.ok) {
      throw new Error(`Failed to fetch components: ${componentsResponse.status}`);
    }
    
    const componentsData = await componentsResponse.json() as ComponentsResponse;
    
    // Store components in the module-level variable
    availableComponents = componentsData.components || [];
    console.log("Available components:", availableComponents);

    // Then send the design request with available components and layout instructions
    const response = await fetch("http://localhost:3000/command", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        prompt,
        systemPrompt: `You are a UI/UX design expert creating high-quality, professional designs using primitive components. 
        When creating a two-column layout:
        - The main content area must be exactly 900px wide
        - The sidebar must be exactly 400px wide
        - The sidebar should be used for widgets like Activity, Timeline, Alerts, etc.
        - Maintain 32px spacing between columns
        When creating a header, always follow it with a global navigation component.
        The global navigation should be placed immediately after the header in the component hierarchy.
        Every design must include a footer component at the bottom of the page.
        The footer should be the last component in the page hierarchy.`,
        availableComponents
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
    console.error("Error in getDesignData:", error);
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

// Add this function after the interfaces
function findMatchingComponentKey(type: string, availableComponents: ComponentInfo[]): string | undefined {
  // Skip matching for text type
  if (type === 'text') {
    return undefined;
  }

  // Special case for header component
  if (type === 'header') {
    return '3a068adf26ed6116101337530679fd2ae6b73c13';
  }

  // Convert type to lowercase and remove special characters for case-insensitive matching
  const typeLower = type.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // First try to find an exact match by ID
  const exactMatch = availableComponents.find(comp => {
    if (!comp || !comp.name) return false;
    const compId = comp.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    // Check if the component ID matches the type
    return compId === typeLower;
  });

  if (exactMatch && exactMatch.key) {
    console.log(`Found exact match for ${type} with ID ${exactMatch.name}: ${exactMatch.key}`);
    return exactMatch.key;
  }

  // If no exact match found, look for partial match by ID
  const partialMatch = availableComponents.find(comp => {
    if (!comp || !comp.name) return false;
    const compId = comp.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return compId.includes(typeLower);
  });
  
  if (partialMatch && partialMatch.key) {
    console.log(`Found partial match for ${type} with ID ${partialMatch.name}: ${partialMatch.key}`);
    return partialMatch.key;
  }

  return undefined;
}

// Add this function after the interfaces
async function loadRequiredFonts() {
  try {
    await figma.loadFontAsync({ family: "SF Pro", style: "Regular" });
    await figma.loadFontAsync({ family: "SF Pro", style: "Bold" });
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    await figma.loadFontAsync({ family: "Inter", style: "Bold" });
    console.log("Required fonts loaded successfully");
  } catch (error) {
    console.error("Error loading fonts:", error);
  }
}

// Update the renderNode function to add componentKey
async function renderNode(data: Node, isTopLevel = false): Promise<SceneNode> {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid node data');
  }

  // Convert container type to frame
  if (data.type === 'container') {
    console.log(`Converting container type to frame for node: ${data.id}`);
    data.type = 'frame';
  }

  console.log(`[renderNode] Rendering node:`, {
    id: data.id,
    type: data.type,
    hasChildren: data.children && data.children.length > 0,
    componentKey: data.componentKey,
    isTopLevel,
    text: data.text
  });

  let node: SceneNode;

  // First check if componentKey is directly provided in the data
  if (data.componentKey) {
    console.log(`Using provided componentKey: ${data.componentKey}`);
    try {
      // Load required fonts before importing component
      await loadRequiredFonts();
      
      // Try to instantiate the component from the library
      const component = await figma.importComponentByKeyAsync(data.componentKey);
      if (component) {
        console.log(`Successfully imported component with key: ${data.componentKey}`);
        node = component.createInstance();
        
        // Set the name if provided
        if (data.name) {
          node.name = data.name;
        }

        // Apply layout if provided
        if (data.layout) {
          await applyLayout(node, data.layout);
        }

        // If we have AI-generated text, update the component text
        if (data.text && node.type === 'INSTANCE') {
          console.log('Updating component text with:', data.text);
          await updateComponentText(node, data.text);
        }

        return node;
      }
    } catch (error) {
      console.error(`Failed to import component with key ${data.componentKey}:`, error);
      // Fall back to regular rendering if component import fails
    }
  }

  // If no componentKey provided or import failed, try to find matching component
  const componentKey = findMatchingComponentKey(data.type, availableComponents);
  if (componentKey) {
    console.log(`Found matching component key for ${data.type}: ${componentKey}`);
    try {
      // Load required fonts before importing component
      await loadRequiredFonts();
      
      // Try to instantiate the component from the library
      const component = await figma.importComponentByKeyAsync(componentKey);
      if (component) {
        console.log(`Successfully imported component: ${componentKey}`);
        node = component.createInstance();
        
        // Set the name if provided
        if (data.name) {
          node.name = data.name;
        }

        // Apply layout if provided
        if (data.layout) {
          await applyLayout(node, data.layout);
        }

        // If we have AI-generated text, update the component text
        if (data.text && node.type === 'INSTANCE') {
          console.log('Updating component text with:', data.text);
          await updateComponentText(node, data.text);
        }

        return node;
      }
    } catch (error) {
      console.error(`Failed to import component ${componentKey}:`, error);
      // Fall back to regular rendering if component import fails
    }
  }

  // Create the appropriate node type if no component key or import failed
  switch (data.type) {
    case 'frame':
      node = await renderFrame(data, isTopLevel);
      break;
    case 'text':
      await loadRequiredFonts();
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
      await loadRequiredFonts();
      node = await renderButton(data);
      break;
    case 'card':
      node = await renderCard(data);
      break;
    case 'input':
      await loadRequiredFonts();
      node = await renderInput(data);
      break;
    case 'tab':
      await loadRequiredFonts();
      node = await renderTab(data);
      break;
    case 'divider':
      node = await renderDivider(data);
      break;
    case 'list':
      await loadRequiredFonts();
      node = await renderList(data);
      break;
    case 'table':
      await loadRequiredFonts();
      node = await renderTable(data);
      break;
    case 'header':
      await loadRequiredFonts();
      node = await renderHeader(data);
      break;
    case 'navigation':
      await loadRequiredFonts();
      node = await renderNavigation(data);
      break;
    case 'footer':
      await loadRequiredFonts();
      node = await renderFooter(data);
      break;
    case 'file-selector':
      await loadRequiredFonts();
      node = await renderFileSelector(data);
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

  // Only render children for frame type nodes
  if (data.type === 'frame' && data.children && node.type === 'FRAME') {
    const frameNode = node as FrameNode;
    for (const child of data.children) {
      try {
        const childNode = await renderNode(child, false); // Always pass false for children
        frameNode.appendChild(childNode);
      } catch (error) {
        console.error('Error rendering child node:', error);
      }
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
    
    // Set layout mode and alignment
    if (layout.direction) {
      frame.layoutMode = layout.direction.toUpperCase() as 'HORIZONTAL' | 'VERTICAL';
    }
    
    if (layout.alignment) {
      const alignmentMap: Record<string, 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN'> = {
        'start': 'MIN',
        'center': 'CENTER',
        'end': 'MAX',
        'space-between': 'SPACE_BETWEEN'
      };
      const alignment = alignmentMap[layout.alignment.toLowerCase()] || 'MIN';
      frame.primaryAxisAlignItems = alignment;
    }

    // Apply spacing and padding
    if (layout.spacing !== undefined) {
      frame.itemSpacing = layout.spacing;
    }
    
    if (layout.padding !== undefined) {
      frame.paddingLeft = layout.padding;
      frame.paddingRight = layout.padding;
      frame.paddingTop = layout.padding;
      frame.paddingBottom = layout.padding;
    }

    // Auto-size frame based on children
    if (frame.children.length > 0) {
      // Calculate total height including padding and spacing
      let totalHeight = frame.paddingTop + frame.paddingBottom;
      let maxWidth = 0;

      if (frame.layoutMode === 'VERTICAL') {
        for (const child of frame.children) {
          totalHeight += child.height;
          if (child.width > maxWidth) {
            maxWidth = child.width;
          }
          if (child !== frame.children[frame.children.length - 1]) {
            totalHeight += frame.itemSpacing;
          }
        }
        // Add padding to width
        maxWidth += frame.paddingLeft + frame.paddingRight;
      } else if (frame.layoutMode === 'HORIZONTAL') {
        for (const child of frame.children) {
          if (child.height > totalHeight) {
            totalHeight = child.height;
          }
          maxWidth += child.width;
          if (child !== frame.children[frame.children.length - 1]) {
            maxWidth += frame.itemSpacing;
          }
        }
        // Add padding to width
        maxWidth += frame.paddingLeft + frame.paddingRight;
      }

      // Update frame size if larger than current size
      if (totalHeight > frame.height) {
        frame.resize(frame.width, totalHeight);
      }
      if (maxWidth > frame.width) {
        frame.resize(maxWidth, frame.height);
      }
    }
  }
}

// Function to render a frame
async function renderFrame(data: Node, isTopLevel = false): Promise<FrameNode> {
  const frame = figma.createFrame();
  frame.name = data.name || data.id || 'Frame';
  
  // Set initial size
  const width = (data.layout && data.layout.width) || 1440;
  const height = (data.layout && data.layout.height) || 900;
  frame.resize(width, height);

  // Fixed widths for two-column layout
  const mainContentWidth = 900;
  const sidebarWidth = 400;
  // Total width including spacing between columns
  const totalWidth = mainContentWidth + sidebarWidth + 32;

  // Set default layout mode if not specified
  if (!data.layout || !data.layout.direction) {
    frame.layoutMode = 'VERTICAL';
    frame.primaryAxisAlignItems = 'MIN';
    frame.counterAxisAlignItems = 'MIN';
    frame.paddingRight = 24;
    frame.paddingTop = 24;
    frame.paddingBottom = 24;
    frame.itemSpacing = 16;
  }

  // For two-column layout, override the children's widths
  if (data.layout && data.layout.direction === 'horizontal' && data.children && data.children.length === 2) {
    // Update the layout properties of the children
    if (data.children[0] && data.children[0].layout) {
      data.children[0].layout.width = mainContentWidth;
    }
    if (data.children[1] && data.children[1].layout) {
      data.children[1].layout.width = sidebarWidth;
    }
    
    // Set horizontal layout properties
    frame.layoutMode = 'HORIZONTAL';
    frame.primaryAxisAlignItems = 'CENTER'; // Center the columns horizontally
    frame.counterAxisAlignItems = 'MIN';
    frame.itemSpacing = 32; // spacing between columns
    frame.paddingRight = 32;
    frame.paddingTop = 32;
    frame.paddingBottom = 32;

    // Resize frame to fit the fixed-width columns
    frame.resize(totalWidth, frame.height);
  }

  // Apply layout properties
  if (data.layout) {
    await applyLayout(frame, data.layout);
  }

  // Force parent (top-level) frame background color to white
  if (isTopLevel) {
    frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  }

  // Add 24px left padding to all frames except header, navigation, footer, and main screen
  const frameName = data.name ? data.name.toLowerCase() : '';
  const isHeader = frameName.includes('header');
  const isNavigation = frameName.includes('navigation');
  const isFooter = frameName.includes('footer');
  
  if (!isHeader && !isNavigation && !isFooter && !isTopLevel) {
    frame.paddingLeft = 24;
    console.log(`Added 24px left padding to frame: ${data.name}`);
  }

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
    if (props.url && props.url.trim() !== '') {
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

// Function to render a card
async function renderCard(data: Node): Promise<FrameNode> {
  const card = figma.createFrame();
  card.name = data.name || data.id || 'Card';
  
  // Set initial size
  const width = (data.layout && data.layout.width) || 300;
  const height = (data.layout && data.layout.height) || 200;
  card.resize(width, height);

  // Set background color, border radius, and shadow
  let fill = { r: 1, g: 1, b: 1 };
  let cornerRadius = 12;
  let shadow = false;
  if (data.properties) {
    if (data.properties.fill) fill = data.properties.fill;
    if (typeof data.properties.cornerRadius === 'number') cornerRadius = data.properties.cornerRadius;
    if (typeof data.properties.shadow === 'boolean') shadow = data.properties.shadow;
  }
  card.fills = [{ type: 'SOLID', color: fill }];
  card.cornerRadius = cornerRadius;
  if (shadow) {
    card.effects = [{ type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.15 }, offset: { x: 0, y: 4 }, radius: 12, spread: 0, visible: true, blendMode: 'NORMAL' }];
  }

  // Set default layout
  card.layoutMode = 'VERTICAL';
  card.primaryAxisAlignItems = 'MIN';
  card.counterAxisAlignItems = 'MIN';
  card.paddingLeft = 24;
  card.paddingRight = 24;
  card.paddingTop = 24;
  card.paddingBottom = 24;
  card.itemSpacing = 16;

  // Apply layout properties
  if (data.layout) {
    await applyLayout(card, data.layout);
  }

  // Render children
  if (data.children && Array.isArray(data.children)) {
    for (const child of data.children) {
      const childNode = await renderNode(child);
      card.appendChild(childNode);
    }
  }

  return card;
}

// Function to render an input
async function renderInput(data: Node): Promise<FrameNode> {
  const frame = figma.createFrame();
  frame.layoutMode = 'VERTICAL';
  frame.primaryAxisAlignItems = 'MIN';
  frame.counterAxisAlignItems = 'MIN';
  frame.itemSpacing = 4;
  frame.paddingLeft = 0;
  frame.paddingRight = 0;
  frame.paddingTop = 0;
  frame.paddingBottom = 0;
  frame.resize(240, 48);

  // Label
  if (data.properties && data.properties.input && data.properties.input.label) {
    const labelNode: Node = {
      id: data.id + '-label',
      type: 'text',
      text: data.properties.input.label,
      properties: { text: { fontSize: 14, color: { r: 0.2, g: 0.2, b: 0.2 } } },
      layout: { width: 240, height: 20 },
    };
    const label = await renderText(labelNode);
    frame.appendChild(label);
  }
  // Input box
  const inputRect = figma.createRectangle();
  inputRect.resize(240, 28);
  inputRect.cornerRadius = 6;
  inputRect.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
  inputRect.strokes = [{ type: 'SOLID', color: { r: 0.36, g: 0.36, b: 0.36 } }];
  inputRect.strokeWeight = 1;
  frame.appendChild(inputRect);
  // Placeholder/value
  if (data.properties && data.properties.input && (data.properties.input.placeholder || data.properties.input.value)) {
    const textNode = figma.createText();
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    textNode.fontName = { family: "Inter", style: "Regular" };
    textNode.characters = data.properties.input.value || data.properties.input.placeholder || '';
    textNode.fontSize = 14;
    textNode.fills = [{ type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5 } }];
    textNode.x = 8;
    textNode.y = 24;
    frame.appendChild(textNode);
  }
  return frame;
}

// Function to render a tab
async function renderTab(data: Node): Promise<FrameNode> {
  const tab = figma.createFrame();
  tab.layoutMode = 'HORIZONTAL';
  tab.primaryAxisAlignItems = 'CENTER';
  tab.counterAxisAlignItems = 'CENTER';
  tab.paddingLeft = 16;
  tab.paddingRight = 16;
  tab.paddingTop = 8;
  tab.paddingBottom = 8;
  tab.itemSpacing = 8;
  tab.resize(120, 36);
  let fill = { r: 0.95, g: 0.95, b: 0.95 };
  if (data.properties && data.properties.tab && data.properties.tab.selected) {
    fill = { r: 0.1, g: 0.5, b: 0.9 };
  }
  tab.fills = [{ type: 'SOLID', color: fill }];
  tab.cornerRadius = 8;
  // Label
  if (data.properties && data.properties.tab && data.properties.tab.label) {
    const labelNode: Node = {
      id: data.id + '-tab-label',
      type: 'text',
      text: data.properties.tab.label,
      properties: { text: { fontSize: 14, color: data.properties.tab.selected ? { r: 1, g: 1, b: 1 } : { r: 0.2, g: 0.2, b: 0.2 } } },
      layout: { width: 80, height: 20 },
    };
    const label = await renderText(labelNode);
    tab.appendChild(label);
  }
  return tab;
}

// Function to render a divider
async function renderDivider(data: Node): Promise<LineNode> {
  const line = figma.createLine();
  const color = (data.properties && data.properties.divider && data.properties.divider.color) || { r: 0.8, g: 0.8, b: 0.8 };
  const thickness = (data.properties && data.properties.divider && data.properties.divider.thickness) || 1;
  line.strokes = [{ type: 'SOLID', color }];
  line.strokeWeight = thickness;
  if (data.layout && data.layout.width) {
    line.resize(data.layout.width, thickness);
  }
  return line;
}

// Function to render a list
async function renderList(data: Node): Promise<FrameNode> {
  const frame = figma.createFrame();
  frame.name = data.name || data.id || 'List';
  
  // Set initial size
  const width = (data.layout && data.layout.width) || 240;
  const height = (data.layout && data.layout.height) || 100;
  frame.resize(width, height);

  // Set default layout
  frame.layoutMode = 'VERTICAL';
  frame.primaryAxisAlignItems = 'MIN';
  frame.counterAxisAlignItems = 'MIN';
  frame.itemSpacing = 8;
  frame.paddingLeft = 16;
  frame.paddingRight = 16;
  frame.paddingTop = 16;
  frame.paddingBottom = 16;

  // Apply layout properties
  if (data.layout) {
    await applyLayout(frame, data.layout);
  }

  // Render list items
  if (data.properties && data.properties.list && data.properties.list.items && Array.isArray(data.properties.list.items)) {
    let idx = 1;
    for (const item of data.properties.list.items) {
      // Create a row frame for each item
      const rowFrame = figma.createFrame();
      rowFrame.layoutMode = 'HORIZONTAL';
      rowFrame.primaryAxisAlignItems = 'MIN';
      rowFrame.counterAxisAlignItems = 'CENTER';
      rowFrame.itemSpacing = 8;
      rowFrame.resize(width - 32, 24); // Account for padding

      // Add bullet or number if ordered
      if (data.properties.list.ordered) {
        const bullet = figma.createText();
        await figma.loadFontAsync({ family: "Inter", style: "Regular" });
        bullet.fontName = { family: "Inter", style: "Regular" };
        bullet.characters = idx + '.';
        bullet.fontSize = 14;
        bullet.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 } }];
        rowFrame.appendChild(bullet);
      } else {
        // Add bullet point for unordered lists
        const bullet = figma.createText();
        await figma.loadFontAsync({ family: "Inter", style: "Regular" });
        bullet.fontName = { family: "Inter", style: "Regular" };
        bullet.characters = '•';
        bullet.fontSize = 14;
        bullet.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 } }];
        rowFrame.appendChild(bullet);
      }

      // Create text node for the item
      let itemNode: SceneNode;
      if (typeof item === 'string') {
        const textNode: Node = {
          id: data.id + '-item-' + idx,
          type: 'text',
          text: item,
          properties: { 
            text: { 
              fontSize: 14, 
              color: { r: 0.2, g: 0.2, b: 0.2 },
              textAlign: 'left'
            } 
          },
          layout: { 
            width: width - 48, // Account for bullet and spacing
            height: 20 
          }
        };
        itemNode = await renderText(textNode);
      } else {
        // If item is a Node object, render it
        itemNode = await renderNode(item);
      }

      rowFrame.appendChild(itemNode);
      frame.appendChild(rowFrame);
      idx++;
    }

    // Auto-size the frame based on content
    if (frame.children.length > 0) {
      let totalHeight = frame.paddingTop + frame.paddingBottom;
      for (const child of frame.children) {
        totalHeight += child.height;
        if (child !== frame.children[frame.children.length - 1]) {
          totalHeight += frame.itemSpacing;
        }
      }
      frame.resize(frame.width, totalHeight);
    }
  }

  return frame;
}

// Function to render a table
async function renderTable(data: Node): Promise<FrameNode> {
  const frame = figma.createFrame();
  frame.layoutMode = 'VERTICAL';
  frame.primaryAxisAlignItems = 'MIN';
  frame.counterAxisAlignItems = 'MIN';
  frame.itemSpacing = 0;
  frame.paddingLeft = 0;
  frame.paddingRight = 0;
  frame.paddingTop = 0;
  frame.paddingBottom = 0;
  frame.resize(400, 200);

  // Only render from properties.table, never from children
  if (data.properties && data.properties.table) {
    const { columns = [], rows = [] } = data.properties.table;

    // Validate columns and rows
    if (!Array.isArray(columns) || !Array.isArray(rows)) {
      console.error('Invalid table data:', data.properties.table);
      return frame;
    }

    // Header row
    const headerRow = figma.createFrame();
    headerRow.layoutMode = 'HORIZONTAL';
    headerRow.primaryAxisAlignItems = 'MIN';
    headerRow.counterAxisAlignItems = 'MIN';
    headerRow.itemSpacing = 0;
    headerRow.paddingLeft = 12;
    headerRow.paddingRight = 12;
    headerRow.fills = [{ type: 'SOLID', color: { r: 0.97, g: 0.97, b: 0.97 } }];

    // Calculate column width based on number of columns
    const columnWidth = Math.floor(400 / Math.max(1, columns.length));

    for (const col of columns) {
      const cell = figma.createText();
      await figma.loadFontAsync({ family: "Inter", style: "Bold" });
      cell.fontName = { family: "Inter", style: "Bold" };
      cell.characters = String(col);
      cell.fontSize = 14;
      cell.fills = [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1 } }];
      cell.resize(columnWidth, 40);
      headerRow.appendChild(cell);
    }
    frame.appendChild(headerRow);

    // Data rows
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!Array.isArray(row)) continue;

      const rowFrame = figma.createFrame();
      rowFrame.layoutMode = 'HORIZONTAL';
      rowFrame.primaryAxisAlignItems = 'MIN';
      rowFrame.counterAxisAlignItems = 'MIN';
      rowFrame.itemSpacing = 0;
      rowFrame.paddingLeft = 12;
      rowFrame.paddingRight = 12;
      
      // Alternate row colors
      if (i % 2 === 1) {
        rowFrame.fills = [{ type: 'SOLID', color: { r: 0.98, g: 0.98, b: 0.98 } }];
      }

      for (const cellText of row) {
        const cell = figma.createText();
        await figma.loadFontAsync({ family: "Inter", style: "Regular" });
        cell.fontName = { family: "Inter", style: "Regular" };
        cell.characters = String(cellText);
        cell.fontSize = 14;
        cell.fills = [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 } }];
        cell.resize(columnWidth, 40);
        rowFrame.appendChild(cell);
      }
      frame.appendChild(rowFrame);
    }

    // Add borders
    frame.strokes = [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.8 } }];
    frame.strokeWeight = 1;
  }

  return frame;
}

// Function to render a header
async function renderHeader(data: Node): Promise<FrameNode> {
  const frame = figma.createFrame();
  frame.layoutMode = 'HORIZONTAL';
  frame.primaryAxisAlignItems = 'CENTER';
  frame.counterAxisAlignItems = 'CENTER';
  frame.paddingLeft = 32;
  frame.paddingRight = 32;
  frame.paddingTop = 16;
  frame.paddingBottom = 16;
  frame.itemSpacing = 64;
  frame.resize(1440, 64);
  let fill = { r: 0.97, g: 0.97, b: 0.97 };
  if (data.properties && data.properties.header && data.properties.header.backgroundColor) {
    fill = data.properties.header.backgroundColor;
  }
  frame.fills = [{ type: 'SOLID', color: fill }];

  // Render children (e.g., nav, logo, etc.)
  if (data.children && Array.isArray(data.children)) {
    for (const child of data.children) {
      const childNode = await renderNode(child);
      frame.appendChild(childNode);
    }
  }

  return frame;
}

// Function to render a navigation
async function renderNavigation(data: Node): Promise<FrameNode> {
  const frame = figma.createFrame();
  frame.name = data.name || data.id || 'Navigation';
  
  // Set default layout if not provided
  const layout = data.layout || {
    width: 1440,
    height: 48,
    x: 0,
    y: 64,
    direction: 'horizontal',
    alignment: 'center',
    spacing: 32,
    padding: 24
  };

  // Apply layout
  frame.resize(layout.width || 1440, layout.height || 48);
  frame.x = layout.x || 0;
  frame.y = layout.y || 64;

  // Set up frame properties
  const direction = layout.direction ? layout.direction.toUpperCase() : 'HORIZONTAL';
  const alignment = layout.alignment ? layout.alignment.toUpperCase() : 'CENTER';
  
  frame.layoutMode = direction as 'HORIZONTAL' | 'VERTICAL';
  frame.primaryAxisAlignItems = alignment as 'MIN' | 'CENTER' | 'MAX';
  frame.counterAxisAlignItems = 'CENTER';
  frame.itemSpacing = layout.spacing || 32;
  frame.paddingLeft = layout.padding || 24;
  frame.paddingRight = layout.padding || 24;
  frame.paddingTop = layout.padding || 24;
  frame.paddingBottom = layout.padding || 24;

  // Set background color
  frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];

  // Render children
  if (data.children && Array.isArray(data.children)) {
    for (const child of data.children) {
      const childNode = await renderNode(child);
      frame.appendChild(childNode);
    }
  }

  return frame;
}

// Function to render a footer
async function renderFooter(data: Node): Promise<FrameNode> {
  const frame = figma.createFrame();
  frame.name = data.name || data.id || 'Footer';
  
  // Set initial size
  const width = (data.layout && data.layout.width) || 1440;
  const height = (data.layout && data.layout.height) || 80;
  frame.resize(width, height);

  // Set default layout
  frame.layoutMode = 'HORIZONTAL';
  frame.primaryAxisAlignItems = 'CENTER';
  frame.counterAxisAlignItems = 'CENTER';
  frame.paddingLeft = 32;
  frame.paddingRight = 32;
  frame.paddingTop = 16;
  frame.paddingBottom = 16;
  frame.itemSpacing = 32;

  // Set background color
  let fill = { r: 0.97, g: 0.97, b: 0.97 };
  if (data.properties && data.properties.footer && data.properties.footer.backgroundColor) {
    fill = data.properties.footer.backgroundColor;
  }
  frame.fills = [{ type: 'SOLID', color: fill }];

  // Add footer text if provided
  if (data.properties && data.properties.footer && data.properties.footer.text) {
    const textNode: Node = {
      id: data.id + '-text',
      type: 'text',
      text: data.properties.footer.text,
      properties: { 
        text: { 
          fontSize: 14, 
          color: { r: 0.2, g: 0.2, b: 0.2 },
          textAlign: 'center'
        } 
      }
    };
    const text = await renderText(textNode);
    frame.appendChild(text);
  }

  // Render children if any
  if (data.children && Array.isArray(data.children)) {
    for (const child of data.children) {
      const childNode = await renderNode(child);
      frame.appendChild(childNode);
    }
  }

  return frame;
}

// Function to render a file selector
async function renderFileSelector(data: Node): Promise<FrameNode> {
  const frame = figma.createFrame();
  frame.name = data.name || data.id || 'File Selector';
  
  // Set initial size
  const width = (data.layout && data.layout.width) || 240;
  const height = (data.layout && data.layout.height) || 48;
  frame.resize(width, height);

  // Set default layout
  frame.layoutMode = 'HORIZONTAL';
  frame.primaryAxisAlignItems = 'CENTER';
  frame.counterAxisAlignItems = 'CENTER';
  frame.paddingLeft = 16;
  frame.paddingRight = 16;
  frame.paddingTop = 8;
  frame.paddingBottom = 8;
  frame.itemSpacing = 8;

  // Create the button frame
  const buttonFrame = figma.createFrame();
  buttonFrame.name = 'Select File Button';
  buttonFrame.resize(width - 32, 32);
  buttonFrame.cornerRadius = 6;
  buttonFrame.fills = [{ type: 'SOLID', color: { r: 0.1, g: 0.5, b: 0.9 } }];
  buttonFrame.layoutMode = 'HORIZONTAL';
  buttonFrame.primaryAxisAlignItems = 'CENTER';
  buttonFrame.counterAxisAlignItems = 'CENTER';

  // Add button text
  const textNode: Node = {
    id: data.id + '-button-text',
    type: 'text',
    text: 'Select File',
    properties: { 
      text: { 
        fontSize: 14, 
        color: { r: 1, g: 1, b: 1 },
        textAlign: 'center'
      } 
    }
  };
  const text = await renderText(textNode);
  buttonFrame.appendChild(text);

  frame.appendChild(buttonFrame);
  return frame;
}

// Function to report progress to UI
function reportProgress(stage: string, message: string) {
  figma.ui.postMessage({
    type: "progress",
    stage,
    message
  });
}

async function updateComponentText(node: InstanceNode | FrameNode, text: string) {
  try {
    console.log('Updating component text for node:', node.name, 'with text:', text);

    // For component instances, use the override approach
    if (node.type === 'INSTANCE') {
      const instance = node as InstanceNode;
      
      // Find text nodes by name or type
      const textNodes = instance.findAll(node => node.type === "TEXT") as TextNode[];
      
      if (textNodes.length > 0) {
        console.log(`Found ${textNodes.length} text nodes in component instance`);
        
        // Log all text nodes for debugging
        textNodes.forEach((textNode, index) => {
          console.log(`Text node ${index}:`, {
            name: textNode.name,
            characters: textNode.characters,
            visible: textNode.visible,
            x: textNode.x,
            y: textNode.y
          });
        });
        
        // Try to find a text node with specific names first
        let targetTextNode = textNodes.find(tn => 
          tn.name.toLowerCase().includes('label') || 
          tn.name.toLowerCase().includes('text') || 
          tn.name.toLowerCase().includes('title') ||
          tn.name.toLowerCase().includes('content')
        );
        
        // If no specific text node found, use the first visible one
        if (!targetTextNode) {
          targetTextNode = textNodes.find(tn => tn.visible) || textNodes[0];
        }
        
        if (targetTextNode) {
          console.log('Target text node:', {
            name: targetTextNode.name,
            characters: targetTextNode.characters,
            visible: targetTextNode.visible,
            x: targetTextNode.x,
            y: targetTextNode.y
          });
          
          try {
            // Load the font
            await figma.loadFontAsync(targetTextNode.fontName as FontName);
            // Use override approach
            targetTextNode.characters = text;
            console.log('Successfully updated text node with override');
            
            // Verify the update
            console.log('Updated text node now contains:', targetTextNode.characters);
          } catch (error) {
            console.error('Error updating text node with override:', error);
          }
        } else {
          console.log('No suitable text node found for update');
        }
      } else {
        console.log('No text nodes found in component instance');
      }
    } else if (node.type === 'FRAME') {
      // For frames, find text nodes recursively
      const textNodes = node.findAll(node => node.type === "TEXT") as TextNode[];
      
      if (textNodes.length > 0) {
        console.log(`Found ${textNodes.length} text nodes in frame`);
        
        // Log all text nodes for debugging
        textNodes.forEach((textNode, index) => {
          console.log(`Text node ${index}:`, {
            name: textNode.name,
            characters: textNode.characters,
            visible: textNode.visible,
            x: textNode.x,
            y: textNode.y
          });
        });
        
        // Try to find a text node with specific names first
        let targetTextNode = textNodes.find(tn => 
          tn.name.toLowerCase().includes('label') || 
          tn.name.toLowerCase().includes('text') || 
          tn.name.toLowerCase().includes('title') ||
          tn.name.toLowerCase().includes('content')
        );
        
        // If no specific text node found, use the first visible one
        if (!targetTextNode) {
          targetTextNode = textNodes.find(tn => tn.visible) || textNodes[0];
        }
        
        if (targetTextNode) {
          console.log('Target text node:', {
            name: targetTextNode.name,
            characters: targetTextNode.characters,
            visible: targetTextNode.visible,
            x: targetTextNode.x,
            y: targetTextNode.y
          });
          
          try {
            // Load the font
            await figma.loadFontAsync(targetTextNode.fontName as FontName);
            // Use override approach
            targetTextNode.characters = text;
            console.log('Successfully updated text node with override');
            
            // Verify the update
            console.log('Updated text node now contains:', targetTextNode.characters);
          } catch (error) {
            console.error('Error updating text node with override:', error);
          }
        } else {
          console.log('No suitable text node found for update');
        }
      } else {
        console.log('No text nodes found in frame');
      }
    }
  } catch (error) {
    console.error('Error updating component text:', error);
  }
}
