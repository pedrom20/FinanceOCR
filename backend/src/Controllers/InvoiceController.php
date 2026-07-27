<?php

namespace FinanceOcr\Controllers;

use FinanceOcr\Auth\AuthMiddleware;
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
}
