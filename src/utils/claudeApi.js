import { API_BASE } from '../lib/api';
const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT || `${API_BASE}/api/claude`;
const ENABLE_UPLOAD = import.meta.env.VITE_ENABLE_UPLOAD === 'true';

export async function analyzeCodebase(fileTree, fileContents, importEdges) {
  if (!ENABLE_UPLOAD) {
    throw new Error('Upload feature is not enabled');
  }

  // Prepare a summary of the codebase for Claude
  const fileSummary = fileTree
    .filter(f => f.isCode)
    .map(f => `${f.path} (${f.size} bytes)`)
    .join('\n');

  // Sample key files (first 200 lines each, up to 20 files)
  const keyFiles = Object.entries(fileContents)
    .slice(0, 20)
    .map(([path, content]) => {
      const lines = content.split('\n').slice(0, 200).join('\n');
      return `--- ${path} ---\n${lines}`;
    })
    .join('\n\n');

  const prompt = `Analyze this codebase and extract concepts for visualization.

FILE TREE:
${fileSummary}

KEY FILE CONTENTS:
${keyFiles}

IMPORT RELATIONSHIPS:
${importEdges.slice(0, 50).map(e => `${e.source} -> ${e.target}`).join('\n')}

Respond with ONLY valid JSON matching this exact schema:
{
  "concepts": [
    {
      "id": "concept-1",
      "name": "Human readable name",
      "color": "one of: teal, purple, coral, blue, amber, pink, green, gray",
      "description": "Plain English description for non-technical person",
      "fileIds": ["file paths that belong to this concept"]
    }
  ],
  "files": [
    {
      "id": "file path",
      "name": "filename",
      "conceptId": "concept-1",
      "description": "Plain English description",
      "exports": ["exported names"],
      "codeSnippet": "first 15 lines of code"
    }
  ],
  "conceptEdges": [
    {
      "source": "concept-1",
      "target": "concept-2",
      "label": "depends on | sends data to | controls | stores data in | triggers"
    }
  ]
}

Rules:
- Extract 8-15 concepts maximum
- Use plain English that a non-technical person would understand
- Each file should belong to exactly one concept
- Assign colors from the palette evenly
- Write descriptions as if explaining to someone who has never seen code`;

  const response = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}

export async function explainFile(fileName, code, concepts) {
  if (!ENABLE_UPLOAD) {
    // Return mock explanation for demo mode
    return getMockExplanation(fileName);
  }

  const response = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: `Explain this code file in plain English for someone who has never written code.

File: ${fileName}
Code:
${code}

Context: This file is part of an app with these concepts: ${concepts.map(c => c.name).join(', ')}

Respond with JSON:
{
  "whatItDoes": "2-3 sentences",
  "keyFunctions": [{"name": "function name", "explanation": "what it does in plain English"}],
  "watchOut": "anything tricky or important",
  "connections": "how it connects to other parts of the app"
}`,
    }),
  });

  if (!response.ok) throw new Error('API request failed');
  return response.json();
}

export async function chatAboutCode(message, context) {
  if (!ENABLE_UPLOAD) {
    return getMockChatResponse(message);
  }

  const response = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: `You are helping a non-technical person understand a codebase.
Context: ${JSON.stringify(context)}
User question: ${message}
Respond in plain English. Be friendly and helpful. Keep it concise.`,
    }),
  });

  if (!response.ok) throw new Error('API request failed');
  const data = await response.json();
  return data.response;
}

function getMockExplanation(fileName) {
  return {
    whatItDoes: `This file (${fileName}) handles one of the core features of the app. It processes data, communicates with other parts of the system, and helps keep everything running smoothly.`,
    keyFunctions: [
      { name: 'main handler', explanation: 'The main entry point that coordinates everything this file does' },
      { name: 'data processing', explanation: 'Takes raw data and transforms it into a format the app can use' },
      { name: 'error handling', explanation: 'Catches problems and makes sure the app doesn\'t crash' },
    ],
    watchOut: 'This file is connected to several other parts of the app, so changes here could affect other features.',
    connections: 'This file talks to the database for storing data and communicates with the frontend to display results to users.',
  };
}

function getMockChatResponse(message) {
  const responses = [
    "Great question! This part of the codebase handles data processing. Think of it like a kitchen in a restaurant — raw ingredients (data) come in, get prepared, and go out as finished dishes (what users see on screen).",
    "That's a common pattern in modern apps. It's essentially a way to keep different parts of the code organized and talking to each other without creating a mess. Like having different departments in a company that communicate through clear channels.",
    "The authentication system here works like a bouncer at a club — it checks your ID (username/password), gives you a wristband (a token), and then every time you want to go to a different area, you just show the wristband instead of your ID again.",
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}
