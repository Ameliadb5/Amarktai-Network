<?php
/**
 * Amarktai Network — Admin Authentication
 * POST /admin/auth.php
 * Body: { "action": "verify", "password": "..." }
 */

session_start();
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$raw    = file_get_contents('php://input');
$body   = json_decode($raw, true);
$action = $body['action'] ?? '';

// Bcrypt hash of "Ashmor12@" — regenerate with password_hash() if you change the password
const ADMIN_HASH = '$2y$10$eqbj2h0txDHI/KfmlBuBouNIwOYCL/bs/Ddb7Xvi/KSDMXa/hyTia';

if ($action === 'verify') {
    $password = $body['password'] ?? '';

    if (!is_string($password) || strlen($password) === 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Password required']);
        exit;
    }

    if (password_verify($password, ADMIN_HASH)) {
        $_SESSION['admin_authenticated'] = true;
        $_SESSION['admin_ip']            = $_SERVER['REMOTE_ADDR'] ?? '';
        $_SESSION['admin_at']            = time();

        // Log successful login
        try {
            $configFile = __DIR__ . '/../includes/config.php';
            if (file_exists($configFile)) {
                require_once $configFile;
                $stmt = db()->prepare(
                    'INSERT INTO admin_logs (event, detail, ip, created_at)
                     VALUES (:event, :detail, :ip, NOW())'
                );
                $stmt->execute([
                    ':event'  => 'admin_login',
                    ':detail' => 'Successful login',
                    ':ip'     => $_SERVER['REMOTE_ADDR'] ?? '',
                ]);
            }
        } catch (Throwable $e) {
            error_log('Admin log error: ' . $e->getMessage());
        }

        echo json_encode(['success' => true]);
    } else {
        // Log failed attempt
        try {
            $configFile = __DIR__ . '/../includes/config.php';
            if (file_exists($configFile)) {
                require_once $configFile;
                $stmt = db()->prepare(
                    'INSERT INTO admin_logs (event, detail, ip, created_at)
                     VALUES (:event, :detail, :ip, NOW())'
                );
                $stmt->execute([
                    ':event'  => 'admin_login_fail',
                    ':detail' => 'Invalid password attempt',
                    ':ip'     => $_SERVER['REMOTE_ADDR'] ?? '',
                ]);
            }
        } catch (Throwable $e) { /* non-fatal */ }

        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid password']);
    }

} elseif ($action === 'check') {
    // Check if session is still valid
    $valid = !empty($_SESSION['admin_authenticated'])
          && (time() - ($_SESSION['admin_at'] ?? 0)) < 3600; // 1-hour session
    echo json_encode(['authenticated' => $valid]);

} elseif ($action === 'logout') {
    session_destroy();
    echo json_encode(['success' => true]);

} else {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Unknown action']);
}
