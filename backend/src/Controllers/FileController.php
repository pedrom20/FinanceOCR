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

        $safeName = basename((string) $params['fileName']);
        $userDir = Config::uploadsDir() . '/' . $userId;
        $filePath = $userDir . '/' . $safeName;

        // Defesa extra: confirma que o caminho resolvido continua dentro da
        // pasta do próprio utilizador (não apenas basename()).
        $realUserDir = realpath($userDir);
        $realFilePath = realpath($filePath);
        if (!$realUserDir || !$realFilePath || !str_starts_with($realFilePath, $realUserDir . DIRECTORY_SEPARATOR)) {
            Response::error('Ficheiro não encontrado', 404);
            return;
        }

        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mime = finfo_file($finfo, $realFilePath) ?: 'application/octet-stream';
        finfo_close($finfo);

        header('Content-Type: ' . $mime);
        header('Content-Disposition: attachment; filename="' . $safeName . '"');
        header('Content-Length: ' . filesize($realFilePath));
        readfile($realFilePath);
    }
}
