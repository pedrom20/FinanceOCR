<?php

namespace FinanceOcr\Repositories;

use FinanceOcr\Database;

/**
 * Exemplos corrigidos à mão por um admin para a área de "treino do OCR".
 * Não há modelo local a re-treinar aqui — isto é um pool global (não por
 * utilizador) de referências few-shot: quando um NIF já conhecido aparece
 * outra vez, o exemplo corrigido entra no prompt da IA para esse comerciante.
 */
class TrainingExampleRepository
{
    public static function create(string $storeNif, string $storeName, string $correctedJson, ?string $fileName, int $createdBy): int
    {
        $stmt = Database::get()->prepare(
            'INSERT INTO ocr_training_examples (store_nif, store_name, corrected_json, file_name, created_by) VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([$storeNif, $storeName, $correctedJson, $fileName, $createdBy]);
        return (int) Database::get()->lastInsertId();
    }

    public static function listAll(): array
    {
        $stmt = Database::get()->query(
            'SELECT e.id, e.store_nif, e.store_name, e.file_name, e.created_at, u.email AS created_by_email
             FROM ocr_training_examples e
             LEFT JOIN users u ON u.id = e.created_by
             ORDER BY e.created_at DESC'
        );
        return array_map(static fn (array $row) => [
            'id' => (string) $row['id'],
            'storeNif' => $row['store_nif'],
            'storeName' => $row['store_name'],
            'fileName' => $row['file_name'],
            'createdAt' => $row['created_at'],
            'createdByEmail' => $row['created_by_email'],
        ], $stmt->fetchAll());
    }

    /** Exemplo mais recente para este NIF — usado como hint few-shot na próxima extração por IA do mesmo comerciante. */
    public static function findByNif(string $storeNif): ?string
    {
        if ($storeNif === '') {
            return null;
        }
        $stmt = Database::get()->prepare(
            'SELECT corrected_json FROM ocr_training_examples WHERE store_nif = ? ORDER BY created_at DESC LIMIT 1'
        );
        $stmt->execute([$storeNif]);
        $json = $stmt->fetchColumn();
        return $json === false ? null : $json;
    }

    /**
     * Como findByNif(), mas com fallback por nome quando o NIF ainda não é
     * conhecido — que é precisamente o caso mais comum em que o hint faz
     * falta: o parser local (regex, só conhece rótulos portugueses) raramente
     * encontra o NIF num recibo estrangeiro, mas costuma apanhar o nome da
     * loja no cabeçalho (ex: "MERCADONA, S-2\"" antes de limpar a razão
     * social). Usa a primeira palavra do nome detetado como prefixo.
     */
    public static function findByNifOrName(string $storeNif, string $storeName): ?string
    {
        $byNif = self::findByNif($storeNif);
        if ($byNif !== null) {
            return $byNif;
        }
        if ($storeName === '' || $storeName === 'Loja Identificada') {
            return null;
        }

        $firstWord = trim((string) preg_split('/[\s,]+/', $storeName)[0]);
        if ($firstWord === '') {
            return null;
        }
        $stmt = Database::get()->prepare(
            'SELECT corrected_json FROM ocr_training_examples WHERE store_name LIKE CONCAT(?, "%") ORDER BY created_at DESC LIMIT 1'
        );
        $stmt->execute([$firstWord]);
        $json = $stmt->fetchColumn();
        return $json === false ? null : $json;
    }

    public static function delete(int $id): bool
    {
        $stmt = Database::get()->prepare('DELETE FROM ocr_training_examples WHERE id = ?');
        $stmt->execute([$id]);
        return $stmt->rowCount() > 0;
    }
}
