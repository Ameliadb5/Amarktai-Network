/**
 * Coding Agent — AI App Builder Engine
 *
 * Accepts a natural language app description and generates a complete project
 * structure with files, folders, and boilerplate. Supports multiple project
 * types (Next.js, React, Express, Flask, Static HTML) and iterative refinement.
 *
 * Server-side only — no secrets exposed to the client.
 */

import { randomUUID } from 'crypto'

// ── Project Types ────────────────────────────────────────────────────────────

export type ProjectType =
  | 'nextjs'
  | 'react'
  | 'express'
  | 'flask'
  | 'static'

export interface ProjectTypeInfo {
  id: ProjectType
  label: string
  description: string
  language: string
  icon: string
  defaultFiles: string[]
}

const PROJECT_TYPES: Record<ProjectType, ProjectTypeInfo> = {
  nextjs: {
    id: 'nextjs',
    label: 'Next.js',
    description: 'Full-stack React framework with API routes, SSR, and file-based routing',
    language: 'typescript',
    icon: '▲',
    defaultFiles: [
      'package.json', 'tsconfig.json', 'next.config.mjs', 'tailwind.config.ts',
      'postcss.config.mjs', 'src/app/layout.tsx', 'src/app/page.tsx',
      'src/app/globals.css', 'src/app/api/hello/route.ts',
    ],
  },
  react: {
    id: 'react',
    label: 'React (Vite)',
    description: 'Client-side React app with Vite bundler and TypeScript',
    language: 'typescript',
    icon: '⚛',
    defaultFiles: [
      'package.json', 'tsconfig.json', 'vite.config.ts', 'index.html',
      'src/main.tsx', 'src/App.tsx', 'src/App.css', 'src/index.css',
    ],
  },
  express: {
    id: 'express',
    label: 'Express API',
    description: 'Node.js REST API with Express, TypeScript, and middleware',
    language: 'typescript',
    icon: '🚀',
    defaultFiles: [
      'package.json', 'tsconfig.json', 'src/index.ts', 'src/routes/index.ts',
      'src/middleware/errorHandler.ts', '.env.example', 'README.md',
    ],
  },
  flask: {
    id: 'flask',
    label: 'Python Flask',
    description: 'Python REST API with Flask, typed routes, and blueprints',
    language: 'python',
    icon: '🐍',
    defaultFiles: [
      'requirements.txt', 'app.py', 'config.py', 'routes/__init__.py',
      'routes/api.py', 'models/__init__.py', '.env.example', 'README.md',
    ],
  },
  static: {
    id: 'static',
    label: 'Static HTML',
    description: 'Simple HTML/CSS/JS website with no build step required',
    language: 'html',
    icon: '🌐',
    defaultFiles: [
      'index.html', 'styles.css', 'script.js', 'README.md',
    ],
  },
}

// ── Generated File ───────────────────────────────────────────────────────────

export interface GeneratedFile {
  path: string
  content: string
  language: string
}

// ── Session & History ────────────────────────────────────────────────────────

export interface GenerationEvent {
  id: string
  type: 'generate' | 'refine'
  description: string
  projectType: ProjectType
  timestamp: string
  fileCount: number
}

export interface GenerationSession {
  id: string
  description: string
  projectType: ProjectType
  files: GeneratedFile[]
  history: GenerationEvent[]
  createdAt: string
  updatedAt: string
}

export interface GenerateOptions {
  includeTests?: boolean
  includeDocs?: boolean
  includeDocker?: boolean
  styling?: 'tailwind' | 'css-modules' | 'plain'
}

// In-memory session store (persists for server lifetime)
const sessions = new Map<string, GenerationSession>()

// ── Language Detection ───────────────────────────────────────────────────────

function _detectLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', html: 'html', css: 'css', json: 'json', md: 'markdown',
    yml: 'yaml', yaml: 'yaml', mjs: 'javascript', env: 'shell',
    txt: 'text', toml: 'toml', cfg: 'ini', sh: 'shell',
  }
  return map[ext] ?? 'text'
}

// ── Template Generators ──────────────────────────────────────────────────────

