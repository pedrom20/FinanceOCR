<?php

namespace FinanceOcr\Controllers;

use FinanceOcr\Support\Response;

class HealthController
{
    public static function check(): void
    {
        Response::json(['status' => 'ok']);
    }
}
