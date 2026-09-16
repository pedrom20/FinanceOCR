<?php

namespace FinanceOcr\Controllers;

use FinanceOcr\Auth\AuthMiddleware;
use FinanceOcr\Repositories\InvoiceRepository;
use FinanceOcr\Support\Response;

class ItemController
{
    /**
     * Renomeia todas as ocorrências deste artigo (por este utilizador) e
     * grava a correspondência raw->novo nome, para faturas futuras já
     * saírem com o nome corrigido em vez de criarem um "artigo novo".
     */
    public static function rename(): void
    {
        $payload = AuthMiddleware::authenticate();
        $userId = (int) $payload['sub'];

        $body = json_decode((string) file_get_contents('php://input'), true);
        $oldName = trim((string) ($body['productName'] ?? ''));
        $newName = trim((string) ($body['newName'] ?? ''));
        if ($oldName === '' || $newName === '') {
            Response::error('Nome inválido', 400);
            return;
        }

        $updated = InvoiceRepository::renameProductGroup($userId, $oldName, $newName);
        if ($newName !== $oldName) {
            InvoiceRepository::saveProductNameMapping($userId, $oldName, $newName);
        }
        Response::json(['updatedCount' => $updated]);
    }

    public static function recategorize(): void
    {
        $payload = AuthMiddleware::authenticate();
        $userId = (int) $payload['sub'];

        $body = json_decode((string) file_get_contents('php://input'), true);
        $productName = trim((string) ($body['productName'] ?? ''));
        $category = trim((string) ($body['category'] ?? ''));
        if ($productName === '') {
            Response::error('Artigo inválido', 400);
            return;
        }

        $updated = InvoiceRepository::recategorizeProductGroup($userId, $productName, $category);
        Response::json(['updatedCount' => $updated]);
    }
}
