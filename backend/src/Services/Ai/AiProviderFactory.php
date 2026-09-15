<?php

namespace FinanceOcr\Services\Ai;

use FinanceOcr\Config;
use FinanceOcr\Repositories\SettingsRepository;

/**
 * Instancia o fornecedor de IA ativo (definido na página de definições), com
 * a respetiva chave/modelo. Devolve null se não houver chave configurada
 * para o fornecedor ativo — quem chamar trata isso como "IA desativada".
 */
class AiProviderFactory
{
    /** @return class-string<AiProviderInterface>[] */
    public static function all(): array
    {
        return [AnthropicProvider::class, OpenAiProvider::class, GoogleProvider::class];
    }

    public static function current(): ?AiProviderInterface
    {
        $activeKey = SettingsRepository::get('ai_provider') ?? AnthropicProvider::key();

        foreach (self::all() as $class) {
            if ($class::key() !== $activeKey) {
                continue;
            }
            $apiKey = SettingsRepository::get($class::key() . '_api_key');
            // O .env só serve de fallback para Anthropic, por compatibilidade
            // com deploys que já o configuravam assim antes de existir a
            // página de definições.
            if (!$apiKey && $class === AnthropicProvider::class) {
                $apiKey = Config::get('ANTHROPIC_API_KEY');
            }
            if (!$apiKey) {
                return null;
            }
            $model = SettingsRepository::get($class::key() . '_model') ?: $class::defaultModel();
            return new $class($apiKey, $model);
        }

        return null;
    }
}
