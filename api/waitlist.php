<?php
/**
 * Amarktai Network — Waitlist Signup Handler
 * POST /api/waitlist.php
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$raw  = file_get_contents('php://input');
$body = json_decode($raw, true);

$email = filter_var(trim($body['email'] ?? ''), FILTER_VALIDATE_EMAIL);
if (!$email) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid email address']);
    exit;
}

$app = mb_substr(trim($body['app'] ?? 'General'), 0, 100);
$ip  = $_SERVER['REMOTE_ADDR'] ?? '';

try {
    $configFile = __DIR__ . '/../includes/config.php';
    if (file_exists($configFile)) {
        require_once $configFile;
        // Upsert — ignore duplicate email+app
        $stmt = db()->prepare(
            'INSERT IGNORE INTO waitlist (email, app_name, ip, created_at)
             VALUES (:email, :app, :ip, NOW())'
        );
        $stmt->execute([':email' => $email, ':app' => $app, ':ip' => $ip]);
    }
} catch (Throwable $e) {
    error_log('Waitlist DB error: ' . $e->getMessage());
}

echo json_encode(['success' => true, 'message' => "🎉 You're on the waitlist! We'll notify you at launch."]);
