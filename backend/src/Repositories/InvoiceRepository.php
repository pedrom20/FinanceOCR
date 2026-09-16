<?php

namespace FinanceOcr\Repositories;

use FinanceOcr\Database;

class InvoiceRepository
{
    public static function create(int $userId, array $invoiceData, array $items): int
    {
        $db = Database::get();
        $db->beginTransaction();
        try {
            $stmt = $db->prepare(
                'INSERT INTO invoices (user_id, store_name, store_location, store_nif, invoice_number, invoice_date, total_amount, payment_method, file_name)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $stmt->execute([
                $userId,
                $invoiceData['storeName'],
                $invoiceData['storeLocation'] ?? '',
                $invoiceData['storeNif'] ?? '',
                $invoiceData['invoiceNumber'] ?? '',
                $invoiceData['invoiceDate'] ?? null ?: null,
                $invoiceData['totalAmount'],
                $invoiceData['paymentMethod'] ?? 'Dinheiro',
                $invoiceData['fileName'] ?? null,
            ]);
            $invoiceId = (int) $db->lastInsertId();
            self::insertItems($db, $invoiceId, $items);

            $db->commit();
            return $invoiceId;
        } catch (\Throwable $e) {
            $db->rollBack();
            throw $e;
        }
    }

    /**
     * Substitui a fatura (dados + artigos) pelo resultado de um novo OCR
     * sobre o mesmo ficheiro original — mantém o id, created_at e fileName,
     * troca tudo o resto. false se a fatura não pertencer a este utilizador.
     */
    public static function reprocessInvoice(int $userId, int $invoiceId, array $extracted): bool
    {
        $db = Database::get();
        $stmt = $db->prepare('SELECT id FROM invoices WHERE id = ? AND user_id = ?');
        $stmt->execute([$invoiceId, $userId]);
        if ($stmt->fetch() === false) {
            return false;
        }

        $db->beginTransaction();
        try {
            $stmt = $db->prepare(
                'UPDATE invoices SET store_name = ?, store_location = ?, store_nif = ?, invoice_date = ?, total_amount = ?, payment_method = ?
                 WHERE id = ? AND user_id = ?'
            );
            $stmt->execute([
                $extracted['storeName'],
                $extracted['storeLocation'] ?? '',
                $extracted['storeNif'] ?? '',
                $extracted['invoiceDate'] ?: null,
                $extracted['totalAmount'],
                $extracted['paymentMethod'] ?? 'Dinheiro',
                $invoiceId,
                $userId,
            ]);

            $db->prepare('DELETE FROM invoice_items WHERE invoice_id = ?')->execute([$invoiceId]);
            self::insertItems($db, $invoiceId, $extracted['items'] ?? []);

            $db->commit();
            return true;
        } catch (\Throwable $e) {
            $db->rollBack();
            throw $e;
        }
    }

    private static function insertItems(\PDO $db, int $invoiceId, array $items): void
    {
        if (empty($items)) {
            return;
        }
        $itemStmt = $db->prepare(
            'INSERT INTO invoice_items (invoice_id, product_name, quantity, quantity_unit, unit_price, total_price, vat_rate, category)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        foreach ($items as $item) {
            $itemStmt->execute([
                $invoiceId,
                $item['productName'],
                $item['quantity'] ?? 1,
                $item['quantityUnit'] ?? 'un',
                $item['unitPrice'] ?? 0,
                $item['totalPrice'] ?? 0,
                $item['vatRate'] ?? null,
                $item['category'] ?? '',
            ]);
        }
    }

    public static function listByUser(int $userId): array
    {
        $stmt = Database::get()->prepare(
            'SELECT id, store_name, store_location, store_nif, invoice_number, invoice_date, total_amount, payment_method, file_name, created_at
             FROM invoices WHERE user_id = ? ORDER BY created_at DESC'
        );
        $stmt->execute([$userId]);
        return array_map([self::class, 'mapRow'], $stmt->fetchAll());
    }

    /**
     * Nome de loja mais recentemente confirmado pelo próprio utilizador para
     * este NIF — usado para normalizar o nome entre filiais do mesmo
     * comerciante (ex: "Lidl" em vez de "LIDL & Cia - ODEMIRA" numa filial e
     * "LIDL & Cia - SINTRA" noutra).
     */
    public static function findStoreNameByNif(int $userId, string $storeNif): ?string
    {
        $stmt = Database::get()->prepare(
            'SELECT store_name FROM invoices WHERE user_id = ? AND store_nif = ? ORDER BY created_at DESC LIMIT 1'
        );
        $stmt->execute([$userId, $storeNif]);
        $name = $stmt->fetchColumn();
        return $name === false ? null : $name;
    }

    /**
     * Fatura completa com os artigos, ou null se não existir ou não pertencer
     * a este utilizador (evita expor faturas de outros por adivinhação de id).
     */
    public static function findByIdForUser(int $userId, int $invoiceId): ?array
    {
        $stmt = Database::get()->prepare(
            'SELECT id, store_name, store_location, store_nif, invoice_number, invoice_date, total_amount, payment_method, file_name, created_at
             FROM invoices WHERE id = ? AND user_id = ?'
        );
        $stmt->execute([$invoiceId, $userId]);
        $row = $stmt->fetch();
        if ($row === false) {
            return null;
        }

        $invoice = self::mapRow($row);
        $invoice['items'] = self::itemsForInvoice($invoiceId);
        return $invoice;
    }

    /** Categorias já usadas por este utilizador, para o fallback de IA reaproveitar em vez de inventar novas. */
    public static function listCategoriesForUser(int $userId): array
    {
        $stmt = Database::get()->prepare(
            "SELECT DISTINCT ii.category FROM invoice_items ii
             JOIN invoices i ON i.id = ii.invoice_id
             WHERE i.user_id = ? AND ii.category != ''
             ORDER BY ii.category"
        );
        $stmt->execute([$userId]);
        return $stmt->fetchAll(\PDO::FETCH_COLUMN);
    }

    /**
     * Renomeia a loja. Se $applyToAllWithNif e a fatura tiver NIF, aplica a
     * TODAS as faturas deste utilizador com esse NIF (ex: corrigir "LIDL &
     * Cia - ODEMIRA" para "Lidl" em todas as filiais já guardadas), não só
     * nesta fatura — devolve o número de faturas atualizadas, ou null se a
     * fatura não existir/não pertencer a este utilizador.
     */
    public static function renameStore(int $userId, int $invoiceId, string $newName, bool $applyToAllWithNif): ?int
    {
        $db = Database::get();
        $stmt = $db->prepare('SELECT store_nif FROM invoices WHERE id = ? AND user_id = ?');
        $stmt->execute([$invoiceId, $userId]);
        $row = $stmt->fetch();
        if ($row === false) {
            return null;
        }

        if ($applyToAllWithNif && $row['store_nif'] !== '') {
            $stmt = $db->prepare('UPDATE invoices SET store_name = ? WHERE user_id = ? AND store_nif = ?');
            $stmt->execute([$newName, $userId, $row['store_nif']]);
        } else {
            $stmt = $db->prepare('UPDATE invoices SET store_name = ? WHERE id = ? AND user_id = ?');
            $stmt->execute([$newName, $invoiceId, $userId]);
        }
        return $stmt->rowCount();
    }

    /**
     * Atualiza a categoria de um artigo (definida à mão pelo utilizador, em
     * vez de/por cima da sugestão da IA). true se o artigo existia e
     * pertencia a uma fatura deste utilizador.
     */
    public static function updateItemCategory(int $userId, int $invoiceId, int $itemId, string $category): bool
    {
        $stmt = Database::get()->prepare(
            'UPDATE invoice_items ii
             JOIN invoices i ON i.id = ii.invoice_id
             SET ii.category = ?
             WHERE ii.id = ? AND ii.invoice_id = ? AND i.user_id = ?'
        );
        $stmt->execute([$category, $itemId, $invoiceId, $userId]);
        return $stmt->rowCount() > 0;
    }

    /** true se a fatura existia e pertencia a este utilizador (e foi apagada). Os artigos vão com ela (ON DELETE CASCADE). */
    public static function deleteForUser(int $userId, int $invoiceId): bool
    {
        $stmt = Database::get()->prepare('DELETE FROM invoices WHERE id = ? AND user_id = ?');
        $stmt->execute([$invoiceId, $userId]);
        return $stmt->rowCount() > 0;
    }

    /** Artigos deste utilizador ainda sem categoria, para o "categorizar em falta" em lote. */
    public static function findItemsWithoutCategory(int $userId): array
    {
        $stmt = Database::get()->prepare(
            "SELECT ii.id, ii.invoice_id, ii.product_name FROM invoice_items ii
             JOIN invoices i ON i.id = ii.invoice_id
             WHERE i.user_id = ? AND ii.category = ''
             ORDER BY ii.id"
        );
        $stmt->execute([$userId]);
        return $stmt->fetchAll();
    }

    /**
     * Lojas distintas deste utilizador para a área de gestão de lojas —
     * agrupadas por NIF quando existe (várias filiais/recibos com o mesmo
     * NIF juntam-se numa linha), ou por nome exato quando não há NIF. Um
     * comerciante como o Lidl tem 200+ lojas físicas a partilhar o mesmo
     * NIF — agrupar só por NIF perderia de vista em que loja concreta foi
     * cada compra, por isso cada grupo vem com a divisão por storeLocation.
     */
    public static function listStoresForUser(int $userId): array
    {
        $db = Database::get();

        $stmt = $db->prepare(
            "SELECT
                CASE WHEN store_nif != '' THEN store_nif ELSE CONCAT('__name__', store_name) END AS group_key,
                MAX(store_nif) AS store_nif,
                MAX(store_name) AS store_name,
                COUNT(*) AS invoice_count,
                SUM(total_amount) AS total_spent,
                MAX(created_at) AS last_purchase
             FROM invoices
             WHERE user_id = ?
             GROUP BY group_key
             ORDER BY total_spent DESC"
        );
        $stmt->execute([$userId]);
        $groups = $stmt->fetchAll();

        $stmt = $db->prepare(
            "SELECT
                CASE WHEN store_nif != '' THEN store_nif ELSE CONCAT('__name__', store_name) END AS group_key,
                store_location,
                COUNT(*) AS invoice_count,
                SUM(total_amount) AS total_spent,
                MAX(created_at) AS last_purchase
             FROM invoices
             WHERE user_id = ?
             GROUP BY group_key, store_location
             ORDER BY total_spent DESC"
        );
        $stmt->execute([$userId]);
        $locationsByGroup = [];
        foreach ($stmt->fetchAll() as $row) {
            $locationsByGroup[$row['group_key']][] = [
                'location' => $row['store_location'],
                'invoiceCount' => (int) $row['invoice_count'],
                'totalSpent' => (float) $row['total_spent'],
                'lastPurchase' => $row['last_purchase'],
            ];
        }

        return array_map(static function (array $row) use ($locationsByGroup) {
            // Só vale a pena mostrar a divisão por loja se houver mais que uma.
            $locations = $locationsByGroup[$row['group_key']] ?? [];
            return [
                'storeNif' => $row['store_nif'],
                'storeName' => $row['store_name'],
                'invoiceCount' => (int) $row['invoice_count'],
                'totalSpent' => (float) $row['total_spent'],
                'lastPurchase' => $row['last_purchase'],
                'locations' => count($locations) > 1 ? $locations : [],
            ];
        }, $groups);
    }

    /**
     * Renomeia todas as faturas do grupo (por NIF, ou por nome exato quando
     * não há NIF) — usado pela área de gestão de lojas, que edita o
     * comerciante diretamente em vez de precisar de abrir uma fatura.
     */
    public static function renameStoreGroup(int $userId, string $storeNif, string $oldStoreName, string $newName): int
    {
        $db = Database::get();
        if ($storeNif !== '') {
            $stmt = $db->prepare('UPDATE invoices SET store_name = ? WHERE user_id = ? AND store_nif = ?');
            $stmt->execute([$newName, $userId, $storeNif]);
        } else {
            $stmt = $db->prepare("UPDATE invoices SET store_name = ? WHERE user_id = ? AND store_nif = '' AND store_name = ?");
            $stmt->execute([$newName, $userId, $oldStoreName]);
        }
        return $stmt->rowCount();
    }

    /** Nomes de loja distintos deste utilizador, para o dropdown de filtro do relatório. */
    public static function listDistinctStores(int $userId): array
    {
        $stmt = Database::get()->prepare(
            'SELECT DISTINCT store_name FROM invoices WHERE user_id = ? ORDER BY store_name'
        );
        $stmt->execute([$userId]);
        return $stmt->fetchAll(\PDO::FETCH_COLUMN);
    }

    /**
     * Artigos deste utilizador que cumprem os filtros do relatório, com a
     * informação da fatura a que pertencem. Todos os filtros são opcionais.
     *
     * @param array{store?:string,category?:string,search?:string,dateFrom?:string,dateTo?:string} $filters
     */
    public static function searchItems(int $userId, array $filters): array
    {
        $sql = 'SELECT ii.product_name, ii.quantity, ii.quantity_unit, ii.unit_price, ii.total_price, ii.vat_rate, ii.category,
                       i.id AS invoice_id, i.invoice_date, i.store_name, i.store_location
                FROM invoice_items ii
                JOIN invoices i ON i.id = ii.invoice_id
                WHERE i.user_id = ?';
        $params = [$userId];

        if (!empty($filters['store'])) {
            $sql .= ' AND i.store_name = ?';
            $params[] = $filters['store'];
        }
        if (!empty($filters['category'])) {
            $sql .= ' AND ii.category = ?';
            $params[] = $filters['category'];
        }
        if (!empty($filters['search'])) {
            $sql .= ' AND ii.product_name LIKE ?';
            $params[] = '%' . $filters['search'] . '%';
        }
        if (!empty($filters['dateFrom'])) {
            $sql .= ' AND i.invoice_date >= ?';
            $params[] = $filters['dateFrom'];
        }
        if (!empty($filters['dateTo'])) {
            $sql .= ' AND i.invoice_date <= ?';
            $params[] = $filters['dateTo'];
        }
        $sql .= ' ORDER BY i.invoice_date DESC, i.id DESC';

        $stmt = Database::get()->prepare($sql);
        $stmt->execute($params);

        return array_map(static fn (array $row) => [
            'invoiceId' => (string) $row['invoice_id'],
            'invoiceDate' => $row['invoice_date'],
            'storeName' => $row['store_name'],
            'storeLocation' => $row['store_location'],
            'productName' => $row['product_name'],
            'quantity' => (float) $row['quantity'],
            'quantityUnit' => $row['quantity_unit'],
            'unitPrice' => (float) $row['unit_price'],
            'totalPrice' => (float) $row['total_price'],
            'vatRate' => $row['vat_rate'] !== null ? (float) $row['vat_rate'] : null,
            'category' => $row['category'],
        ], $stmt->fetchAll());
    }

    /**
     * Renomeia TODOS os artigos deste utilizador com este nome exato — usado
     * pela área de Artigos, que edita o "tipo de produto" diretamente em vez
     * de precisar de abrir cada fatura.
     */
    public static function renameProductGroup(int $userId, string $oldName, string $newName): int
    {
        $stmt = Database::get()->prepare(
            'UPDATE invoice_items ii
             JOIN invoices i ON i.id = ii.invoice_id
             SET ii.product_name = ?
             WHERE i.user_id = ? AND ii.product_name = ?'
        );
        $stmt->execute([$newName, $userId, $oldName]);
        return $stmt->rowCount();
    }

    /** Recategoriza TODOS os artigos deste utilizador com este nome exato. */
    public static function recategorizeProductGroup(int $userId, string $productName, string $category): int
    {
        $stmt = Database::get()->prepare(
            'UPDATE invoice_items ii
             JOIN invoices i ON i.id = ii.invoice_id
             SET ii.category = ?
             WHERE i.user_id = ? AND ii.product_name = ?'
        );
        $stmt->execute([$category, $userId, $productName]);
        return $stmt->rowCount();
    }

    /**
     * Guarda que "raw_name" (o texto que a OCR costuma extrair) deve passar a
     * aparecer como "canonical_name" — para faturas futuras não criarem um
     * "artigo novo" sempre que a OCR ler o mesmo texto bruto outra vez.
     */
    public static function saveProductNameMapping(int $userId, string $rawName, string $canonicalName): void
    {
        $stmt = Database::get()->prepare(
            'INSERT INTO product_name_mappings (user_id, raw_name, canonical_name) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE canonical_name = VALUES(canonical_name)'
        );
        $stmt->execute([$userId, $rawName, $canonicalName]);
    }

    /** @return array<string,string> raw_name => canonical_name, para aplicar logo a seguir à OCR. */
    public static function findProductNameMappings(int $userId): array
    {
        $stmt = Database::get()->prepare('SELECT raw_name, canonical_name FROM product_name_mappings WHERE user_id = ?');
        $stmt->execute([$userId]);
        return $stmt->fetchAll(\PDO::FETCH_KEY_PAIR);
    }

    private static function itemsForInvoice(int $invoiceId): array
    {
        $stmt = Database::get()->prepare(
            'SELECT id, product_name, quantity, quantity_unit, unit_price, total_price, vat_rate, category
             FROM invoice_items WHERE invoice_id = ? ORDER BY id'
        );
        $stmt->execute([$invoiceId]);
        return array_map(static fn (array $row) => [
            'id' => (string) $row['id'],
            'productName' => $row['product_name'],
            'quantity' => (float) $row['quantity'],
            'quantityUnit' => $row['quantity_unit'],
            'unitPrice' => (float) $row['unit_price'],
            'totalPrice' => (float) $row['total_price'],
            'vatRate' => $row['vat_rate'] !== null ? (float) $row['vat_rate'] : null,
            'category' => $row['category'],
        ], $stmt->fetchAll());
    }

    private static function mapRow(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'storeName' => $row['store_name'],
            'storeLocation' => $row['store_location'],
            'storeNif' => $row['store_nif'],
            'invoiceNumber' => $row['invoice_number'],
            'invoiceDate' => $row['invoice_date'],
            'totalAmount' => (float) $row['total_amount'],
            'paymentMethod' => $row['payment_method'],
            'fileName' => $row['file_name'],
            'createdAt' => $row['created_at'],
        ];
    }
}
