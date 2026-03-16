<?php
/**
 * Amarktai Network — Database & API Configuration
 *
 * Copy this file to config.php on your VPS and fill in the real credentials.
 * This sample file is safe to commit; config.php is in .gitignore.
 */

define('DB_HOST',    'localhost');
define('DB_NAME',    'amarktainet1');
define('DB_USER',    'amarktainet1');
define('DB_PASS',    'YOUR_DB_PASSWORD_HERE');   // replace on VPS
define('DB_CHARSET', 'utf8mb4');

// Qwen (Dashscope) API key — get yours at https://dashscope.aliyun.com
define('QWEN_API_KEY', 'YOUR_QWEN_API_KEY_HERE');

/**
 * Return a PDO connection (singleton).
 */
function db(): PDO
{
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];
    $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
    return $pdo;
}
