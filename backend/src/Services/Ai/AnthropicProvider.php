<?php

namespace FinanceOcr\Services\Ai;

class AnthropicProvider extends AbstractAiProvider
{
    private const API_URL = 'https://api.anthropic.com/v1/messages';
    private const ANTHROPIC_VERSION = '2023-06-01';

    public static function key(): string
    {
        return 'anthropic';
    }

    public static function label(): string
    {
        return 'Anthropic Claude';
    }

    public static function defaultModel(): string
    {
        return 'claude-haiku-4-5-20251001';
    }

    public static function supportedMediaTypes(): array
    {
        return ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    }

    protected function callVision(string $prompt, string $base64Image, string $mediaType): string
    {
        return $this->call([
            ['type' => 'image', 'source' => ['type' => 'base64', 'media_type' => $mediaType, 'data' => $base64Image]],
            ['type' => 'text', 'text' => $prompt],
        ], 1024);
    }

    protected function callText(string $prompt): string
    {
        return $this->call([['type' => 'text', 'text' => $prompt]], 512);
    }

    private function call(array $content, int $maxTokens): string
    {
        $response = self::post(self::API_URL, [
            'model' => $this->model,
            'max_tokens' => $maxTokens,
            'messages' => [['role' => 'user', 'content' => $content]],
        ], [
            'content-type: application/json',
            'x-api-key: ' . $this->apiKey,
            'anthropic-version: ' . self::ANTHROPIC_VERSION,
        ]);

        $decoded = json_decode($response, true);
        $text = $decoded['content'][0]['text'] ?? null;
        if (!is_string($text)) {
            throw new \RuntimeException('Resposta da API Anthropic sem texto utilizável');
        }
        return $text;
    }
}
