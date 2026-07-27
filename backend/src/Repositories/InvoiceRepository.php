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
                'INSERT INTO invoices (user_id, store_name, store_nif, invoice_number, invoice_date, total_amount, payment_method, file_name)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $stmt->execute([
                $userId,
                $invoiceData['storeName'],
                $invoiceData['storeNif'] ?? '',
                $invoiceData['invoiceNumber'] ?? '',
                $invoiceData['invoiceDate'] ?: null,
                $invoiceData['totalAmount'],
                $invoiceData['paymentMethod'] ?? 'Dinheiro',
                $invoiceData['fileName'] ?? null,
            ]);
            $invoiceId = (int) $db->lastInsertId();

            if (!empty($items)) {
                $itemStmt = $db->prepare(
                    'INSERT INTO invoice_items (invoice_id, product_name, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)'
                );
                foreach ($items as $item) {
                    $itemStmt->execute([
                        $invoiceId,
                        $item['productName'],
                        $item['quantity'] ?? 1,
                        $item['unitPrice'] ?? 0,
                        $item['totalPrice'] ?? 0,
                    ]);
                }
            }

            $db->commit();
            return $invoiceId;
        } catch (\Throwable $e) {
            $db->rollBack();
            throw $e;
        }
    }

    public static function listByUser(int $userId): array
    {
        $stmt = Database::get()->prepare(
            'SELECT id, store_name, store_nif, invoice_number, invoice_date, total_amount, payment_method, file_name, created_at
             FROM invoices WHERE user_id = ? ORDER BY created_at DESC'
        );
        $stmt->execute([$userId]);
        return array_map([self::class, 'mapRow'], $stmt->fetchAll());
    }

    private static function mapRow(array $row): array
    {
        return [
            'id' => (string) $row['id'],
            'storeName' => $row['store_name'],
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
