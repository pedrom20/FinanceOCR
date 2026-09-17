<?php

namespace FinanceOcr\Controllers;

use Dompdf\Dompdf;
use Dompdf\Options;
use FinanceOcr\Auth\AuthMiddleware;
use FinanceOcr\Repositories\InvoiceRepository;
use FinanceOcr\Repositories\UserRepository;
use FinanceOcr\Support\Response;

class ReportController
{
    public static function filters(): void
    {
        $payload = AuthMiddleware::authenticate();
        $userId = (int) $payload['sub'];

        Response::json([
            'stores' => InvoiceRepository::listDistinctStores($userId),
            'locations' => InvoiceRepository::listDistinctLocations($userId),
            'categories' => InvoiceRepository::listCategoriesForUser($userId),
        ]);
    }

    public static function items(): void
    {
        $payload = AuthMiddleware::authenticate();
        $userId = (int) $payload['sub'];

        $filters = [
            'store' => $_GET['store'] ?? '',
            'location' => $_GET['location'] ?? '',
            'category' => $_GET['category'] ?? '',
            'search' => $_GET['search'] ?? '',
            'dateFrom' => $_GET['dateFrom'] ?? '',
            'dateTo' => $_GET['dateTo'] ?? '',
        ];

        $items = InvoiceRepository::searchItems($userId, $filters);
        $total = array_sum(array_column($items, 'totalPrice'));

        Response::json(['items' => $items, 'total' => $total]);
    }

    public static function pdf(): void
    {
        $payload = AuthMiddleware::authenticate();
        $userId = (int) $payload['sub'];

        $user = UserRepository::findById($userId);
        $invoices = InvoiceRepository::listByUser($userId);

        $total = 0.0;
        $rows = '';
        foreach ($invoices as $inv) {
            $total += $inv['totalAmount'];
            $rows .= sprintf(
                '<tr><td>%s</td><td>%s</td><td class="right">%s €</td></tr>',
                htmlspecialchars((string) $inv['invoiceDate']),
                htmlspecialchars($inv['storeName'] ?: 'Desconhecido'),
                number_format($inv['totalAmount'], 2, ',', '.')
            );
        }

        $html = '<html><head><style>
            body { font-family: sans-serif; font-size: 12px; }
            h1 { font-size: 20px; text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { text-align: left; border-bottom: 1px solid #ccc; padding: 6px 4px; }
            td { padding: 6px 4px; }
            .right { text-align: right; }
            .total { font-size: 14px; font-weight: bold; text-align: right; margin-top: 12px; }
        </style></head><body>
            <h1>FinOCR - Relatório de Despesas</h1>
            <p>Utilizador: ' . htmlspecialchars($user['name'] ?? '') . ' (' . htmlspecialchars($user['email'] ?? '') . ')</p>
            <p>Data: ' . date('d/m/Y') . '</p>
            <table>
                <thead><tr><th>Data</th><th>Loja</th><th class="right">Valor</th></tr></thead>
                <tbody>' . $rows . '</tbody>
            </table>
            <p class="total">TOTAL GERAL: ' . number_format($total, 2, ',', '.') . ' €</p>
        </body></html>';

        $options = new Options();
        $options->set('isRemoteEnabled', false);
        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($html);
        $dompdf->setPaper('A4');
        $dompdf->render();

        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename=relatorio-finocr.pdf');
        echo $dompdf->output();
    }
}
