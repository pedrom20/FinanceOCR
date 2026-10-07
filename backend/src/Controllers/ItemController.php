<?php

namespace FinanceOcr\Controllers;

use FinanceOcr\Auth\AuthMiddleware;
use FinanceOcr\Config;
use FinanceOcr\Repositories\InvoiceRepository;
use FinanceOcr\Support\Response;

class ItemController
{
    private const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];
    private const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

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

    public static function listAliases(): void
    {
        $payload = AuthMiddleware::authenticate();
        $userId = (int) $payload['sub'];

        $canonicalName = trim((string) ($_GET['productName'] ?? ''));
        if ($canonicalName === '') {
            Response::error('Artigo inválido', 400);
            return;
        }

        Response::json(['aliases' => InvoiceRepository::listAliasesForCanonical($userId, $canonicalName)]);
    }

    /**
     * Associa um nome alternativo (ex: "Agua", a mesma compra em espanhol) a
     * um artigo já existente — mesmo que nenhuma fatura tenha ainda esse
     * texto exato. Faz logo o merge retroativo (se já existir algum artigo
     * com esse nome) e grava a correspondência para faturas futuras.
     */
    public static function addAlias(): void
    {
        $payload = AuthMiddleware::authenticate();
        $userId = (int) $payload['sub'];

        $body = json_decode((string) file_get_contents('php://input'), true);
        $canonicalName = trim((string) ($body['canonicalName'] ?? ''));
        $alias = trim((string) ($body['alias'] ?? ''));
        if ($canonicalName === '' || $alias === '') {
            Response::error('Dados inválidos', 400);
            return;
        }
        if ($alias === $canonicalName) {
            Response::error('O nome alternativo não pode ser igual ao nome do artigo', 400);
            return;
        }

        InvoiceRepository::saveProductNameMapping($userId, $alias, $canonicalName);
        $merged = InvoiceRepository::renameProductGroup($userId, $alias, $canonicalName);
        Response::json(['mergedCount' => $merged]);
    }

    public static function removeAlias(): void
    {
        $payload = AuthMiddleware::authenticate();
        $userId = (int) $payload['sub'];

        $canonicalName = trim((string) ($_GET['canonicalName'] ?? ''));
        $alias = trim((string) ($_GET['alias'] ?? ''));
        if ($canonicalName === '' || $alias === '') {
            Response::error('Dados inválidos', 400);
            return;
        }

        $removed = InvoiceRepository::removeProductNameMapping($userId, $canonicalName, $alias);
        Response::json(['removed' => $removed]);
    }

    /** Imagem de referência de um artigo (ex: foto da embalagem) — aplica-se a TODAS as ocorrências com este nome, tal como a categoria. */
    public static function uploadImage(): void
    {
        $payload = AuthMiddleware::authenticate();
        $userId = (int) $payload['sub'];

        $productName = trim((string) ($_POST['productName'] ?? ''));
        if ($productName === '') {
            Response::error('Artigo inválido', 400);
            return;
        }
        if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
            Response::error('Imagem é obrigatória', 400);
            return;
        }

        $file = $_FILES['image'];
        if ($file['size'] > self::MAX_IMAGE_SIZE) {
            Response::error('Imagem demasiado grande (máx. 5MB)', 400);
            return;
        }

        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);
        if (!in_array($mime, self::ALLOWED_IMAGE_MIME, true)) {
            Response::error('Formato não suportado (usa JPG, PNG ou WEBP)', 400);
            return;
        }

        $userDir = Config::uploadsDir() . '/' . $userId . '/products';
        if (!is_dir($userDir) && !mkdir($userDir, 0755, true) && !is_dir($userDir)) {
            Response::error('Falha ao preparar armazenamento', 500);
            return;
        }

        $ext = match ($mime) {
            'image/png' => 'png',
            'image/webp' => 'webp',
            default => 'jpg',
        };
        $storedName = time() . '-' . bin2hex(random_bytes(4)) . '.' . $ext;
        $storedPath = $userDir . '/' . $storedName;
        if (!move_uploaded_file($file['tmp_name'], $storedPath)) {
            Response::error('Falha ao guardar imagem', 500);
            return;
        }

        InvoiceRepository::setProductImage($userId, $productName, $storedName);
        Response::json(['imagePath' => $storedName]);
    }

    public static function removeImage(): void
    {
        $payload = AuthMiddleware::authenticate();
        $userId = (int) $payload['sub'];

        $body = json_decode((string) file_get_contents('php://input'), true);
        $productName = trim((string) ($body['productName'] ?? ''));
        if ($productName === '') {
            Response::error('Artigo inválido', 400);
            return;
        }

        InvoiceRepository::setProductImage($userId, $productName, null);
        Response::json(['removed' => true]);
    }
}
