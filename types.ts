export interface User {
  id: number;
  name: string;
  email: string;
}

export interface Store {
  id: number;
  name: string;
  nif: string;
}

export interface InvoiceItem {
  id?: number;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface Invoice {
  id?: number;
  store_name?: string; // For UI form binding before store_id is resolved
  store_id?: number;
  nif?: string; // Extracted NIF
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  payment_method: string;
  items: InvoiceItem[];
  file_path?: string;
}

export interface DashboardStats {
  totalSpentMonth: number;
  totalSpentYear: number;
  invoiceCountMonth: number;
}

export interface ReportData {
  label: string;
  value: number;
}
