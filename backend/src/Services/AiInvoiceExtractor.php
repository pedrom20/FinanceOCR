<?php

namespace FinanceOcr\Services;

use FinanceOcr\Config;

/**
 * Fallback for receipts the regex-based InvoiceParser can't handle (a format
 * it's never seen). Sends the receipt image itself to a vision-capable
 * Claude model and asks for the same field shape InvoiceParser produces.
 * Only called when the free/local parse looks unreliable (see OcrController)
 * — this hits a paid external API, so it's an exception path, not the norm.
 */
class AiInvoiceExtractor
{
    private const API_URL = 'https://api.anthropic.com/v1/messages';
    private const ANTHROPIC_VERSION = '2023-06-01';
    private const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
    private const SUPPORTED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

    private const PROMPT = <<<'PROMPT'
Extrai os dados desta fatura ou talão de compra português. Responde APENAS
com um único objeto JSON (sem markdown, sem explicações, sem ```), com
exatamente estes campos:

{
  "storeName": string (nome do comerciante/loja),
  "storeNif": string (9 dígitos, sem espaços; "" se não encontrares),
  "invoiceDate": string (formato AAAA-MM-DD; "" se não encontrares),
  "totalAmount": number (valor total pago),
  "paymentMethod": string (ex: "Multibanco", "Cartão", "Dinheiro", "MB Way"; "Dinheiro" se não conseguires determinar),
  "items": [ { "productName": string, "quantity": number, "unitPrice": number, "totalPrice": number } ]
}

Se não conseguires ler algum campo, usa "" para strings, 0 para números, ou
[] para items. Não inventes valores que não estejam visíveis na imagem.
PROMPT;

    private const CATEGORY_PROMPT = <<<'PROMPT'
Tens uma lista de artigos comprados e, opcionalmente, uma lista de categorias
já usadas antes por este utilizador. Para cada artigo, escolhe a categoria
mais apropriada — reutiliza uma categoria já existente sempre que fizer
sentido (mesmo que o nome do artigo seja diferente, ex: "Atum em Lata" e
"Bom Petisco 120g" podem ser ambos "Conservas de Peixe"), e só inventes uma
categoria nova, curta e genérica (ex: "Fruta e Legumes", "Laticínios",
"Limpeza", "Bebidas", "Higiene", "Charcutaria", "Mercearia", "Padaria") se
nenhuma existente servir.

Categorias já existentes: {{categories}}

Artigos:
{{items}}

Responde APENAS com um objeto JSON (sem markdown, sem explicações) que
mapeia o número de cada artigo à categoria escolhida, ex:
{"1": "Fruta e Legumes", "2": "Higiene"}
PROMPT;

    /**
     * @return array{storeName:string,storeNif:string,invoiceDate:string,totalAmount:float,paymentMethod:string,items:array}|null
     *         null se a API não estiver configurada, o tipo de imagem não for suportado, ou o pedido falhar.
     */
    public static function extract(string $imagePath, string $mediaType): ?array
    {
        $apiKey = Config::get('ANTHROPIC_API_KEY');
        if (!$apiKey) {
            return null;
        }
        if (!in_array($mediaType, self::SUPPORTED_MEDIA_TYPES, true)) {
            return null;
        }

        $imageData = @file_get_contents($imagePath);
        if ($imageData === false) {
            return null;
        }

        $content = [
            ['type' => 'image', 'source' => [
                'type' => 'base64',
                'media_type' => $mediaType,
                'data' => base64_encode($imageData),
            ]],
            ['type' => 'text', 'text' => self::PROMPT],
        ];

        $text = self::callMessagesApi($apiKey, $content, 1024);
        return self::parseModelJson($text);
    }

    /**
     * Sugere uma categoria por artigo, reaproveitando categorias que este
     * utilizador já usou antes sempre que fizer sentido. Chamada de texto
     * (sem imagem), por isso muito mais barata que extract(). Devolve um mapa
     * índice-no-array-$productNames => categoria; entradas em falta significam
     * que o modelo não sugeriu nada para esse artigo.
     *
     * @param string[] $productNames
     * @param string[] $knownCategories
     * @return array<int,string>|null
     */
    public static function suggestCategories(array $productNames, array $knownCategories): ?array
    {
        $apiKey = Config::get('ANTHROPIC_API_KEY');
        if (!$apiKey || empty($productNames)) {
            return null;
        }

        $itemsText = '';
        foreach (array_values($productNames) as $i => $name) {
            $itemsText .= ($i + 1) . '. ' . $name . "\n";
        }
        $categoriesText = empty($knownCategories) ? 'nenhuma' : implode(', ', $knownCategories);
        $prompt = str_replace(
            ['{{categories}}', '{{items}}'],
            [$categoriesText, trim($itemsText)],
            self::CATEGORY_PROMPT
        );

        $text = self::callMessagesApi($apiKey, [['type' => 'text', 'text' => $prompt]], 512);
        $data = self::decodeJsonFromModelText($text);
        if (!is_array($data)) {
            return null;
        }

        $result = [];
        foreach (array_values($productNames) as $i => $name) {
            $key = (string) ($i + 1);
            if (isset($data[$key]) && is_string($data[$key]) && $data[$key] !== '') {
                $result[$i] = $data[$key];
            }
        }
        return $result;
    }

    private static function callMessagesApi(string $apiKey, array $content, int $maxTokens): string
    {
        $payload = [
            'model' => Config::get('ANTHROPIC_MODEL', self::DEFAULT_MODEL),
            'max_tokens' => $maxTokens,
            'messages' => [['role' => 'user', 'content' => $content]],
        ];

        $ch = curl_init(self::API_URL);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_HTTPHEADER => [
                'content-type: application/json',
                'x-api-key: ' . $apiKey,
                'anthropic-version: ' . self::ANTHROPIC_VERSION,
            ],
            CURLOPT_TIMEOUT => 30,
        ]);
        $response = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($response === false) {
            throw new \RuntimeException('Falha ao contactar a API de IA: ' . $curlError);
        }
        if ($status !== 200) {
            throw new \RuntimeException("API de IA devolveu HTTP {$status}: {$response}");
        }

        $decoded = json_decode($response, true);
        $text = $decoded['content'][0]['text'] ?? null;
        if (!is_string($text)) {
            throw new \RuntimeException('Resposta da API de IA sem texto utilizável');
        }
        return $text;
    }

    private static function decodeJsonFromModelText(string $text): ?array
    {
        $text = trim($text);
        $text = preg_replace('/^```(?:json)?|```$/m', '', $text);
        $data = json_decode(trim((string) $text), true);
        return is_array($data) ? $data : null;
    }

    private static function parseModelJson(string $text): ?array
    {
        $data = self::decodeJsonFromModelText($text);
        if ($data === null) {
            return null;
        }

        $items = [];
        foreach ((array) ($data['items'] ?? []) as $item) {
            if (!is_array($item) || !isset($item['productName'])) {
                continue;
            }
            $items[] = [
                'productName' => (string) $item['productName'],
                'quantity' => (float) ($item['quantity'] ?? 1),
                'quantityUnit' => 'un',
                'unitPrice' => (float) ($item['unitPrice'] ?? 0),
                'totalPrice' => (float) ($item['totalPrice'] ?? 0),
                'vatRate' => null,
                'category' => '',
            ];
        }

        return [
            'storeName' => (string) ($data['storeName'] ?? ''),
            'storeNif' => preg_replace('/\D/', '', (string) ($data['storeNif'] ?? '')),
            'invoiceDate' => (string) ($data['invoiceDate'] ?? ''),
            'totalAmount' => (float) ($data['totalAmount'] ?? 0),
            'paymentMethod' => (string) ($data['paymentMethod'] ?? 'Dinheiro'),
            'items' => $items,
        ];
    }
}
