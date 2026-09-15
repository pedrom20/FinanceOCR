<?php

namespace FinanceOcr\Services\Ai;

class OpenAiProvider extends AbstractAiProvider
{
    private const API_URL = 'https://api.openai.com/v1/chat/completions';

    public static function key(): string
    {
        return 'openai';
    }

    public static function label(): string
    {
        return 'OpenAI';
    }

    public static function defaultModel(): string
    {
        return 'gpt-4o-mini';
    }

    public static function supportedMediaTypes(): array
    {
        return ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    }

    protected function callVision(string $prompt, string $base64Image, string $mediaType): string
    {
        return $this->call([
            ['type' => 'text', 'text' => $prompt],
            ['type' => 'image_url', 'image_url' => ['url' => "data:{$mediaType};base64,{$base64Image}"]],
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
            'authorization: Bearer ' . $this->apiKey,
        ]);

        $decoded = json_decode($response, true);
        $text = $decoded['choices'][0]['message']['content'] ?? null;
        if (!is_string($text)) {
            throw new \RuntimeException('Resposta da API OpenAI sem texto utilizável');
        }
        return $text;
    }
}
