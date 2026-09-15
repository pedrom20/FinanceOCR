<?php

namespace FinanceOcr\Controllers;

use FinanceOcr\Auth\AuthMiddleware;
use FinanceOcr\Auth\GoogleTokenVerifier;
use FinanceOcr\Auth\Jwt;
use FinanceOcr\Repositories\UserRepository;
use FinanceOcr\Support\Response;

class AuthController
{
    public static function register(): void
    {
        $body = self::body();
        $email = strtolower(trim((string) ($body['email'] ?? '')));
        $password = (string) ($body['password'] ?? '');
        $name = trim((string) ($body['name'] ?? ''));

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::error('Email inválido', 400);
            return;
        }
        if (strlen($password) < 6) {
            Response::error('A password deve ter pelo menos 6 caracteres', 400);
            return;
        }
        if (UserRepository::findByEmail($email)) {
            Response::error('Este email já está registado', 409);
            return;
        }

        $user = UserRepository::create($email, $name !== '' ? $name : $email, password_hash($password, PASSWORD_DEFAULT), null);
        self::respondWithToken($user, 201);
    }

    public static function login(): void
    {
        $body = self::body();
        $email = strtolower(trim((string) ($body['email'] ?? '')));
        $password = (string) ($body['password'] ?? '');

        $user = UserRepository::findByEmail($email);
        if (!$user) {
            Response::error('Credenciais inválidas', 401);
            return;
        }
        if ($user['password_hash'] === null) {
            Response::error('Esta conta usa login com Google', 400);
            return;
        }
        if (!password_verify($password, $user['password_hash'])) {
            Response::error('Credenciais inválidas', 401);
            return;
        }

        self::respondWithToken($user);
    }

    public static function google(): void
    {
        $body = self::body();
        $credential = (string) ($body['credential'] ?? '');
        $googleUser = GoogleTokenVerifier::verify($credential);
        if (!$googleUser || !$googleUser['sub'] || !$googleUser['email']) {
            Response::error('Token Google inválido', 401);
            return;
        }

        $user = UserRepository::findByGoogleId($googleUser['sub']);
        if (!$user) {
            $existing = UserRepository::findByEmail($googleUser['email']);
            if ($existing && $googleUser['email_verified']) {
                UserRepository::linkGoogleId((int) $existing['id'], $googleUser['sub']);
                $user = UserRepository::findById((int) $existing['id']);
            } else {
                $user = UserRepository::create($googleUser['email'], $googleUser['name'], null, $googleUser['sub']);
            }
        }

        self::respondWithToken($user);
    }

    public static function me(): void
    {
        $payload = AuthMiddleware::authenticate();
        $user = UserRepository::findById((int) $payload['sub']);
        if (!$user) {
            Response::error('Utilizador não encontrado', 404);
            return;
        }
        Response::json(['id' => (string) $user['id'], 'email' => $user['email'], 'name' => $user['name'], 'role' => $user['role']]);
    }

    private static function respondWithToken(array $user, int $status = 200): void
    {
        $token = Jwt::issue((int) $user['id'], $user['email'], $user['name']);
        Response::json([
            'token' => $token,
            'user' => ['id' => (string) $user['id'], 'email' => $user['email'], 'name' => $user['name'], 'role' => $user['role']],
        ], $status);
    }

    private static function body(): array
    {
        $data = json_decode((string) file_get_contents('php://input'), true);
        return is_array($data) ? $data : [];
    }
}
