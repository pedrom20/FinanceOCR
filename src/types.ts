export interface User {
  id: string;
  name: string;
  email: string;
}

export interface InvoiceItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
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
