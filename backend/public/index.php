<?php

require __DIR__ . '/../vendor/autoload.php';

use FinanceOcr\Router;
use FinanceOcr\Controllers\AuthController;
use FinanceOcr\Controllers\FileController;
use FinanceOcr\Controllers\HealthController;
use FinanceOcr\Controllers\InvoiceController;
use FinanceOcr\Controllers\OcrController;
use FinanceOcr\Controllers\ReportController;
use FinanceOcr\Controllers\SettingsController;

$router = new Router();

$router->get('/api/health', fn () => HealthController::check());

$router->post('/api/auth/register', fn () => AuthController::register());
$router->post('/api/auth/login', fn () => AuthController::login());
$router->post('/api/auth/google', fn () => AuthController::google());
$router->get('/api/auth/me', fn () => AuthController::me());

$router->post('/api/ocr/process-invoice', fn () => OcrController::processInvoice());

$router->post('/api/invoices', fn () => InvoiceController::create());
$router->get('/api/invoices', fn () => InvoiceController::list());
$router->get('/api/invoices/{id}', fn (array $params) => InvoiceController::show($params));
$router->delete('/api/invoices/{id}', fn (array $params) => InvoiceController::destroy($params));

$router->get('/api/files/{fileName}', fn (array $params) => FileController::download($params));

$router->get('/api/reports/pdf', fn () => ReportController::pdf());
$router->get('/api/reports/filters', fn () => ReportController::filters());
$router->get('/api/reports/items', fn () => ReportController::items());

$router->get('/api/settings', fn () => SettingsController::show());
$router->post('/api/settings', fn () => SettingsController::update());

$router->dispatch($_SERVER['REQUEST_METHOD'], $_SERVER['REQUEST_URI']);
