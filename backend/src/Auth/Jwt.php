<?php

namespace FinanceOcr\Auth;

use FinanceOcr\Config;
use Firebase\JWT\JWT as FirebaseJwt;
use Firebase\JWT\Key;

/**
 * Signs and verifies our own app-level tokens. Uses firebase/php-jwt, a
 * generic JWT library (the name predates/has nothing to do with the Firebase
 * cloud service) — no external dependency at issue/verify time.
 */
class Jwt
{
    public static function issue(int $userId, string $email, string $name): string
    {
        $ttlDays = (int) (Config::get('JWT_TTL_DAYS', '30'));
        $now = time();
        $payload = [
            'sub' => (string) $userId,
            'email' => $email,
            'name' => $name,
            'iat' => $now,
            'exp' => $now + $ttlDays * 86400,
        ];
        return FirebaseJwt::encode($payload, self::secret(), 'HS256');
    }

    /** @return array{sub:string,email:string,name:string,iat:int,exp:int}|null */
    public static function verify(string $token): ?array
    {
        try {
            $decoded = FirebaseJwt::decode($token, new Key(self::secret(), 'HS256'));
            return (array) $decoded;
        } catch (\Throwable $e) {
            return null;
        }
    }

    private static function secret(): string
    {
        $secret = Config::get('JWT_SECRET');
        if (!$secret) {
            throw new \RuntimeException('JWT_SECRET não configurado');
        }
        return $secret;
    }
}