function generateNextjsApp(desc: string, opts: GenerateOptions): GeneratedFile[] {
  const appName = extractAppName(desc)
  const slug = appName.toLowerCase().replace(/[^a-z0-9]+/g, '-')

  const files: GeneratedFile[] = [
    {
      path: 'package.json',
      language: 'json',
      content: JSON.stringify({
        name: slug,
        version: '0.1.0',
        private: true,
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start',
          lint: 'next lint',
        },
        dependencies: {
          next: '^14.2.0',
          react: '^18.3.0',
          'react-dom': '^18.3.0',
        },
        devDependencies: {
          typescript: '^5.4.0',
          '@types/node': '^20.0.0',
          '@types/react': '^18.3.0',
          '@types/react-dom': '^18.3.0',
          ...(opts.styling === 'tailwind' ? {
            tailwindcss: '^3.4.0',
            postcss: '^8.4.0',
            autoprefixer: '^10.4.0',
          } : {}),
        },
      }, null, 2),
    },
    {
      path: 'tsconfig.json',
      language: 'json',
      content: JSON.stringify({
        compilerOptions: {
          target: 'ES2017',
          lib: ['dom', 'dom.iterable', 'esnext'],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: 'esnext',
          moduleResolution: 'bundler',
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: 'preserve',
          incremental: true,
          paths: { '@/*': ['./src/*'] },
        },
        include: ['next-env.d.ts', '**/*.ts', '**/*.tsx'],
        exclude: ['node_modules'],
      }, null, 2),
    },
    {
      path: 'next.config.mjs',
      language: 'javascript',
      content: `/** @type {import('next').NextConfig} */\nconst nextConfig = {}\n\nexport default nextConfig\n`,
    },
    {
      path: 'src/app/layout.tsx',
      language: 'typescript',
      content: [
        `import type { Metadata } from 'next'`,
        `import './globals.css'`,
        ``,
        `export const metadata: Metadata = {`,
        `  title: '${appName}',`,
        `  description: '${desc.slice(0, 120)}',`,
        `}`,
        ``,
        `export default function RootLayout({`,
        `  children,`,
        `}: {`,
        `  children: React.ReactNode`,
        `}) {`,
        `  return (`,
        `    <html lang="en">`,
        `      <body>{children}</body>`,
        `    </html>`,
        `  )`,
        `}`,
      ].join('\n'),
    },
    {
      path: 'src/app/page.tsx',
      language: 'typescript',
      content: [
        `export default function Home() {`,
        `  return (`,
        `    <main className="min-h-screen flex flex-col items-center justify-center p-8">`,
        `      <h1 className="text-4xl font-bold mb-4">${appName}</h1>`,
        `      <p className="text-lg text-gray-600 max-w-xl text-center">`,
        `        ${desc.slice(0, 200)}`,
        `      </p>`,
        `    </main>`,
        `  )`,
        `}`,
      ].join('\n'),
    },
    {
      path: 'src/app/globals.css',
      language: 'css',
      content: opts.styling === 'tailwind'
        ? `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n`
        : `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }\nbody { font-family: system-ui, -apple-system, sans-serif; }\n`,
    },
    {
      path: 'src/app/api/hello/route.ts',
      language: 'typescript',
      content: [
        `import { NextResponse } from 'next/server'`,
        ``,
        `export async function GET() {`,
        `  return NextResponse.json({ message: 'Hello from ${appName}!' })`,
        `}`,
      ].join('\n'),
    },
    {
      path: 'README.md',
      language: 'markdown',
      content: [
        `# ${appName}`,
        ``,
        `> ${desc}`,
        ``,
        `## Getting Started`,
        ``,
        '```bash',
        `npm install`,
        `npm run dev`,
        '```',
        ``,
        `Open [http://localhost:3000](http://localhost:3000) to view it in the browser.`,
      ].join('\n'),
    },
  ]

  if (opts.styling === 'tailwind') {
    files.push({
      path: 'tailwind.config.ts',
      language: 'typescript',
      content: [
        `import type { Config } from 'tailwindcss'`,
        ``,
        `const config: Config = {`,
        `  content: ['./src/**/*.{ts,tsx}'],`,
        `  theme: { extend: {} },`,
        `  plugins: [],`,
        `}`,
        ``,
        `export default config`,
      ].join('\n'),
    })
    files.push({
      path: 'postcss.config.mjs',
      language: 'javascript',
      content: `/** @type {import('postcss-load-config').Config} */\nconst config = {\n  plugins: {\n    tailwindcss: {},\n    autoprefixer: {},\n  },\n}\n\nexport default config\n`,
    })
  }

  if (opts.includeDocker) {
    files.push({
      path: 'Dockerfile',
      language: 'shell',
      content: [
        `FROM node:20-alpine AS base`,
        `WORKDIR /app`,
        `COPY package*.json ./`,
        `RUN npm ci`,
        `COPY . .`,
        `RUN npm run build`,
        ``,
        `FROM node:20-alpine AS runner`,
        `WORKDIR /app`,
        `COPY --from=base /app/.next ./.next`,
        `COPY --from=base /app/node_modules ./node_modules`,
        `COPY --from=base /app/package.json ./`,
        `EXPOSE 3000`,
        `CMD ["npm", "start"]`,
      ].join('\n'),
    })
  }

  return files
}

