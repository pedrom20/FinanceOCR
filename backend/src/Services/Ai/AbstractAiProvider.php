<?php

namespace FinanceOcr\Services\Ai;

use FinanceOcr\Services\InvoiceParser;

/**
 * Prompts e parsing de resposta partilhados entre fornecedores — cada
 * fornecedor só implementa a chamada HTTP específica da sua API (o formato
 * do pedido/resposta é diferente em cada uma).
 */
abstract class AbstractAiProvider implements AiProviderInterface
{
    protected const PROMPT = <<<'PROMPT'
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

    protected const CATEGORY_PROMPT = <<<'PROMPT'
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

    public function __construct(protected string $apiKey, protected string $model)
    {
    }

    abstract protected function callVision(string $prompt, string $base64Image, string $mediaType): string;

    abstract protected function callText(string $prompt): string;

    /** @return string[] Tipos MIME de imagem que a API de visão deste fornecedor aceita. */
    abstract public static function supportedMediaTypes(): array;

    public function extractInvoice(string $imagePath, string $mediaType): ?array
    {
        if (!in_array($mediaType, static::supportedMediaTypes(), true)) {
            return null;
        }
        $imageData = @file_get_contents($imagePath);
        if ($imageData === false) {
            return null;
        }
        $text = $this->callVision(static::PROMPT, base64_encode($imageData), $mediaType);
        return $this->parseInvoiceJson($text);
    }

    public function suggestCategories(array $productNames, array $knownCategories): ?array
    {
        if (empty($productNames)) {
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
            static::CATEGORY_PROMPT
        );

        $text = $this->callText($prompt);
        $data = $this->decodeJson($text);
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

    protected const STORE_NAME_PROMPT = <<<'PROMPT'
Texto extraído por OCR do cabeçalho de um recibo/fatura português:
Nome: "{{name}}"
Localização/filial: "{{location}}"

Qual é o nome comercial curto e reconhecível deste comerciante (a marca,
não a filial nem a razão social completa)? Ex: "LIDL & Cia" -> "Lidl",
"CONTINENTE MODELO HIPERMERCADOS S.A." -> "Continente".

Responde APENAS com o nome sugerido, sem mais nada, sem aspas.
PROMPT;

    public function suggestStoreName(string $rawName, string $rawLocation): ?string
    {
        $prompt = str_replace(['{{name}}', '{{location}}'], [$rawName, $rawLocation ?: 'desconhecida'], self::STORE_NAME_PROMPT);
        $text = trim($this->callText($prompt));
        // Alguns modelos respondem com aspas à volta apesar do pedido.
        $text = trim($text, " \t\n\r\0\x0B\"'");
        return $text !== '' ? $text : null;
    }

    public function testConnection(): array
    {
        try {
            $text = trim($this->callText('Responde apenas com a palavra OK, sem mais nada.'));
            $ok = stripos($text, 'OK') !== false;
            return [
                'ok' => $ok,
                'message' => $ok ? "Ligação bem-sucedida (modelo: {$this->model})." : 'Resposta inesperada do modelo: ' . mb_substr($text, 0, 200),
            ];
        } catch (\Throwable $e) {
            return ['ok' => false, 'message' => $e->getMessage()];
        }
    }

    protected function decodeJson(string $text): ?array
    {
        $text = trim($text);
        $text = preg_replace('/^```(?:json)?|```$/m', '', $text);
        $data = json_decode(trim((string) $text), true);
        return is_array($data) ? $data : null;
    }

    private function parseInvoiceJson(string $text): ?array
    {
        $data = $this->decodeJson($text);
        if ($data === null) {
            return null;
        }

        $items = [];
        foreach ((array) ($data['items'] ?? []) as $item) {
            if (!is_array($item) || !isset($item['productName'])) {
                continue;
            }
            $items[] = [
                'productName' => InvoiceParser::toDisplayCase((string) $item['productName']),
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

    /** POST JSON genérico via cURL — os fornecedores só constroem o payload/headers. */
    protected static function post(string $url, array $payload, array $headers): string
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_HTTPHEADER => $headers,
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
        return $response;
    }
}
