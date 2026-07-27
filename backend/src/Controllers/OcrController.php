<?php

namespace FinanceOcr\Controllers;

use FinanceOcr\Auth\AuthMiddleware;
use FinanceOcr\Config;
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

        $convertedPath = null;
        try {
            $ocrImagePath = $storedPath;
            if ($mime === 'application/pdf') {
                $convertedPath = OcrService::convertPdfToImage($storedPath);
                $ocrImagePath = $convertedPath;
            }

            $text = OcrService::recognize($ocrImagePath);
            error_log('Texto OCR (' . strlen($text) . " chars) para {$userId}:\n{$text}");

            $extracted = InvoiceParser::parse($text);
            Response::json(array_merge($extracted, ['fileName' => $storedName]));
        } catch (\Throwable $e) {
            error_log('Erro OCR: ' . $e->getMessage());
            Response::error('Falha ao processar OCR', 500);
        } finally {
            if ($convertedPath && file_exists($convertedPath)) {
                @unlink($convertedPath);
            }
        }
    }
}
