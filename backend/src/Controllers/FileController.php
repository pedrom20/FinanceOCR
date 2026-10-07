<?php

namespace FinanceOcr\Controllers;

use FinanceOcr\Auth\AuthMiddleware;
use FinanceOcr\Config;
use FinanceOcr\Support\Response;

class FileController
{
    public static function download(array $params): void
    {
        $payload = AuthMiddleware::authenticate();
        $userId = (string) $payload['sub'];

        $realFilePath = self::resolveSafePath($userId, '', (string) $params['fileName']);
        if ($realFilePath === null) {
            Response::error('Ficheiro não encontrado', 404);
            return;
        }

        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($finfo, $realFilePath) ?: 'application/octet-stream';
        finfo_close($finfo);

        header('Content-Type: ' . $mime);
        header('Content-Disposition: attachment; filename="' . basename($realFilePath) . '"');
        header('Content-Length: ' . filesize($realFilePath));
        readfile($realFilePath);
    }

    /** Imagem de referência de um artigo (Items > "Nomes alternativos" / foto). Sem Content-Disposition: attachment — é para mostrar inline, não descarregar. */
    public static function productImage(array $params): void
    {
        $payload = AuthMiddleware::authenticate();
        $userId = (string) $payload['sub'];

        $realFilePath = self::resolveSafePath($userId, 'products', (string) $params['fileName']);
        if ($realFilePath === null) {
            Response::error('Imagem não encontrada', 404);
            return;
        }

        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($finfo, $realFilePath) ?: 'application/octet-stream';
        finfo_close($finfo);

        header('Content-Type: ' . $mime);
        header('Content-Length: ' . filesize($realFilePath));
        readfile($realFilePath);
    }

    /** basename() sozinho não chega — confirma que o caminho resolvido continua dentro da pasta do próprio utilizador antes de servir qualquer ficheiro. */
    private static function resolveSafePath(string $userId, string $subDir, string $fileName): ?string
    {
        $safeName = basename($fileName);
        $userDir = Config::uploadsDir() . '/' . $userId . ($subDir !== '' ? '/' . $subDir : '');
        $filePath = $userDir . '/' . $safeName;

        $realUserDir = realpath($userDir);
        $realFilePath = realpath($filePath);
        if (!$realUserDir || !$realFilePath || !str_starts_with($realFilePath, $realUserDir . DIRECTORY_SEPARATOR)) {
            return null;
        }
        return $realFilePath;
    }
}
