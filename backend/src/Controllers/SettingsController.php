<?php

namespace FinanceOcr\Controllers;

use FinanceOcr\Auth\AuthMiddleware;
use FinanceOcr\Repositories\SettingsRepository;
use FinanceOcr\Services\Ai\AiProviderFactory;
use FinanceOcr\Services\Ai\AnthropicProvider;
use FinanceOcr\Support\Response;

class SettingsController
{
    /** Nunca devolve os valores das chaves já guardadas — só se cada uma está ou não configurada. */
    public static function show(): void
    {
        AuthMiddleware::requireAdmin();

        $providers = [];
        foreach (AiProviderFactory::all() as $class) {
            $providers[$class::key()] = [
                'label' => $class::label(),
                'configured' => SettingsRepository::get($class::key() . '_api_key') !== null,
                'model' => SettingsRepository::get($class::key() . '_model') ?? '',
                'defaultModel' => $class::defaultModel(),
            ];
        }

        Response::json([
            'activeProvider' => SettingsRepository::get('ai_provider') ?? AnthropicProvider::key(),
            'providers' => $providers,
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

        $validKeys = array_map(fn ($class) => $class::key(), AiProviderFactory::all());
        if (isset($body['activeProvider']) && in_array($body['activeProvider'], $validKeys, true)) {
            SettingsRepository::set('ai_provider', $body['activeProvider']);
        }

        foreach ($validKeys as $providerKey) {
            $providerBody = $body[$providerKey] ?? null;
            if (!is_array($providerBody)) {
                continue;
            }
            // Campo em branco = não mexer na chave já guardada (o formulário
            // nunca mostra o valor atual, por isso "vazio" não pode significar
            // "apagar").
            if (isset($providerBody['apiKey']) && trim((string) $providerBody['apiKey']) !== '') {
                SettingsRepository::set($providerKey . '_api_key', trim((string) $providerBody['apiKey']));
            }
            if (isset($providerBody['model'])) {
                $model = trim((string) $providerBody['model']);
                SettingsRepository::set($providerKey . '_model', $model !== '' ? $model : null);
            }
        }

        self::show();
    }

    /**
     * Testa a ligação a um fornecedor com uma chamada de texto mínima (sem
     * imagem, custo quase nulo). Aceita apiKey/model no corpo para testar
     * valores ainda não gravados; se omitidos, usa os já guardados.
     */
    public static function test(): void
    {
        AuthMiddleware::requireAdmin();

        $body = json_decode((string) file_get_contents('php://input'), true);
        $providerKey = (string) ($body['provider'] ?? '');

        $validKeys = array_map(fn ($class) => $class::key(), AiProviderFactory::all());
        if (!in_array($providerKey, $validKeys, true)) {
            Response::error('Fornecedor inválido', 400);
            return;
        }

        $apiKey = trim((string) ($body['apiKey'] ?? '')) ?: null;
        $model = trim((string) ($body['model'] ?? '')) ?: null;

        $provider = AiProviderFactory::forKey($providerKey, $apiKey, $model);
        if ($provider === null) {
            Response::json(['ok' => false, 'message' => 'Nenhuma chave configurada para testar.']);
            return;
        }

        Response::json($provider->testConnection());
    }
}
