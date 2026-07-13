export interface User {
  uid: string;
  name: string;
  email: string;
  createdAt: any;
}

export interface InvoiceItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Invoice {
  id?: string;
  userId: string;
  storeName: string;
  storeNif: string;
  invoiceNumber: string;
  invoiceDate: string;
  totalAmount: number;
  paymentMethod: string;
  fileName?: string;
  createdAt: any;
  items?: InvoiceItem[];
}
