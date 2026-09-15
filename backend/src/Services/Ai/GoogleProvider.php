<?php

namespace FinanceOcr\Services\Ai;

class GoogleProvider extends AbstractAiProvider
{
    private const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

    public static function key(): string
    {
        return 'google';
    }

    public static function label(): string
    {
        return 'Google Gemini';
    }

    public static function defaultModel(): string
    {
        return 'gemini-2.0-flash';
    }

    public static function supportedMediaTypes(): array
    {
        return ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    }

    protected function callVision(string $prompt, string $base64Image, string $mediaType): string
    {
        return $this->call([
            ['text' => $prompt],
            ['inline_data' => ['mime_type' => $mediaType, 'data' => $base64Image]],
        ], 1024);
    }

    protected function callText(string $prompt): string
    {
        return $this->call([['text' => $prompt]], 512);
    }

    private function call(array $parts, int $maxOutputTokens): string
    {
        $url = self::API_BASE . rawurlencode($this->model) . ':generateContent?key=' . rawurlencode($this->apiKey);
        $response = self::post($url, [
            'contents' => [['parts' => $parts]],
            'generationConfig' => ['maxOutputTokens' => $maxOutputTokens],
        ], ['content-type: application/json']);

        $decoded = json_decode($response, true);
        $text = $decoded['candidates'][0]['content']['parts'][0]['text'] ?? null;
        if (!is_string($text)) {
            throw new \RuntimeException('Resposta da API Google sem texto utilizável');
        }
        return $text;
    }
}
