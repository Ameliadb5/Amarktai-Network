<?php
/**
 * Amarktai Network — Contact Form Handler
 * POST /api/contact.php
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

// ── Validate ────────────────────────────────────────────────────────
$required = ['first_name', 'last_name', 'email', 'inquiry', 'message'];
foreach ($required as $field) {
    if (empty($body[$field])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => "Missing required field: $field"]);
        exit;
    }
}

$email = filter_var(trim($body['email']), FILTER_VALIDATE_EMAIL);
if (!$email) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid email address']);
    exit;
}

$firstName = mb_substr(trim($body['first_name']), 0, 100);
$lastName  = mb_substr(trim($body['last_name']),  0, 100);
$company   = mb_substr(trim($body['company'] ?? ''), 0, 200);
$inquiry   = mb_substr(trim($body['inquiry']),   0, 100);
$message   = mb_substr(trim($body['message']),   0, 5000);
$ip        = $_SERVER['REMOTE_ADDR'] ?? '';

// ── Persist to DB ───────────────────────────────────────────────────
try {
    $configFile = __DIR__ . '/../includes/config.php';
    if (file_exists($configFile)) {
        require_once $configFile;
        $stmt = db()->prepare(
            'INSERT INTO contacts
                (first_name, last_name, email, company, inquiry_type, message, ip, created_at)
             VALUES
                (:fn, :ln, :email, :company, :inquiry, :msg, :ip, NOW())'
        );
        $stmt->execute([
            ':fn'      => $firstName,
            ':ln'      => $lastName,
            ':email'   => $email,
            ':company' => $company,
            ':inquiry' => $inquiry,
            ':msg'     => $message,
            ':ip'      => $ip,
        ]);
    }
} catch (Throwable $e) {
    // Log but don't expose DB errors to client
    error_log('Contact DB error: ' . $e->getMessage());
}

echo json_encode(['success' => true, 'message' => 'Message received. We\'ll be in touch within 24 hours.']);
