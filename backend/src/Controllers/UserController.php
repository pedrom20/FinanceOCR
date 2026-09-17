<?php

namespace FinanceOcr\Controllers;

use FinanceOcr\Auth\AuthMiddleware;
use FinanceOcr\Repositories\UserRepository;
use FinanceOcr\Support\Response;

class UserController
{
    private const VALID_ROLES = ['user', 'admin'];

    public static function list(): void
    {
        AuthMiddleware::requireAdmin();
        Response::json(UserRepository::listAll());
    }

    public static function updateRole(array $params): void
    {
        $payload = AuthMiddleware::requireAdmin();
        $currentUserId = (int) $payload['sub'];
        $targetUserId = (int) $params['id'];

        $body = json_decode((string) file_get_contents('php://input'), true);
        $role = (string) ($body['role'] ?? '');
        if (!in_array($role, self::VALID_ROLES, true)) {
            Response::error('Role inválida', 400);
            return;
        }

        $target = UserRepository::findById($targetUserId);
        if ($target === null) {
            Response::error('Utilizador não encontrado', 404);
            return;
        }

        // Impede ficar sem nenhum admin (self-lockout): não deixa despromover
        // o próprio admin, nem o último admin que resta.
        if ($target['role'] === 'admin' && $role !== 'admin') {
            if ($targetUserId === $currentUserId) {
                Response::error('Não podes remover o teu próprio acesso de administrador', 400);
                return;
            }
            if (UserRepository::countAdmins() <= 1) {
                Response::error('Tem de existir sempre pelo menos um administrador', 400);
                return;
            }
        }

        UserRepository::updateRole($targetUserId, $role);
        Response::json(['id' => (string) $targetUserId, 'role' => $role]);
    }

    public static function destroy(array $params): void
    {
        $payload = AuthMiddleware::requireAdmin();
        $currentUserId = (int) $payload['sub'];
        $targetUserId = (int) $params['id'];

        if ($targetUserId === $currentUserId) {
            Response::error('Não podes apagar a tua própria conta', 400);
            return;
        }

        $target = UserRepository::findById($targetUserId);
        if ($target === null) {
            Response::error('Utilizador não encontrado', 404);
            return;
        }
        if ($target['role'] === 'admin' && UserRepository::countAdmins() <= 1) {
            Response::error('Tem de existir sempre pelo menos um administrador', 400);
            return;
        }

        UserRepository::delete($targetUserId);
        Response::json(['deleted' => true]);
    }
}
