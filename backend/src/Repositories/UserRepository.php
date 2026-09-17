<?php

namespace FinanceOcr\Repositories;

use FinanceOcr\Database;

class UserRepository
{
    public static function findById(int $id): ?array
    {
        $stmt = Database::get()->prepare('SELECT * FROM users WHERE id = ?');
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function findByEmail(string $email): ?array
    {
        $stmt = Database::get()->prepare('SELECT * FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function findByGoogleId(string $googleId): ?array
    {
        $stmt = Database::get()->prepare('SELECT * FROM users WHERE google_id = ?');
        $stmt->execute([$googleId]);
        $row = $stmt->fetch();
        return $row ?: null;
    }

    public static function create(string $email, string $name, ?string $passwordHash, ?string $googleId): array
    {
        // O primeiro utilizador a registar-se num deploy novo torna-se admin
        // automaticamente — não há nenhum outro mecanismo de bootstrap (sem
        // isto, um deploy de raiz nunca teria um admin sem intervenção manual
        // na base de dados).
        $stmt = Database::get()->prepare('SELECT COUNT(*) FROM users');
        $stmt->execute();
        $role = ((int) $stmt->fetchColumn()) === 0 ? 'admin' : 'user';

        $stmt = Database::get()->prepare(
            'INSERT INTO users (email, name, password_hash, google_id, role) VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([$email, $name, $passwordHash, $googleId, $role]);
        return self::findById((int) Database::get()->lastInsertId());
    }

    public static function linkGoogleId(int $userId, string $googleId): void
    {
        $stmt = Database::get()->prepare('UPDATE users SET google_id = ? WHERE id = ?');
        $stmt->execute([$googleId, $userId]);
    }

    /** Para a área de gestão de utilizadores (admin). Inclui contagem de faturas por utilizador. */
    public static function listAll(): array
    {
        $stmt = Database::get()->query(
            "SELECT u.id, u.email, u.name, u.role, u.created_at,
                    (SELECT COUNT(*) FROM invoices i WHERE i.user_id = u.id) AS invoice_count
             FROM users u
             ORDER BY u.created_at"
        );
        return array_map(static fn (array $row) => [
            'id' => (string) $row['id'],
            'email' => $row['email'],
            'name' => $row['name'],
            'role' => $row['role'],
            'createdAt' => $row['created_at'],
            'invoiceCount' => (int) $row['invoice_count'],
        ], $stmt->fetchAll());
    }

    public static function countAdmins(): int
    {
        $stmt = Database::get()->query("SELECT COUNT(*) FROM users WHERE role = 'admin'");
        return (int) $stmt->fetchColumn();
    }

    public static function updateRole(int $userId, string $role): bool
    {
        $stmt = Database::get()->prepare('UPDATE users SET role = ? WHERE id = ?');
        $stmt->execute([$role, $userId]);
        return $stmt->rowCount() > 0;
    }

    /** As faturas/artigos/definições do utilizador vão com ele (ON DELETE CASCADE / são globais). */
    public static function delete(int $userId): bool
    {
        $stmt = Database::get()->prepare('DELETE FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        return $stmt->rowCount() > 0;
    }
}
