CREATE TABLE IF NOT EXISTS users (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email          VARCHAR(255) NOT NULL,
  name           VARCHAR(255) NOT NULL DEFAULT '',
  password_hash  VARCHAR(255) NULL,
  google_id      VARCHAR(255) NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_google_id (google_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoices (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         INT UNSIGNED NOT NULL,
  store_name      VARCHAR(255) NOT NULL,
  store_location  VARCHAR(255) NOT NULL DEFAULT '',
  store_nif       VARCHAR(20)  NOT NULL DEFAULT '',
  invoice_number  VARCHAR(100) NOT NULL DEFAULT '',
  invoice_date    DATE NULL,
  total_amount    DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_method  VARCHAR(50)  NOT NULL DEFAULT 'Dinheiro',
  file_name       VARCHAR(255) NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_invoices_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  KEY idx_invoices_user_created (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoice_items (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_id    INT UNSIGNED NOT NULL,
  product_name  VARCHAR(255) NOT NULL,
  quantity      DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price    DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_price   DECIMAL(10,2) NOT NULL DEFAULT 0,
  CONSTRAINT fk_items_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  KEY idx_items_invoice (invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