function generateReactApp(desc: string, _opts: GenerateOptions): GeneratedFile[] {
  const appName = extractAppName(desc)
  const slug = appName.toLowerCase().replace(/[^a-z0-9]+/g, '-')

  return [
    {
      path: 'package.json',
      language: 'json',
      content: JSON.stringify({
        name: slug,
        private: true,
        version: '0.1.0',
        type: 'module',
        scripts: {
          dev: 'vite',
          build: 'tsc && vite build',
          preview: 'vite preview',
        },
        dependencies: { react: '^18.3.0', 'react-dom': '^18.3.0' },
        devDependencies: {
          '@types/react': '^18.3.0',
          '@types/react-dom': '^18.3.0',
          '@vitejs/plugin-react': '^4.2.0',
          typescript: '^5.4.0',
          vite: '^5.2.0',
        },
      }, null, 2),
    },
    {
      path: 'vite.config.ts',
      language: 'typescript',
      content: `import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\nexport default defineConfig({\n  plugins: [react()],\n})\n`,
    },
    {
      path: 'tsconfig.json',
      language: 'json',
      content: JSON.stringify({
        compilerOptions: {
          target: 'ES2020', lib: ['ES2020', 'DOM', 'DOM.Iterable'],
          module: 'ESNext', skipLibCheck: true, moduleResolution: 'bundler',
          jsx: 'react-jsx', strict: true, noEmit: true,
        },
        include: ['src'],
      }, null, 2),
    },
    {
      path: 'index.html',
      language: 'html',
      content: [
        `<!DOCTYPE html>`,
        `<html lang="en">`,
        `<head>`,
        `  <meta charset="UTF-8" />`,
        `  <meta name="viewport" content="width=device-width, initial-scale=1.0" />`,
        `  <title>${appName}</title>`,
        `</head>`,
        `<body>`,
        `  <div id="root"></div>`,
        `  <script type="module" src="/src/main.tsx"></script>`,
        `</body>`,
        `</html>`,
      ].join('\n'),
    },
    {
      path: 'src/main.tsx',
      language: 'typescript',
      content: `import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App'\nimport './index.css'\n\nReactDOM.createRoot(document.getElementById('root')!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>,\n)\n`,
    },
    {
      path: 'src/App.tsx',
      language: 'typescript',
      content: [
        `import './App.css'`,
        ``,
        `export default function App() {`,
        `  return (`,
        `    <div className="app">`,
        `      <h1>${appName}</h1>`,
        `      <p>${desc.slice(0, 200)}</p>`,
        `    </div>`,
        `  )`,
        `}`,
      ].join('\n'),
    },
    {
      path: 'src/App.css',
      language: 'css',
      content: `.app {\n  max-width: 800px;\n  margin: 0 auto;\n  padding: 2rem;\n  text-align: center;\n}\nh1 { font-size: 2.5rem; margin-bottom: 1rem; }\n`,
    },
    {
      path: 'src/index.css',
      language: 'css',
      content: `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }\nbody { font-family: system-ui, -apple-system, sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; }\n`,
    },
    {
      path: 'README.md',
      language: 'markdown',
      content: `# ${appName}\n\n> ${desc}\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`,
    },
  ]
}

