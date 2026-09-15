<?php

namespace FinanceOcr\Services;

use FinanceOcr\Config;

/**
 * Shells out to the system `pdftoppm` (poppler-utils) and `tesseract` CLI
 * binaries. No tesseract.js-style runtime download of language data: the
 * `por` language pack is installed as a system package (tesseract-ocr-por),
 * or, if TESSDATA_DIR is configured, read from a bundled .traineddata file.
 */
class OcrService
{
    /**
     * @return string[] Um PNG por página, em ordem. `-singlefile` (usado
     *         antes) força só a primeira página a sair — faturas Lidl com
     *         muitos artigos costumam vir em 2-3 páginas, com o total, o
     *         método de pagamento e a tabela de IVA só na última.
     */
    public static function convertPdfToImages(string $pdfPath): array
    {
        $outputPrefix = $pdfPath . '-page';
        $cmd = sprintf(
            'pdftoppm -png -r 300 %s %s 2>&1',
            escapeshellarg($pdfPath),
            escapeshellarg($outputPrefix)
        );
        exec($cmd, $output, $exitCode);
        if ($exitCode !== 0) {
            throw new \RuntimeException('Falha ao converter PDF: ' . implode("\n", $output));
        }

        $pages = glob($outputPrefix . '-*.png') ?: [];
        sort($pages, SORT_NATURAL);
        if (empty($pages)) {
            throw new \RuntimeException('Conversão do PDF não produziu nenhuma página');
        }
        return $pages;
    }

    /** OCR de várias páginas, concatenado por ordem — para o InvoiceParser ver o documento inteiro. */
    public static function recognizeAll(array $imagePaths): string
    {
        return implode("\n\n", array_map([self::class, 'recognize'], $imagePaths));
    }

    public static function recognize(string $imagePath): string
    {
        $outputBase = $imagePath . '-ocr-' . uniqid();
        $tessdataDir = Config::tessdataDir();
        $langArg = $tessdataDir ? sprintf('--tessdata-dir %s', escapeshellarg($tessdataDir)) : '';

        $cmd = sprintf(
            'tesseract %s %s -l por %s 2>&1',
            escapeshellarg($imagePath),
            escapeshellarg($outputBase),
            $langArg
        );
        exec($cmd, $output, $exitCode);

        $textFile = $outputBase . '.txt';
        if ($exitCode !== 0 || !file_exists($textFile)) {
            throw new \RuntimeException('Falha ao executar OCR: ' . implode("\n", $output));
        }

        $text = (string) file_get_contents($textFile);
        @unlink($textFile);
        return $text;
    }
}
