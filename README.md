# FinOCR

Gestão de faturas com OCR. Frontend em React/Vite, backend em PHP + MySQL — pensado para correr em hospedagem partilhada convencional (Apache/PHP-FPM + MySQL), sem depender de nenhum serviço cloud de terceiros.

## Arquitetura

- **Frontend** (`/`): React + TypeScript + Vite + Tailwind. Fala com o backend via `fetch` (`src/api.ts`), autenticado por JWT guardado em `localStorage`.
- **Backend** (`backend/`): PHP 8.1+, MySQL via PDO, JWT próprio (`firebase/php-jwt`, apenas a biblioteca — sem dependência do serviço Firebase), OCR via `tesseract`/`pdftoppm` (linha de comandos), relatórios em PDF via DomPDF.

## Desenvolvimento local

**Pré-requisitos:** Node.js, PHP 8.1+, Composer, MySQL, e os binários `tesseract` (com o pacote de idioma `tesseract-ocr-por`) e `poppler-utils` (`pdftoppm`) instalados no sistema.

1. Backend:
   ```
   cd backend
   composer install
   cp .env.example .env   # preencher DB_*, JWT_SECRET, GOOGLE_CLIENT_ID
   mysql -u root -p < schema.sql
   php -S localhost:8080 -t public
   ```
2. Frontend (noutro terminal, na raiz do projeto):
   ```
   npm install
   cp .env.example .env.local   # opcional: VITE_GOOGLE_CLIENT_ID para ativar "Sign in with Google"
   npm run dev
   ```
   O proxy do Vite (`vite.config.ts`) encaminha `/api/*` para `http://localhost:8080`.

## Deploy em hospedagem partilhada

1. **Frontend**: `npm run build` gera `dist/`. Envia o conteúdo de `dist/` para a pasta pública do domínio (ex: `public_html/`).
2. **Backend**: envia o conteúdo de `backend/` (incluindo `vendor/`, gerado localmente com `composer install --no-dev` ou diretamente no host via SSH) para uma subpasta (ex: `public_html/api/`), com o document root/rewrite a apontar para `backend/public`. Cria o ficheiro `.env` a partir de `.env.example` com as credenciais reais da base de dados. Importa `schema.sql` (ex: via phpMyAdmin).
3. Confirma que o host tem os binários `tesseract-ocr-por` e `poppler-utils` disponíveis (ou instala-os via SSH, se o plano permitir).
4. Se o backend ficar num subdomínio diferente do frontend (em vez de uma subpasta do mesmo domínio), define `VITE_API_BASE_URL` no ambiente de build do frontend antes do `npm run build`.
5. Para ativar "Sign in with Google", define `VITE_GOOGLE_CLIENT_ID` no build do frontend com o mesmo Client ID configurado em `GOOGLE_CLIENT_ID` no `.env` do backend. Sem esta variável, o botão simplesmente não aparece e só o login por email/password fica disponível.

## Estrutura do frontend

```
index.html / index.tsx / App.tsx   -- entrypoint e routing (HashRouter)
src/api.ts                          -- fetch helper com Authorization: Bearer <token>
src/auth/AuthContext.tsx            -- estado de sessão (login/registo/logout)
src/pages/                          -- Dashboard, InvoiceList, InvoiceUpload, Reports, AuthPage
src/components/                     -- Sidebar, MobileNav, GoogleSignInButton
```
