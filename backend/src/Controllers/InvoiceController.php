<?php

namespace FinanceOcr\Controllers;

use FinanceOcr\Auth\AuthMiddleware;
use FinanceOcr\Config;
use FinanceOcr\Repositories\InvoiceRepository;
use FinanceOcr\Services\Ai\AiProviderFactory;
use FinanceOcr\Support\Response;

class InvoiceController
{
    public static function create(): void
    {
        $payload = AuthMiddleware::authenticate();
        $userId = (int) $payload['sub'];

        $body = json_decode((string) file_get_contents('php://input'), true);
        if (!is_array($body)) {
            Response::error('Corpo do pedido inválido', 400);
            return;
        }

        $items = $body['items'] ?? [];
        unset($body['items']);

        if (!isset($body['storeName']) || !is_string($body['storeName']) || $body['storeName'] === '') {
            Response::error('Dados da fatura inválidos', 400);
            return;
        }
        if (!isset($body['totalAmount']) || !is_numeric($body['totalAmount'])) {
            Response::error('Dados da fatura inválidos', 400);
            return;
        }

        $id = InvoiceRepository::create($userId, $body, is_array($items) ? $items : []);
        Response::json(['id' => (string) $id], 201);
    }

    public static function list(): void
    {
        $payload = AuthMiddleware::authenticate();
        $userId = (int) $payload['sub'];
        Response::json(InvoiceRepository::listByUser($userId));
    }

    public static function show(array $params): void
    {
        $payload = AuthMiddleware::authenticate();
        $userId = (int) $payload['sub'];

        $invoice = InvoiceRepository::findByIdForUser($userId, (int) $params['id']);
        if ($invoice === null) {
            Response::error('Fatura não encontrada', 404);
            return;
        }
        Response::json($invoice);
    }

    public static function renameStore(array $params): void
    {
        $payload = AuthMiddleware::authenticate();
        $userId = (int) $payload['sub'];
        $invoiceId = (int) $params['id'];

        $body = json_decode((string) file_get_contents('php://input'), true);
        $newName = trim((string) ($body['storeName'] ?? ''));
        if ($newName === '') {
            Response::error('Nome da loja inválido', 400);
            return;
        }
        $applyToAll = !empty($body['applyToAllWithNif']);

        $updated = InvoiceRepository::renameStore($userId, $invoiceId, $newName, $applyToAll);
        if ($updated === null) {
            Response::error('Fatura não encontrada', 404);
            return;
        }
        Response::json(['updatedCount' => $updated]);
    }

    public static function updateItemCategory(array $params): void
    {
        $payload = AuthMiddleware::authenticate();
        $userId = (int) $payload['sub'];

        $body = json_decode((string) file_get_contents('php://input'), true);
        $category = trim((string) ($body['category'] ?? ''));

        $updated = InvoiceRepository::updateItemCategory($userId, (int) $params['invoiceId'], (int) $params['itemId'], $category);
        if (!$updated) {
            Response::error('Artigo não encontrado', 404);
            return;
        }
        Response::json(['category' => $category]);
    }

    /**
     * Categoriza em lote todos os artigos deste utilizador que ainda não têm
     * categoria (ex: faturas guardadas antes da sugestão de IA existir, ou
     * de quando ainda não havia nenhum fornecedor configurado).
     */
    public static function categorizeMissing(): void
    {
        $payload = AuthMiddleware::authenticate();
        $userId = (int) $payload['sub'];

        $provider = AiProviderFactory::current();
        if ($provider === null) {
            Response::error('Nenhum fornecedor de IA configurado nas definições', 400);
            return;
        }

        $items = InvoiceRepository::findItemsWithoutCategory($userId);
        if (empty($items)) {
            Response::json(['updated' => 0, 'total' => 0]);
            return;
        }

        $knownCategories = InvoiceRepository::listCategoriesForUser($userId);
        $updated = 0;
        foreach (array_chunk($items, 30) as $chunk) {
            $names = array_column($chunk, 'product_name');
            try {
                $categoryMap = $provider->suggestCategories($names, $knownCategories);
            } catch (\Throwable $e) {
                error_log('Falha ao categorizar em lote: ' . $e->getMessage());
                continue;
            }
            if ($categoryMap === null) {
                continue;
            }
            foreach ($categoryMap as $idx => $category) {
                if (!isset($chunk[$idx])) {
                    continue;
                }
                $ok = InvoiceRepository::updateItemCategory($userId, (int) $chunk[$idx]['invoice_id'], (int) $chunk[$idx]['id'], $category);
                if ($ok) {
                    $updated++;
                    if (!in_array($category, $knownCategories, true)) {
                        $knownCategories[] = $category;
                    }
                }
            }
        }

        Response::json(['updated' => $updated, 'total' => count($items)]);
    }

    /**
     * Corre outra vez todo o pipeline de OCR sobre o ficheiro já guardado
     * desta fatura (ex: depois de melhorar o parser, ou de configurar/trocar
     * o fornecedor de IA) e substitui os dados/artigos pelo resultado novo.
     */
    public static function reprocess(array $params): void
    {
        $payload = AuthMiddleware::authenticate();
        $userId = (int) $payload['sub'];
        $invoiceId = (int) $params['id'];

        $invoice = InvoiceRepository::findByIdForUser($userId, $invoiceId);
        if ($invoice === null) {
            Response::error('Fatura não encontrada', 404);
            return;
        }
        if (empty($invoice['fileName'])) {
            Response::error('Esta fatura não tem documento original para reprocessar', 400);
            return;
        }

        $path = Config::uploadsDir() . '/' . $userId . '/' . basename($invoice['fileName']);
        if (!file_exists($path)) {
            Response::error('O documento original já não existe no servidor', 404);
            return;
        }

        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($finfo, $path);
        finfo_close($finfo);

        try {
            $extracted = OcrController::extractInvoiceData($path, $mime, $userId);
        } catch (\Throwable $e) {
            error_log("Erro ao reprocessar fatura {$invoiceId}: " . $e->getMessage());
            Response::error('Falha ao reprocessar fatura', 500);
            return;
        }

        InvoiceRepository::reprocessInvoice($userId, $invoiceId, $extracted);
        Response::json(InvoiceRepository::findByIdForUser($userId, $invoiceId));
    }

    public static function destroy(array $params): void
    {
        $payload = AuthMiddleware::authenticate();
        $userId = (int) $payload['sub'];
        $invoiceId = (int) $params['id'];

        // Busca primeiro para saber se existe/pertence ao utilizador e para
        // obter o fileName a apagar do disco — deleteForUser() só confirma
        // que apagou uma linha, não devolve os dados que já desapareceram.
        $invoice = InvoiceRepository::findByIdForUser($userId, $invoiceId);
        if ($invoice === null) {
            Response::error('Fatura não encontrada', 404);
            return;
        }

        InvoiceRepository::deleteForUser($userId, $invoiceId);

        if (!empty($invoice['fileName'])) {
            $path = Config::uploadsDir() . '/' . $userId . '/' . basename($invoice['fileName']);
            if (file_exists($path)) {
                @unlink($path);
            }
        }

        Response::json(['deleted' => true]);
    }
}
