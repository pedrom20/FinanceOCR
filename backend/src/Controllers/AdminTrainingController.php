<?php

namespace FinanceOcr\Controllers;

use FinanceOcr\Auth\AuthMiddleware;
use FinanceOcr\Config;
use FinanceOcr\Repositories\TrainingExampleRepository;
use FinanceOcr\Support\Response;

/**
 * Área de admin para "treinar o OCR": não há um modelo local a re-treinar
 * (OCR = tesseract regex + chamada a uma API de visão externa), por isso
 * isto corrige um recibo uma vez e guarda a correção — a próxima fatura do
 * mesmo comerciante (por NIF) passa esse exemplo corrigido à IA como
 * referência, em vez de fine-tuning real.
 */
class AdminTrainingController
{
    private const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'application/pdf'];
    private const MAX_SIZE = 10 * 1024 * 1024;

    /** Corre o pipeline normal de OCR sobre um recibo de exemplo, para o admin corrigir a seguir. Não cria nenhuma fatura. */
    public static function process(): void
    {
        $payload = AuthMiddleware::requireAdmin();
        $adminId = (int) $payload['sub'];

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
            Response::error('Formato não suportado. Envia uma foto (JPG/PNG) ou um PDF.', 400);
            return;
        }

        $trainingDir = Config::uploadsDir() . '/training';
        if (!is_dir($trainingDir) && !mkdir($trainingDir, 0755, true) && !is_dir($trainingDir)) {
            Response::error('Falha ao preparar armazenamento', 500);
            return;
        }

        $safeName = preg_replace('/[^a-zA-Z0-9._-]/', '_', basename($file['name']));
        $storedName = time() . '-' . $safeName;
        $storedPath = $trainingDir . '/' . $storedName;
        if (!move_uploaded_file($file['tmp_name'], $storedPath)) {
            Response::error('Falha ao guardar ficheiro', 500);
            return;
        }

        try {
            $extracted = OcrController::extractInvoiceData($storedPath, $mime, $adminId);
            Response::json(array_merge($extracted, ['fileName' => $storedName]));
        } catch (\Throwable $e) {
            error_log('Erro OCR (treino): ' . $e->getMessage());
            Response::error('Falha ao processar OCR', 500);
        }
    }

    /** Guarda os dados corrigidos à mão pelo admin como exemplo de referência para este comerciante (por NIF). */
    public static function store(): void
    {
        $payload = AuthMiddleware::requireAdmin();
        $adminId = (int) $payload['sub'];

        $body = json_decode((string) file_get_contents('php://input'), true);
        if (!is_array($body)) {
            Response::error('Corpo do pedido inválido', 400);
            return;
        }

        $storeNif = trim((string) ($body['storeNif'] ?? ''));
        $storeName = trim((string) ($body['storeName'] ?? ''));
        $fileName = $body['fileName'] ?? null;
        unset($body['fileName']);

        if ($storeNif === '' || $storeName === '') {
            Response::error('NIF e nome da loja são obrigatórios para associar o exemplo ao comerciante certo', 400);
            return;
        }

        $id = TrainingExampleRepository::create($storeNif, $storeName, json_encode($body, JSON_UNESCAPED_UNICODE), $fileName, $adminId);
        Response::json(['id' => (string) $id], 201);
    }

    public static function list(): void
    {
        AuthMiddleware::requireAdmin();
        Response::json(TrainingExampleRepository::listAll());
    }

    public static function destroy(array $params): void
    {
        AuthMiddleware::requireAdmin();
        $deleted = TrainingExampleRepository::delete((int) $params['id']);
        Response::json(['deleted' => $deleted]);
    }
}