function generateExpressApp(desc: string, opts: GenerateOptions): GeneratedFile[] {
  const appName = extractAppName(desc)
  const slug = appName.toLowerCase().replace(/[^a-z0-9]+/g, '-')

  const files: GeneratedFile[] = [
    {
      path: 'package.json',
      language: 'json',
      content: JSON.stringify({
        name: slug,
        version: '0.1.0',
        private: true,
        scripts: {
          dev: 'tsx watch src/index.ts',
          build: 'tsc',
          start: 'node dist/index.js',
        },
        dependencies: { express: '^4.18.0', cors: '^2.8.5', dotenv: '^16.4.0' },
        devDependencies: {
          '@types/express': '^4.17.0',
          '@types/cors': '^2.8.0',
          '@types/node': '^20.0.0',
          typescript: '^5.4.0',
          tsx: '^4.7.0',
        },
      }, null, 2),
    },
    {
      path: 'tsconfig.json',
      language: 'json',
      content: JSON.stringify({
        compilerOptions: {
          target: 'ES2020', module: 'commonjs', outDir: './dist',
          rootDir: './src', strict: true, esModuleInterop: true,
          skipLibCheck: true, resolveJsonModule: true,
        },
        include: ['src'],
      }, null, 2),
    },
    {
      path: 'src/index.ts',
      language: 'typescript',
      content: [
        `import express from 'express'`,
        `import cors from 'cors'`,
        `import dotenv from 'dotenv'`,
        `import { router } from './routes'`,
        ``,
        `dotenv.config()`,
        ``,
        `const app = express()`,
        `const PORT = process.env.PORT || 3001`,
        ``,
        `app.use(cors())`,
        `app.use(express.json())`,
        `app.use('/api', router)`,
        ``,
        `app.get('/health', (_req, res) => {`,
        `  res.json({ status: 'ok', name: '${appName}' })`,
        `})`,
        ``,
        `app.listen(PORT, () => {`,
        `  console.log(\`${appName} running on port \${PORT}\`)`,
        `})`,
      ].join('\n'),
    },
    {
      path: 'src/routes/index.ts',
      language: 'typescript',
      content: [
        `import { Router } from 'express'`,
        ``,
        `export const router = Router()`,
        ``,
        `router.get('/hello', (_req, res) => {`,
        `  res.json({ message: 'Hello from ${appName}!' })`,
        `})`,
      ].join('\n'),
    },
    {
      path: 'src/middleware/errorHandler.ts',
      language: 'typescript',
      content: [
        `import type { Request, Response, NextFunction } from 'express'`,
        ``,
        `export function errorHandler(`,
        `  err: Error,`,
        `  _req: Request,`,
        `  res: Response,`,
        `  _next: NextFunction,`,
        `) {`,
        `  console.error('[Error]', err.message)`,
        `  res.status(500).json({ error: err.message || 'Internal server error' })`,
        `}`,
      ].join('\n'),
    },
    {
      path: '.env.example',
      language: 'shell',
      content: `PORT=3001\nNODE_ENV=development\n`,
    },
    {
      path: 'README.md',
      language: 'markdown',
      content: `# ${appName}\n\n> ${desc}\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\nAPI is available at http://localhost:3001/api\n`,
    },
  ]

  if (opts.includeDocker) {
    files.push({
      path: 'Dockerfile',
      language: 'shell',
      content: `FROM node:20-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci\nCOPY . .\nRUN npm run build\nEXPOSE 3001\nCMD ["npm", "start"]\n`,
    })
  }

  return files
}

