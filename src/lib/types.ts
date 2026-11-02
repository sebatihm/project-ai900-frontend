export type RoleName =
  | "BOSS"
  | "ADMIN"
  | "BRANCH_MANAGER"
  | "WAREHOUSE_HEAD"
  | "ADMIN_SUPPORT";

export type UserSummary = {
  id: string;
  name: string;
  email: string;
  role: RoleName;
  branchId: string | null;
  branchName: string | null;
  warehouseId: string | null;
  warehouseName: string | null;
};

export type LoginResponse = {
  token: string;
  tokenType: string;
  expiresAt: string;
  user: UserSummary;
};

export type ApiResponse<T> = {
  timestamp: string;
  status: number;
  message: string;
  data: T;
};

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  offset: number;
  limit: number;
};

export type CustomerSummary = {
  id: string;
  name: string;
  type: string;
  email: string;
  phone: string;
};

export type OrderSummary = {
  id: string;
  code: string;
  status: string;
  customerId: string;
  customerName: string;
  branchId: string;
  branchCode: string;
  orderDate: string;
  estimatedDeliveryDate: string;
  total: number;
};

export type CategorySummary = {
  id: string;
  name: string;
};

export type BranchSummary = {
  id: string;
  code: string;
  name: string;
  city: string;
};

export type ChatMode = "internal" | "public";

export type ChatResponse = {
  respuesta: string;
  conversationId: string | null;
  transcripcion: string | null;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  transcription?: string | null;
  voice?: boolean;
  createdAt: string;
};

export type ChatConversation = {
  conversationId: string | null;
  messages: ChatMessage[];
};

export type ProductSummary = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  price: number;
  categoryId: string;
  categoryName: string;
};

export type TicketSummary = {
  id: string;
  subject: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED";
  channel: "EMAIL" | "VOICE" | "PORTAL";
  topic: string | null;
  sentiment: string | null;
  handledBy: "AGENT" | "HUMAN";
  requiresHumanReview: boolean;
  customerId: string;
  customerName: string;
  orderId: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  createdAt: string;
};

export type TicketDetail = TicketSummary & {
  rating: number | null;
  messageCount: number;
};

export type TicketMessage = {
  id: string;
  ticketId: string;
  author: "CUSTOMER" | "EMPLOYEE" | "AGENT";
  content: string;
  action: string | null;
  sources: string | null;
  sentAt: string;
};

export type ReportSalesResponse = {
  downloadPath: string;
  filename: string;
  period: string;
  scope: string;
  orders: number;
  total: number;
  expiresInMinutes: number;
};

export type InvoiceItem = {
  description: string;
  quantity: number;
  amount: number;
};

export type SuspicionReason = {
  rule: string;
  points: number;
  detail: string;
};

export type InvoiceAnalysis = {
  invoiceId: string;
  status: "VALID" | "SUSPICIOUS" | "REJECTED";
  suspicionScore: number;
  reasons: SuspicionReason[];
  supplierId: string;
  supplierName: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  currency: string | null;
  minConfidence: number | null;
  originalFileName: string;
  sha256: string;
  container: string;
  blobPath: string;
  readUrl: string | null;
  items: InvoiceItem[];
  createdAt: string;
};

export type InvoiceSummary = {
  id: string;
  status: "VALID" | "SUSPICIOUS" | "REJECTED";
  suspicionScore: number;
  supplierName: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  total: number | null;
  currency: string | null;
  originalFileName: string;
  createdAt: string;
};

export type SupplierSummary = {
  id: string;
  name: string;
  rfc: string;
  email: string | null;
  invoiceAnalyzerUrl: string;
};

export type SupplierDetail = SupplierSummary;

export type PublicInvoiceAnalysis = Omit<
  InvoiceAnalysis,
  | "originalFileName"
  | "sha256"
  | "container"
  | "blobPath"
  | "readUrl"
  | "minConfidence"
>;
