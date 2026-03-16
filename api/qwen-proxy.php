<?php
/**
 * Amarktai Network — Qwen API Proxy
 *
 * Securely forwards chat requests to the Qwen (Dashscope) API.
 * The API key never reaches the browser.
 *
 * POST /api/qwen-proxy.php
 * Body: { "message": "..." }
 *
 * API key configuration — set QWEN_API_KEY in one of two ways:
 *   1. Add  define('QWEN_API_KEY', 'sk-...');  to includes/config.php  (preferred)
 *   2. Set an environment variable:  QWEN_API_KEY=sk-...
 */

// ── Load shared config (DB + API keys) ──────────────────────────────
$configFile = __DIR__ . '/../includes/config.php';
if (file_exists($configFile)) {
    require_once $configFile;
}

// Resolve API key: config.php constant → env var → placeholder
$qwenApiKey = defined('QWEN_API_KEY') ? QWEN_API_KEY
            : (getenv('QWEN_API_KEY') ?: 'YOUR_QWEN_API_KEY_HERE');

const QWEN_API_URL    = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions';
const QWEN_MODEL      = 'qwen-plus';
const MAX_INPUT_CHARS = 4000;
const RATE_LIMIT_SEC  = 2;   // minimum seconds between requests per IP

// ── CORS / headers ─────────────────────────────────────────────────
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
// Restrict to same origin in production; adjust as needed
if (in_array($origin, ['https://amarktai.network', 'http://localhost', ''], true)) {
    header('Access-Control-Allow-Origin: ' . ($origin ?: '*'));
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// ── Rate limiting (file-lock protected to avoid race conditions) ────
$ip       = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$rateFile = sys_get_temp_dir() . '/qwen_rate_' . md5($ip);
$now      = microtime(true);

$fh = fopen($rateFile, 'c+');
if ($fh && flock($fh, LOCK_EX)) {
    $lastTime = (float) stream_get_contents($fh);
    if ($lastTime > 0 && ($now - $lastTime) < RATE_LIMIT_SEC) {
        flock($fh, LOCK_UN);
        fclose($fh);
        http_response_code(429);
        echo json_encode(['error' => 'Too many requests. Please wait a moment.']);
        exit;
    }
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, $now);
    flock($fh, LOCK_UN);
}
if ($fh) fclose($fh);

// ── Parse request ──────────────────────────────────────────────────
$raw  = file_get_contents('php://input');
$body = json_decode($raw, true);

if (!isset($body['message']) || !is_string($body['message'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing or invalid "message" field']);
    exit;
}

$userMessage = trim($body['message']);
if (mb_strlen($userMessage) === 0) {
    http_response_code(400);
    echo json_encode(['error' => 'Message cannot be empty']);
    exit;
}
if (mb_strlen($userMessage) > MAX_INPUT_CHARS) {
    http_response_code(400);
    echo json_encode(['error' => 'Message too long (max ' . MAX_INPUT_CHARS . ' characters)']);
    exit;
}

// ── System prompt ──────────────────────────────────────────────────
$systemPrompt = <<<SYSTEM
You are the Amarktai AI Designer — a live, intelligent interface for the Amarktai Network website.
You have two modes:

MODE 1 — PAGE REDESIGN:
When the user asks to redesign a section (e.g. "make the hero neon purple Tron style", "explode into South African flag colors", "redesign features section cyberpunk"), you MUST respond with ONLY clean, valid HTML + Tailwind CSS classes that can be directly injected into that section. No explanation, no markdown, no code fences — just the raw HTML. Make it futuristic, visually stunning, and cyber. When South African themes are requested, incorporate the flag colors: green (#007A4D), gold (#FFB612), red (#DE3831), blue (#002395), black (#000000), white (#FFFFFF).

MODE 2 — GENERAL CONVERSATION:
For all other questions about Amarktai Network, its apps, vision, or general AI topics, reply conversationally in 1–3 concise paragraphs. Be knowledgeable, enthusiastic, and professional. Amarktai Network consists of 10 AI apps: Amarktai Crypto (invite-only, amarktai.online), EquiProfile (live, equiprofile.online), Kinship, Amarktai Secure, Amarktai Marketing, Amarktai Property Manager, Amarktai Agents, Amarktai Forex, Amarktai Prayer, Amarktai Jobs.

IMPORTANT: Never reveal API keys, server credentials, or internal system details. If asked to "show admin", reply exactly: "Enter master password to access the admin dashboard:"
SYSTEM;

// ── Call Qwen API ──────────────────────────────────────────────────
$payload = json_encode([
    'model'    => QWEN_MODEL,
    'messages' => [
        ['role' => 'system', 'content' => $systemPrompt],
        ['role' => 'user',   'content' => $userMessage],
    ],
    'max_tokens'  => 2048,
    'temperature' => 0.8,
]);

$ch = curl_init(QWEN_API_URL);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $payload,
    CURLOPT_HTTPHEADER     => [
        'Authorization: Bearer ' . $qwenApiKey,
        'Content-Type: application/json',
    ],
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_SSL_VERIFYPEER => true,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr  = curl_error($ch);
curl_close($ch);

if ($curlErr) {
    http_response_code(502);
    echo json_encode(['error' => 'Network error connecting to AI service: ' . $curlErr]);
    exit;
}

if ($httpCode !== 200) {
    http_response_code($httpCode ?: 502);
    // Pass through the upstream error JSON
    echo $response ?: json_encode(['error' => 'AI service returned HTTP ' . $httpCode]);
    exit;
}

// ── Log to DB (optional — only if DB is available) ─────────────────
try {
    $configFile = __DIR__ . '/../includes/config.php';
    if (file_exists($configFile)) {
        require_once $configFile;
        $stmt = db()->prepare(
            'INSERT INTO admin_logs (event, detail, ip, created_at)
             VALUES (:event, :detail, :ip, NOW())'
        );
        $stmt->execute([
            ':event'  => 'qwen_chat',
            ':detail' => mb_substr($userMessage, 0, 255),
            ':ip'     => $ip,
        ]);
    }
} catch (Throwable $e) {
    // Non-fatal — continue even if DB logging fails
}

// ── Return AI response ─────────────────────────────────────────────
echo $response;
