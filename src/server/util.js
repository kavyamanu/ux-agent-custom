export const generateSchemaInstructions = (systemPrompt) => `
You must generate JSON that strictly follows this schema:
{
  "type": "FRAME",
  "id": string,
  "layout": {
    "width": number,
    "height": number,
    "x": number,
    "y": number
  },
  "children": [
    {
      "type": string ,
      "componentName": string (must be one of the provided component names),
      "id": string,
      "properties": {
        "text": string,
        "color": string (hex color code),
        "size": number (for text components)
      },
      "layout": {
        "width": number,
        "height": number,
        "x": number,
        "y": number
      }
    }
  ]
}

Requirements:
1. The JSON structure must exactly match this schema
2. All componentName values must be chosen from this list: ${systemPrompt}
3. Each child must have all the properties shown in the schema
4. Layout values must be numbers (not strings)
5. Colors must be hex codes (e.g., "#000000")
6. The response must be valid JSON
`;
