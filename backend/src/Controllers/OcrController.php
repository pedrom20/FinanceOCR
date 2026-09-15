<?php

namespace FinanceOcr\Controllers;

use FinanceOcr\Auth\AuthMiddleware;
use FinanceOcr\Config;
use FinanceOcr\Repositories\InvoiceRepository;
use FinanceOcr\Services\Ai\AiProviderFactory;
use FinanceOcr\Services\InvoiceParser;
use FinanceOcr\Services\OcrService;
use FinanceOcr\Support\Response;

class OcrController
{
    private const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'application/pdf'];
    private const MAX_SIZE = 10 * 1024 * 1024;

    public static function processInvoice(): void
    {
        $payload = AuthMiddleware::authenticate();
        $userId = (string) $payload['sub'];

        if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            Response::error('Ficheiro é obrigatório', 400);
            return;
        }

        $file = $_FILES['file'];
        if ($file['size'] > self::MAX_SIZE) {
            Response::error('Ficheiro demasiado grande (máx. 10MB)', 400);
            return;
        }

        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);

        if (!in_array($mime, self::ALLOWED_MIME, true)) {
            Response::error('Formato não suportado. Envie uma foto (JPG/PNG) ou um PDF da fatura.', 400);
            return;
        }

        $userDir = Config::uploadsDir() . '/' . $userId;
        if (!is_dir($userDir) && !mkdir($userDir, 0755, true) && !is_dir($userDir)) {
            Response::error('Falha ao preparar armazenamento', 500);
            return;
        }

        $safeName = preg_replace('/[^a-zA-Z0-9._-]/', '_', basename($file['name']));
        $storedName = time() . '-' . $safeName;
        $storedPath = $userDir . '/' . $storedName;

        if (!move_uploaded_file($file['tmp_name'], $storedPath)) {
            Response::error('Falha ao guardar ficheiro', 500);
            return;
        }

        error_log("A processar OCR para utilizador {$userId} ({$file['name']}, {$file['size']} bytes)");

        $convertedPaths = [];
        try {
            $ocrImagePath = $storedPath;
            if ($mime === 'application/pdf') {
                $convertedPaths = OcrService::convertPdfToImages($storedPath);
                // A primeira página é a usada no fallback de visão da IA mais
                // abaixo — nesse caso (menos comum, só quando o parser local já
                // falhou) a IA só vê essa página, não o documento completo.
                $ocrImagePath = $convertedPaths[0];
                $text = OcrService::recognizeAll($convertedPaths);
            } else {
                $text = OcrService::recognize($ocrImagePath);
            }
            error_log('Texto OCR (' . strlen($text) . " chars) para {$userId}:\n{$text}");

            $extracted = InvoiceParser::parse($text);
            $provider = AiProviderFactory::current();

            // O parser local (grátis, regex) falha em formatos que nunca viu.
            // Quando o resultado parece pouco fiável, tenta-se um fallback
            // pago (visão da IA sobre a própria imagem, no fornecedor ativo
            // nas definições) — só nesse caso, para manter o custo baixo. Uma
            // falha aqui não deve rebentar o pedido: fica-se com o resultado
            // do parser local.
            $lowConfidence = empty($extracted['items'])
                || $extracted['storeNif'] === ''
                || $extracted['totalAmount'] <= 0;
            if ($lowConfidence) {
                try {
                    $aiMediaType = $mime === 'application/pdf' ? 'image/png' : $mime;
                    $aiResult = $provider?->extractInvoice($ocrImagePath, $aiMediaType);
                    if ($aiResult !== null) {
                        error_log("Fallback IA (" . get_class($provider) . ") usado para utilizador {$userId} (parse local insuficiente)");
                        if ($aiResult['storeName'] !== '') {
                            $extracted['storeName'] = $aiResult['storeName'];
                        }
                        if ($aiResult['storeNif'] !== '') {
                            $extracted['storeNif'] = $aiResult['storeNif'];
                        }
                        if ($aiResult['invoiceDate'] !== '') {
                            $extracted['invoiceDate'] = $aiResult['invoiceDate'];
                        }
                        if ($aiResult['totalAmount'] > 0) {
                            $extracted['totalAmount'] = $aiResult['totalAmount'];
                        }
                        if (!empty($aiResult['items'])) {
                            $extracted['items'] = $aiResult['items'];
                        }
                        $extracted['paymentMethod'] = $aiResult['paymentMethod'];
                    }
                } catch (\Throwable $e) {
                    error_log('Falha no fallback IA: ' . $e->getMessage());
                }
            }

            // Sugestão de categoria por artigo (ex: "Fruta e Legumes"), para
            // agregação em relatórios entre lojas/marcas diferentes. Chamada de
            // texto, bem mais barata que o fallback de visão acima, por isso
            // corre sempre que há artigos (não só em baixa confiança).
            if (!empty($extracted['items'])) {
                try {
                    $productNames = array_column($extracted['items'], 'productName');
                    $knownCategories = InvoiceRepository::listCategoriesForUser((int) $userId);
                    $categoryMap = $provider?->suggestCategories($productNames, $knownCategories);
                    if ($categoryMap !== null) {
                        foreach ($categoryMap as $idx => $category) {
                            $extracted['items'][$idx]['category'] = $category;
                        }
                    }
                } catch (\Throwable $e) {
                    error_log('Falha na sugestão de categorias: ' . $e->getMessage());
                }
            }

            // O InvoiceParser já separa "Empresa - Filial" quando o cabeçalho
            // vem nesse formato; se não vier (nome sem traço), usa-se o nome
            // completo como "localização" — melhor que ficar em branco. Depois,
            // se este NIF já tiver sido confirmado antes por este utilizador,
            // usa-se esse nome (já normalizado por ele) em vez do texto deste OCR.
            if ($extracted['storeLocation'] === '') {
                $extracted['storeLocation'] = $extracted['storeName'];
            }
            if ($extracted['storeNif'] !== '') {
                $knownName = InvoiceRepository::findStoreNameByNif((int) $userId, $extracted['storeNif']);
                if ($knownName !== null) {
                    $extracted['storeName'] = $knownName;
                }
            }

            Response::json(array_merge($extracted, ['fileName' => $storedName]));
        } catch (\Throwable $e) {
            error_log('Erro OCR: ' . $e->getMessage());
            Response::error('Falha ao processar OCR', 500);
        } finally {
            foreach ($convertedPaths as $path) {
                if (file_exists($path)) {
                    @unlink($path);
                }
            }
        }
    }
}
