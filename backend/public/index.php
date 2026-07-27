<?php

require __DIR__ . '/../vendor/autoload.php';

use FinanceOcr\Router;
use FinanceOcr\Controllers\AuthController;
use FinanceOcr\Controllers\FileController;
use FinanceOcr\Controllers\HealthController;
use FinanceOcr\Controllers\InvoiceController;
use FinanceOcr\Controllers\OcrController;
use FinanceOcr\Controllers\ReportController;

$router = new Router();

$router->get('/api/health', fn () => HealthController::check());

$router->post('/api/auth/register', fn () => AuthController::register());
$router->post('/api/auth/login', fn () => AuthController::login());
$router->post('/api/auth/google', fn () => AuthController::google());
$router->get('/api/auth/me', fn () => AuthController::me());

$router->post('/api/ocr/process-invoice', fn () => OcrController::processInvoice());

$router->post('/api/invoices', fn () => InvoiceController::create());
$router->get('/api/invoices', fn () => InvoiceController::list());

$router->get('/api/files/{fileName}', fn (array $params) => FileController::download($params));

$router->get('/api/reports/pdf', fn () => ReportController::pdf());

$router->dispatch($_SERVER['REQUEST_METHOD'], $_SERVER['REQUEST_URI']);
