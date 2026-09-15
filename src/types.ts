export interface User {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
}

export interface InvoiceItem {
  productName: string;
  quantity: number;
  quantityUnit?: string;
  unitPrice: number;
  totalPrice: number;
  vatRate?: number | null;
  category?: string;
}

// Forma devolvida por InvoiceRepository::mapRow() (backend/src/Repositories/InvoiceRepository.php)
export interface Invoice {
  id: string;
  storeName: string;
  storeLocation?: string;
  storeNif: string;
  invoiceNumber: string;
  invoiceDate: string;
  totalAmount: number;
  paymentMethod: string;
  fileName?: string | null;
  createdAt: string;
  items?: InvoiceItem[];
}
