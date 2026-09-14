<?php

require __DIR__ . '/../vendor/autoload.php';

use FinanceOcr\Services\InvoiceParser;

function assertField(string $label, $actual, $expected): bool
{
    $ok = $actual === $expected;
    printf("[%s] %s: got %s, expected %s\n", $ok ? 'OK' : 'FAIL', $label, json_encode($actual), json_encode($expected));
    return $ok;
}

$failures = 0;

echo "--- MEO invoice fixture ---\n";
$meoText = file_get_contents(__DIR__ . '/fixtures/meo-invoice-ocr-text.txt');
$meo = InvoiceParser::parse($meoText);
$failures += !assertField('storeName', $meo['storeName'], 'MEO');
$failures += !assertField('storeNif', $meo['storeNif'], '114980136');
$failures += !assertField('totalAmount', $meo['totalAmount'], 72.55);
$failures += !assertField('invoiceDate', $meo['invoiceDate'], '2026-06-26');

echo "\n--- Supermarket receipt fixture ---\n";
$marketText = file_get_contents(__DIR__ . '/fixtures/supermarket-receipt-ocr-text.txt');
$market = InvoiceParser::parse($marketText);
$failures += !assertField('storeName', $market['storeName'], 'CONTINENTE MODELO');
$failures += !assertField('storeNif', $market['storeNif'], '502011475');
$failures += !assertField('totalAmount', $market['totalAmount'], 11.63);
$failures += !assertField('invoiceDate', $market['invoiceDate'], '2026-07-22');
$failures += !assertField('items count', count($market['items']), 4);
if (count($market['items']) === 4) {
    $failures += !assertField('item[0].productName', $market['items'][0]['productName'], 'PAO DE FORMA BIMBO');
    $failures += !assertField('item[0].unitPrice', $market['items'][0]['unitPrice'], 1.99);
}

echo "\n--- Lidl receipt fixture (real OCR output, VAT-letter suffixes + MULTIBANCO line) ---\n";
$lidlText = file_get_contents(__DIR__ . '/fixtures/lidl-receipt-ocr-text.txt');
$lidl = InvoiceParser::parse($lidlText);
$failures += !assertField('storeName', $lidl['storeName'], 'LIDL & Cia - ODEMIRA');
$failures += !assertField('storeNif', $lidl['storeNif'], '503340855');
$failures += !assertField('totalAmount', $lidl['totalAmount'], 12.19);
$failures += !assertField('invoiceDate', $lidl['invoiceDate'], '2026-09-08');
$failures += !assertField('paymentMethod', $lidl['paymentMethod'], 'Multibanco');
$failures += !assertField('items count', count($lidl['items']), 6);
if (count($lidl['items']) === 6) {
    $failures += !assertField('item[0].productName', $lidl['items'][0]['productName'], 'LIMAO');
    $failures += !assertField('item[0].unitPrice', $lidl['items'][0]['unitPrice'], 1.14);
}

echo "\n" . ($failures === 0 ? "ALL PASSED\n" : "{$failures} FAILURE(S)\n");
exit($failures === 0 ? 0 : 1);
