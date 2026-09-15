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
$failures += !assertField('storeLocation', $meo['storeLocation'], '');
$failures += !assertField('storeNif', $meo['storeNif'], '114980136');
$failures += !assertField('totalAmount', $meo['totalAmount'], 72.55);
$failures += !assertField('invoiceDate', $meo['invoiceDate'], '2026-06-26');

echo "\n--- Supermarket receipt fixture ---\n";
$marketText = file_get_contents(__DIR__ . '/fixtures/supermarket-receipt-ocr-text.txt');
$market = InvoiceParser::parse($marketText);
$failures += !assertField('storeName', $market['storeName'], 'CONTINENTE MODELO');
$failures += !assertField('storeLocation', $market['storeLocation'], '');
$failures += !assertField('storeNif', $market['storeNif'], '502011475');
$failures += !assertField('totalAmount', $market['totalAmount'], 11.63);
$failures += !assertField('invoiceDate', $market['invoiceDate'], '2026-07-22');
$failures += !assertField('items count', count($market['items']), 4);
if (count($market['items']) === 4) {
    $failures += !assertField('item[0].productName', $market['items'][0]['productName'], 'Pao de Forma Bimbo');
    $failures += !assertField('item[0].unitPrice', $market['items'][0]['unitPrice'], 1.99);
}

echo "\n--- Lidl receipt fixture (real OCR output, VAT-letter suffixes + MULTIBANCO line) ---\n";
$lidlText = file_get_contents(__DIR__ . '/fixtures/lidl-receipt-ocr-text.txt');
$lidl = InvoiceParser::parse($lidlText);
$failures += !assertField('storeName', $lidl['storeName'], 'LIDL & Cia');
$failures += !assertField('storeLocation', $lidl['storeLocation'], 'ODEMIRA');
$failures += !assertField('storeNif', $lidl['storeNif'], '503340855');
$failures += !assertField('totalAmount', $lidl['totalAmount'], 12.19);
$failures += !assertField('invoiceDate', $lidl['invoiceDate'], '2026-09-08');
$failures += !assertField('paymentMethod', $lidl['paymentMethod'], 'Multibanco');
$failures += !assertField('items count', count($lidl['items']), 6);
if (count($lidl['items']) === 6) {
    $failures += !assertField('item[0].productName', $lidl['items'][0]['productName'], 'Limao');
    $failures += !assertField('item[0].unitPrice (EUR/kg)', $lidl['items'][0]['unitPrice'], 2.49);
    $failures += !assertField('item[0].quantity (kg)', $lidl['items'][0]['quantity'], 0.458);
    $failures += !assertField('item[0].quantityUnit', $lidl['items'][0]['quantityUnit'], 'kg');
    $failures += !assertField('item[0].vatRate', $lidl['items'][0]['vatRate'], 6.0);
    $failures += !assertField('item[1].productName', $lidl['items'][1]['productName'], 'Agua Oxigenada 10 Vol.');
    $failures += !assertField('item[1].quantityUnit', $lidl['items'][1]['quantityUnit'], 'un');
    $failures += !assertField('item[1].vatRate', $lidl['items'][1]['vatRate'], 23.0);
}

echo "\n--- Lidl multi-page receipt with per-item discounts (PDF, 3 pages) ---\n";
$discountText = file_get_contents(__DIR__ . '/fixtures/lidl-discounts-multipage-ocr-text.txt');
$discount = InvoiceParser::parse($discountText);
$failures += !assertField('storeName', $discount['storeName'], 'LIDL & Cia');
$failures += !assertField('storeLocation', $discount['storeLocation'], 'ODEMIRA');
$failures += !assertField('storeNif', $discount['storeNif'], '503340855');
$failures += !assertField('totalAmount', $discount['totalAmount'], 27.35);
$failures += !assertField('invoiceDate', $discount['invoiceDate'], '2026-04-26');
$failures += !assertField('paymentMethod', $discount['paymentMethod'], 'Multibanco');
$failures += !assertField('items count', count($discount['items']), 20);
$discountSum = round(array_sum(array_column($discount['items'], 'totalPrice')), 2);
$failures += !assertField('sum(items.totalPrice) matches printed total', $discountSum, 27.35);
if (count($discount['items']) === 20) {
    // "Bife Frango Alho Salsa" tem preço de tabela 4,12€ e dois descontos
    // (-0,83 e -0,33): o total do artigo deve refletir ambos.
    $failures += !assertField('item[0].productName', $discount['items'][0]['productName'], 'Bife Frango Alho Salsa');
    $failures += !assertField('item[0].totalPrice (após 2 descontos)', $discount['items'][0]['totalPrice'], 2.96);
    // "AGUA ... 1,78 €" (sem letra de IVA, símbolo de euro em vez disso) tem
    // de ser reconhecido como o seu próprio artigo, não fundido com o anterior.
    $failures += !assertField('item[6].productName', $discount['items'][6]['productName'], 'AGUA 0,89 x2');
    $failures += !assertField('item[6].totalPrice', $discount['items'][6]['totalPrice'], 1.6);
    $failures += !assertField('item[5].productName (MORANGO, não deve levar o desconto da AGUA)', $discount['items'][5]['productName'], 'Morango 500 G');
    $failures += !assertField('item[5].totalPrice', $discount['items'][5]['totalPrice'], 1.79);
}

echo "\n--- InvoiceParser::toDisplayCase ---\n";
$failures += !assertField('nome todo em maiúsculas', InvoiceParser::toDisplayCase('MINI BOLA BERLIM AVEL LEITE'), 'Mini Bola Berlim Avel Leite');
$failures += !assertField('preposição no meio fica em minúscula', InvoiceParser::toDisplayCase('BATATA PRONTA A COZINHAR'), 'Batata Pronta a Cozinhar');
$failures += !assertField('já tem minúsculas, não mexe', InvoiceParser::toDisplayCase('Gelado Remoinho CookieCream'), 'Gelado Remoinho CookieCream');
$failures += !assertField('nome com número/símbolo preservado', InvoiceParser::toDisplayCase('AGUA OXIGENADA 10 VOL.'), 'Agua Oxigenada 10 Vol.');

echo "\n" . ($failures === 0 ? "ALL PASSED\n" : "{$failures} FAILURE(S)\n");
exit($failures === 0 ? 0 : 1);
