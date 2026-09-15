<?php

namespace FinanceOcr\Services\Ai;

interface AiProviderInterface
{
    /** Chave estável usada nas definições e na BD (ex: "anthropic"). */
    public static function key(): string;

    /** Nome amigável para a UI de definições (ex: "Anthropic Claude"). */
    public static function label(): string;

    public static function defaultModel(): string;

    /** @return string[] Tipos MIME de imagem que a API de visão deste fornecedor aceita. */
    public static function supportedMediaTypes(): array;

    /**
     * Extrai os dados de uma fatura a partir da imagem do recibo. Usado como
     * fallback quando o parser local (regex) não confia no resultado.
     *
     * @return array{storeName:string,storeNif:string,invoiceDate:string,totalAmount:float,paymentMethod:string,items:array}|null
     *         null se a imagem não for suportada por este fornecedor.
     */
    public function extractInvoice(string $imagePath, string $mediaType): ?array;

    /**
     * Sugere uma categoria por artigo (chamada de texto, sem imagem).
     *
     * @param string[] $productNames
     * @param string[] $knownCategories
     * @return array<int,string>|null Índice em $productNames => categoria.
     */
    public function suggestCategories(array $productNames, array $knownCategories): ?array;

    /**
     * Chamada de texto mínima para confirmar que a chave/modelo funcionam,
     * sem custo de visão. Nunca lança exceção — erros vão em "message".
     *
     * @return array{ok:bool,message:string}
     */
    public function testConnection(): array;
}