function generateFlaskApp(desc: string, opts: GenerateOptions): GeneratedFile[] {
  const appName = extractAppName(desc)

  const files: GeneratedFile[] = [
    {
      path: 'requirements.txt',
      language: 'text',
      content: `flask>=3.0.0\npython-dotenv>=1.0.0\nflask-cors>=4.0.0\ngunicorn>=21.2.0\n`,
    },
    {
      path: 'app.py',
      language: 'python',
      content: [
        `"""${appName} — ${desc.slice(0, 100)}"""`,
        ``,
        `from flask import Flask`,
        `from flask_cors import CORS`,
        `from config import Config`,
        `from routes.api import api_bp`,
        ``,
        ``,
        `def create_app() -> Flask:`,
        `    app = Flask(__name__)`,
        `    app.config.from_object(Config)`,
        `    CORS(app)`,
        `    app.register_blueprint(api_bp, url_prefix="/api")`,
        `    return app`,
        ``,
        ``,
        `app = create_app()`,
        ``,
        ``,
        `@app.route("/health")`,
        `def health():`,
        `    return {"status": "ok", "name": "${appName}"}`,
        ``,
        ``,
        `if __name__ == "__main__":`,
        `    app.run(debug=True, port=5000)`,
      ].join('\n'),
    },
    {
      path: 'config.py',
      language: 'python',
      content: [
        `import os`,
        `from dotenv import load_dotenv`,
        ``,
        `load_dotenv()`,
        ``,
        ``,
        `class Config:`,
        `    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret")`,
        `    DEBUG = os.getenv("FLASK_DEBUG", "true").lower() == "true"`,
      ].join('\n'),
    },
    {
      path: 'routes/__init__.py',
      language: 'python',
      content: ``,
    },
    {
      path: 'routes/api.py',
      language: 'python',
      content: [
        `from flask import Blueprint, jsonify`,
        ``,
        `api_bp = Blueprint("api", __name__)`,
        ``,
        ``,
        `@api_bp.route("/hello")`,
        `def hello():`,
        `    return jsonify({"message": "Hello from ${appName}!"})`,
      ].join('\n'),
    },
    {
      path: 'models/__init__.py',
      language: 'python',
      content: `"""Data models for ${appName}."""\n`,
    },
    {
      path: '.env.example',
      language: 'shell',
      content: `FLASK_DEBUG=true\nSECRET_KEY=change-me\n`,
    },
    {
      path: 'README.md',
      language: 'markdown',
      content: `# ${appName}\n\n> ${desc}\n\n## Getting Started\n\n\`\`\`bash\npip install -r requirements.txt\npython app.py\n\`\`\`\n\nAPI is available at http://localhost:5000/api\n`,
    },
  ]

  if (opts.includeDocker) {
    files.push({
      path: 'Dockerfile',
      language: 'shell',
      content: `FROM python:3.12-slim\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install --no-cache-dir -r requirements.txt\nCOPY . .\nEXPOSE 5000\nCMD ["gunicorn", "app:app", "-b", "0.0.0.0:5000"]\n`,
    })
  }

  return files
}

