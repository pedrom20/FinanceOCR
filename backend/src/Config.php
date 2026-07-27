<?php

namespace FinanceOcr;

use Dotenv\Dotenv;

class Config
{
    private static bool $loaded = false;

    private static function ensureLoaded(): void
    {
        if (self::$loaded) {
            return;
        }
        $envDir = dirname(__DIR__);
        if (file_exists($envDir . '/.env')) {
            Dotenv::createImmutable($envDir)->load();
        }
        self::$loaded = true;
    }

    public static function get(string $key, ?string $default = null): ?string
    {
        self::ensureLoaded();
        $value = $_ENV[$key] ?? $_SERVER[$key] ?? getenv($key);
        if ($value === false || $value === null || $value === '') {
            return $default;
        }
        return $value;
    }

    public static function uploadsDir(): string
    {
        $configured = self::get('UPLOADS_DIR', '../uploads');
        $path = str_starts_with($configured, '/')
            ? $configured
            : dirname(__DIR__) . '/' . ltrim($configured, './');
        return rtrim($path, '/');
    }

    public static function tessdataDir(): ?string
    {
        return self::get('TESSDATA_DIR') ?: null;
    }
}
