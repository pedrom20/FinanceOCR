<?php

namespace FinanceOcr\Controllers;

use FinanceOcr\Auth\AuthMiddleware;
use FinanceOcr\Repositories\SettingsRepository;
use FinanceOcr\Support\Response;

class SettingsController
{
    private const ANTHROPIC_API_KEY = 'anthropic_api_key';
    private const ANTHROPIC_MODEL = 'anthropic_model';

    /** Nunca devolve o valor da chave já guardada — só se está ou não configurada. */
    public static function show(): void
    {
        AuthMiddleware::requireAdmin();
        Response::json([
            'anthropicApiKeyConfigured' => SettingsRepository::get(self::ANTHROPIC_API_KEY) !== null,
            'anthropicModel' => SettingsRepository::get(self::ANTHROPIC_MODEL) ?? '',
        ]);
    }

    public static function update(): void
    {
        AuthMiddleware::requireAdmin();

        $body = json_decode((string) file_get_contents('php://input'), true);
        if (!is_array($body)) {
            Response::error('Corpo do pedido inválido', 400);
            return;
        }

        // Campo em branco = não mexer na chave já guardada (o formulário nunca
        // mostra o valor atual, por isso "vazio" não pode significar "apagar").
        if (isset($body['anthropicApiKey']) && trim((string) $body['anthropicApiKey']) !== '') {
            SettingsRepository::set(self::ANTHROPIC_API_KEY, trim((string) $body['anthropicApiKey']));
        }
        if (isset($body['anthropicModel'])) {
            $model = trim((string) $body['anthropicModel']);
            SettingsRepository::set(self::ANTHROPIC_MODEL, $model !== '' ? $model : null);
        }

        self::show();
    }
}