function generateStaticApp(desc: string, _opts: GenerateOptions): GeneratedFile[] {
  const appName = extractAppName(desc)

  return [
    {
      path: 'index.html',
      language: 'html',
      content: [
        `<!DOCTYPE html>`,
        `<html lang="en">`,
        `<head>`,
        `  <meta charset="UTF-8" />`,
        `  <meta name="viewport" content="width=device-width, initial-scale=1.0" />`,
        `  <title>${appName}</title>`,
        `  <link rel="stylesheet" href="styles.css" />`,
        `</head>`,
        `<body>`,
        `  <header>`,
        `    <h1>${appName}</h1>`,
        `  </header>`,
        `  <main>`,
        `    <p>${desc.slice(0, 200)}</p>`,
        `  </main>`,
        `  <script src="script.js"></script>`,
        `</body>`,
        `</html>`,
      ].join('\n'),
    },
    {
      path: 'styles.css',
      language: 'css',
      content: [
        `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }`,
        `body {`,
        `  font-family: system-ui, -apple-system, sans-serif;`,
        `  min-height: 100vh;`,
        `  display: flex;`,
        `  flex-direction: column;`,
        `  align-items: center;`,
        `  padding: 2rem;`,
        `  background: #fafafa;`,
        `  color: #1a1a1a;`,
        `}`,
        `header { margin-bottom: 2rem; }`,
        `h1 { font-size: 2.5rem; }`,
        `main { max-width: 640px; text-align: center; line-height: 1.6; }`,
      ].join('\n'),
    },
    {
      path: 'script.js',
      language: 'javascript',
      content: `// ${appName}\nconsole.log('${appName} loaded')\n`,
    },
    {
      path: 'README.md',
      language: 'markdown',
      content: `# ${appName}\n\n> ${desc}\n\nOpen \`index.html\` in a browser to view.\n`,
    },
  ]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Extract a short app name from the user's description. */
function extractAppName(desc: string): string {
  const cleaned = desc.replace(/[^\w\s]/g, '').trim()
  const words = cleaned.split(/\s+/).slice(0, 4)
  if (words.length === 0) return 'My App'

  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns available project types with metadata.
 */
export function getProjectTypes(): ProjectTypeInfo[] {
  return Object.values(PROJECT_TYPES)
}

/**
 * Generate a complete app from a natural language description.
 */
export function generateApp(
  description: string,
  projectType: ProjectType,
  options: GenerateOptions = {},
): GenerationSession {
  const resolvedOpts: GenerateOptions = {
    includeTests: options.includeTests ?? false,
    includeDocs: options.includeDocs ?? true,
    includeDocker: options.includeDocker ?? false,
    styling: options.styling ?? 'tailwind',
  }

  const generators: Record<ProjectType, (d: string, o: GenerateOptions) => GeneratedFile[]> = {
    nextjs: generateNextjsApp,
    react: generateReactApp,
    express: generateExpressApp,
    flask: generateFlaskApp,
    static: generateStaticApp,
  }

  const generator = generators[projectType]
  if (!generator) {
    throw new Error(`Unsupported project type: ${projectType}`)
  }

  const files = generator(description, resolvedOpts)

  const sessionId = randomUUID()
  const now = new Date().toISOString()
  const event: GenerationEvent = {
    id: randomUUID(),
    type: 'generate',
    description,
    projectType,
    timestamp: now,
    fileCount: files.length,
  }

  const session: GenerationSession = {
    id: sessionId,
    description,
    projectType,
    files,
    history: [event],
    createdAt: now,
    updatedAt: now,
  }

  sessions.set(sessionId, session)
  return session
}

/**
 * Refine an existing generation based on user feedback.
 * Appends new/modified files and records the refinement in history.
 */
export function refineApp(
  sessionId: string,
  feedback: string,
): GenerationSession {
  const session = sessions.get(sessionId)
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`)
  }

  const refinedFiles = applyRefinement(session.files, feedback, session.projectType)

  const now = new Date().toISOString()
  const event: GenerationEvent = {
    id: randomUUID(),
    type: 'refine',
    description: feedback,
    projectType: session.projectType,
    timestamp: now,
    fileCount: refinedFiles.length,
  }

  session.files = refinedFiles
  session.history.push(event)
  session.updatedAt = now

  return session
}

/**
 * Retrieve the full history of a generation session.
 */
export function getSessionHistory(sessionId: string): GenerationEvent[] {
  const session = sessions.get(sessionId)
  if (!session) throw new Error(`Session not found: ${sessionId}`)
  return session.history
}

/**
 * Get a specific session by ID.
 */
export function getSession(sessionId: string): GenerationSession | null {
  return sessions.get(sessionId) ?? null
}

/**
 * List all active sessions (most recent first).
 */
export function listSessions(): GenerationSession[] {
  return Array.from(sessions.values())
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

// ── Refinement Logic ─────────────────────────────────────────────────────────

function applyRefinement(
  existingFiles: GeneratedFile[],
  feedback: string,
  projectType: ProjectType,
): GeneratedFile[] {
  const lower = feedback.toLowerCase()
  const files = [...existingFiles]

  // Add dark mode if requested
  if (lower.includes('dark mode') || lower.includes('dark theme')) {
    const cssIdx = files.findIndex((f) => f.path.endsWith('.css') && f.path.includes('global'))
    if (cssIdx >= 0) {
      files[cssIdx] = {
        ...files[cssIdx],
        content: files[cssIdx].content + '\n\n/* Dark mode */\n@media (prefers-color-scheme: dark) {\n  body { background: #0a0a0a; color: #ededed; }\n}\n',
      }
    }
  }

  // Add authentication scaffold
  if (lower.includes('auth') || lower.includes('login') || lower.includes('authentication')) {
    if (projectType === 'nextjs' || projectType === 'react') {
      files.push({
        path: 'src/components/LoginForm.tsx',
        language: 'typescript',
        content: [
          `'use client'`,
          ``,
          `import { useState } from 'react'`,
          ``,
          `export default function LoginForm() {`,
          `  const [email, setEmail] = useState('')`,
          `  const [password, setPassword] = useState('')`,
          ``,
          `  const handleSubmit = (e: React.FormEvent) => {`,
          `    e.preventDefault()`,
          `    // TODO: implement authentication`,
          `    console.log('Login:', { email })`,
          `  }`,
          ``,
          `  return (`,
          `    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-sm mx-auto p-6">`,
          `      <h2 className="text-2xl font-bold">Sign In</h2>`,
          `      <input`,
          `        type="email"`,
          `        placeholder="Email"`,
          `        value={email}`,
          `        onChange={(e) => setEmail(e.target.value)}`,
          `        className="border rounded px-3 py-2"`,
          `        required`,
          `      />`,
          `      <input`,
          `        type="password"`,
          `        placeholder="Password"`,
          `        value={password}`,
          `        onChange={(e) => setPassword(e.target.value)}`,
          `        className="border rounded px-3 py-2"`,
          `        required`,
          `      />`,
          `      <button type="submit" className="bg-blue-600 text-white rounded py-2 font-medium hover:bg-blue-700">`,
          `        Sign In`,
          `      </button>`,
          `    </form>`,
          `  )`,
          `}`,
        ].join('\n'),
      })
    } else if (projectType === 'express') {
      files.push({
        path: 'src/routes/auth.ts',
        language: 'typescript',
        content: [
          `import { Router } from 'express'`,
          ``,
          `export const authRouter = Router()`,
          ``,
          `authRouter.post('/login', (req, res) => {`,
          `  const { email, password } = req.body`,
          `  // TODO: implement real authentication`,
          `  if (!email || !password) {`,
          `    return res.status(400).json({ error: 'Email and password required' })`,
          `  }`,
          `  res.json({ token: 'placeholder-jwt-token', user: { email } })`,
          `})`,
        ].join('\n'),
      })
    } else if (projectType === 'flask') {
      files.push({
        path: 'routes/auth.py',
        language: 'python',
        content: [
          `from flask import Blueprint, request, jsonify`,
          ``,
          `auth_bp = Blueprint("auth", __name__)`,
          ``,
          ``,
          `@auth_bp.route("/login", methods=["POST"])`,
          `def login():`,
          `    data = request.get_json()`,
          `    email = data.get("email")`,
          `    password = data.get("password")`,
          `    # TODO: implement real authentication`,
          `    if not email or not password:`,
          `        return jsonify({"error": "Email and password required"}), 400`,
          `    return jsonify({"token": "placeholder-jwt-token", "user": {"email": email}})`,
        ].join('\n'),
      })
    }
  }

  // Add Dockerfile if requested
  if (lower.includes('docker') && !files.some((f) => f.path === 'Dockerfile')) {
    if (projectType === 'nextjs') {
      files.push({
        path: 'Dockerfile',
        language: 'shell',
        content: `FROM node:20-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci\nCOPY . .\nRUN npm run build\nEXPOSE 3000\nCMD ["npm", "start"]\n`,
      })
    } else if (projectType === 'flask') {
      files.push({
        path: 'Dockerfile',
        language: 'shell',
        content: `FROM python:3.12-slim\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install --no-cache-dir -r requirements.txt\nCOPY . .\nEXPOSE 5000\nCMD ["gunicorn", "app:app", "-b", "0.0.0.0:5000"]\n`,
      })
    }
  }

  // Add testing setup if requested
  if (lower.includes('test') || lower.includes('testing')) {
    if (projectType === 'nextjs' || projectType === 'react') {
      files.push({
        path: 'src/__tests__/App.test.tsx',
        language: 'typescript',
        content: [
          `import { describe, it, expect } from 'vitest'`,
          ``,
          `describe('App', () => {`,
          `  it('should pass a basic test', () => {`,
          `    expect(1 + 1).toBe(2)`,
          `  })`,
          `})`,
        ].join('\n'),
      })
    } else if (projectType === 'flask') {
      files.push({
        path: 'tests/test_api.py',
        language: 'python',
        content: [
          `import pytest`,
          `from app import create_app`,
          ``,
          ``,
          `@pytest.fixture`,
          `def client():`,
          `    app = create_app()`,
          `    app.config["TESTING"] = True`,
          `    with app.test_client() as client:`,
          `        yield client`,
          ``,
          ``,
          `def test_health(client):`,
          `    rv = client.get("/health")`,
          `    assert rv.status_code == 200`,
          `    assert rv.json["status"] == "ok"`,
        ].join('\n'),
      })
    }
  }

  // Add README notes for any other feedback
  const readmeIdx = files.findIndex((f) => f.path === 'README.md')
  if (readmeIdx >= 0) {
    files[readmeIdx] = {
      ...files[readmeIdx],
      content: files[readmeIdx].content + `\n## Refinement Notes\n\n- ${feedback}\n`,
    }
  }

  return files
}
