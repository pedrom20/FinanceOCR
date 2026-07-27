<?php

namespace FinanceOcr\Auth;

use FinanceOcr\Config;
use Firebase\JWT\JWT;
use Firebase\JWT\JWK;

/**
 * Verifies a Google Identity Services ID token by checking its signature
 * against Google's public JWKS — no Firebase/Google SDK involved, just the
 * standard OIDC verification any "Sign in with Google" integration needs.
 */
class GoogleTokenVerifier
{
    private const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
    private const CACHE_TTL_SECONDS = 3600;

    /** @return array{sub:string,email:string,email_verified:bool,name:string}|null */
    public static function verify(string $idToken): ?array
    {
        $jwks = self::getJwks();
        if (!$jwks) {
            return null;
        }

        try {
            $keys = JWK::parseKeySet($jwks);
            $decoded = (array) JWT::decode($idToken, $keys);
        } catch (\Throwable $e) {
            return null;
        }

        $expectedAud = Config::get('GOOGLE_CLIENT_ID');
        if (!$expectedAud || ($decoded['aud'] ?? null) !== $expectedAud) {
            return null;
        }
        $iss = $decoded['iss'] ?? '';
        if (!in_array($iss, ['accounts.google.com', 'https://accounts.google.com'], true)) {
            return null;
        }
        if (($decoded['exp'] ?? 0) < time()) {
            return null;
        }

        return [
            'sub' => (string) ($decoded['sub'] ?? ''),
            'email' => (string) ($decoded['email'] ?? ''),
            'email_verified' => (bool) ($decoded['email_verified'] ?? false),
            'name' => (string) ($decoded['name'] ?? ($decoded['email'] ?? '')),
        ];
    }

    private static function getJwks(): ?array
    {
        $cacheFile = sys_get_temp_dir() . '/financeocr_google_jwks.json';

        if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < self::CACHE_TTL_SECONDS) {
            $cached = json_decode((string) file_get_contents($cacheFile), true);
            if (is_array($cached)) {
                return $cached;
            }
        }

        $ch = curl_init(self::JWKS_URL);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 5,
        ]);
        $body = curl_exec($ch);
        $ok = $body !== false && curl_getinfo($ch, CURLINFO_HTTP_CODE) === 200;
        curl_close($ch);

        if (!$ok) {
            return null;
        }

        $data = json_decode($body, true);
        if (is_array($data)) {
            @file_put_contents($cacheFile, $body);
        }
        return $data;
    }
}
