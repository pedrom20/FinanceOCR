<?php

namespace FinanceOcr\Controllers;

use FinanceOcr\Auth\AuthMiddleware;
use FinanceOcr\Repositories\InvoiceRepository;
use FinanceOcr\Services\Ai\AiProviderFactory;
use FinanceOcr\Support\Response;

class StoreController
{
    public static function list(): void
    {
        $payload = AuthMiddleware::authenticate();
        $userId = (int) $payload['sub'];
        Response::json(InvoiceRepository::listStoresForUser($userId));
    }

    public static function rename(): void
    {
        $payload = AuthMiddleware::authenticate();
        $userId = (int) $payload['sub'];

        $body = json_decode((string) file_get_contents('php://input'), true);
        $storeNif = trim((string) ($body['storeNif'] ?? ''));
        $oldStoreName = trim((string) ($body['storeName'] ?? ''));
        $newName = trim((string) ($body['newName'] ?? ''));
        if ($newName === '') {
            Response::error('Nome inválido', 400);
            return;
        }

        $updated = InvoiceRepository::renameStoreGroup($userId, $storeNif, $oldStoreName, $newName);
        Response::json(['updatedCount' => $updated]);
    }

    /** Sugestão de IA (não guarda nada — o utilizador confirma via rename()). */
    public static function suggestName(): void
    {
        AuthMiddleware::authenticate();

        $body = json_decode((string) file_get_contents('php://input'), true);
        $rawName = trim((string) ($body['storeName'] ?? ''));
        if ($rawName === '') {
            Response::error('Nome inválido', 400);
            return;
        }
        $rawLocation = trim((string) ($body['storeLocation'] ?? ''));

        $provider = AiProviderFactory::current();
        if ($provider === null) {
            Response::error('Nenhum fornecedor de IA configurado nas definições', 400);
            return;
        }

        try {
            $suggestion = $provider->suggestStoreName($rawName, $rawLocation);
        } catch (\Throwable $e) {
            Response::error('Falha ao sugerir nome: ' . $e->getMessage(), 502);
            return;
        }

        if ($suggestion === null) {
            Response::error('A IA não conseguiu sugerir um nome', 502);
            return;
        }
        Response::json(['suggestion' => $suggestion]);
    }
}
