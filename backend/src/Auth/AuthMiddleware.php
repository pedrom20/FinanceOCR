<?php

namespace FinanceOcr\Auth;

use FinanceOcr\Support\Response;

class AuthMiddleware
{
    /** @return array{sub:string,email:string,name:string} Exits with 401 if not authenticated. */
    public static function authenticate(): array
    {
        $header = self::authorizationHeader();
        if (!str_starts_with($header, 'Bearer ')) {
            Response::error('Token de autenticação em falta', 401);
            exit;
        }

        $payload = Jwt::verify(substr($header, 7));
        if (!$payload) {
            Response::error('Token de autenticação inválido', 401);
            exit;
        }

        return $payload;
    }

    // Apache doesn't always populate $_SERVER['HTTP_AUTHORIZATION'] by default
    // (needs an explicit rewrite rule), so fall back to apache_request_headers().
    private static function authorizationHeader(): string
    {
        if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
            return $_SERVER['HTTP_AUTHORIZATION'];
        }
        if (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            return $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        }
        if (function_exists('apache_request_headers')) {
            foreach (apache_request_headers() as $name => $value) {
                if (strcasecmp($name, 'Authorization') === 0) {
                    return $value;
                }
            }
        }
        return '';
    }
}
