<?php

namespace FinanceOcr\Controllers;

use FinanceOcr\Auth\AuthMiddleware;
use FinanceOcr\Config;
use FinanceOcr\Repositories\InvoiceRepository;
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
