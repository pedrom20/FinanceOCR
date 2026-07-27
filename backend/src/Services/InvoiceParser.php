<?php

namespace FinanceOcr\Services;

/**
 * Port of the original Node parseInvoiceText() (api/server.js). Same regexes,
 * same field names, same heuristics — tuned this session against a real
 * Portuguese telecom invoice (MEO, as a PDF) and a synthetic supermarket
 * receipt, see backend/tests/fixtures/ and backend/tests/verify-ocr-parser.php.
 */
class InvoiceParser
{
    public static function parse(string $text): array
    {
        $result = [
            'storeName' => 'Loja Identificada',
            'storeNif' => '',
            'invoiceNumber' => '',
            'invoiceDate' => '',
            'totalAmount' => 0.0,
            'paymentMethod' => 'Dinheiro',
            'items' => [],
        ];

        // preg_match with /u fails silently (returns false) on invalid UTF-8,
        // which JS strings can never contain — sanitize first since OCR output
        // occasionally isn't clean UTF-8.
        $text = (string) iconv('UTF-8', 'UTF-8//IGNORE', $text);

        $lines = array_values(array_filter(array_map('trim', explode("\n", $text)), fn($l) => $l !== ''));

        // O NIF costuma aparecer com espaços entre grupos de dígitos (ex: "114 980 136"),
        // por isso captura-se dígitos+espaços e limpam-se os espaços depois.
        $nifRegex = '/(?:NIF|NIPC|CONTRIB(?:UINTE)?)\D{0,8}([\d ]{9,13})/iu';
        // Entre o rótulo e o valor pode haver espaços de alinhamento, dois pontos
        // ou o símbolo de euro — mas não outras palavras, para não apanhar o
        // número errado em linhas como "Total da fatura de junho 58,980 ... € 72,55".
        $totalRegex = '/(?:VALOR A PAGAR|TOTAL A PAGAR|VALOR TOTAL|TOTAL|PAGAR)[:\s€]*(\d+[.,]\d{2})/iu';
        $dateRegex = '/(\d{2}[-\/]\d{2}[-\/]\d{4})/';
        $itemExclusionRegex = '/\b(TOTAL|SUBTOTAL|IVA|NIF|NIPC|CONTRIBUINTE|TROCO|DESCONTO|PAGO|REFER[ÊE]NCIA|CLIENTE|CONTA|IBAN|BIC|D[ÉE]BITO|PAGAMENTO|FATURA|EMISS[ÃA]O|MORADA|ATCUD|CR[ÉE]DITO)\b/iu';

        // Nome da loja: normalmente é uma das primeiras linhas do cabeçalho, antes
        // de qualquer linha "administrativa" (NIF, Fatura Nº, Data, etc.).
        $storeStopRegex = '/\b(NIF|NIPC|CONTRIBUINTE|FATURA|FACTURA|TAL[ÃA]O|RECIBO|ATCUD|DATA)\b/iu';
        foreach (array_slice($lines, 0, 12) as $line) {
            if (preg_match($storeStopRegex, $line) === 1) {
                break;
            }
            $letters = preg_match_all('/[A-Za-zÀ-ÿ]/u', $line);
            $letters = $letters === false ? 0 : $letters;
            if ($letters >= 3 && $letters / mb_strlen($line) >= 0.5) {
                $result['storeName'] = $line;
                break;
            }
        }

        // Nas faturas em PDF o cabeçalho é muitas vezes um logótipo, que o OCR lê
        // como ruído ilegível antes de qualquer linha "administrativa" — a
        // heurística acima falha nesses casos. Como alternativa, procura-se um
        // domínio (ex: "meo.pt") no texto, que costuma identificar a empresa.
        if ($result['storeName'] === 'Loja Identificada') {
            if (preg_match('/\b([a-z][a-z0-9-]{1,20})\.(?:pt|com|eu)\b/iu', $text, $domainMatch) === 1) {
                $result['storeName'] = mb_strtoupper($domainMatch[1]);
            }
        }

        foreach ($lines as $line) {
            // Detect NIF
            if (!$result['storeNif'] && preg_match($nifRegex, $line, $nifMatch) === 1) {
                $digits = preg_replace('/\D/', '', $nifMatch[1]);
                if (strlen($digits) === 9) {
                    $result['storeNif'] = $digits;
                }
            }

            // Detect Total: ignora "SUBTOTAL" e fica com a última ocorrência
            if (preg_match('/SUBTOTAL/iu', $line) !== 1) {
                if (preg_match($totalRegex, $line, $totalMatch) === 1) {
                    $result['totalAmount'] = (float) str_replace(',', '.', $totalMatch[1]);
                }
            }

            // Detect Date: converte DD/MM/AAAA ou DD-MM-AAAA para AAAA-MM-DD
            if (!$result['invoiceDate'] && preg_match($dateRegex, $line, $dateMatch) === 1) {
                [$day, $month, $year] = preg_split('/[-\/]/', $dateMatch[1]);
                $result['invoiceDate'] = "{$year}-{$month}-{$day}";
            }

            // Try to catch items (e.g. "Product Name 1.50")
            if (preg_match('/(.+?)\s+(\d+[.,]\d{2})$/u', $line, $itemMatch) === 1
                && preg_match($itemExclusionRegex, $line) !== 1) {
                $productName = preg_replace('/\s{2,}/', ' ', trim($itemMatch[1]));
                $price = (float) str_replace(',', '.', $itemMatch[2]);
                $lettersInName = preg_match_all('/[A-Za-zÀ-ÿ]/u', $productName);
                $lettersInName = $lettersInName === false ? 0 : $lettersInName;

                // Só aceita linhas que pareçam mesmo um produto: nome com letras
                // reais e preço num intervalo plausível.
                if ($lettersInName >= 3 && $price > 0 && $price < 10000) {
                    $result['items'][] = [
                        'productName' => $productName,
                        'quantity' => 1,
                        'unitPrice' => $price,
                        'totalPrice' => $price,
                    ];
                }
            }
        }

        if (!$result['invoiceDate']) {
            $result['invoiceDate'] = date('Y-m-d');
        }

        return $result;
    }
}
