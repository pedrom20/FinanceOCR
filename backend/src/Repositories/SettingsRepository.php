<?php

namespace FinanceOcr\Repositories;

use FinanceOcr\Database;

/**
 * Configuração global da app (ex: chave da API de IA), editável a partir da
 * página de definições (admin). Guardada na BD em vez do .env para poder ser
 * alterada pela UI sem acesso SSH ao servidor.
 */
class SettingsRepository
{
    public static function get(string $key): ?string
    {
        $stmt = Database::get()->prepare('SELECT setting_value FROM app_settings WHERE setting_key = ?');
        $stmt->execute([$key]);
        $value = $stmt->fetchColumn();
        return $value === false || $value === null ? null : (string) $value;
    }

    public static function set(string $key, ?string $value): void
    {
        $stmt = Database::get()->prepare(
            'INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)'
        );
        $stmt->execute([$key, $value]);
    }
}
