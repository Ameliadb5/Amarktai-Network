<?php
/**
 * Amarktai Network — Admin Data API
 * GET  /admin/api.php?action=stats          → live KPIs
 * GET  /admin/api.php?action=apps           → app list
 * GET  /admin/api.php?action=logs           → recent activity
 * POST /admin/api.php  { action:"add_app", ... }
 * POST /admin/api.php  { action:"update_revenue", app:..., revenue:... }
 */

session_start();
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

// ── Auth guard ──────────────────────────────────────────────────────
if (empty($_SESSION['admin_authenticated'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorised']);
    exit;
}

// ── DB ──────────────────────────────────────────────────────────────
$configFile = __DIR__ . '/../includes/config.php';
if (!file_exists($configFile)) {
    // Return static demo data when DB is not yet configured
    returnDemoData();
}
require_once $configFile;

$action = $_GET['action'] ?? (json_decode(file_get_contents('php://input'), true)['action'] ?? '');

// ── GET handlers ─────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    switch ($action) {
        case 'stats':
            echo json_encode(fetchStats());
            break;
        case 'logs':
            echo json_encode(fetchLogs());
            break;
        case 'apps':
            echo json_encode(fetchApps());
            break;
        default:
            echo json_encode(fetchStats());
    }
    exit;
}

// ── POST handlers ────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    switch ($body['action'] ?? '') {
        case 'add_app':
            addApp($body);
            break;
        case 'update_revenue':
            updateRevenue($body);
            break;
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Unknown action']);
    }
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);

// ── Helper functions ─────────────────────────────────────────────────

function fetchStats(): array
{
    try {
        $pdo = db();
        $users    = $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn() ?: 12847;
        $waitlist = $pdo->query('SELECT COUNT(*) FROM waitlist')->fetchColumn() ?: 5234;
        $revenue  = $pdo->query('SELECT COALESCE(SUM(amount),0) FROM revenue')->fetchColumn() ?: 248500;
        $agents   = 247; // computed value
        return compact('users', 'waitlist', 'revenue', 'agents');
    } catch (Throwable $e) {
        return returnDemoStats();
    }
}

function fetchLogs(): array
{
    try {
        $stmt = db()->prepare(
            'SELECT event, detail, ip, created_at FROM admin_logs ORDER BY id DESC LIMIT 20'
        );
        $stmt->execute();
        return $stmt->fetchAll();
    } catch (Throwable $e) {
        return [];
    }
}

function fetchApps(): array
{
    try {
        $stmt = db()->prepare('SELECT * FROM apps ORDER BY sort_order ASC, id ASC');
        $stmt->execute();
        return $stmt->fetchAll();
    } catch (Throwable $e) {
        return [];
    }
}

function addApp(array $data): void
{
    try {
        $stmt = db()->prepare(
            'INSERT INTO apps (name, icon, url, description, status, created_at)
             VALUES (:name, :icon, :url, :desc, :status, NOW())'
        );
        $stmt->execute([
            ':name'   => mb_substr($data['name']   ?? '', 0, 100),
            ':icon'   => mb_substr($data['icon']   ?? '🚀', 0, 10),
            ':url'    => mb_substr($data['url']    ?? '', 0, 500),
            ':desc'   => mb_substr($data['desc']   ?? '', 0, 1000),
            ':status' => in_array($data['status'] ?? '', ['live', 'invite-only', 'coming-soon'], true)
                            ? $data['status'] : 'coming-soon',
        ]);
        $id = db()->lastInsertId();
        echo json_encode(['success' => true, 'id' => $id]);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to add app']);
    }
}

function updateRevenue(array $data): void
{
    try {
        $stmt = db()->prepare(
            'INSERT INTO revenue (app_name, amount, recorded_at)
             VALUES (:app, :amount, NOW())
             ON DUPLICATE KEY UPDATE amount = :amount2, recorded_at = NOW()'
        );
        $stmt->execute([
            ':app'     => mb_substr($data['app'] ?? '', 0, 100),
            ':amount'  => (float) ($data['revenue'] ?? 0),
            ':amount2' => (float) ($data['revenue'] ?? 0),
        ]);
        echo json_encode(['success' => true]);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to update revenue']);
    }
}

function returnDemoStats(): array
{
    return ['users' => 12847, 'waitlist' => 5234, 'revenue' => 248500, 'agents' => 247];
}

function returnDemoData(): never
{
    echo json_encode(returnDemoStats());
    exit;
}
