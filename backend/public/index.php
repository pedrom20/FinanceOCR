<?php

require __DIR__ . '/../vendor/autoload.php';

use FinanceOcr\Router;
use FinanceOcr\Controllers\AuthController;
use FinanceOcr\Controllers\FileController;
use FinanceOcr\Controllers\HealthController;
use FinanceOcr\Controllers\InvoiceController;
use FinanceOcr\Controllers\ItemController;
use FinanceOcr\Controllers\OcrController;
use FinanceOcr\Controllers\ReportController;
use FinanceOcr\Controllers\SettingsController;
use FinanceOcr\Controllers\StoreController;

$router = new Router();

$router->get('/api/health', fn () => HealthController::check());

$router->post('/api/auth/register', fn () => AuthController::register());
$router->post('/api/auth/login', fn () => AuthController::login());
$router->post('/api/auth/google', fn () => AuthController::google());
$router->get('/api/auth/me', fn () => AuthController::me());

$router->post('/api/ocr/process-invoice', fn () => OcrController::processInvoice());

$router->post('/api/invoices', fn () => InvoiceController::create());
$router->post('/api/invoices/categorize-missing', fn () => InvoiceController::categorizeMissing());
$router->get('/api/invoices', fn () => InvoiceController::list());
$router->get('/api/invoices/{id}', fn (array $params) => InvoiceController::show($params));
$router->delete('/api/invoices/{id}', fn (array $params) => InvoiceController::destroy($params));
$router->put('/api/invoices/{id}/store', fn (array $params) => InvoiceController::renameStore($params));
$router->put('/api/invoices/{invoiceId}/items/{itemId}', fn (array $params) => InvoiceController::updateItemCategory($params));
$router->post('/api/invoices/{id}/reprocess', fn (array $params) => InvoiceController::reprocess($params));

$router->put('/api/items/rename', fn () => ItemController::rename());
$router->put('/api/items/category', fn () => ItemController::recategorize());

$router->get('/api/stores', fn () => StoreController::list());
$router->put('/api/stores', fn () => StoreController::rename());
$router->post('/api/stores/suggest-name', fn () => StoreController::suggestName());

$router->get('/api/files/{fileName}', fn (array $params) => FileController::download($params));

$router->get('/api/reports/pdf', fn () => ReportController::pdf());
$router->get('/api/reports/filters', fn () => ReportController::filters());
$router->get('/api/reports/items', fn () => ReportController::items());

$router->get('/api/settings', fn () => SettingsController::show());
$router->post('/api/settings', fn () => SettingsController::update());
$router->post('/api/settings/test', fn () => SettingsController::test());

$router->dispatch($_SERVER['REQUEST_METHOD'], $_SERVER['REQUEST_URI']);
